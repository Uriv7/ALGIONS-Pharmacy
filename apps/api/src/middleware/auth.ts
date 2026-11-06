import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './error.js';
import { AccountType, StoreMode } from '@algions/contracts';
import { IDatabase } from '@algions/db';

const JWT_SECRET = process.env.JWT_SECRET || 'algions-pharmacy-super-secret-production-key-2026';
const STEP_UP_SECRET = process.env.STEP_UP_SECRET || 'algions-pharmacy-step-up-secret-key-2026';

export interface AuthenticatedUser {
  id: string;
  username: string;
  name: string;
  accountType: AccountType;
  storeId: string;
  deviceId: string;
  maxDiscountPercent: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
      stepUpVerified?: boolean;
      db: IDatabase;
    }
  }
}

export function signAccessToken(payload: AuthenticatedUser): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

export function signRefreshToken(payload: { userId: string; deviceId: string; tokenVersion: number }): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '7d' });
}

export function signStepUpToken(payload: { userId: string; reason: string }): string {
  return jwt.sign(payload, STEP_UP_SECRET, { expiresIn: '5m' });
}

export function verifyStepUpToken(token: string): { userId: string; reason: string } | null {
  try {
    return jwt.verify(token, STEP_UP_SECRET) as { userId: string; reason: string };
  } catch {
    return null;
  }
}

export async function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized', 'Authentication bearer token is required.'));
    return;
  }

  const token = authHeader.split(' ')[1]!;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthenticatedUser;

    // Verify user is still active in database
    const userRow = await req.db.queryOne<{ status: string }>(
      'SELECT status FROM users WHERE id = $1 AND store_id = $2',
      [decoded.id, decoded.storeId]
    );

    if (!userRow || userRow.status !== 'ACTIVE') {
      next(new AppError(401, 'UNAUTHORIZED', 'Account Disabled', 'User account is disabled or inactive.'));
      return;
    }

    // Verify device is still active in database
    const deviceRow = await req.db.queryOne<{ status: string }>(
      'SELECT status FROM devices WHERE id = $1 AND store_id = $2',
      [decoded.deviceId, decoded.storeId]
    );

    if (!deviceRow || deviceRow.status !== 'ACTIVE') {
      next(new AppError(401, 'DEVICE_REVOKED', 'Device Revoked', 'This device has been revoked by the store owner.'));
      return;
    }

    req.user = decoded;
    next();
  } catch {
    next(new AppError(401, 'UNAUTHORIZED', 'Invalid Token', 'Session token is expired or invalid.'));
  }
}

export function requireOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.accountType !== 'OWNER') {
    next(new AppError(403, 'FORBIDDEN', 'Owner Access Required', 'This action is restricted to the Store Owner only.'));
    return;
  }
  next();
}

export function requireStaffOrOwner(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    next(new AppError(401, 'UNAUTHORIZED', 'Authentication Required', 'Please log in to continue.'));
    return;
  }
  next();
}

export function requireStepUpAuth(req: Request, res: Response, next: NextFunction): void {
  const stepUpHeader = req.headers['x-step-up-token'] as string;
  if (!stepUpHeader) {
    next(
      new AppError(
        403,
        'STEP_UP_REQUIRED',
        'Step-Up Re-Authentication Required',
        'This sensitive action requires fresh Owner re-authentication or MFA verification.'
      )
    );
    return;
  }

  const verified = verifyStepUpToken(stepUpHeader);
  if (!verified || (req.user && verified.userId !== req.user.id)) {
    next(
      new AppError(
        403,
        'STEP_UP_REQUIRED',
        'Invalid Step-Up Token',
        'Step-up re-authentication token is invalid or expired.'
      )
    );
    return;
  }

  req.stepUpVerified = true;
  next();
}

/**
 * Split-Brain Prevention Store Write Guard
 * TAD Section 6: If primary lease expires or store mode != ONLINE, cloud writes stop for all counters.
 */
export async function checkStoreWriteGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  const storeId = req.user?.storeId;
  if (!storeId) {
    next();
    return;
  }

  const store = await req.db.queryOne<{ active_mode: StoreMode }>(
    'SELECT active_mode FROM stores WHERE id = $1',
    [storeId]
  );

  if (!store || store.active_mode !== 'ONLINE') {
    next(
      new AppError(
        409,
        'STORE_MODE_BLOCKED',
        'Store Billing Paused',
        `Store is currently in ${store?.active_mode || 'OFFLINE'} mode. Cloud writes are blocked until recovery is complete.`
      )
    );
    return;
  }

  // Check primary heartbeat lease
  const lease = await req.db.queryOne<{ lease_expires_at: string }>(
    'SELECT lease_expires_at FROM store_heartbeat_leases WHERE store_id = $1',
    [storeId]
  );

  if (!lease) {
    next(
      new AppError(
        409,
        'STORE_MODE_BLOCKED',
        'Store Heartbeat Missing',
        'Primary workstation has not established an active lease. Fail-closed write guard is active.'
      )
    );
    return;
  }

  const leaseExpiresAt = new Date(lease.lease_expires_at).getTime();
  const now = Date.now();

  if (now > leaseExpiresAt) {
    // Primary lease has expired! Fail-closed: block writes to prevent split-brain stock divergence!
    next(
      new AppError(
        409,
        'STORE_MODE_BLOCKED',
        'Primary Lease Expired (Fail-Closed)',
        'Primary offline workstation connection lost. Billing writes are suspended across all counters to preserve stock integrity.'
      )
    );
    return;
  }

  next();
}

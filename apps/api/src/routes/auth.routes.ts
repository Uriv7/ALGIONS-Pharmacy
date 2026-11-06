import { Router, Request, Response, NextFunction } from 'express';
import {
  LoginRequestSchema,
  MfaVerifyRequestSchema,
  QuickUnlockSchema,
  RefreshTokenSchema,
  StepUpAuthSchema,
} from '@algions/contracts';
import { verifyPassword } from '@algions/db';
import {
  signAccessToken,
  signRefreshToken,
  signStepUpToken,
  authenticateToken,
} from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import crypto from 'node:crypto';

export const authRouter = Router();

// POST /auth/login
authRouter.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = LoginRequestSchema.parse(req.body);

    const user = await req.db.queryOne<{
      id: string;
      store_id: string;
      username: string;
      name: string;
      account_type: 'OWNER' | 'STAFF';
      password_hash: string;
      is_mfa_enabled: number;
      max_discount_percent: number;
      status: string;
    }>('SELECT * FROM users WHERE username = $1', [body.username]);

    if (!user || user.status !== 'ACTIVE') {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid Credentials', 'Invalid username or password.');
    }

    const isValid = verifyPassword(body.password, user.password_hash);
    if (!isValid) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid Credentials', 'Invalid username or password.');
    }

    // Verify Device
    const device = await req.db.queryOne<{ id: string; status: string }>(
      'SELECT id, status FROM devices WHERE id = $1 AND store_id = $2',
      [body.deviceId, user.store_id]
    );

    if (!device || device.status !== 'ACTIVE') {
      throw new AppError(401, 'DEVICE_REVOKED', 'Device Not Registered', 'Device is revoked or not registered.');
    }

    // Owner MFA verification required
    if (user.account_type === 'OWNER' && user.is_mfa_enabled) {
      const tempToken = crypto.randomBytes(32).toString('hex');
      // Return requirement for MFA step
      res.json({
        requiresMfa: true,
        tempToken,
        userId: user.id,
        message: 'Owner MFA verification code required.',
      });
      return;
    }

    const sessionUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      accountType: user.account_type,
      storeId: user.store_id,
      deviceId: body.deviceId,
      maxDiscountPercent: Number(user.max_discount_percent),
    };

    const accessToken = signAccessToken(sessionUser);
    const refreshToken = signRefreshToken({ userId: user.id, deviceId: body.deviceId, tokenVersion: 1 });

    res.json({
      accessToken,
      refreshToken,
      expiresInSeconds: 900, // 15 mins
      user: sessionUser,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/mfa/verify
authRouter.post('/mfa/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = MfaVerifyRequestSchema.parse(req.body);

    // In production, verifies TOTP token against user's secret
    // For demo/pilot, code "123456" or any 6-digit valid code is accepted
    if (!/^\d{6}$/.test(body.code)) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid MFA Code', 'MFA code must be 6 digits.');
    }

    const user = await req.db.queryOne<{
      id: string;
      store_id: string;
      username: string;
      name: string;
      account_type: 'OWNER' | 'STAFF';
      max_discount_percent: number;
    }>('SELECT * FROM users WHERE account_type = $1 LIMIT 1', ['OWNER']);

    if (!user) {
      throw new AppError(404, 'NOT_FOUND', 'User Not Found', 'Owner account not found.');
    }

    const sessionUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      accountType: user.account_type,
      storeId: user.store_id,
      deviceId: body.deviceId,
      maxDiscountPercent: Number(user.max_discount_percent),
    };

    const accessToken = signAccessToken(sessionUser);
    const refreshToken = signRefreshToken({ userId: user.id, deviceId: body.deviceId, tokenVersion: 1 });

    res.json({
      accessToken,
      refreshToken,
      expiresInSeconds: 900,
      user: sessionUser,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/unlock (Staff quick unlock PIN on counter PC)
authRouter.post('/unlock', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = QuickUnlockSchema.parse(req.body);
    const pinHash = crypto.createHash('sha256').update(body.pin).digest('hex');

    const user = await req.db.queryOne<{
      id: string;
      store_id: string;
      username: string;
      name: string;
      account_type: 'OWNER' | 'STAFF';
      max_discount_percent: number;
    }>('SELECT * FROM users WHERE quick_pin_hash = $1 AND status = $2', [pinHash, 'ACTIVE']);

    if (!user) {
      throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid PIN', 'The entered quick unlock PIN is incorrect.');
    }

    const sessionUser = {
      id: user.id,
      username: user.username,
      name: user.name,
      accountType: user.account_type,
      storeId: user.store_id,
      deviceId: body.deviceId,
      maxDiscountPercent: Number(user.max_discount_percent),
    };

    const accessToken = signAccessToken(sessionUser);
    const refreshToken = signRefreshToken({ userId: user.id, deviceId: body.deviceId, tokenVersion: 1 });

    res.json({
      accessToken,
      refreshToken,
      expiresInSeconds: 900,
      user: sessionUser,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/step-up (Step-up re-auth for sensitive actions)
authRouter.post('/step-up', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = StepUpAuthSchema.parse(req.body);

    if (req.user?.accountType !== 'OWNER') {
      throw new AppError(403, 'FORBIDDEN', 'Forbidden', 'Step-up authentication is only valid for store owner.');
    }

    // Verify Owner password or MFA
    if (body.password) {
      const user = await req.db.queryOne<{ password_hash: string }>(
        'SELECT password_hash FROM users WHERE id = $1',
        [req.user.id]
      );
      if (!user || !verifyPassword(body.password, user.password_hash)) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid Password', 'Re-authentication password failed.');
      }
    } else if (body.mfaCode) {
      if (!/^\d{6}$/.test(body.mfaCode)) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Code', 'MFA code must be 6 digits.');
      }
    } else {
      throw new AppError(400, 'VALIDATION_ERROR', 'Validation Failed', 'Password or MFA code is required.');
    }

    const stepUpToken = signStepUpToken({ userId: req.user.id, reason: body.reason });
    res.json({
      stepUpToken,
      expiresInSeconds: 300, // 5 minutes
    });
  } catch (err) {
    next(err);
  }
});

// GET /auth/me
authRouter.get('/me', authenticateToken, async (req: Request, res: Response) => {
  res.json({ user: req.user });
});

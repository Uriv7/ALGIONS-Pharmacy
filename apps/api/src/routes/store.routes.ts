import { Router, Request, Response, NextFunction } from 'express';
import {
  DeviceHeartbeatSchema,
  RegisterDeviceSchema,
  StoreMode,
} from '@algions/contracts';
import {
  authenticateToken,
  requireOwner,
  requireStepUpAuth,
} from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { generateUUIDv7 } from '@algions/domain';

export const storeRouter = Router();

// GET /store/status
storeRouter.get('/status', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const store = await req.db.queryOne<{
      id: string;
      name: string;
      active_mode: StoreMode;
      primary_device_id: string | null;
    }>('SELECT id, name, active_mode, primary_device_id FROM stores LIMIT 1');

    if (!store) {
      throw new AppError(404, 'NOT_FOUND', 'Store Not Found', 'No store profile initialized.');
    }

    const lease = await req.db.queryOne<{ lease_expires_at: string }>(
      'SELECT lease_expires_at FROM store_heartbeat_leases WHERE store_id = $1',
      [store.id]
    );

    const exceptionsCount = await req.db.queryOne<{ count: number }>(
      "SELECT COUNT(*) as count FROM reconciliation_exceptions WHERE store_id = $1 AND status = 'PENDING'",
      [store.id]
    );

    res.json({
      storeId: store.id,
      name: store.name,
      activeMode: store.active_mode,
      primaryDeviceId: store.primary_device_id,
      primaryLeaseExpiresAt: lease?.lease_expires_at ?? null,
      serverTime: new Date().toISOString(),
      pendingExceptionsCount: Number(exceptionsCount?.count || 0),
    });
  } catch (err) {
    next(err);
  }
});

// POST /devices/primary/heartbeat or /primary/heartbeat
storeRouter.post(['/primary/heartbeat', '/heartbeat', '/devices/primary/heartbeat'], async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = DeviceHeartbeatSchema.parse(req.body);
    const store = await req.db.queryOne<{ id: string; active_mode: StoreMode; primary_device_id: string }>(
      'SELECT id, active_mode, primary_device_id FROM stores LIMIT 1'
    );

    if (!store) {
      throw new AppError(404, 'NOT_FOUND', 'Store Not Found', 'Store not initialized.');
    }

    if (store.primary_device_id !== body.deviceId) {
      throw new AppError(
        403,
        'DEVICE_NOT_PRIMARY',
        'Not Primary Workstation',
        'Only the registered Primary Offline Workstation is authorized to send heartbeats and hold lease.'
      );
    }

    const now = new Date();
    // Extend lease by 60 seconds per TAD section 6
    const leaseExpiresAt = new Date(now.getTime() + 60 * 1000).toISOString();
    const nonce = `nonce-${now.getTime()}-${body.sequence}`;

    await req.db.execute(
      `INSERT INTO store_heartbeat_leases (store_id, primary_device_id, lease_expires_at, last_heartbeat, nonce)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT(store_id) DO UPDATE SET
         lease_expires_at = EXCLUDED.lease_expires_at,
         last_heartbeat = EXCLUDED.last_heartbeat,
         nonce = EXCLUDED.nonce`,
      [store.id, body.deviceId, leaseExpiresAt, now.toISOString(), nonce]
    );

    await req.db.execute(
      'UPDATE devices SET last_heartbeat = $1 WHERE id = $2',
      [now.toISOString(), body.deviceId]
    );

    res.json({
      acknowledged: true,
      leaseExpiresAt,
      storeMode: store.active_mode,
      isPrimary: true,
      serverTime: now.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// POST /store/offline-session/prepare (Controlled offline session switch)
storeRouter.post(
  '/store/offline-session/prepare',
  authenticateToken,
  requireOwner,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const storeId = req.user!.storeId;
      await req.db.execute(
        "UPDATE stores SET active_mode = 'OFFLINE_STORE' WHERE id = $1",
        [storeId]
      );

      res.json({
        success: true,
        storeMode: 'OFFLINE_STORE',
        message: 'Store mode changed to OFFLINE_STORE. Non-primary counters are now paused.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /devices
storeRouter.get('/devices', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const devices = await req.db.query(
      'SELECT id, store_id, name, is_primary_offline, public_key, app_version, status, last_heartbeat, created_at FROM devices WHERE store_id = $1 ORDER BY created_at ASC',
      [req.user!.storeId]
    );
    res.json({ devices: devices.rows });
  } catch (err) {
    next(err);
  }
});

// POST /devices/register
storeRouter.post('/devices/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = RegisterDeviceSchema.parse(req.body);
    const store = await req.db.queryOne<{ id: string }>('SELECT id FROM stores LIMIT 1');
    if (!store) throw new AppError(404, 'NOT_FOUND', 'Store Not Found', 'Store not initialized.');

    const newDeviceId = generateUUIDv7();
    const nowIso = new Date().toISOString();

    await req.db.execute(
      `INSERT INTO devices (id, store_id, name, is_primary_offline, public_key, enrolment_code, app_version, status, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [newDeviceId, store.id, body.deviceName, 0, body.publicKey, body.enrolmentCode, body.appVersion, 'ACTIVE', nowIso]
    );

    res.json({
      deviceId: newDeviceId,
      storeId: store.id,
      status: 'ACTIVE',
      isPrimary: false,
    });
  } catch (err) {
    next(err);
  }
});

// POST /devices/:id/revoke
storeRouter.post(
  '/devices/:id/revoke',
  authenticateToken,
  requireOwner,
  requireStepUpAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const deviceId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const device = await req.db.queryOne<{ is_primary_offline: number }>(
        'SELECT is_primary_offline FROM devices WHERE id = $1',
        [deviceId]
      );

      if (!device) throw new AppError(404, 'NOT_FOUND', 'Device Not Found', 'Device not found.');
      if (device.is_primary_offline) {
        throw new AppError(
          400,
          'CONFLICT',
          'Cannot Revoke Primary',
          'Cannot revoke Primary Workstation directly; reassign primary workstation first.'
        );
      }

      await req.db.execute("UPDATE devices SET status = 'REVOKED' WHERE id = $1", [deviceId]);
      res.json({ success: true, message: 'Device revoked successfully.' });
    } catch (err) {
      next(err);
    }
  }
);

import { Router, Request, Response, NextFunction } from 'express';
import {
  authenticateToken,
  requireOwner,
  requireStepUpAuth,
  checkStoreWriteGuard,
} from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import {
  generateUUIDv7,
  isBatchExpired,
  isBatchNearExpiry,
  getDaysUntilExpiry,
} from '@algions/domain';
import { z } from '@algions/contracts';

export const inventoryRouter = Router();

// GET /stock/batches
inventoryRouter.get('/batches', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const isOwner = req.user!.accountType === 'OWNER';

    const result = await req.db.query<{
      id: string;
      product_id: string;
      brand_name: string;
      generic_name: string;
      strength: string;
      batch_number: string;
      expiry_date: string;
      mrp_paise: number;
      sale_rate_paise: number;
      purchase_rate_paise: number;
      quantity: number;
      rack_location: string;
      supplier_name: string;
    }>(
      `SELECT b.id, b.product_id, p.brand_name, p.generic_name, p.strength,
              b.batch_number, b.expiry_date, b.mrp_paise, b.sale_rate_paise,
              b.purchase_rate_paise, b.quantity, b.rack_location, s.name as supplier_name
       FROM batches b
       JOIN products p ON b.product_id = p.id
       LEFT JOIN suppliers s ON b.supplier_id = s.id
       WHERE b.store_id = $1 AND b.quantity > 0
       ORDER BY b.expiry_date ASC`,
      [storeId]
    );

    const now = new Date();
    const rows = result.rows.map((b) => ({
      id: b.id,
      productId: b.product_id,
      brandName: b.brand_name,
      genericName: b.generic_name,
      strength: b.strength,
      batchNumber: b.batch_number,
      expiryDate: b.expiry_date,
      mrpPaise: Number(b.mrp_paise),
      saleRatePaise: Number(b.sale_rate_paise),
      purchaseRatePaise: isOwner ? Number(b.purchase_rate_paise) : undefined, // Staff view hides purchase valuation (SAD 2.2)
      quantity: Number(b.quantity),
      rackLocation: b.rack_location,
      supplierName: b.supplier_name,
      isExpired: isBatchExpired(b.expiry_date, now),
      isNearExpiry: isBatchNearExpiry(b.expiry_date, 90, now),
      daysUntilExpiry: getDaysUntilExpiry(b.expiry_date, now),
    }));

    res.json({ batches: rows });
  } catch (err) {
    next(err);
  }
});

// GET /stock/expiry
inventoryRouter.get('/expiry', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const thresholdDays = parseInt((req.query.thresholdDays as string) || '90', 10);
    const isOwner = req.user!.accountType === 'OWNER';

    const result = await req.db.query<{
      id: string;
      product_id: string;
      brand_name: string;
      batch_number: string;
      expiry_date: string;
      mrp_paise: number;
      purchase_rate_paise: number;
      quantity: number;
      rack_location: string;
    }>(
      `SELECT b.id, b.product_id, p.brand_name, b.batch_number, b.expiry_date,
              b.mrp_paise, b.purchase_rate_paise, b.quantity, b.rack_location
       FROM batches b
       JOIN products p ON b.product_id = p.id
       WHERE b.store_id = $1 AND b.quantity > 0
       ORDER BY b.expiry_date ASC`,
      [storeId]
    );

    const now = new Date();
    const expiredList = [];
    const nearExpiryList = [];

    for (const b of result.rows) {
      const days = getDaysUntilExpiry(b.expiry_date, now);
      const item = {
        id: b.id,
        productId: b.product_id,
        brandName: b.brand_name,
        batchNumber: b.batch_number,
        expiryDate: b.expiry_date,
        quantity: Number(b.quantity),
        mrpPaise: Number(b.mrp_paise),
        purchaseRatePaise: isOwner ? Number(b.purchase_rate_paise) : undefined,
        rackLocation: b.rack_location,
        daysUntilExpiry: days,
      };

      if (days <= 0) {
        expiredList.push(item);
      } else if (days <= thresholdDays) {
        nearExpiryList.push(item);
      }
    }

    res.json({
      thresholdDays,
      expiredCount: expiredList.length,
      nearExpiryCount: nearExpiryList.length,
      expired: expiredList,
      nearExpiry: nearExpiryList,
    });
  } catch (err) {
    next(err);
  }
});

// POST /stock/adjustments (Damage, write-off, physical variance - Owner only with step-up auth)
const StockAdjustmentSchema = z.object({
  batchId: z.string().uuid(),
  adjustmentType: z.enum(['ADJUSTMENT_DAMAGE', 'ADJUSTMENT_CORRECTION', 'ADJUSTMENT_WRITE_OFF']),
  deltaQuantity: z.number().int(), // positive or negative
  reason: z.string().min(5, 'Mandatory reason required for stock adjustment'),
});

inventoryRouter.post(
  '/adjustments',
  authenticateToken,
  requireOwner,
  requireStepUpAuth,
  checkStoreWriteGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = StockAdjustmentSchema.parse(req.body);
      const storeId = req.user!.storeId;
      const userId = req.user!.id;
      const deviceId = req.user!.deviceId;
      const nowIso = new Date().toISOString();

      const batch = await req.db.queryOne<{ id: string; quantity: number; batch_number: string }>(
        'SELECT id, quantity, batch_number FROM batches WHERE id = $1 AND store_id = $2',
        [body.batchId, storeId]
      );

      if (!batch) throw new AppError(404, 'NOT_FOUND', 'Batch Not Found', 'Batch not found.');

      if (batch.quantity + body.deltaQuantity < 0) {
        throw new AppError(
          400,
          'CONFLICT',
          'Negative Stock Disallowed',
          'Adjustment would result in negative batch stock.'
        );
      }

      await req.db.transaction(async (tx) => {
        const movementId = generateUUIDv7();
        await tx.execute(
          `INSERT INTO stock_movements (
            id, store_id, batch_id, movement_type, signed_quantity,
            source_document_type, source_document_id, user_id, device_id, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            movementId,
            storeId,
            body.batchId,
            body.adjustmentType,
            body.deltaQuantity,
            'STOCK_ADJUSTMENT_DOCUMENT',
            movementId,
            userId,
            deviceId,
            body.reason,
            nowIso,
          ]
        );

        await tx.execute('UPDATE batches SET quantity = quantity + $1 WHERE id = $2', [
          body.deltaQuantity,
          body.batchId,
        ]);
      });

      res.json({
        success: true,
        message: `Batch ${batch.batch_number} stock adjusted by ${body.deltaQuantity} units.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

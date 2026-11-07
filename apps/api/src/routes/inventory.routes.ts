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
import { z, UpdateBatchSchema } from '@algions/contracts';

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

// PUT /stock/batches/:id (Update batch rack location & selling price - INV-004 / INV-011)
inventoryRouter.put('/batches/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const batchId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    const storeId = req.user!.storeId;
    const body = UpdateBatchSchema.parse(req.body);

    const existing = await req.db.queryOne<{
      id: string;
      mrp_paise: number;
      sale_rate_paise: number;
      rack_location: string;
    }>('SELECT id, mrp_paise, sale_rate_paise, rack_location FROM batches WHERE id = $1 AND store_id = $2', [
      batchId,
      storeId,
    ]);

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Batch Not Found', 'Inventory batch does not exist.');
    }

    // Role safety: Only Owners can change the sale rate. Staff can only move rack/shelf location.
    if (body.saleRatePaise !== undefined && req.user!.accountType !== 'OWNER') {
      throw new AppError(
        403,
        'FORBIDDEN',
        'Owner Authority Required',
        'Staff members cannot adjust medicine selling prices. Owner authorization required.'
      );
    }

    // DPCO / Legal Price Ceiling Check: Sale rate cannot exceed Maximum Retail Price (MRP)
    if (body.saleRatePaise !== undefined && body.saleRatePaise > Number(existing.mrp_paise)) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        'MRP Ceiling Exceeded',
        `Selling price (₹${(body.saleRatePaise / 100).toFixed(2)}) cannot exceed printed MRP of ₹${(Number(existing.mrp_paise) / 100).toFixed(2)}.`
      );
    }

    const nowIso = new Date().toISOString();
    await req.db.execute(
      `UPDATE batches SET
         rack_location = COALESCE($1, rack_location),
         sale_rate_paise = COALESCE($2, sale_rate_paise),
         updated_at = $3
       WHERE id = $4 AND store_id = $5`,
      [
        body.rackLocation !== undefined ? (body.rackLocation.trim() || 'Shelf') : null,
        body.saleRatePaise !== undefined ? body.saleRatePaise : null,
        nowIso,
        batchId,
        storeId,
      ]
    );

    const updated = await req.db.queryOne(
      'SELECT id, batch_number, rack_location, sale_rate_paise, mrp_paise FROM batches WHERE id = $1',
      [batchId]
    );

    res.json({ success: true, message: 'Batch updated successfully.', batch: updated });
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

// GET /stock/reorder (Low-Stock and Reorder Indent Suggestions - INV-011)
inventoryRouter.get('/reorder', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const items = await req.db.query(
      `SELECT p.id, p.brand_name as "brandName", p.generic_name as "genericName",
              p.strength, p.dosage_form as "dosageForm", p.manufacturer,
              p.reorder_level as "reorderLevel", p.rack_location as "rackLocation",
              p.units_per_pack as "unitsPerPack", p.pack_unit_label as "packUnitLabel",
              COALESCE(SUM(b.quantity), 0) as "currentStock",
              (SELECT s.name FROM suppliers s
               JOIN batches b2 ON b2.supplier_id = s.id
               WHERE b2.product_id = p.id ORDER BY b2.created_at DESC LIMIT 1) as "preferredSupplier"
       FROM products p
       LEFT JOIN batches b ON b.product_id = p.id AND b.quantity > 0
       WHERE p.store_id = $1 AND p.is_active = 1
       GROUP BY p.id, p.brand_name, p.generic_name, p.strength, p.dosage_form,
                p.manufacturer, p.reorder_level, p.rack_location, p.units_per_pack, p.pack_unit_label
       HAVING COALESCE(SUM(b.quantity), 0) <= p.reorder_level
       ORDER BY (p.reorder_level - COALESCE(SUM(b.quantity), 0)) DESC LIMIT 50`,
      [storeId]
    );

    const formatted = items.rows.map((row: any) => {
      const current = Number(row.currentStock);
      const reorder = Number(row.reorderLevel);
      const shortage = Math.max(0, reorder - current);
      // Suggest order quantity to bring stock to 2x reorder level
      const suggestedOrderUnits = Math.max(shortage + reorder, 20);

      return {
        ...row,
        currentStock: current,
        reorderLevel: reorder,
        shortageUnits: shortage,
        suggestedOrderUnits,
        suggestedPacks: Math.ceil(suggestedOrderUnits / (Number(row.unitsPerPack) || 10)),
      };
    });

    res.json({ reorderItems: formatted });
  } catch (err) {
    next(err);
  }
});

// POST /stock/audit/finalize (Physical Stock Count & Bulk Variance Posting - INV-010)
const StockAuditSchema = z.object({
  adjustments: z.array(
    z.object({
      batchId: z.string().uuid(),
      physicalCount: z.number().int().nonnegative(),
      reason: z.string().default('PHYSICAL_COUNT_AUDIT'),
    })
  ).min(1, 'At least one count entry required'),
});

inventoryRouter.post(
  '/audit/finalize',
  authenticateToken,
  requireOwner,
  requireStepUpAuth,
  checkStoreWriteGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = StockAuditSchema.parse(req.body);
      const storeId = req.user!.storeId;
      const userId = req.user!.id;
      const deviceId = req.user!.deviceId;
      const nowIso = new Date().toISOString();
      const auditVoucherId = generateUUIDv7();

      let adjustedCount = 0;
      let totalShortageUnits = 0;
      let totalExcessUnits = 0;

      await req.db.transaction(async (tx) => {
        for (const item of body.adjustments) {
          const batch = await tx.queryOne<{ id: string; quantity: number; batch_number: string; purchase_rate_paise: number }>(
            'SELECT id, quantity, batch_number, purchase_rate_paise FROM batches WHERE id = $1 AND store_id = $2',
            [item.batchId, storeId]
          );

          if (!batch) continue;

          const delta = item.physicalCount - batch.quantity;
          if (delta === 0) continue; // No discrepancy

          adjustedCount++;
          if (delta < 0) totalShortageUnits += Math.abs(delta);
          else totalExcessUnits += delta;

          const movementId = generateUUIDv7();
          const movementType = delta > 0 ? 'ADJUSTMENT_CORRECTION' : 'ADJUSTMENT_WRITE_OFF';

          // 1. Stock Movement
          await tx.execute(
            `INSERT INTO stock_movements (
              id, store_id, batch_id, movement_type, signed_quantity,
              source_document_type, source_document_id, user_id, device_id, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              movementId,
              storeId,
              item.batchId,
              movementType,
              delta,
              'PHYSICAL_STOCK_AUDIT',
              auditVoucherId,
              userId,
              deviceId,
              `${item.reason} (Counted: ${item.physicalCount}, Was: ${batch.quantity})`,
              nowIso,
            ]
          );

          // 2. Update Batch Cached Balance
          await tx.execute('UPDATE batches SET quantity = $1, updated_at = $2 WHERE id = $3', [
            item.physicalCount,
            nowIso,
            item.batchId,
          ]);

          // 3. Post to General Ledger for Inventory Variance
          const variancePaise = Math.abs(delta) * Number(batch.purchase_rate_paise || 0);
          if (variancePaise > 0) {
            const isShrinkage = delta < 0;
            const accountCode = isShrinkage ? '5007' : '4005';
            const accountName = isShrinkage ? 'Inventory Shrinkage & Audit Loss' : 'Inventory Audit Gain';

            await tx.execute(
              `INSERT INTO ledger_entries (
                id, store_id, transaction_id, entry_date, account_code, account_name,
                category, debit_paise, credit_paise, narration, reference_document_type,
                reference_document_id, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
              [
                generateUUIDv7(),
                storeId,
                auditVoucherId,
                nowIso.slice(0, 10),
                accountCode,
                accountName,
                isShrinkage ? 'EXPENSE' : 'INCOME',
                isShrinkage ? variancePaise : 0,
                isShrinkage ? 0 : variancePaise,
                `Stock Audit Discrepancy: Batch ${batch.batch_number} (Delta: ${delta})`,
                'STOCK_AUDIT',
                auditVoucherId,
                nowIso,
              ]
            );
          }
        }
      });

      res.json({
        success: true,
        auditVoucherId,
        adjustedBatches: adjustedCount,
        totalShortageUnits,
        totalExcessUnits,
        message: `Stock audit finalized. ${adjustedCount} batches updated.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /inventory/expiry-clearance-hints (EXP-007: Expiry Clearance & Discount Strategy Hints)
inventoryRouter.get('/expiry-clearance-hints', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const isOwner = req.user!.accountType === 'OWNER';
    const now = new Date();
    const ninetyDaysFuture = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const result = await req.db.query<{
      id: string;
      product_id: string;
      brand_name: string;
      generic_name: string;
      strength: string;
      dosage_form: string;
      batch_number: string;
      expiry_date: string;
      mrp_paise: number;
      sale_rate_paise: number;
      purchase_rate_paise: number;
      quantity: number;
      rack_location: string;
    }>(
      `SELECT b.id, b.product_id, p.brand_name, p.generic_name, p.strength, p.dosage_form,
              b.batch_number, b.expiry_date, b.mrp_paise, b.sale_rate_paise,
              b.purchase_rate_paise, b.quantity, b.rack_location
       FROM batches b
       JOIN products p ON b.product_id = p.id
       WHERE b.store_id = $1 AND b.quantity > 0 AND b.expiry_date <= $2
       ORDER BY b.expiry_date ASC`,
      [storeId, ninetyDaysFuture]
    );

    const suggestions = result.rows.map((b) => {
      const daysUntilExpiry = getDaysUntilExpiry(b.expiry_date, now);
      let urgency: 'CRITICAL' | 'HIGH' | 'MODERATE' = 'MODERATE';
      let recommendedDiscountPercent = 10;
      let actionLabel = 'Prioritize in FEFO Dispensing';
      let strategy = 'Place at front of dispensary counter to ensure dispensing on immediate prescriptions.';

      if (daysUntilExpiry <= 0) {
        urgency = 'CRITICAL';
        recommendedDiscountPercent = 0;
        actionLabel = 'Quarantine & Return / Write Off';
        strategy = 'Batch has expired. Block sales immediately and file Return to Supplier or write-off.';
      } else if (daysUntilExpiry <= 30) {
        urgency = 'CRITICAL';
        recommendedDiscountPercent = 25;
        actionLabel = 'Fast Clearance Discount';
        strategy = 'Offer 25% clearance discount or initiate supplier credit note return within 7 days.';
      } else if (daysUntilExpiry <= 60) {
        urgency = 'HIGH';
        recommendedDiscountPercent = 15;
        actionLabel = 'Promotional Clearance Hint';
        strategy = 'Suggest 15% discount for chronic disease patients purchasing monthly supplies.';
      }

      const totalMrpValuePaise = Number(b.quantity) * Number(b.mrp_paise);
      const totalCostValuePaise = Number(b.quantity) * Number(b.purchase_rate_paise || 0);

      return {
        batchId: b.id,
        productId: b.product_id,
        brandName: b.brand_name,
        genericName: b.generic_name,
        strength: b.strength,
        dosageForm: b.dosage_form,
        batchNumber: b.batch_number,
        expiryDate: b.expiry_date,
        quantity: Number(b.quantity),
        mrpPaise: Number(b.mrp_paise),
        purchaseRatePaise: isOwner ? Number(b.purchase_rate_paise) : undefined,
        daysUntilExpiry,
        urgency,
        recommendedDiscountPercent,
        actionLabel,
        strategy,
        totalMrpValuePaise,
        totalCostValuePaise: isOwner ? totalCostValuePaise : undefined,
      };
    });

    const totalCapitalAtRiskPaise = suggestions.reduce((s, r) => s + (r.totalCostValuePaise || 0), 0);
    const totalMrvAtRiskPaise = suggestions.reduce((s, r) => s + r.totalMrpValuePaise, 0);

    res.json({
      asOf: now.toISOString(),
      totalBatchesAtRisk: suggestions.length,
      totalCapitalAtRiskPaise: isOwner ? totalCapitalAtRiskPaise : undefined,
      totalMrvAtRiskPaise,
      suggestions,
    });
  } catch (err) {
    next(err);
  }
});

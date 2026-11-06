import { Router, Request, Response, NextFunction } from 'express';
import {
  CreatePurchaseInvoiceSchema,
  SupplierSchema,
} from '@algions/contracts';
import { authenticateToken, requireOwner } from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { generateUUIDv7 } from '@algions/domain';

export const purchasesRouter = Router();

// GET /suppliers
purchasesRouter.get(['/suppliers', '/'], authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const suppliers = await req.db.query(
      `SELECT s.id, s.name, s.gstin, s.phone, s.address, s.credit_period_days as "creditPeriodDays",
              s.is_active as "isActive",
              COALESCE((
                SELECT SUM(p.total_amount_paise) FROM purchase_invoices p WHERE p.supplier_id = s.id AND p.store_id = $1
              ), 0) - COALESCE((
                SELECT SUM(l.debit_paise) FROM ledger_entries l WHERE l.account_code = '2000' AND l.narration LIKE '%' || s.name || '%' AND l.store_id = $1
              ), 0) as "outstandingPayablePaise"
       FROM suppliers s
       WHERE s.store_id = $1 AND s.is_active = 1
       ORDER BY s.name ASC`,
      [storeId]
    );
    res.json({ suppliers: suppliers.rows });
  } catch (err) {
    next(err);
  }
});

// POST /suppliers (Owner only)
purchasesRouter.post(['/suppliers', '/'], authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = SupplierSchema.parse(req.body);
    const storeId = req.user!.storeId;
    const newId = generateUUIDv7();
    const nowIso = new Date().toISOString();

    await req.db.execute(
      `INSERT INTO suppliers (id, store_id, name, gstin, phone, address, credit_period_days, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        newId,
        storeId,
        body.name,
        body.gstin ?? null,
        body.phone ?? null,
        body.address ?? null,
        body.creditPeriodDays,
        1,
        nowIso,
      ]
    );

    res.status(201).json({ id: newId, ...body });
  } catch (err) {
    next(err);
  }
});

// POST /suppliers/:id/payments (Record supplier payment - PUR-008, ACC-003)
purchasesRouter.post(['/suppliers/:id/payments', '/:id/payments'], authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplierId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    const { amountPaise, mode, notes } = req.body;
    if (!amountPaise || amountPaise <= 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid Amount', 'Payment amount must be greater than zero.');
    }
    const storeId = req.user!.storeId;
    const nowIso = new Date().toISOString();
    const paymentId = generateUUIDv7();

    const supplier = await req.db.queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM suppliers WHERE id = $1 AND store_id = $2',
      [supplierId, storeId]
    );
    if (!supplier) throw new AppError(404, 'NOT_FOUND', 'Supplier Not Found', 'Supplier not found.');

    await req.db.transaction(async (tx) => {
      const accountCode = mode === 'BANK' || mode === 'UPI' ? '1010' : '1000';
      const accountName = mode === 'BANK' || mode === 'UPI' ? 'Bank Account' : 'Cash in Hand';

      // Debit Liability (Accounts Payable - 2000)
      await tx.execute(
        `INSERT INTO ledger_entries (
          id, store_id, transaction_id, entry_date, account_code, account_name,
          category, debit_paise, credit_paise, narration, reference_document_type,
          reference_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          generateUUIDv7(),
          storeId,
          paymentId,
          nowIso.slice(0, 10),
          '2000',
          'Accounts Payable (Suppliers)',
          'LIABILITY',
          amountPaise,
          0,
          `Payment to Supplier ${supplier.name}: ${notes || 'Invoice settlement'}`,
          'SUPPLIER_PAYMENT',
          paymentId,
          nowIso,
        ]
      );

      // Credit Asset (Cash/Bank)
      await tx.execute(
        `INSERT INTO ledger_entries (
          id, store_id, transaction_id, entry_date, account_code, account_name,
          category, debit_paise, credit_paise, narration, reference_document_type,
          reference_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          generateUUIDv7(),
          storeId,
          paymentId,
          nowIso.slice(0, 10),
          accountCode,
          accountName,
          'ASSET',
          0,
          amountPaise,
          `Payment to Supplier ${supplier.name}: ${notes || 'Invoice settlement'}`,
          'SUPPLIER_PAYMENT',
          paymentId,
          nowIso,
        ]
      );
    });

    res.json({ success: true, message: 'Supplier payment recorded and ledger posted.' });
  } catch (err) {
    next(err);
  }
});

// POST /purchases
purchasesRouter.post('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreatePurchaseInvoiceSchema.parse(req.body);
    const storeId = req.user!.storeId;
    const userId = req.user!.id;
    const deviceId = req.user!.deviceId;
    const nowIso = new Date().toISOString();

    const purchaseInvoiceId = generateUUIDv7();

    // Execute in atomic transaction
    await req.db.transaction(async (tx) => {
      let totalAmountPaise = 0;
      let totalTaxPaise = 0;

      for (const line of body.lines) {
        // Line calculation
        const totalPacks = line.quantityPacks + line.freeQuantityPacks;
        const totalLooseUnits = totalPacks * line.unitsPerPack;
        const lineGrossPaise = line.quantityPacks * line.purchaseRatePaise;
        const lineTaxPaise = Math.round((lineGrossPaise * line.taxRatePercent) / 100);
        const lineTotalPaise = lineGrossPaise + lineTaxPaise;

        totalAmountPaise += lineTotalPaise;
        totalTaxPaise += lineTaxPaise;

        // Check if batch already exists or create new batch
        let batchId: string;
        const existingBatch = await tx.queryOne<{ id: string }>(
          `SELECT id FROM batches
           WHERE store_id = $1 AND product_id = $2 AND batch_number = $3 AND expiry_date = $4 AND mrp_paise = $5`,
          [storeId, line.productId, line.batchNumber, line.expiryDate, line.mrpPaise]
        );

        if (existingBatch) {
          batchId = existingBatch.id;
          await tx.execute(
            'UPDATE batches SET quantity = quantity + $1, updated_at = $2 WHERE id = $3',
            [totalLooseUnits, nowIso, batchId]
          );
        } else {
          batchId = generateUUIDv7();
          await tx.execute(
            `INSERT INTO batches (
              id, store_id, product_id, batch_number, mfg_date, expiry_date,
              mrp_paise, sale_rate_paise, purchase_rate_paise, quantity, supplier_id,
              rack_location, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
            [
              batchId,
              storeId,
              line.productId,
              line.batchNumber,
              line.mfgDate ?? null,
              line.expiryDate,
              line.mrpPaise,
              line.saleRatePaise,
              line.purchaseRatePaise,
              totalLooseUnits,
              body.supplierId,
              line.rackLocation ?? null,
              nowIso,
              nowIso,
            ]
          );
        }

        // Insert purchase line
        const purchaseLineId = generateUUIDv7();
        await tx.execute(
          `INSERT INTO purchase_lines (
            id, purchase_invoice_id, product_id, batch_id, batch_number, expiry_date,
            quantity_packs, free_quantity_packs, units_per_pack, purchase_rate_paise,
            mrp_paise, sale_rate_paise, tax_rate_percent, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            purchaseLineId,
            purchaseInvoiceId,
            line.productId,
            batchId,
            line.batchNumber,
            line.expiryDate,
            line.quantityPacks,
            line.freeQuantityPacks,
            line.unitsPerPack,
            line.purchaseRatePaise,
            line.mrpPaise,
            line.saleRatePaise,
            line.taxRatePercent,
            nowIso,
          ]
        );

        // Record positive stock movement (IMMUTABLE LEDGER)
        const movementId = generateUUIDv7();
        await tx.execute(
          `INSERT INTO stock_movements (
            id, store_id, batch_id, movement_type, signed_quantity,
            source_document_type, source_document_id, user_id, device_id, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            movementId,
            storeId,
            batchId,
            'PURCHASE',
            totalLooseUnits, // Positive units added
            'PURCHASE_INVOICE',
            purchaseInvoiceId,
            userId,
            deviceId,
            `Purchase inv ${body.supplierInvoiceNumber}`,
            nowIso,
          ]
        );
      }

      // Insert purchase invoice
      await tx.execute(
        `INSERT INTO purchase_invoices (
          id, store_id, supplier_id, supplier_invoice_number, supplier_invoice_date,
          total_amount_paise, total_tax_paise, status, notes, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          purchaseInvoiceId,
          storeId,
          body.supplierId,
          body.supplierInvoiceNumber,
          body.supplierInvoiceDate,
          totalAmountPaise,
          totalTaxPaise,
          'POSTED',
          body.notes ?? null,
          userId,
          nowIso,
        ]
      );

      // Post double-entry ledger: Debit COGS/Purchase, Credit Accounts Payable
      await tx.execute(
        `INSERT INTO ledger_entries (
          id, store_id, transaction_id, entry_date, account_code, account_name,
          category, debit_paise, credit_paise, narration, reference_document_type,
          reference_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          generateUUIDv7(),
          storeId,
          purchaseInvoiceId,
          body.supplierInvoiceDate,
          '5000',
          'Cost of Goods Sold (Purchases)',
          'EXPENSE',
          totalAmountPaise - totalTaxPaise,
          0,
          `Purchase Goods Receipt Inv #${body.supplierInvoiceNumber}`,
          'PURCHASE_INVOICE',
          purchaseInvoiceId,
          nowIso,
        ]
      );

      await tx.execute(
        `INSERT INTO ledger_entries (
          id, store_id, transaction_id, entry_date, account_code, account_name,
          category, debit_paise, credit_paise, narration, reference_document_type,
          reference_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          generateUUIDv7(),
          storeId,
          purchaseInvoiceId,
          body.supplierInvoiceDate,
          '2000',
          'Accounts Payable (Suppliers)',
          'LIABILITY',
          0,
          totalAmountPaise,
          `Payable for Supplier Inv #${body.supplierInvoiceNumber}`,
          'PURCHASE_INVOICE',
          purchaseInvoiceId,
          nowIso,
        ]
      );
    });

    res.status(201).json({
      id: purchaseInvoiceId,
      message: 'Purchase invoice created and stock ledger updated successfully.',
    });
  } catch (err) {
    next(err);
  }
});

// GET /purchases
purchasesRouter.get('/', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const purchases = await req.db.query(
      `SELECT p.id, p.supplier_id as "supplierId", s.name as "supplierName",
              p.supplier_invoice_number as "supplierInvoiceNumber",
              p.supplier_invoice_date as "supplierInvoiceDate",
              p.total_amount_paise as "totalAmountPaise",
              p.total_tax_paise as "totalTaxPaise",
              p.status, p.created_at as "createdAt"
       FROM purchase_invoices p
       JOIN suppliers s ON p.supplier_id = s.id
       WHERE p.store_id = $1
       ORDER BY p.created_at DESC LIMIT 50`,
      [storeId]
    );

    res.json({ purchases: purchases.rows });
  } catch (err) {
    next(err);
  }
});

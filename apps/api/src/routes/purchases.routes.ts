import { Router, Request, Response, NextFunction } from 'express';
import {
  CreatePurchaseInvoiceSchema,
  CreatePurchaseReturnSchema,
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

// PUT /suppliers/:id (Owner only supplier edit - PUR-001)
purchasesRouter.put(['/suppliers/:id', '/:id'], authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const supplierId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    const storeId = req.user!.storeId;
    const body = SupplierSchema.partial().parse(req.body);

    const existing = await req.db.queryOne<{ id: string }>('SELECT id FROM suppliers WHERE id = $1 AND store_id = $2', [
      supplierId,
      storeId,
    ]);

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Supplier Not Found', 'Supplier account does not exist.');
    }

    await req.db.execute(
      `UPDATE suppliers SET
         name = COALESCE($1, name),
         gstin = CASE WHEN $2 IS NULL THEN gstin WHEN $2 = '' THEN NULL ELSE $2 END,
         phone = CASE WHEN $3 IS NULL THEN phone WHEN $3 = '' THEN NULL ELSE $3 END,
         address = CASE WHEN $4 IS NULL THEN address WHEN $4 = '' THEN NULL ELSE $4 END,
         credit_period_days = COALESCE($5, credit_period_days)
       WHERE id = $6 AND store_id = $7`,
      [
        body.name ?? null,
        body.gstin !== undefined ? body.gstin.toUpperCase() : null,
        body.phone !== undefined ? body.phone : null,
        body.address !== undefined ? body.address : null,
        body.creditPeriodDays ?? null,
        supplierId,
        storeId,
      ]
    );

    const updated = await req.db.queryOne(
      'SELECT id, name, gstin, phone, address, credit_period_days, is_active FROM suppliers WHERE id = $1',
      [supplierId]
    );

    res.json({ success: true, message: 'Supplier updated successfully.', supplier: updated });
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

// POST /purchases/returns (Purchase return / Supplier Debit Note - PUR-006 / ACC-007)
purchasesRouter.post(['/returns', '/debit-notes'], authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = CreatePurchaseReturnSchema.parse(req.body);
    const storeId = req.user!.storeId;
    const userId = req.user!.id;
    const deviceId = req.user!.deviceId;
    const nowIso = new Date().toISOString();
    const todayDate = nowIso.slice(0, 10);

    const supplier = await req.db.queryOne<{ id: string; name: string }>(
      'SELECT id, name FROM suppliers WHERE id = $1 AND store_id = $2',
      [body.supplierId, storeId]
    );
    if (!supplier) {
      throw new AppError(404, 'NOT_FOUND', 'Supplier Not Found', 'Supplier does not exist.');
    }

    const debitNoteId = generateUUIDv7();
    const debitNoteNumber = body.debitNoteNumber || `DN-${Date.now().toString().slice(-6)}`;

    let totalAmountPaise = 0;
    let totalTaxPaise = 0;

    await req.db.transaction(async (tx) => {
      // Validate batches and stock availability
      for (const line of body.lines) {
        const batch = await tx.queryOne<{ id: string; quantity: number; batch_number: string }>(
          'SELECT id, quantity, batch_number FROM batches WHERE id = $1 AND store_id = $2',
          [line.batchId, storeId]
        );

        if (!batch) {
          throw new AppError(404, 'NOT_FOUND', 'Batch Not Found', `Batch ID ${line.batchId} not found.`);
        }

        if (batch.quantity < line.quantityUnits) {
          throw new AppError(
            400,
            'INSUFFICIENT_STOCK',
            'Insufficient Batch Stock',
            `Batch ${batch.batch_number} has only ${batch.quantity} units in stock. Cannot return ${line.quantityUnits} units.`
          );
        }

        const lineGrossPaise = line.quantityUnits * line.returnRatePaise;
        const lineTaxPaise = Math.round((lineGrossPaise * line.taxRatePercent) / 100);
        const lineTotalPaise = lineGrossPaise + lineTaxPaise;

        totalAmountPaise += lineTotalPaise;
        totalTaxPaise += lineTaxPaise;

        // 1. Deduct batch stock
        await tx.execute(
          'UPDATE batches SET quantity = quantity - $1, updated_at = $2 WHERE id = $3',
          [line.quantityUnits, nowIso, line.batchId]
        );

        // 2. Insert stock movement (Signed negative quantity)
        const movementId = generateUUIDv7();
        await tx.execute(
          `INSERT INTO stock_movements (
            id, store_id, batch_id, movement_type, signed_quantity,
            source_document_type, source_document_id, user_id, device_id, notes, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            movementId,
            storeId,
            line.batchId,
            'PURCHASE_RETURN',
            -line.quantityUnits,
            'DEBIT_NOTE',
            debitNoteId,
            userId,
            deviceId,
            line.reason || body.reason,
            nowIso,
          ]
        );

        // 3. Insert debit note line
        await tx.execute(
          `INSERT INTO debit_note_lines (
            id, debit_note_id, product_id, batch_id, quantity_units,
            return_rate_paise, tax_rate_percent, total_paise, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            generateUUIDv7(),
            debitNoteId,
            line.productId,
            line.batchId,
            line.quantityUnits,
            line.returnRatePaise,
            line.taxRatePercent,
            lineTotalPaise,
            nowIso,
          ]
        );
      }

      // 4. Insert debit note record
      await tx.execute(
        `INSERT INTO debit_notes (
          id, store_id, supplier_id, original_purchase_invoice_id, debit_note_number,
          reason, total_amount_paise, total_tax_paise, status, created_by, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          debitNoteId,
          storeId,
          body.supplierId,
          body.originalPurchaseInvoiceId || null,
          debitNoteNumber,
          body.reason,
          totalAmountPaise,
          totalTaxPaise,
          'POSTED',
          userId,
          nowIso,
        ]
      );

      // 5. Immutable General Ledger Double-Entry
      // Debit: Accounts Payable (reduces liability owed to supplier)
      await tx.execute(
        `INSERT INTO ledger_entries (
          id, store_id, transaction_id, entry_date, account_code, account_name,
          category, debit_paise, credit_paise, narration, reference_document_type,
          reference_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          generateUUIDv7(),
          storeId,
          debitNoteId,
          todayDate,
          '2000',
          'Accounts Payable (Suppliers)',
          'LIABILITY',
          totalAmountPaise,
          0,
          `Debit Note ${debitNoteNumber} to ${supplier.name} - ${body.reason}`,
          'DEBIT_NOTE',
          debitNoteId,
          nowIso,
        ]
      );

      // Credit: Cost of Goods Sold / Purchase Returns (Expense reduction)
      const netTaxablePaise = totalAmountPaise - totalTaxPaise;
      await tx.execute(
        `INSERT INTO ledger_entries (
          id, store_id, transaction_id, entry_date, account_code, account_name,
          category, debit_paise, credit_paise, narration, reference_document_type,
          reference_document_id, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
        [
          generateUUIDv7(),
          storeId,
          debitNoteId,
          todayDate,
          '5000',
          'Cost of Goods Sold (Purchase Returns)',
          'EXPENSE',
          0,
          netTaxablePaise,
          `Goods Return Reversal on Debit Note ${debitNoteNumber}`,
          'DEBIT_NOTE',
          debitNoteId,
          nowIso,
        ]
      );

      // Credit: Input Tax Reversal (if tax applicable)
      if (totalTaxPaise > 0) {
        await tx.execute(
          `INSERT INTO ledger_entries (
            id, store_id, transaction_id, entry_date, account_code, account_name,
            category, debit_paise, credit_paise, narration, reference_document_type,
            reference_document_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            generateUUIDv7(),
            storeId,
            debitNoteId,
            todayDate,
            '2100',
            'GST Input Tax Credit Reversal',
            'LIABILITY',
            0,
            totalTaxPaise,
            `Input GST Reversal on Debit Note ${debitNoteNumber}`,
            'DEBIT_NOTE',
            debitNoteId,
            nowIso,
          ]
        );
      }
    });

    res.status(201).json({
      success: true,
      id: debitNoteId,
      debitNoteNumber,
      totalAmountPaise,
      totalTaxPaise,
      message: `Debit Note ${debitNoteNumber} issued successfully. Stock and supplier ledger updated.`,
    });
  } catch (err) {
    next(err);
  }
});

// GET /purchases/returns (List all debit notes)
purchasesRouter.get(['/returns', '/debit-notes'], authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const result = await req.db.query(
      `SELECT d.id, d.debit_note_number as "debitNoteNumber", d.supplier_id as "supplierId",
              s.name as "supplierName", d.original_purchase_invoice_id as "originalPurchaseInvoiceId",
              d.reason, d.total_amount_paise as "totalAmountPaise", d.total_tax_paise as "totalTaxPaise",
              d.status, d.created_at as "createdAt", u.name as "createdByName",
              (SELECT COUNT(*) FROM debit_note_lines l WHERE l.debit_note_id = d.id) as "lineCount"
       FROM debit_notes d
       JOIN suppliers s ON d.supplier_id = s.id
       JOIN users u ON d.created_by = u.id
       WHERE d.store_id = $1
       ORDER BY d.created_at DESC LIMIT 50`,
      [storeId]
    );

    res.json({ debitNotes: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /purchases/returns/:id (View debit note with lines)
purchasesRouter.get(['/returns/:id', '/debit-notes/:id'], authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const noteId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    const storeId = req.user!.storeId;

    const note = await req.db.queryOne<Record<string, any>>(
      `SELECT d.id, d.debit_note_number as "debitNoteNumber", d.supplier_id as "supplierId",
              s.name as "supplierName", s.gstin as "supplierGstin", s.phone as "supplierPhone",
              d.original_purchase_invoice_id as "originalPurchaseInvoiceId",
              d.reason, d.total_amount_paise as "totalAmountPaise", d.total_tax_paise as "totalTaxPaise",
              d.status, d.created_at as "createdAt", u.name as "createdByName"
       FROM debit_notes d
       JOIN suppliers s ON d.supplier_id = s.id
       JOIN users u ON d.created_by = u.id
       WHERE d.id = $1 AND d.store_id = $2`,
      [noteId, storeId]
    );

    if (!note) {
      throw new AppError(404, 'NOT_FOUND', 'Debit Note Not Found', 'Debit note does not exist.');
    }

    const lines = await req.db.query(
      `SELECT l.id, l.product_id as "productId", p.brand_name as "productName",
              l.batch_id as "batchId", b.batch_number as "batchNumber", b.expiry_date as "expiryDate",
              l.quantity_units as "quantityUnits", l.return_rate_paise as "returnRatePaise",
              l.tax_rate_percent as "taxRatePercent", l.total_paise as "totalPaise"
       FROM debit_note_lines l
       JOIN products p ON l.product_id = p.id
       JOIN batches b ON l.batch_id = b.id
       WHERE l.debit_note_id = $1`,
      [noteId]
    );

    res.json({ debitNote: { ...note, lines: lines.rows } });
  } catch (err) {
    next(err);
  }
});

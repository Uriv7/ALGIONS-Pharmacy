import { Router, Request, Response, NextFunction } from 'express';
import {
  CreateSaleRequestSchema,
  SalesReturnRequestSchema,
  HoldBillSchema,
} from '@algions/contracts';
import {
  authenticateToken,
  requireStaffOrOwner,
  requireOwner,
  requireStepUpAuth,
  checkStoreWriteGuard,
} from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import {
  generateUUIDv7,
  calculateInvoiceTotals,
  isBatchExpired,
} from '@algions/domain';
import crypto from 'node:crypto';

export const posRouter = Router();

// In-memory invoice sequence counter
let currentInvoiceSeq = 1001;

// POST /pos/sales
posRouter.post(
  '/sales',
  authenticateToken,
  requireStaffOrOwner,
  checkStoreWriteGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
      if (!idempotencyKey) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Idempotency-Key Required',
          'All document-creating POST requests require an Idempotency-Key header.'
        );
      }

      const storeId = req.user!.storeId;
      const deviceId = req.user!.deviceId;
      const userId = req.user!.id;

      // 1. Check idempotency replay
      const existingInvoice = await req.db.queryOne<{ id: string; full_invoice_number: string }>(
        'SELECT id, full_invoice_number FROM sales_invoices WHERE store_id = $1 AND idempotency_key = $2',
        [storeId, idempotencyKey]
      );

      if (existingInvoice) {
        // Return existing invoice
        const fullInvoice = await getInvoiceById(req.db, existingInvoice.id);
        res.status(200).json(fullInvoice);
        return;
      }

      const body = CreateSaleRequestSchema.parse(req.body);

      // Check Staff discount limit (AUTH-012)
      if (req.user?.accountType === 'STAFF') {
        const staffDiscountLimit = req.user.maxDiscountPercent;
        if (body.billDiscountPercent && body.billDiscountPercent > staffDiscountLimit) {
          throw new AppError(
            403,
            'DISCOUNT_LIMIT_EXCEEDED',
            'Staff Discount Limit Exceeded',
            `Staff discount cannot exceed ${staffDiscountLimit}%. Owner approval is required.`
          );
        }
        for (const line of body.lines) {
          if (line.discountPercent > staffDiscountLimit) {
            throw new AppError(
              403,
              'DISCOUNT_LIMIT_EXCEEDED',
              'Staff Discount Limit Exceeded',
              `Line discount of ${line.discountPercent}% exceeds your limit of ${staffDiscountLimit}%.`
            );
          }
        }
      }

      // Calculate totals using pure domain functions
      const invoiceCalculation = calculateInvoiceTotals({
        lines: body.lines.map((l) => ({
          productId: l.productId,
          batchId: l.batchId,
          quantity: l.quantity,
          unitsPerPack: l.unitsPerPack,
          saleRatePaise: l.saleRatePaise,
          mrpPaise: l.mrpPaise,
          discountPercent: l.discountPercent,
          taxRatePercent: l.taxRatePercent,
          isTaxInclusive: true,
        })),
        billDiscountPercent: body.billDiscountPercent,
        billDiscountPaise: body.billDiscountPaise,
        isInterState: body.isInterState,
      });

      // Verify payment totals match grand total
      const totalPaidPaise = body.payments.reduce((sum, p) => sum + p.amountPaise, 0);
      if (totalPaidPaise !== invoiceCalculation.grandTotalPaise) {
        throw new AppError(
          400,
          'VALIDATION_ERROR',
          'Payment Mismatch',
          `Total payment ₹${(totalPaidPaise / 100).toFixed(2)} does not match net bill payable ₹${(invoiceCalculation.grandTotalPaise / 100).toFixed(2)}.`
        );
      }

      // Execute in Single Atomic Database Transaction
      const resultInvoice = await req.db.transaction(async (tx) => {
        // Sort batch IDs to prevent concurrent deadlocks
        const sortedLines = [...body.lines].sort((a, b) => a.batchId.localeCompare(b.batchId));

        for (const line of sortedLines) {
          const batchRow = await tx.queryOne<{
            id: string;
            quantity: number;
            expiry_date: string;
            batch_number: string;
          }>('SELECT id, quantity, expiry_date, batch_number FROM batches WHERE id = $1 FOR UPDATE', [
            line.batchId,
          ]);

          if (!batchRow) {
            throw new AppError(404, 'NOT_FOUND', 'Batch Not Found', `Batch ID ${line.batchId} not found.`);
          }

          if (isBatchExpired(batchRow.expiry_date)) {
            throw new AppError(
              400,
              'BATCH_EXPIRED',
              'Cannot Dispense Expired Batch',
              `Batch ${batchRow.batch_number} expired on ${batchRow.expiry_date}. Dispensing expired medicine is blocked.`
            );
          }

          if (batchRow.quantity < line.quantity) {
            throw new AppError(
              409,
              'INSUFFICIENT_STOCK',
              'Insufficient Stock',
              `Insufficient stock for batch ${batchRow.batch_number}. Available: ${batchRow.quantity}, Requested: ${line.quantity}.`
            );
          }
        }

        // Generate Invoice Number
        const invoiceId = body.offlineInvoiceId || generateUUIDv7();
        const series = body.offlineInvoiceId ? 'OF/26-27' : 'ON/26-27';
        const numPart = String(currentInvoiceSeq++).padStart(6, '0');
        const invoiceNumber = body.offlineInvoiceNumber || numPart;
        const fullInvoiceNumber = `${series}/${invoiceNumber}`;
        const nowIso = new Date().toISOString();

        // 1. Insert Sales Invoice
        await tx.execute(
          `INSERT INTO sales_invoices (
            id, store_id, device_id, user_id, customer_id, customer_name, customer_phone,
            doctor_id, doctor_name, invoice_series, invoice_number, full_invoice_number,
            is_offline_origin, status, item_count, total_units, gross_total_paise,
            line_discount_total_paise, subtotal_paise, bill_discount_paise, total_discount_paise,
            taxable_total_paise, cgst_total_paise, sgst_total_paise, igst_total_paise,
            tax_total_paise, round_off_paise, grand_total_paise, idempotency_key, notes,
            occurred_at_local, created_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17,
            $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
          )`,
          [
            invoiceId,
            storeId,
            deviceId,
            userId,
            body.customerId ?? null,
            body.customerName ?? null,
            body.customerPhone ?? null,
            body.doctorId ?? null,
            body.doctorName ?? null,
            series,
            invoiceNumber,
            fullInvoiceNumber,
            body.offlineInvoiceId ? 1 : 0,
            'POSTED',
            invoiceCalculation.itemCount,
            invoiceCalculation.totalUnits,
            invoiceCalculation.grossTotalPaise,
            invoiceCalculation.lineDiscountTotalPaise,
            invoiceCalculation.subtotalPaise,
            invoiceCalculation.billDiscountPaise,
            invoiceCalculation.totalDiscountPaise,
            invoiceCalculation.taxableTotalPaise,
            invoiceCalculation.cgstTotalPaise,
            invoiceCalculation.sgstTotalPaise,
            invoiceCalculation.igstTotalPaise,
            invoiceCalculation.taxTotalPaise,
            invoiceCalculation.roundOffPaise,
            invoiceCalculation.grandTotalPaise,
            idempotencyKey,
            body.notes ?? null,
            body.occurredAtLocal || nowIso,
            nowIso,
          ]
        );

        // 2. Insert Sales Lines, Deduct Stock, and Record Immutable Stock Movements
        for (const line of invoiceCalculation.lines) {
          const lineId = generateUUIDv7();
          const prodInfo = await tx.queryOne<{ brand_name: string; generic_name: string }>(
            'SELECT brand_name, generic_name FROM products WHERE id = $1',
            [line.productId]
          );
          const batchInfo = await tx.queryOne<{ batch_number: string; expiry_date: string }>(
            'SELECT batch_number, expiry_date FROM batches WHERE id = $1',
            [line.batchId]
          );

          await tx.execute(
            `INSERT INTO sales_lines (
              id, sales_invoice_id, product_id, batch_id, product_name, generic_name,
              batch_number, expiry_date, quantity, units_per_pack, sale_rate_paise, mrp_paise,
              discount_percent, discount_paise, taxable_amount_paise, tax_rate_percent,
              cgst_paise, sgst_paise, igst_paise, total_tax_paise, final_line_total_paise, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
            [
              lineId,
              invoiceId,
              line.productId,
              line.batchId,
              prodInfo?.brand_name || 'Medicine',
              prodInfo?.generic_name || '',
              batchInfo?.batch_number || '',
              batchInfo?.expiry_date || '',
              line.quantity,
              line.unitsPerPack,
              line.saleRatePaise,
              line.mrpPaise,
              line.discountPercent,
              line.discountAmountPaise,
              line.taxableAmountPaise,
              line.taxRatePercent,
              line.cgstPaise,
              line.sgstPaise,
              line.igstPaise,
              line.totalTaxPaise,
              line.finalLineTotalPaise,
              nowIso,
            ]
          );

          // Insert negative stock movement (IMMUTABLE LEDGER)
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
              'SALE',
              -line.quantity, // Negative quantity
              'SALES_INVOICE',
              invoiceId,
              userId,
              deviceId,
              `Sale Invoice ${fullInvoiceNumber}`,
              nowIso,
            ]
          );

          // Update cached quantity in batches
          await tx.execute('UPDATE batches SET quantity = quantity - $1 WHERE id = $2', [
            line.quantity,
            line.batchId,
          ]);
        }

        // 3. Insert Payments
        for (const payment of body.payments) {
          const paymentId = generateUUIDv7();
          await tx.execute(
            `INSERT INTO payments (id, store_id, sales_invoice_id, mode, amount_paise, reference_number, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              paymentId,
              storeId,
              invoiceId,
              payment.mode,
              payment.amountPaise,
              payment.referenceNumber ?? null,
              nowIso,
            ]
          );
        }

        // 4. Double-Entry Ledger Postings
        // Debit: Cash/Bank/Receivable
        for (const p of body.payments) {
          const accountCode = p.mode === 'CASH' ? '1000' : p.mode === 'CREDIT' ? '1200' : '1010';
          const accountName = p.mode === 'CASH' ? 'Cash in Hand' : p.mode === 'CREDIT' ? 'Customer Receivable' : 'Bank Account';
          await tx.execute(
            `INSERT INTO ledger_entries (
              id, store_id, transaction_id, entry_date, account_code, account_name,
              category, debit_paise, credit_paise, narration, reference_document_type,
              reference_document_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              generateUUIDv7(),
              storeId,
              invoiceId,
              nowIso.slice(0, 10),
              accountCode,
              accountName,
              'ASSET',
              p.amountPaise,
              0,
              `Receipt for Invoice ${fullInvoiceNumber}`,
              'SALES_INVOICE',
              invoiceId,
              nowIso,
            ]
          );
        }

        // Credit: Sales Revenue (Taxable amount)
        await tx.execute(
          `INSERT INTO ledger_entries (
            id, store_id, transaction_id, entry_date, account_code, account_name,
            category, debit_paise, credit_paise, narration, reference_document_type,
            reference_document_id, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
          [
            generateUUIDv7(),
            storeId,
            invoiceId,
            nowIso.slice(0, 10),
            '4000',
            'Retail Medicine Sales',
            'REVENUE',
            0,
            invoiceCalculation.taxableTotalPaise,
            `Sales Revenue for Invoice ${fullInvoiceNumber}`,
            'SALES_INVOICE',
            invoiceId,
            nowIso,
          ]
        );

        // Credit: GST Output (CGST & SGST)
        if (invoiceCalculation.cgstTotalPaise > 0) {
          await tx.execute(
            `INSERT INTO ledger_entries (
              id, store_id, transaction_id, entry_date, account_code, account_name,
              category, debit_paise, credit_paise, narration, reference_document_type,
              reference_document_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              generateUUIDv7(),
              storeId,
              invoiceId,
              nowIso.slice(0, 10),
              '2100',
              'CGST Payable Output',
              'LIABILITY',
              0,
              invoiceCalculation.cgstTotalPaise,
              `CGST Output for Invoice ${fullInvoiceNumber}`,
              'SALES_INVOICE',
              invoiceId,
              nowIso,
            ]
          );
        }

        if (invoiceCalculation.sgstTotalPaise > 0) {
          await tx.execute(
            `INSERT INTO ledger_entries (
              id, store_id, transaction_id, entry_date, account_code, account_name,
              category, debit_paise, credit_paise, narration, reference_document_type,
              reference_document_id, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
              generateUUIDv7(),
              storeId,
              invoiceId,
              nowIso.slice(0, 10),
              '2110',
              'SGST Payable Output',
              'LIABILITY',
              0,
              invoiceCalculation.sgstTotalPaise,
              `SGST Output for Invoice ${fullInvoiceNumber}`,
              'SALES_INVOICE',
              invoiceId,
              nowIso,
            ]
          );
        }

        // 5. Tamper-evident Audit Log Entry
        const auditId = generateUUIDv7();
        const prevAudit = await tx.queryOne<{ current_hash: string }>(
          'SELECT current_hash FROM audit_logs WHERE store_id = $1 ORDER BY created_at DESC LIMIT 1',
          [storeId]
        );
        const prevHash = prevAudit?.current_hash || '0'.repeat(64);
        const auditPayload = `${auditId}:${invoiceId}:${fullInvoiceNumber}:${invoiceCalculation.grandTotalPaise}:${nowIso}:${prevHash}`;
        const currentHash = crypto.createHash('sha256').update(auditPayload).digest('hex');

        await tx.execute(
          `INSERT INTO audit_logs (
            id, store_id, user_id, account_type, device_id, action,
            entity_type, entity_id, before_state, after_state, reason,
            ip_address, prev_hash, current_hash, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
          [
            auditId,
            storeId,
            userId,
            req.user!.accountType,
            deviceId,
            'SALE_POSTED',
            'SALES_INVOICE',
            invoiceId,
            null,
            JSON.stringify({ fullInvoiceNumber, grandTotalPaise: invoiceCalculation.grandTotalPaise }),
            'Standard Sale Checkout',
            req.ip || '127.0.0.1',
            prevHash,
            currentHash,
            nowIso,
          ]
        );

        return await getInvoiceById(tx, invoiceId);
      });

      res.status(201).json(resultInvoice);
    } catch (err) {
      next(err);
    }
  }
);

// POST /returns/sales (Sales Return)
posRouter.post(
  '/returns',
  authenticateToken,
  requireStaffOrOwner,
  checkStoreWriteGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = SalesReturnRequestSchema.parse(req.body);
      const storeId = req.user!.storeId;
      const deviceId = req.user!.deviceId;
      const userId = req.user!.id;

      const originalInvoice = await req.db.queryOne<{ id: string; full_invoice_number: string }>(
        'SELECT id, full_invoice_number FROM sales_invoices WHERE id = $1 AND store_id = $2',
        [body.originalInvoiceId, storeId]
      );

      if (!originalInvoice) {
        throw new AppError(404, 'NOT_FOUND', 'Invoice Not Found', 'Original sales invoice not found.');
      }

      await req.db.transaction(async (tx) => {
        const nowIso = new Date().toISOString();

        for (const item of body.items) {
          if (item.isSellable) {
            // Positive stock movement returning goods to sellable stock
            const movementId = generateUUIDv7();
            await tx.execute(
              `INSERT INTO stock_movements (
                id, store_id, batch_id, movement_type, signed_quantity,
                source_document_type, source_document_id, user_id, device_id, notes, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                movementId,
                storeId,
                item.batchId,
                'SALE_RETURN',
                item.quantity, // Positive quantity returned
                'SALES_RETURN',
                body.originalInvoiceId,
                userId,
                deviceId,
                `Return against ${originalInvoice.full_invoice_number}: ${item.returnReason}`,
                nowIso,
              ]
            );

            // Increment batch balance
            await tx.execute('UPDATE batches SET quantity = quantity + $1 WHERE id = $2', [
              item.quantity,
              item.batchId,
            ]);
          } else {
            // Damaged/expired return: routed to quarantine/write-off, NOT added to sellable stock
            const movementId = generateUUIDv7();
            await tx.execute(
              `INSERT INTO stock_movements (
                id, store_id, batch_id, movement_type, signed_quantity,
                source_document_type, source_document_id, user_id, device_id, notes, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                movementId,
                storeId,
                item.batchId,
                'ADJUSTMENT_DAMAGE',
                0, // 0 sellable impact
                'SALES_RETURN_DAMAGED',
                body.originalInvoiceId,
                userId,
                deviceId,
                `Damaged return quarantined: ${item.returnReason}`,
                nowIso,
              ]
            );
          }
        }

        // Update original invoice status
        await tx.execute(
          "UPDATE sales_invoices SET status = 'RETURNED_PARTIAL' WHERE id = $1",
          [body.originalInvoiceId]
        );
      });

      res.json({
        success: true,
        message: 'Sales return processed successfully.',
      });
    } catch (err) {
      next(err);
    }
  }
);

// POST /pos/sales/:id/void (Invoice Void as Reversal Document - Owner Only with Step-Up Auth)
posRouter.post(
  '/sales/:id/void',
  authenticateToken,
  requireOwner,
  requireStepUpAuth,
  checkStoreWriteGuard,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const invoiceId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const { reason } = req.body;
      if (!reason) {
        throw new AppError(400, 'VALIDATION_ERROR', 'Reason Required', 'Mandatory void reason must be provided.');
      }

      const storeId = req.user!.storeId;
      const deviceId = req.user!.deviceId;
      const userId = req.user!.id;

      const invoice = await req.db.queryOne<{ id: string; status: string; full_invoice_number: string }>(
        'SELECT id, status, full_invoice_number FROM sales_invoices WHERE id = $1 AND store_id = $2',
        [invoiceId, storeId]
      );

      if (!invoice) throw new AppError(404, 'NOT_FOUND', 'Invoice Not Found', 'Invoice not found.');
      if (invoice.status === 'VOIDED') {
        throw new AppError(400, 'CONFLICT', 'Already Voided', 'Invoice is already voided.');
      }

      await req.db.transaction(async (tx) => {
        const nowIso = new Date().toISOString();

        // 1. Fetch original lines
        const lines = await tx.query<{ batch_id: string; quantity: number }>(
          'SELECT batch_id, quantity FROM sales_lines WHERE sales_invoice_id = $1',
          [invoiceId]
        );

        // 2. Reverse stock movements
        for (const line of lines.rows) {
          const movementId = generateUUIDv7();
          await tx.execute(
            `INSERT INTO stock_movements (
              id, store_id, batch_id, movement_type, signed_quantity,
              source_document_type, source_document_id, user_id, device_id, notes, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
            [
              movementId,
              storeId,
              line.batch_id,
              'SALE_RETURN',
              line.quantity, // Restore stock
              'INVOICE_VOID',
              invoiceId,
              userId,
              deviceId,
              `Reversal for voided bill ${invoice.full_invoice_number}: ${reason}`,
              nowIso,
            ]
          );

          await tx.execute('UPDATE batches SET quantity = quantity + $1 WHERE id = $2', [
            line.quantity,
            line.batch_id,
          ]);
        }

        // 3. Mark invoice as VOIDED with audit fields
        await tx.execute(
          `UPDATE sales_invoices SET status = 'VOIDED', void_reason = $1, voided_at = $2, voided_by = $3 WHERE id = $4`,
          [reason, nowIso, userId, invoiceId]
        );
      });

      res.json({
        success: true,
        message: `Invoice ${invoice.full_invoice_number} successfully reversed and marked VOIDED.`,
      });
    } catch (err) {
      next(err);
    }
  }
);

// GET /pos/invoices
posRouter.get('/invoices', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const isOwner = req.user!.accountType === 'OWNER';
    const userId = req.user!.id;

    let query = `
      SELECT id, full_invoice_number, customer_name, grand_total_paise, status,
             is_offline_origin, occurred_at_local, created_at, item_count
      FROM sales_invoices
      WHERE store_id = $1
    `;
    const params: unknown[] = [storeId];

    // Staff sees own/shift invoices per FES P3
    if (!isOwner) {
      query += ' AND user_id = $2';
      params.push(userId);
    }

    query += ' ORDER BY created_at DESC LIMIT 50';

    const result = await req.db.query(query, params);
    res.json({ invoices: result.rows });
  } catch (err) {
    next(err);
  }
});

// GET /pos/invoices/:id
posRouter.get('/invoices/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoiceId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
    const invoice = await getInvoiceById(req.db, invoiceId);
    if (!invoice) throw new AppError(404, 'NOT_FOUND', 'Invoice Not Found', 'Invoice not found.');
    res.json(invoice);
  } catch (err) {
    next(err);
  }
});

// POST /pos/holds (Hold bill)
posRouter.post('/holds', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = HoldBillSchema.parse(req.body);
    const storeId = req.user!.storeId;
    const deviceId = req.user!.deviceId;
    const userId = req.user!.id;

    await req.db.execute(
      `INSERT INTO held_bills (id, store_id, device_id, user_id, customer_name, customer_phone, lines_json, held_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        body.id,
        storeId,
        deviceId,
        userId,
        body.customerName ?? null,
        body.customerPhone ?? null,
        JSON.stringify(body.lines),
        body.heldAt,
      ]
    );

    res.json({ success: true, id: body.id });
  } catch (err) {
    next(err);
  }
});

// GET /pos/holds (List held bills)
posRouter.get('/holds', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const holds = await req.db.query(
      'SELECT id, customer_name, customer_phone, lines_json, held_at FROM held_bills WHERE store_id = $1 ORDER BY held_at DESC',
      [storeId]
    );
    const parsed = holds.rows.map((h: any) => ({
      id: h.id,
      customerName: h.customer_name,
      customerPhone: h.customer_phone,
      lines: JSON.parse(h.lines_json || '[]'),
      heldAt: h.held_at,
    }));
    res.json({ heldBills: parsed });
  } catch (err) {
    next(err);
  }
});

// DELETE /pos/holds/:id
posRouter.delete('/holds/:id', authenticateToken, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await req.db.execute('DELETE FROM held_bills WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

async function getInvoiceById(db: any, invoiceId: string) {
  const inv = await db.queryOne(
    `SELECT i.*, u.name as user_name
     FROM sales_invoices i
     JOIN users u ON i.user_id = u.id
     WHERE i.id = $1`,
    [invoiceId]
  );
  if (!inv) return null;

  const lines = await db.query(
    'SELECT * FROM sales_lines WHERE sales_invoice_id = $1 ORDER BY created_at ASC',
    [invoiceId]
  );

  const payments = await db.query(
    'SELECT mode, amount_paise as "amountPaise", reference_number as "referenceNumber" FROM payments WHERE sales_invoice_id = $1',
    [invoiceId]
  );

  return {
    ...inv,
    fullInvoiceNumber: inv.full_invoice_number,
    invoiceNumber: inv.invoice_number,
    invoiceSeries: inv.invoice_series,
    grandTotalPaise: inv.grand_total_paise,
    lines: lines.rows,
    payments: payments.rows,
  };
}

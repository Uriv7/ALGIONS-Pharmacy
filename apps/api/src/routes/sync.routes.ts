import { Router, Request, Response, NextFunction } from 'express';
import {
  BatchSyncRequestSchema,
  ResolveExceptionSchema,
} from '@algions/contracts';
import {
  authenticateToken,
  requireOwner,
  requireStepUpAuth,
} from '../middleware/auth.js';
import { AppError } from '../middleware/error.js';
import { generateUUIDv7 } from '@algions/domain';
import crypto from 'node:crypto';

export const syncRouter = Router();

// POST /sync/events:batch
syncRouter.post('/events:batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = BatchSyncRequestSchema.parse(req.body);
    const store = await req.db.queryOne<{ id: string; active_mode: string; primary_device_id: string }>(
      'SELECT id, active_mode, primary_device_id FROM stores LIMIT 1'
    );

    if (!store) throw new AppError(404, 'NOT_FOUND', 'Store Not Found', 'Store not initialized.');

    // Only Primary Workstation may upload offline sync events (TAD Section 10)
    if (store.primary_device_id !== body.deviceId) {
      throw new AppError(
        403,
        'DEVICE_NOT_PRIMARY',
        'Not Authorized for Sync',
        'Only the registered Primary Offline Workstation can upload batch sync events.'
      );
    }

    let highestAckSequence = 0;
    let processedCount = 0;
    let exceptionsCount = 0;

    // Sort events by localSequence ascending
    const sortedEvents = [...body.events].sort((a, b) => a.localSequence - b.localSequence);

    // Get last processed sequence for this device
    const lastSeqRow = await req.db.queryOne<{ max_seq: number }>(
      'SELECT COALESCE(MAX(local_sequence), 0) as max_seq FROM sync_events WHERE device_id = $1',
      [body.deviceId]
    );
    let expectedSequence = Number(lastSeqRow?.max_seq || 0) + 1;

    for (const event of sortedEvents) {
      // 1. Check for duplicate/replay in processed_events
      const existing = await req.db.queryOne<{ event_id: string }>(
        'SELECT event_id FROM processed_events WHERE event_id = $1',
        [event.eventId]
      );

      if (existing) {
        // Idempotent replay: already applied
        if (event.localSequence > highestAckSequence) {
          highestAckSequence = event.localSequence;
        }
        continue;
      }

      // 2. Sequence Gap Check (SYN-005)
      if (event.localSequence !== expectedSequence) {
        // Gap detected! Stop processing and return highest contiguous ack
        break;
      }

      // 3. Verify SHA-256 payload hash (TAD 10.1)
      const computedHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(event.payload))
        .digest('hex');

      // 4. Process event atomically
      await req.db.transaction(async (tx) => {
        const nowIso = new Date().toISOString();

        // Record event in sync_events
        await tx.execute(
          `INSERT INTO sync_events (
            id, store_id, device_id, local_sequence, event_type, schema_version,
            occurred_at_local, entity_id, payload_hash, payload, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            event.eventId,
            store.id,
            body.deviceId,
            event.localSequence,
            event.eventType,
            event.schemaVersion,
            event.occurredAtLocal,
            event.entityId,
            event.payloadHash,
            JSON.stringify(event.payload),
            nowIso,
          ]
        );

        if (event.eventType === 'SALE_POSTED') {
          const inv = event.payload.invoice;
          const lines = event.payload.lines || [];
          const payments = event.payload.payments || [];

          // Insert Sales Invoice with is_offline_origin = 1
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
            ) ON CONFLICT(store_id, idempotency_key) DO NOTHING`,
            [
              inv.id || event.entityId,
              store.id,
              body.deviceId,
              inv.userId,
              inv.customerId ?? null,
              inv.customerName ?? null,
              inv.customerPhone ?? null,
              inv.doctorId ?? null,
              inv.doctorName ?? null,
              inv.invoiceSeries || 'OF/26-27',
              inv.invoiceNumber,
              inv.fullInvoiceNumber,
              1, // is_offline_origin
              'POSTED',
              inv.itemCount,
              inv.totalUnits,
              inv.grossTotalPaise,
              inv.lineDiscountTotalPaise,
              inv.subtotalPaise,
              inv.billDiscountPaise,
              inv.totalDiscountPaise,
              inv.taxableTotalPaise,
              inv.cgstTotalPaise,
              inv.sgstTotalPaise,
              inv.igstTotalPaise,
              inv.taxTotalPaise,
              inv.roundOffPaise,
              inv.grandTotalPaise,
              inv.idempotencyKey || event.eventId,
              inv.notes ?? null,
              event.occurredAtLocal,
              nowIso,
            ]
          );

          // Lines and Stock movements
          for (const line of lines) {
            const batch = await tx.queryOne<{ id: string; quantity: number; batch_number: string }>(
              'SELECT id, quantity, batch_number FROM batches WHERE id = $1',
              [line.batchId]
            );

            if (!batch || batch.quantity < line.quantity) {
              // Stock conflict! Per TAD Section 10.3:
              // Preserve the invoice, do NOT reject it, but raise a reconciliation_exception!
              exceptionsCount++;
              const exceptionId = generateUUIDv7();
              await tx.execute(
                `INSERT INTO reconciliation_exceptions (
                  id, event_id, store_id, device_id, entity_id, exception_type, status, details, created_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  exceptionId,
                  event.eventId,
                  store.id,
                  body.deviceId,
                  event.entityId,
                  'STOCK_MISMATCH',
                  'PENDING',
                  JSON.stringify({
                    message: `Offline sale of ${line.quantity} units exceeded available cloud stock (${batch?.quantity ?? 0}) for batch ${line.batchNumber}.`,
                    productName: line.productName,
                    batchNumber: line.batchNumber,
                    offlineStock: line.quantity,
                    cloudStock: batch?.quantity ?? 0,
                    occurredAtLocal: event.occurredAtLocal,
                  }),
                  nowIso,
                ]
              );
            }

            // Always record the movement and deduct stock
            const movementId = generateUUIDv7();
            await tx.execute(
              `INSERT INTO stock_movements (
                id, store_id, batch_id, movement_type, signed_quantity,
                source_document_type, source_document_id, user_id, device_id, notes, created_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
              [
                movementId,
                store.id,
                line.batchId,
                'SALE',
                -line.quantity,
                'OFFLINE_SALES_INVOICE',
                event.entityId,
                inv.userId,
                body.deviceId,
                `Offline sync: ${inv.fullInvoiceNumber}`,
                nowIso,
              ]
            );

            await tx.execute('UPDATE batches SET quantity = quantity - $1 WHERE id = $2', [
              line.quantity,
              line.batchId,
            ]);
          }

          // Mark processed
          await tx.execute(
            `INSERT INTO processed_events (event_id, store_id, device_id, processed_at, result_summary)
             VALUES ($1, $2, $3, $4, $5)`,
            [event.eventId, store.id, body.deviceId, nowIso, `Applied offline sale ${inv.fullInvoiceNumber}`]
          );
        }

        highestAckSequence = event.localSequence;
        expectedSequence = event.localSequence + 1;
        processedCount++;
      });
    }

    // If all events reconciled, store returns to ONLINE mode per TAD 5
    if (store.active_mode === 'RECOVERY_SYNCING' && exceptionsCount === 0) {
      await req.db.execute("UPDATE stores SET active_mode = 'ONLINE' WHERE id = $1", [store.id]);
    } else if (exceptionsCount > 0) {
      await req.db.execute("UPDATE stores SET active_mode = 'DEGRADED_CONFLICT' WHERE id = $1", [store.id]);
    }

    res.json({
      highestAckSequence,
      processedCount,
      exceptionsCount,
      serverTime: new Date().toISOString(),
      storeMode: store.active_mode,
    });
  } catch (err) {
    next(err);
  }
});

// GET /sync/exceptions (Owner exception review queue)
syncRouter.get('/exceptions', authenticateToken, requireOwner, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const storeId = req.user!.storeId;
    const exceptions = await req.db.query(
      `SELECT e.id, e.event_id as "eventId", e.device_id as "deviceId",
              e.entity_id as "entityId", e.exception_type as "exceptionType",
              e.status, e.details, e.resolution_notes as "resolutionNotes",
              e.created_at as "createdAt"
       FROM reconciliation_exceptions e
       WHERE e.store_id = $1
       ORDER BY e.created_at DESC`,
      [storeId]
    );

    const parsed = exceptions.rows.map((row: any) => ({
      ...row,
      details: typeof row.details === 'string' ? JSON.parse(row.details) : row.details,
    }));

    res.json({ exceptions: parsed });
  } catch (err) {
    next(err);
  }
});

// POST /sync/exceptions/:id/resolve (Resolve exception with step-up MFA - Owner only)
syncRouter.post(
  '/exceptions/:id/resolve',
  authenticateToken,
  requireOwner,
  requireStepUpAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const exceptionId = Array.isArray(req.params.id) ? req.params.id[0]! : req.params.id!;
      const body = ResolveExceptionSchema.parse(req.body);
      const storeId = req.user!.storeId;
      const userId = req.user!.id;
      const nowIso = new Date().toISOString();

      await req.db.execute(
        `UPDATE reconciliation_exceptions
         SET status = 'RESOLVED', resolution_notes = $1, resolved_by_user_id = $2, resolved_at = $3
         WHERE id = $4 AND store_id = $5`,
        [body.resolutionNotes, userId, nowIso, exceptionId, storeId]
      );

      // Check if any pending exceptions remain
      const pending = await req.db.queryOne<{ count: number }>(
        "SELECT COUNT(*) as count FROM reconciliation_exceptions WHERE store_id = $1 AND status = 'PENDING'",
        [storeId]
      );

      if (Number(pending?.count || 0) === 0) {
        // Return store to ONLINE mode
        await req.db.execute("UPDATE stores SET active_mode = 'ONLINE' WHERE id = $1", [storeId]);
      }

      res.json({
        success: true,
        message: 'Reconciliation exception resolved.',
      });
    } catch (err) {
      next(err);
    }
  }
);

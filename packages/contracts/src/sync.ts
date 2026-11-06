import { z } from 'zod';

export type SyncEventType =
  | 'SALE_POSTED'
  | 'SALE_RETURN_POSTED'
  | 'PAYMENT_RECEIVED'
  | 'INVOICE_VOIDED'
  | 'STOCK_ADJUSTED'
  | 'CUSTOMER_UPSERTED';

export const SyncEventEnvelopeSchema = z.object({
  eventId: z.string().uuid(),
  storeId: z.string().uuid(),
  deviceId: z.string().uuid(),
  localSequence: z.number().int().positive(),
  eventType: z.enum([
    'SALE_POSTED',
    'SALE_RETURN_POSTED',
    'PAYMENT_RECEIVED',
    'INVOICE_VOIDED',
    'STOCK_ADJUSTED',
    'CUSTOMER_UPSERTED',
  ]),
  schemaVersion: z.number().int().default(1),
  occurredAtLocal: z.string(),
  entityId: z.string().uuid(),
  payloadHash: z.string().min(10), // SHA-256 hash of payload
  payload: z.record(z.any()),
});
export type SyncEventEnvelope = z.infer<typeof SyncEventEnvelopeSchema>;

export const BatchSyncRequestSchema = z.object({
  deviceId: z.string().uuid(),
  events: z.array(SyncEventEnvelopeSchema),
});
export type BatchSyncRequest = z.infer<typeof BatchSyncRequestSchema>;

export interface BatchSyncResponse {
  highestAckSequence: number;
  processedCount: number;
  exceptionsCount: number;
  serverTime: string;
  storeMode: string;
}

export type ExceptionType =
  | 'STOCK_MISMATCH'
  | 'PRICE_MISMATCH'
  | 'UNKNOWN_BATCH'
  | 'UNKNOWN_PRODUCT'
  | 'SCHEMA_ERROR';

export type ExceptionStatus = 'PENDING' | 'RESOLVED' | 'DISMISSED';

export interface ReconciliationExceptionDTO {
  id: string;
  eventId: string;
  deviceId: string;
  storeId: string;
  entityId: string;
  exceptionType: ExceptionType;
  status: ExceptionStatus;
  details: {
    message: string;
    productName?: string;
    batchNumber?: string;
    offlineStock?: number;
    cloudStock?: number;
    offlinePricePaise?: number;
    cloudPricePaise?: number;
    occurredAtLocal?: string;
  };
  resolutionNotes?: string | null;
  resolvedByUserId?: string | null;
  resolvedAt?: string | null;
  createdAt: string;
}

export const ResolveExceptionSchema = z.object({
  resolutionNotes: z.string().min(3),
  action: z.enum(['ACCEPT_OFFLINE_SALE', 'ADJUST_CLOUD_STOCK', 'DISMISS']),
  mfaCode: z.string().optional(),
  stepUpToken: z.string().optional(),
});
export type ResolveExceptionRequest = z.infer<typeof ResolveExceptionSchema>;

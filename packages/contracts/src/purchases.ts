import { z } from 'zod';

export const SupplierSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  gstin: z.string().regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Invalid GSTIN format').optional().or(z.literal('')),
  phone: z.string().optional(),
  address: z.string().optional(),
  creditPeriodDays: z.number().int().nonnegative().default(30),
  isActive: z.boolean().default(true),
});
export type SupplierDTO = z.infer<typeof SupplierSchema>;

export const PurchaseLineSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().optional(),
  batchNumber: z.string().min(1),
  mfgDate: z.string().optional(),
  expiryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expiry must be YYYY-MM-DD'),
  quantityPacks: z.number().int().positive(),
  freeQuantityPacks: z.number().int().nonnegative().default(0),
  unitsPerPack: z.number().int().positive().default(10),
  purchaseRatePaise: z.number().int().positive(), // per pack
  mrpPaise: z.number().int().positive(), // per pack
  saleRatePaise: z.number().int().positive(), // per pack
  taxRatePercent: z.number().default(12),
  rackLocation: z.string().optional(),
});
export type PurchaseLine = z.infer<typeof PurchaseLineSchema>;

export const CreatePurchaseInvoiceSchema = z.object({
  supplierId: z.string().uuid(),
  supplierInvoiceNumber: z.string().min(1),
  supplierInvoiceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  lines: z.array(PurchaseLineSchema).min(1),
  notes: z.string().optional(),
});
export type CreatePurchaseInvoiceRequest = z.infer<typeof CreatePurchaseInvoiceSchema>;

export interface PurchaseInvoiceDTO {
  id: string;
  storeId: string;
  supplierId: string;
  supplierName: string;
  supplierInvoiceNumber: string;
  supplierInvoiceDate: string;
  totalAmountPaise: number;
  totalTaxPaise: number;
  status: 'PENDING_REVIEW' | 'POSTED' | 'REVERSED';
  createdBy: string;
  reviewedBy?: string | null;
  lines: (PurchaseLine & { id: string })[];
  createdAt: string;
}

// Purchase Return / Supplier Debit Note (PUR-006 / ACC-007)
export const PurchaseReturnLineSchema = z.object({
  batchId: z.string().uuid(),
  productId: z.string().uuid(),
  quantityUnits: z.number().int().positive(),
  returnRatePaise: z.number().int().positive(), // per loose unit
  taxRatePercent: z.number().default(12),
  reason: z.string().optional(),
});
export type PurchaseReturnLine = z.infer<typeof PurchaseReturnLineSchema>;

export const CreatePurchaseReturnSchema = z.object({
  supplierId: z.string().uuid(),
  originalPurchaseInvoiceId: z.string().uuid().optional(),
  debitNoteNumber: z.string().optional(),
  reason: z.string().min(3, 'Return reason is required'),
  lines: z.array(PurchaseReturnLineSchema).min(1, 'At least one return item is required'),
});
export type CreatePurchaseReturnRequest = z.infer<typeof CreatePurchaseReturnSchema>;

export interface DebitNoteDTO {
  id: string;
  storeId: string;
  supplierId: string;
  supplierName?: string;
  originalPurchaseInvoiceId?: string | null;
  debitNoteNumber: string;
  reason: string;
  totalAmountPaise: number;
  totalTaxPaise: number;
  status: 'POSTED' | 'CANCELLED';
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  lines?: {
    id: string;
    productId: string;
    productName?: string;
    batchId: string;
    batchNumber?: string;
    quantityUnits: number;
    returnRatePaise: number;
    taxRatePercent: number;
    totalPaise: number;
  }[];
}

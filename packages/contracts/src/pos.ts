import { z } from 'zod';

export type PaymentMode = 'CASH' | 'UPI' | 'CARD' | 'BANK' | 'CREDIT';

export const SaleLineInputSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid(),
  quantity: z.number().int().positive(), // in loose units (e.g. 5 tablets, or 20 for 2 strips)
  unitsPerPack: z.number().int().positive().default(1),
  saleRatePaise: z.number().int().nonnegative(),
  mrpPaise: z.number().int().nonnegative(),
  discountPercent: z.number().min(0).max(100).default(0),
  taxRatePercent: z.number().min(0).max(100).default(12),
});
export type SaleLineInput = z.infer<typeof SaleLineInputSchema>;

export const SplitPaymentSchema = z.object({
  mode: z.enum(['CASH', 'UPI', 'CARD', 'BANK', 'CREDIT']),
  amountPaise: z.number().int().positive(),
  referenceNumber: z.string().optional(),
});
export type SplitPayment = z.infer<typeof SplitPaymentSchema>;

export const CreateSaleRequestSchema = z.object({
  lines: z.array(SaleLineInputSchema).min(1, 'At least one item is required in a sale'),
  customerId: z.string().uuid().optional(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  doctorId: z.string().uuid().optional(),
  doctorName: z.string().optional(),
  billDiscountPercent: z.number().min(0).max(100).optional(),
  billDiscountPaise: z.number().int().min(0).optional(),
  payments: z.array(SplitPaymentSchema).min(1, 'At least one payment method is required'),
  isInterState: z.boolean().default(false),
  notes: z.string().optional(),
  offlineInvoiceId: z.string().uuid().optional(), // Provided if sync or offline origin
  offlineInvoiceNumber: z.string().optional(),
  occurredAtLocal: z.string().optional(),
});
export type CreateSaleRequest = z.infer<typeof CreateSaleRequestSchema>;

export interface SaleInvoiceLineDTO {
  id: string;
  invoiceId: string;
  productId: string;
  productName: string;
  genericName?: string;
  batchId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: number;
  unitsPerPack: number;
  saleRatePaise: number;
  mrpPaise: number;
  discountPercent: number;
  discountPaise: number;
  taxableAmountPaise: number;
  taxRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  finalLineTotalPaise: number;
}

export interface SaleInvoiceDTO {
  id: string;
  storeId: string;
  deviceId: string;
  userId: string;
  userName: string;
  invoiceSeries: string;
  invoiceNumber: string;
  fullInvoiceNumber: string; // e.g. ON/26-27/000001 or OF/26-27/000001
  isOfflineOrigin: boolean;
  status: 'POSTED' | 'VOIDED' | 'RETURNED_PARTIAL' | 'RETURNED_FULL';
  customerId?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  doctorId?: string | null;
  doctorName?: string | null;
  itemCount: number;
  totalUnits: number;
  grossTotalPaise: number;
  lineDiscountTotalPaise: number;
  subtotalPaise: number;
  billDiscountPaise: number;
  totalDiscountPaise: number;
  taxableTotalPaise: number;
  cgstTotalPaise: number;
  sgstTotalPaise: number;
  igstTotalPaise: number;
  taxTotalPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
  payments: SplitPayment[];
  lines: SaleInvoiceLineDTO[];
  createdAt: string;
  occurredAtLocal?: string;
  voidReason?: string | null;
  voidedAt?: string | null;
}

export const SalesReturnRequestSchema = z.object({
  originalInvoiceId: z.string().uuid(),
  items: z
    .array(
      z.object({
        batchId: z.string().uuid(),
        quantity: z.number().int().positive(),
        returnReason: z.string().min(1),
        isSellable: z.boolean().default(true), // if false, damaged/expired and not returned to active stock
      })
    )
    .min(1),
  refundPaymentMode: z.enum(['CASH', 'UPI', 'CARD', 'BANK', 'CREDIT']),
  notes: z.string().optional(),
});
export type SalesReturnRequest = z.infer<typeof SalesReturnRequestSchema>;

export const HoldBillSchema = z.object({
  id: z.string().uuid(),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
  heldAt: z.string(),
  lines: z.array(SaleLineInputSchema),
  notes: z.string().optional(),
});
export type HoldBill = z.infer<typeof HoldBillSchema>;

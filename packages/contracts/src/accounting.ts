import { z } from 'zod';

export type AccountCategory = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';

export interface LedgerEntryDTO {
  id: string;
  transactionId: string;
  date: string;
  accountCode: string;
  accountName: string;
  category: AccountCategory;
  debitPaise: number;
  creditPaise: number;
  narration: string;
  referenceDocumentType: string;
  referenceDocumentId: string;
}

export interface DayBookEntryDTO {
  id: string;
  timestamp: string;
  documentType: string;
  documentNumber: string;
  partyName: string;
  paymentMode?: string;
  totalAmountPaise: number;
  linesSummary: string;
}

export interface GSTSummaryReportDTO {
  periodStart: string;
  periodEnd: string;
  totalTaxablePaise: number;
  totalCGSTPaise: number;
  totalSGSTPaise: number;
  totalIGSTPaise: number;
  totalTaxPaise: number;
  totalInvoiceValuePaise: number;
  hsnSummary: {
    hsnCode: string;
    description: string;
    totalUnits: number;
    taxablePaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalAmountPaise: number;
  }[];
}

export const CustomerSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  creditLimitPaise: z.number().int().nonnegative().default(0),
  outstandingBalancePaise: z.number().int().default(0),
  isActive: z.boolean().default(true),
});
export type CustomerDTO = z.infer<typeof CustomerSchema>;

export const DoctorSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  regNumber: z.string().optional(),
  specialization: z.string().optional(),
  hospitalClinic: z.string().optional(),
  phone: z.string().optional(),
  isActive: z.boolean().default(true),
});
export type DoctorDTO = z.infer<typeof DoctorSchema>;

export const ExpenseCategoryEnum = z.enum([
  'RENT',
  'ELECTRICITY',
  'PACKAGING',
  'SALARY_ADVANCE',
  'TEA_REFRESHMENTS',
  'MAINTENANCE',
  'OTHER',
]);

export const CreateExpenseSchema = z.object({
  category: ExpenseCategoryEnum,
  payeeName: z.string().min(1),
  amountPaise: z.number().int().positive(),
  paymentMode: z.enum(['CASH', 'BANK', 'UPI']),
  narration: z.string().optional(),
});
export type CreateExpenseRequest = z.infer<typeof CreateExpenseSchema>;

export interface DashboardMetricsDTO {
  asOf: string;
  isStale: boolean;
  todaySalesPaise: number;
  todayBillsCount: number;
  grossMarginPercent: number;
  cashInHandPaise: number;
  bankBalancePaise: number;
  outstandingReceivablesPaise: number;
  outstandingPayablesPaise: number;
  nearExpiryStockValuePaise: number;
  lowStockCount: number;
  salesTrend7Days: { date: string; amountPaise: number; billsCount: number }[];
  paymentModeSplit: { mode: string; amountPaise: number; percent: number }[];
  topSellingProducts: { productName: string; unitsSold: number; totalSalesPaise: number }[];
  pendingExceptionsCount: number;
  pendingPurchasesCount: number;
}

/**
 * ALGIONS Pharmacy - Invoice Calculation Engine
 * Calculates line-level and invoice-level totals, tax splits, discounts, and round-offs.
 */

import { calculateGSTExclusive, calculateGSTInclusive, TaxCalculationResult } from './tax.js';
import { calculateRoundOff } from './money.js';

export interface LineItemInput {
  productId: string;
  batchId: string;
  quantity: number; // in loose units (e.g. tablets)
  unitsPerPack: number;
  saleRatePaise: number; // unit rate in paise (or loose unit rate)
  mrpPaise: number;
  discountPercent?: number; // e.g. 5 for 5%
  taxRatePercent: number; // e.g. 12 for 12% GST
  isInterState?: boolean;
  isTaxInclusive?: boolean; // In retail POS, saleRate / MRP is tax-inclusive
}

export interface CalculatedLineItem {
  productId: string;
  batchId: string;
  quantity: number;
  unitsPerPack: number;
  saleRatePaise: number;
  mrpPaise: number;
  grossAmountPaise: number;
  discountPercent: number;
  discountAmountPaise: number;
  netAmountPaise: number;
  taxableAmountPaise: number;
  taxRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  finalLineTotalPaise: number;
  taxSnapshot: TaxCalculationResult;
}

export interface InvoiceTotalsInput {
  lines: LineItemInput[];
  billDiscountPercent?: number;
  billDiscountPaise?: number;
  isInterState?: boolean;
}

export interface CalculatedInvoiceTotals {
  lines: CalculatedLineItem[];
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
  netBeforeRoundPaise: number;
  roundOffPaise: number;
  grandTotalPaise: number;
}

export function calculateLineItem(input: LineItemInput): CalculatedLineItem {
  const {
    productId,
    batchId,
    quantity,
    unitsPerPack,
    saleRatePaise,
    mrpPaise,
    discountPercent = 0,
    taxRatePercent,
    isInterState = false,
    isTaxInclusive = true,
  } = input;

  if (quantity <= 0) throw new Error('Quantity must be greater than zero');
  if (discountPercent < 0 || discountPercent > 100) {
    throw new Error('Discount percentage must be between 0 and 100');
  }

  const grossAmountPaise = Math.round(saleRatePaise * quantity);
  const discountAmountPaise = Math.round((grossAmountPaise * discountPercent) / 100);
  const netAmountPaise = grossAmountPaise - discountAmountPaise;

  let taxSnapshot: TaxCalculationResult;
  if (isTaxInclusive) {
    taxSnapshot = calculateGSTInclusive(netAmountPaise, taxRatePercent, isInterState);
  } else {
    taxSnapshot = calculateGSTExclusive(netAmountPaise, taxRatePercent, isInterState);
  }

  return {
    productId,
    batchId,
    quantity,
    unitsPerPack,
    saleRatePaise,
    mrpPaise,
    grossAmountPaise,
    discountPercent,
    discountAmountPaise,
    netAmountPaise,
    taxableAmountPaise: taxSnapshot.taxablePaise,
    taxRatePercent,
    cgstPaise: taxSnapshot.cgstPaise,
    sgstPaise: taxSnapshot.sgstPaise,
    igstPaise: taxSnapshot.igstPaise,
    totalTaxPaise: taxSnapshot.totalTaxPaise,
    finalLineTotalPaise: taxSnapshot.totalAmountPaise,
    taxSnapshot,
  };
}

export function calculateInvoiceTotals(input: InvoiceTotalsInput): CalculatedInvoiceTotals {
  const lines = input.lines.map((line) =>
    calculateLineItem({
      ...line,
      isInterState: input.isInterState ?? false,
    })
  );

  const itemCount = lines.length;
  const totalUnits = lines.reduce((sum, l) => sum + l.quantity, 0);
  const grossTotalPaise = lines.reduce((sum, l) => sum + l.grossAmountPaise, 0);
  const lineDiscountTotalPaise = lines.reduce((sum, l) => sum + l.discountAmountPaise, 0);
  const subtotalPaise = grossTotalPaise - lineDiscountTotalPaise;

  let billDiscountPaise = 0;
  if (input.billDiscountPaise && input.billDiscountPaise > 0) {
    billDiscountPaise = Math.min(input.billDiscountPaise, subtotalPaise);
  } else if (input.billDiscountPercent && input.billDiscountPercent > 0) {
    billDiscountPaise = Math.round((subtotalPaise * input.billDiscountPercent) / 100);
  }

  const totalDiscountPaise = lineDiscountTotalPaise + billDiscountPaise;
  const taxableTotalPaise = lines.reduce((sum, l) => sum + l.taxableAmountPaise, 0);
  const cgstTotalPaise = lines.reduce((sum, l) => sum + l.cgstPaise, 0);
  const sgstTotalPaise = lines.reduce((sum, l) => sum + l.sgstPaise, 0);
  const igstTotalPaise = lines.reduce((sum, l) => sum + l.igstPaise, 0);
  const taxTotalPaise = cgstTotalPaise + sgstTotalPaise + igstTotalPaise;

  // After bill discount: net before round
  const netBeforeRoundPaise = Math.max(0, subtotalPaise - billDiscountPaise);
  const { roundOffPaise, finalPayablePaise } = calculateRoundOff(netBeforeRoundPaise);

  return {
    lines,
    itemCount,
    totalUnits,
    grossTotalPaise,
    lineDiscountTotalPaise,
    subtotalPaise,
    billDiscountPaise,
    totalDiscountPaise,
    taxableTotalPaise,
    cgstTotalPaise,
    sgstTotalPaise,
    igstTotalPaise,
    taxTotalPaise,
    netBeforeRoundPaise,
    roundOffPaise,
    grandTotalPaise: finalPayablePaise,
  };
}

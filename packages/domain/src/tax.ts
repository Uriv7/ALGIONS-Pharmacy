/**
 * ALGIONS Pharmacy - GST Tax Calculation Engine
 * Indian GST Compliance: CGST, SGST, IGST calculation and immutable tax snapshots.
 */

export interface TaxCalculationResult {
  taxablePaise: number;
  taxRatePercent: number;
  cgstRatePercent: number;
  sgstRatePercent: number;
  igstRatePercent: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
  totalTaxPaise: number;
  totalAmountPaise: number;
}

export function calculateGSTExclusive(
  taxablePaise: number,
  taxRatePercent: number,
  isInterState: boolean
): TaxCalculationResult {
  if (taxRatePercent < 0) throw new Error('Tax rate cannot be negative');

  const totalTaxPaise = Math.round((taxablePaise * taxRatePercent) / 100);
  const totalAmountPaise = taxablePaise + totalTaxPaise;

  if (isInterState) {
    return {
      taxablePaise,
      taxRatePercent,
      cgstRatePercent: 0,
      sgstRatePercent: 0,
      igstRatePercent: taxRatePercent,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: totalTaxPaise,
      totalTaxPaise,
      totalAmountPaise,
    };
  }

  // Intra-state: CGST + SGST split 50/50
  const halfRate = taxRatePercent / 2;
  const cgstPaise = Math.round(totalTaxPaise / 2);
  const sgstPaise = totalTaxPaise - cgstPaise; // Guarantees exact sum = totalTaxPaise

  return {
    taxablePaise,
    taxRatePercent,
    cgstRatePercent: halfRate,
    sgstRatePercent: halfRate,
    igstRatePercent: 0,
    cgstPaise,
    sgstPaise,
    igstPaise: 0,
    totalTaxPaise,
    totalAmountPaise,
  };
}

export function calculateGSTInclusive(
  totalInclusivePaise: number,
  taxRatePercent: number,
  isInterState: boolean
): TaxCalculationResult {
  if (taxRatePercent < 0) throw new Error('Tax rate cannot be negative');

  // taxable = totalInclusive / (1 + rate / 100) = (totalInclusive * 100) / (100 + rate)
  const taxablePaise = Math.round((totalInclusivePaise * 100) / (100 + taxRatePercent));
  const totalTaxPaise = totalInclusivePaise - taxablePaise;

  if (isInterState) {
    return {
      taxablePaise,
      taxRatePercent,
      cgstRatePercent: 0,
      sgstRatePercent: 0,
      igstRatePercent: taxRatePercent,
      cgstPaise: 0,
      sgstPaise: 0,
      igstPaise: totalTaxPaise,
      totalTaxPaise,
      totalAmountPaise: totalInclusivePaise,
    };
  }

  const halfRate = taxRatePercent / 2;
  const cgstPaise = Math.round(totalTaxPaise / 2);
  const sgstPaise = totalTaxPaise - cgstPaise;

  return {
    taxablePaise,
    taxRatePercent,
    cgstRatePercent: halfRate,
    sgstRatePercent: halfRate,
    igstRatePercent: 0,
    cgstPaise,
    sgstPaise,
    igstPaise: 0,
    totalTaxPaise,
    totalAmountPaise: totalInclusivePaise,
  };
}

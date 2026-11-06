/**
 * ALGIONS Pharmacy - Money & Fixed-Point Calculations
 * All financial amounts are internally represented as integer paise (1 INR = 100 paise)
 * to avoid IEEE 754 floating point precision errors.
 */

export function toPaise(amount: number | string): number {
  if (typeof amount === 'string') {
    const cleaned = amount.trim().replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);
    if (isNaN(num)) {
      throw new Error(`Invalid monetary amount: ${amount}`);
    }
    return Math.round(num * 100);
  }
  return Math.round(amount * 100);
}

export function fromPaise(paise: number): number {
  return paise / 100;
}

export function formatPaiseToINR(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  const parts = rupees.toFixed(2).split('.');
  const integerPart = parts[0]!;
  const decimalPart = parts[1]!;

  // Indian number formatting: last 3 digits, then groups of 2 digits
  let lastThree = integerPart.substring(integerPart.length - 3);
  const otherNumbers = integerPart.substring(0, integerPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInteger =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  const sign = paise < 0 ? '-' : '';
  return `${sign}₹${formattedInteger}.${decimalPart}`;
}

export function roundHalfUp(value: number): number {
  return Math.round(value);
}

export function addPaise(...paiseList: number[]): number {
  return paiseList.reduce((acc, curr) => acc + curr, 0);
}

export function subtractPaise(a: number, b: number): number {
  return a - b;
}

export function multiplyPaiseByQuantity(ratePaise: number, quantity: number): number {
  return Math.round(ratePaise * quantity);
}

export function calculateRoundOff(netBeforeRoundPaise: number): {
  roundOffPaise: number;
  finalPayablePaise: number;
} {
  // Round to nearest whole rupee (multiple of 100 paise)
  const remainder = netBeforeRoundPaise % 100;
  let finalPayablePaise = netBeforeRoundPaise;
  let roundOffPaise = 0;

  if (remainder !== 0) {
    if (remainder >= 50) {
      roundOffPaise = 100 - remainder;
      finalPayablePaise = netBeforeRoundPaise + roundOffPaise;
    } else {
      roundOffPaise = -remainder;
      finalPayablePaise = netBeforeRoundPaise + roundOffPaise;
    }
  }

  return { roundOffPaise, finalPayablePaise };
}

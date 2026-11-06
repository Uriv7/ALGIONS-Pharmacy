/**
 * ALGIONS Pharmacy - FEFO (First-Expiry-First-Out) Batch Selection
 * Ensures earliest non-expired medicines are dispensed first.
 */

export interface BatchItem {
  id: string;
  batchNumber: string;
  expiryDate: string; // YYYY-MM-DD
  quantity: number; // Available loose units
  mrpPaise: number;
  saleRatePaise: number;
  purchaseRatePaise?: number;
  rack?: string | null;
}

export interface BatchAllocation {
  batch: BatchItem;
  allocatedQuantity: number;
  isNearExpiry: boolean;
  daysUntilExpiry: number;
}

export interface FEFOSelectionResult {
  allocations: BatchAllocation[];
  fulfilledQuantity: number;
  unfulfilledQuantity: number;
  isFullyFulfilled: boolean;
  expiredBatchesSkipped: number;
}

export function getDaysUntilExpiry(expiryDateStr: string, currentDate: Date = new Date()): number {
  const [year, month, day] = expiryDateStr.split('-').map(Number);
  const expiry = new Date(Date.UTC(year!, (month || 1) - 1, day || 1));
  const now = new Date(Date.UTC(currentDate.getUTCFullYear(), currentDate.getUTCMonth(), currentDate.getUTCDate()));
  const diffTime = expiry.getTime() - now.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

export function isBatchExpired(expiryDateStr: string, currentDate: Date = new Date()): boolean {
  return getDaysUntilExpiry(expiryDateStr, currentDate) <= 0;
}

export function isBatchNearExpiry(
  expiryDateStr: string,
  thresholdDays = 90,
  currentDate: Date = new Date()
): boolean {
  const days = getDaysUntilExpiry(expiryDateStr, currentDate);
  return days > 0 && days <= thresholdDays;
}

export function selectBatchesFEFO(
  batches: BatchItem[],
  requestedQuantity: number,
  options?: {
    nearExpiryThresholdDays?: number;
    currentDate?: Date;
    allowNegative?: boolean;
  }
): FEFOSelectionResult {
  const now = options?.currentDate ?? new Date();
  const thresholdDays = options?.nearExpiryThresholdDays ?? 90;

  let expiredBatchesSkipped = 0;

  // Filter valid batches (stock > 0 and not expired)
  const availableBatches = batches.filter((b) => {
    if (isBatchExpired(b.expiryDate, now)) {
      expiredBatchesSkipped++;
      return false;
    }
    return b.quantity > 0;
  });

  // Sort strictly by earliest expiry date ascending
  availableBatches.sort((a, b) => a.expiryDate.localeCompare(b.expiryDate));

  const allocations: BatchAllocation[] = [];
  let remainingNeeded = requestedQuantity;

  for (const batch of availableBatches) {
    if (remainingNeeded <= 0) break;

    const daysUntilExpiry = getDaysUntilExpiry(batch.expiryDate, now);
    const take = Math.min(batch.quantity, remainingNeeded);

    allocations.push({
      batch,
      allocatedQuantity: take,
      isNearExpiry: daysUntilExpiry <= thresholdDays,
      daysUntilExpiry,
    });

    remainingNeeded -= take;
  }

  const fulfilledQuantity = requestedQuantity - remainingNeeded;

  return {
    allocations,
    fulfilledQuantity,
    unfulfilledQuantity: Math.max(0, remainingNeeded),
    isFullyFulfilled: remainingNeeded <= 0,
    expiredBatchesSkipped,
  };
}

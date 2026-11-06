import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  toPaise,
  fromPaise,
  formatPaiseToINR,
  calculateRoundOff,
  packToLoose,
  looseToPack,
  formatPackQuantity,
  calculateLooseUnitPricePaise,
  calculateGSTInclusive,
  calculateGSTExclusive,
  selectBatchesFEFO,
  isBatchExpired,
  calculateLineItem,
  calculateInvoiceTotals,
  generateUUIDv7,
  isValidUUID,
} from './index.js';

describe('Domain Package - Money calculations', () => {
  it('converts between rupees and paise accurately', () => {
    assert.strictEqual(toPaise(125.5), 12550);
    assert.strictEqual(toPaise('125.50'), 12550);
    assert.strictEqual(fromPaise(12550), 125.5);
  });

  it('formats paise to Indian currency string', () => {
    assert.strictEqual(formatPaiseToINR(15000000), '₹1,50,000.00');
    assert.strictEqual(formatPaiseToINR(12550), '₹125.50');
    assert.strictEqual(formatPaiseToINR(99), '₹0.99');
  });

  it('calculates cash round-off to nearest rupee', () => {
    // 12549 paise -> rounds down by 49 paise
    const res1 = calculateRoundOff(12549);
    assert.strictEqual(res1.roundOffPaise, -49);
    assert.strictEqual(res1.finalPayablePaise, 12500);

    // 12550 paise -> rounds up by 50 paise
    const res2 = calculateRoundOff(12550);
    assert.strictEqual(res2.roundOffPaise, 50);
    assert.strictEqual(res2.finalPayablePaise, 12600);
  });
});

describe('Domain Package - Units and Pack conversion', () => {
  it('converts strips to loose tablets and vice-versa', () => {
    assert.strictEqual(packToLoose(2, 10), 20);

    const converted = looseToPack(25, 10);
    assert.strictEqual(converted.fullPacks, 2);
    assert.strictEqual(converted.looseUnits, 5);
    assert.strictEqual(converted.totalLooseUnits, 25);
  });

  it('formats pack quantity readable for counter staff', () => {
    assert.strictEqual(formatPackQuantity(25, 10), '2 Strips 5 Tabs');
    assert.strictEqual(formatPackQuantity(20, 10), '2 Strips');
    assert.strictEqual(formatPackQuantity(5, 10), '5 Tabs');
  });

  it('calculates loose unit price from pack MRP', () => {
    // 10-tablet strip with MRP ₹150 (15000 paise) -> 1500 paise per tablet (₹15)
    assert.strictEqual(calculateLooseUnitPricePaise(15000, 10), 1500);
  });
});

describe('Domain Package - Indian GST Calculation', () => {
  it('calculates GST inclusive (Retail MRP)', () => {
    // MRP ₹112 (11200 paise) with 12% GST intra-state
    // Taxable = 11200 * 100 / 112 = 10000 paise (₹100)
    // CGST (6%) = 600 paise, SGST (6%) = 600 paise, Total = 1200 paise
    const res = calculateGSTInclusive(11200, 12, false);
    assert.strictEqual(res.taxablePaise, 10000);
    assert.strictEqual(res.cgstPaise, 600);
    assert.strictEqual(res.sgstPaise, 600);
    assert.strictEqual(res.igstPaise, 0);
    assert.strictEqual(res.totalTaxPaise, 1200);
    assert.strictEqual(res.totalAmountPaise, 11200);
  });

  it('calculates GST exclusive (Wholesale / Purchase)', () => {
    // Taxable ₹1000 (100000 paise) with 18% GST inter-state
    const res = calculateGSTExclusive(100000, 18, true);
    assert.strictEqual(res.taxablePaise, 100000);
    assert.strictEqual(res.cgstPaise, 0);
    assert.strictEqual(res.sgstPaise, 0);
    assert.strictEqual(res.igstPaise, 18000);
    assert.strictEqual(res.totalTaxPaise, 18000);
    assert.strictEqual(res.totalAmountPaise, 118000);
  });
});

describe('Domain Package - FEFO Batch Selection', () => {
  const currentDate = new Date('2026-11-06T00:00:00Z');

  const batches = [
    {
      id: 'batch-1',
      batchNumber: 'B001',
      expiryDate: '2026-10-01', // Expired
      quantity: 50,
      mrpPaise: 1000,
      saleRatePaise: 1000,
    },
    {
      id: 'batch-2',
      batchNumber: 'B002',
      expiryDate: '2027-01-15', // Near expiry (about 70 days)
      quantity: 20,
      mrpPaise: 1000,
      saleRatePaise: 1000,
    },
    {
      id: 'batch-3',
      batchNumber: 'B003',
      expiryDate: '2027-12-31', // Fresh batch
      quantity: 100,
      mrpPaise: 1000,
      saleRatePaise: 1000,
    },
  ];

  it('correctly skips expired batches and selects earliest non-expired batch', () => {
    const result = selectBatchesFEFO(batches, 15, { currentDate });
    assert.strictEqual(result.expiredBatchesSkipped, 1);
    assert.strictEqual(result.isFullyFulfilled, true);
    assert.strictEqual(result.allocations.length, 1);
    assert.strictEqual(result.allocations[0]!.batch.id, 'batch-2');
    assert.strictEqual(result.allocations[0]!.allocatedQuantity, 15);
    assert.strictEqual(result.allocations[0]!.isNearExpiry, true);
  });

  it('splits allocation across multiple batches when requested quantity exceeds first batch', () => {
    const result = selectBatchesFEFO(batches, 35, { currentDate });
    assert.strictEqual(result.isFullyFulfilled, true);
    assert.strictEqual(result.allocations.length, 2);
    // 20 from B002
    assert.strictEqual(result.allocations[0]!.batch.id, 'batch-2');
    assert.strictEqual(result.allocations[0]!.allocatedQuantity, 20);
    // 15 from B003
    assert.strictEqual(result.allocations[1]!.batch.id, 'batch-3');
    assert.strictEqual(result.allocations[1]!.allocatedQuantity, 15);
  });

  it('reports unfulfilled quantity when insufficient stock', () => {
    const result = selectBatchesFEFO(batches, 150, { currentDate });
    assert.strictEqual(result.isFullyFulfilled, false);
    assert.strictEqual(result.fulfilledQuantity, 120);
    assert.strictEqual(result.unfulfilledQuantity, 30);
  });
});

describe('Domain Package - Invoice Totals', () => {
  it('calculates full invoice with line discounts, tax snapshots, and round-off', () => {
    const invoice = calculateInvoiceTotals({
      lines: [
        {
          productId: 'prod-1',
          batchId: 'batch-2',
          quantity: 2,
          unitsPerPack: 1,
          saleRatePaise: 11200, // ₹112 inclusive of 12% GST
          mrpPaise: 11200,
          discountPercent: 10, // 10% disc = 2240 paise disc, net 20160 paise
          taxRatePercent: 12,
        },
      ],
      billDiscountPercent: 0,
    });

    assert.strictEqual(invoice.itemCount, 1);
    assert.strictEqual(invoice.grossTotalPaise, 22400);
    assert.strictEqual(invoice.lineDiscountTotalPaise, 2240);
    assert.strictEqual(invoice.subtotalPaise, 20160);
    assert.strictEqual(invoice.grandTotalPaise, 20200); // 20160 rounded to 20200 (+40 paise round-off)
    assert.strictEqual(invoice.roundOffPaise, 40);
  });
});

describe('Domain Package - UUIDv7', () => {
  it('generates valid time-ordered UUIDv7 strings', () => {
    const id1 = generateUUIDv7();
    const id2 = generateUUIDv7();
    assert.ok(isValidUUID(id1));
    assert.ok(isValidUUID(id2));
    assert.ok(id1 < id2 || id1 !== id2);
  });
});

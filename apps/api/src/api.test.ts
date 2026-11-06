import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createApp } from './app.js';
import { createDatabaseClient, runSeed } from '@algions/db';
import http from 'node:http';

describe('ALGIONS Pharmacy - API Integration & Business Rules Tests', () => {
  let server: http.Server;
  let baseUrl: string;
  let staffToken: string;
  let ownerToken: string;
  let storeId: string;
  let primaryDeviceId: string;
  let doloBatchId: string;
  let doloProductId: string;
  let expiredBatchId: string;

  before(async () => {
    const db = createDatabaseClient(':memory:');
    await runSeed(db);

    const app = createApp(db);
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as { port: number };
        baseUrl = `http://localhost:${address.port}`;
        resolve();
      });
    });

    const store = await db.queryOne<{ id: string; primary_device_id: string }>('SELECT id, primary_device_id FROM stores LIMIT 1');
    storeId = store!.id;
    primaryDeviceId = store!.primary_device_id;

    const doloBatch = await db.queryOne<{ id: string; product_id: string }>(
      "SELECT b.id, b.product_id FROM batches b JOIN products p ON b.product_id = p.id WHERE p.brand_name = 'Dolo 650' AND b.batch_number = 'DOL-26A'"
    );
    doloBatchId = doloBatch!.id;
    doloProductId = doloBatch!.product_id;

    const expBatch = await db.queryOne<{ id: string }>(
      "SELECT id FROM batches WHERE batch_number = 'EXP-TEST-99'"
    );
    expiredBatchId = expBatch!.id;
  });

  after(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });

  it('GET /health returns healthy system status', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.status, 'ok');
    assert.strictEqual(data.activeMode, 'ONLINE');
  });

  it('POST /auth/login logs in Staff user and issues JWT', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'staff1',
        password: 'Staff@Algions2026!',
        deviceId: primaryDeviceId,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.accessToken);
    assert.strictEqual(data.user.accountType, 'STAFF');
    staffToken = data.accessToken;
  });

  it('POST /auth/login for Owner requires MFA verification step', async () => {
    const res = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'owner',
        password: 'Owner@Algions2026!',
        deviceId: primaryDeviceId,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.requiresMfa, true);
    assert.ok(data.tempToken);

    // Verify MFA step
    const mfaRes = await fetch(`${baseUrl}/auth/mfa/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tempToken: data.tempToken,
        code: '123456',
        deviceId: primaryDeviceId,
      }),
    });
    assert.strictEqual(mfaRes.status, 200);
    const mfaData = await mfaRes.json();
    assert.ok(mfaData.accessToken);
    assert.strictEqual(mfaData.user.accountType, 'OWNER');
    ownerToken = mfaData.accessToken;
  });

  it('POST /devices/primary/heartbeat extends lease for primary workstation', async () => {
    const res = await fetch(`${baseUrl}/devices/primary/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        deviceId: primaryDeviceId,
        timestamp: new Date().toISOString(),
        sequence: 1,
      }),
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.acknowledged, true);
    assert.strictEqual(data.isPrimary, true);
  });

  it('GET /products/search returns type-ahead search matching brand and salt', async () => {
    const res = await fetch(`${baseUrl}/products/search?q=dolo`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(data.results.length >= 1);
    const dolo = data.results.find((r: any) => r.product.brandName === 'Dolo 650');
    assert.ok(dolo);
    assert.strictEqual(dolo.product.genericName, 'Paracetamol');
    assert.ok(dolo.batches.length >= 1);
  });

  it('POST /pos/sales executes atomic sale transaction and posts ledger', async () => {
    const idempotencyKey = 'test-idempotent-sale-001';
    const salePayload = {
      lines: [
        {
          productId: doloProductId,
          batchId: doloBatchId,
          quantity: 10,
          unitsPerPack: 15,
          saleRatePaise: 225,
          mrpPaise: 225,
          discountPercent: 0,
          taxRatePercent: 12,
        },
      ],
      payments: [
        {
          mode: 'CASH',
          amountPaise: 2300,
        },
      ],
    };

    const res = await fetch(`${baseUrl}/pos/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(salePayload),
    });

    assert.strictEqual(res.status, 201);
    const invoice = await res.json();
    assert.ok(invoice.id);
    assert.ok(invoice.fullInvoiceNumber.startsWith('ON/26-27/'));
    assert.strictEqual(invoice.grandTotalPaise, 2300);
    assert.strictEqual(invoice.status, 'POSTED');

    // Concurrency / Idempotency Test: Repeat with identical Idempotency-Key returns same invoice!
    const replayRes = await fetch(`${baseUrl}/pos/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(salePayload),
    });
    assert.strictEqual(replayRes.status, 200);
    const replayInvoice = await replayRes.json();
    assert.strictEqual(replayInvoice.id, invoice.id);
    assert.strictEqual(replayInvoice.fullInvoiceNumber, invoice.fullInvoiceNumber);
  });

  it('POST /pos/sales blocks sale of expired batch with 400 BATCH_EXPIRED', async () => {
    const res = await fetch(`${baseUrl}/pos/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
        'Idempotency-Key': 'test-expired-sale-002',
      },
      body: JSON.stringify({
        lines: [
          {
            productId: doloProductId,
            batchId: expiredBatchId,
            quantity: 5,
            unitsPerPack: 10,
            saleRatePaise: 220,
            mrpPaise: 220,
            discountPercent: 0,
            taxRatePercent: 12,
          },
        ],
        payments: [{ mode: 'CASH', amountPaise: 1100 }],
      }),
    });

    assert.strictEqual(res.status, 400);
    const err = await res.json();
    assert.strictEqual(err.code, 'BATCH_EXPIRED');
  });

  it('POST /pos/sales blocks sale if stock is insufficient with 409 INSUFFICIENT_STOCK', async () => {
    const res = await fetch(`${baseUrl}/pos/sales`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${staffToken}`,
        'Idempotency-Key': 'test-insufficient-stock-003',
      },
      body: JSON.stringify({
        lines: [
          {
            productId: doloProductId,
            batchId: doloBatchId,
            quantity: 2000, // Available is ~600
            unitsPerPack: 15,
            saleRatePaise: 225,
            mrpPaise: 225,
            discountPercent: 0,
            taxRatePercent: 12,
          },
        ],
        payments: [{ mode: 'CASH', amountPaise: 450000 }], // 2000 * 225 = 450000
      }),
    });

    assert.strictEqual(res.status, 409);
    const err = await res.json();
    assert.strictEqual(err.code, 'INSUFFICIENT_STOCK');
  });

  it('Route Guard: Deny-by-default blocks unauthorized access to Owner Dashboard', async () => {
    // Unauthenticated
    const unauthRes = await fetch(`${baseUrl}/owner/dashboard`);
    assert.strictEqual(unauthRes.status, 401);

    // Staff access to Owner route
    const staffRes = await fetch(`${baseUrl}/owner/dashboard`, {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.strictEqual(staffRes.status, 403);
    const staffErr = await staffRes.json();
    assert.strictEqual(staffErr.code, 'FORBIDDEN');

    // Owner access allowed
    const ownerRes = await fetch(`${baseUrl}/owner/dashboard`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
    });
    assert.strictEqual(ownerRes.status, 200);
    const dashData = await ownerRes.json();
    assert.ok(dashData.todaySalesPaise > 0);
    assert.strictEqual(dashData.isStale, false);
  });
});

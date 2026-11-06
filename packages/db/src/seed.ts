import { createDatabaseClient, IDatabase } from './client.js';
import { generateUUIDv7 } from '@algions/domain';
import { hashPassword, hashPin } from './hash.js';
import path from 'node:path';
import fs from 'node:fs';

export async function runSeed(targetDb?: IDatabase): Promise<void> {
  const db = targetDb || createDatabaseClient();
  console.log('Seeding ALGIONS Pharmacy Database...');

  // If SQLite, run schema setup
  if (!db.isPostgres()) {
    const schemaSql = `
    CREATE TABLE IF NOT EXISTS stores (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        legal_name TEXT NOT NULL,
        gstin TEXT NOT NULL,
        state_code TEXT NOT NULL DEFAULT '07',
        dl_number_20b TEXT NOT NULL,
        dl_number_21b TEXT NOT NULL,
        address TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        active_mode TEXT NOT NULL DEFAULT 'ONLINE',
        primary_device_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        username TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        account_type TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        mfa_secret TEXT,
        is_mfa_enabled INTEGER NOT NULL DEFAULT 0,
        quick_pin_hash TEXT,
        max_discount_percent REAL NOT NULL DEFAULT 10.00,
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        name TEXT NOT NULL,
        is_primary_offline INTEGER NOT NULL DEFAULT 0,
        public_key TEXT NOT NULL,
        enrolment_code TEXT,
        app_version TEXT NOT NULL DEFAULT '1.0.0',
        status TEXT NOT NULL DEFAULT 'ACTIVE',
        last_heartbeat TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS store_heartbeat_leases (
        store_id TEXT PRIMARY KEY,
        primary_device_id TEXT NOT NULL,
        lease_expires_at TEXT NOT NULL,
        last_heartbeat TEXT NOT NULL,
        nonce TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        brand_name TEXT NOT NULL,
        generic_name TEXT NOT NULL,
        strength TEXT NOT NULL DEFAULT '',
        dosage_form TEXT NOT NULL,
        manufacturer TEXT NOT NULL,
        barcodes TEXT NOT NULL DEFAULT '[]',
        hsn_code TEXT NOT NULL DEFAULT '3004',
        tax_category TEXT NOT NULL DEFAULT 'GST_12',
        tax_rate_percent REAL NOT NULL DEFAULT 12.00,
        units_per_pack INTEGER NOT NULL DEFAULT 10,
        pack_unit_label TEXT NOT NULL DEFAULT 'Strip',
        loose_unit_label TEXT NOT NULL DEFAULT 'Tablet',
        rack_location TEXT,
        reorder_level INTEGER NOT NULL DEFAULT 10,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS suppliers (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        name TEXT NOT NULL,
        gstin TEXT,
        phone TEXT,
        address TEXT,
        credit_period_days INTEGER NOT NULL DEFAULT 30,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        mfg_date TEXT,
        expiry_date TEXT NOT NULL,
        mrp_paise INTEGER NOT NULL,
        sale_rate_paise INTEGER NOT NULL,
        purchase_rate_paise INTEGER NOT NULL DEFAULT 0,
        quantity INTEGER NOT NULL DEFAULT 0,
        supplier_id TEXT,
        rack_location TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stock_movements (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        movement_type TEXT NOT NULL,
        signed_quantity INTEGER NOT NULL,
        source_document_type TEXT NOT NULL,
        source_document_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        notes TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone TEXT NOT NULL,
        email TEXT,
        address TEXT,
        credit_limit_paise INTEGER NOT NULL DEFAULT 0,
        outstanding_balance_paise INTEGER NOT NULL DEFAULT 0,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doctors (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        name TEXT NOT NULL,
        reg_number TEXT,
        specialization TEXT,
        hospital_clinic TEXT,
        phone TEXT,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_invoices (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        customer_id TEXT,
        customer_name TEXT,
        customer_phone TEXT,
        doctor_id TEXT,
        doctor_name TEXT,
        invoice_series TEXT NOT NULL,
        invoice_number TEXT NOT NULL,
        full_invoice_number TEXT NOT NULL,
        is_offline_origin INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'POSTED',
        item_count INTEGER NOT NULL,
        total_units INTEGER NOT NULL,
        gross_total_paise INTEGER NOT NULL,
        line_discount_total_paise INTEGER NOT NULL DEFAULT 0,
        subtotal_paise INTEGER NOT NULL,
        bill_discount_paise INTEGER NOT NULL DEFAULT 0,
        total_discount_paise INTEGER NOT NULL DEFAULT 0,
        taxable_total_paise INTEGER NOT NULL,
        cgst_total_paise INTEGER NOT NULL,
        sgst_total_paise INTEGER NOT NULL,
        igst_total_paise INTEGER NOT NULL,
        tax_total_paise INTEGER NOT NULL,
        round_off_paise INTEGER NOT NULL DEFAULT 0,
        grand_total_paise INTEGER NOT NULL,
        idempotency_key TEXT NOT NULL UNIQUE,
        notes TEXT,
        occurred_at_local TEXT,
        void_reason TEXT,
        voided_at TEXT,
        voided_by TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sales_lines (
        id TEXT PRIMARY KEY,
        sales_invoice_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        product_name TEXT NOT NULL,
        generic_name TEXT,
        batch_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        quantity INTEGER NOT NULL,
        units_per_pack INTEGER NOT NULL DEFAULT 1,
        sale_rate_paise INTEGER NOT NULL,
        mrp_paise INTEGER NOT NULL,
        discount_percent REAL NOT NULL DEFAULT 0.00,
        discount_paise INTEGER NOT NULL DEFAULT 0,
        taxable_amount_paise INTEGER NOT NULL,
        tax_rate_percent REAL NOT NULL DEFAULT 12.00,
        cgst_paise INTEGER NOT NULL DEFAULT 0,
        sgst_paise INTEGER NOT NULL DEFAULT 0,
        igst_paise INTEGER NOT NULL DEFAULT 0,
        total_tax_paise INTEGER NOT NULL DEFAULT 0,
        final_line_total_paise INTEGER NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        sales_invoice_id TEXT,
        mode TEXT NOT NULL,
        amount_paise INTEGER NOT NULL,
        reference_number TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_invoices (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        supplier_id TEXT NOT NULL,
        supplier_invoice_number TEXT NOT NULL,
        supplier_invoice_date TEXT NOT NULL,
        total_amount_paise INTEGER NOT NULL,
        total_tax_paise INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'POSTED',
        notes TEXT,
        created_by TEXT NOT NULL,
        reviewed_by TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS purchase_lines (
        id TEXT PRIMARY KEY,
        purchase_invoice_id TEXT NOT NULL,
        product_id TEXT NOT NULL,
        batch_id TEXT NOT NULL,
        batch_number TEXT NOT NULL,
        expiry_date TEXT NOT NULL,
        quantity_packs INTEGER NOT NULL,
        free_quantity_packs INTEGER NOT NULL DEFAULT 0,
        units_per_pack INTEGER NOT NULL,
        purchase_rate_paise INTEGER NOT NULL,
        mrp_paise INTEGER NOT NULL,
        sale_rate_paise INTEGER NOT NULL,
        tax_rate_percent REAL NOT NULL DEFAULT 12.00,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ledger_entries (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        transaction_id TEXT NOT NULL,
        entry_date TEXT NOT NULL,
        account_code TEXT NOT NULL,
        account_name TEXT NOT NULL,
        category TEXT NOT NULL,
        debit_paise INTEGER NOT NULL DEFAULT 0,
        credit_paise INTEGER NOT NULL DEFAULT 0,
        narration TEXT NOT NULL,
        reference_document_type TEXT NOT NULL,
        reference_document_id TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_events (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        local_sequence INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        schema_version INTEGER NOT NULL DEFAULT 1,
        occurred_at_local TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload_hash TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS processed_events (
        event_id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        processed_at TEXT NOT NULL,
        result_summary TEXT
    );

    CREATE TABLE IF NOT EXISTS reconciliation_exceptions (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL,
        store_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        exception_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        details TEXT NOT NULL,
        resolution_notes TEXT,
        resolved_by_user_id TEXT,
        resolved_at TEXT,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        account_type TEXT NOT NULL,
        device_id TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        entity_id TEXT,
        before_state TEXT,
        after_state TEXT,
        reason TEXT,
        ip_address TEXT,
        prev_hash TEXT NOT NULL,
        current_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS held_bills (
        id TEXT PRIMARY KEY,
        store_id TEXT NOT NULL,
        device_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        customer_name TEXT,
        customer_phone TEXT,
        lines_json TEXT NOT NULL,
        held_at TEXT NOT NULL
    );
    `;
    const statements = schemaSql.split(';');
    for (const stmt of statements) {
      if (stmt.trim()) {
        await db.execute(stmt);
      }
    }
  }

  // Check if already seeded
  const storeCheck = await db.queryOne<{ id: string }>('SELECT id FROM stores LIMIT 1');
  if (storeCheck) {
    console.log('Database already has store data, skipping seed.');
    return;
  }

  const storeId = generateUUIDv7();
  const ownerId = generateUUIDv7();
  const staff1Id = generateUUIDv7();
  const staff2Id = generateUUIDv7();
  const primaryDeviceId = 'dev-primary-01-0000-0000-000000000001';
  const counter2DeviceId = 'dev-counter-02-0000-0000-000000000002';

  const nowIso = new Date().toISOString();

  // 1. Seed Store Profile
  await db.execute(
    `INSERT INTO stores (id, name, legal_name, gstin, state_code, dl_number_20b, dl_number_21b, address, phone, email, active_mode, primary_device_id, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
    [
      storeId,
      'ALGIONS Health Pharmacy',
      'ALGIONS AI LABS PRIVATE LIMITED',
      '07AAAAA0000A1Z5',
      '07', // Delhi
      'DL-20B-12345/2026',
      'DL-21B-67890/2026',
      'Shop 4, Ground Floor, Sector 14 Market, Delhi 110001',
      '+91 98765 43210',
      'pharmacy@algions.com',
      'ONLINE',
      primaryDeviceId,
      nowIso,
      nowIso,
    ]
  );

  // 2. Seed Users (Owner and Staff)
  const ownerPasswordHash = hashPassword('Owner@Algions2026!');
  const staffPasswordHash = hashPassword('Staff@Algions2026!');
  const ownerPinHash = hashPin('9999');
  const staff1PinHash = hashPin('1234');
  const staff2PinHash = hashPin('5678');

  // Single Owner per store (V1 requirement)
  await db.execute(
    `INSERT INTO users (id, store_id, username, name, account_type, password_hash, mfa_secret, is_mfa_enabled, quick_pin_hash, max_discount_percent, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      ownerId,
      storeId,
      'owner',
      'Rajesh Sharma (Owner)',
      'OWNER',
      ownerPasswordHash,
      'JBSWY3DPEHPK3PXP', // Base32 sample MFA secret
      1,
      ownerPinHash,
      100.0,
      'ACTIVE',
      nowIso,
      nowIso,
    ]
  );

  // Staff User 1
  await db.execute(
    `INSERT INTO users (id, store_id, username, name, account_type, password_hash, quick_pin_hash, max_discount_percent, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      staff1Id,
      storeId,
      'staff1',
      'Vikram Verma (Counter Staff)',
      'STAFF',
      staffPasswordHash,
      staff1PinHash,
      10.0, // 10% staff discount cap per AUTH-012
      'ACTIVE',
      nowIso,
      nowIso,
    ]
  );

  // Staff User 2
  await db.execute(
    `INSERT INTO users (id, store_id, username, name, account_type, password_hash, quick_pin_hash, max_discount_percent, status, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      staff2Id,
      storeId,
      'staff2',
      'Priya Nair (Counter Staff)',
      'STAFF',
      staffPasswordHash,
      staff2PinHash,
      10.0,
      'ACTIVE',
      nowIso,
      nowIso,
    ]
  );

  // 3. Seed Devices & Heartbeat Lease
  const leaseExpiry = new Date(Date.now() + 60 * 1000).toISOString();
  await db.execute(
    `INSERT INTO devices (id, store_id, name, is_primary_offline, public_key, enrolment_code, app_version, status, last_heartbeat, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      primaryDeviceId,
      storeId,
      'Counter 1 (Primary Offline Workstation)',
      1,
      'PUBKEY-COUNTER-01-PRIMARY-ED25519',
      'ENROL-PRIMARY-01',
      '1.0.0',
      'ACTIVE',
      nowIso,
      nowIso,
    ]
  );

  await db.execute(
    `INSERT INTO devices (id, store_id, name, is_primary_offline, public_key, enrolment_code, app_version, status, last_heartbeat, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      counter2DeviceId,
      storeId,
      'Counter 2 (Online POS Terminal)',
      0,
      'PUBKEY-COUNTER-02-ONLINE-ED25519',
      'ENROL-COUNTER-02',
      '1.0.0',
      'ACTIVE',
      nowIso,
      nowIso,
    ]
  );

  // Primary Heartbeat lease active
  await db.execute(
    `INSERT INTO store_heartbeat_leases (store_id, primary_device_id, lease_expires_at, last_heartbeat, nonce)
     VALUES ($1, $2, $3, $4, $5)`,
    [storeId, primaryDeviceId, leaseExpiry, nowIso, 'nonce-initial-boot']
  );

  // 4. Seed Suppliers
  const suppliers = [
    {
      id: generateUUIDv7(),
      name: 'Apollo MedSource Distribution',
      gstin: '07AAACA1234A1Z1',
      phone: '+91 11 2345 6789',
      address: 'Industrial Area Okhla Phase 2, New Delhi',
      creditPeriodDays: 30,
    },
    {
      id: generateUUIDv7(),
      name: 'Cipla Direct Wholesale Agency',
      gstin: '07BBBCB5678B1Z2',
      phone: '+91 11 4567 8901',
      address: 'Naraina Industrial Area, New Delhi',
      creditPeriodDays: 21,
    },
    {
      id: generateUUIDv7(),
      name: 'Sun Pharma Logistics Hub',
      gstin: '07CCCC59012C1Z3',
      phone: '+91 11 3456 7890',
      address: 'Kirti Nagar, New Delhi',
      creditPeriodDays: 45,
    },
    {
      id: generateUUIDv7(),
      name: 'Mankind Healthcare Distro',
      gstin: '07DDDD3456D1Z4',
      phone: '+91 11 5678 1234',
      address: 'Mayapuri Phase 1, New Delhi',
      creditPeriodDays: 30,
    },
  ];

  for (const s of suppliers) {
    await db.execute(
      `INSERT INTO suppliers (id, store_id, name, gstin, phone, address, credit_period_days, is_active, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [s.id, storeId, s.name, s.gstin, s.phone, s.address, s.creditPeriodDays, 1, nowIso]
    );
  }

  // 5. Seed Customers
  const customer1Id = generateUUIDv7();
  await db.execute(
    `INSERT INTO customers (id, store_id, name, phone, email, address, credit_limit_paise, outstanding_balance_paise, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      customer1Id,
      storeId,
      'Amitabh Banerjee',
      '9811223344',
      'amitabh.b@example.com',
      'A-42, South Extension, New Delhi',
      500000, // ₹5,000 credit limit
      0,
      1,
      nowIso,
    ]
  );

  // 6. Seed Doctors
  const doctor1Id = generateUUIDv7();
  await db.execute(
    `INSERT INTO doctors (id, store_id, name, reg_number, specialization, hospital_clinic, phone, is_active, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      doctor1Id,
      storeId,
      'Dr. Ananya Sengupta, MD',
      'DMC-44821',
      'General Medicine',
      'Max Super Speciality Hospital',
      '+91 9988776655',
      1,
      nowIso,
    ]
  );

  // 7. Seed Medicines Catalogue (Realistic Indian Essential Medicines)
  const catalogue = [
    {
      brand: 'Dolo 650',
      generic: 'Paracetamol',
      strength: '650 mg',
      form: 'TABLET',
      mfg: 'Micro Labs Ltd',
      barcode: '8901031023011',
      hsn: '30049060',
      taxRate: 12,
      unitsPerPack: 15,
      packLabel: 'Strip',
      looseLabel: 'Tab',
      rack: 'Rack A1',
      reorder: 50,
      batches: [
        {
          num: 'DOL-26A',
          mfg: '2026-01-01',
          expiry: '2027-12-31',
          mrp: 3375, // ₹33.75 for 15 tabs (~₹2.25/tab)
          rate: 3375,
          cost: 2150,
          qty: 600, // 40 strips
        },
        {
          num: 'DOL-25X',
          mfg: '2025-06-01',
          expiry: '2026-12-15', // Near expiry (approx 40 days)
          mrp: 3150,
          rate: 3150,
          cost: 2000,
          qty: 75, // 5 strips
        },
      ],
    },
    {
      brand: 'Augmentin 625 Duo',
      generic: 'Amoxicillin + Potassium Clavulanate',
      strength: '500 mg + 125 mg',
      form: 'TABLET',
      mfg: 'GlaxoSmithKline Pharmaceuticals',
      barcode: '8901031045022',
      hsn: '30041010',
      taxRate: 12,
      unitsPerPack: 10,
      packLabel: 'Strip',
      looseLabel: 'Tab',
      rack: 'Rack B1',
      reorder: 30,
      batches: [
        {
          num: 'AUG-881',
          mfg: '2026-03-01',
          expiry: '2027-08-31',
          mrp: 20500, // ₹205.00 for 10 tabs (₹20.50/tab)
          rate: 20500,
          cost: 14800,
          qty: 250, // 25 strips
        },
      ],
    },
    {
      brand: 'Moxikind CV 625',
      generic: 'Amoxicillin + Potassium Clavulanate',
      strength: '500 mg + 125 mg',
      form: 'TABLET',
      mfg: 'Mankind Pharma Ltd',
      barcode: '8901031045099',
      hsn: '30041010',
      taxRate: 12,
      unitsPerPack: 10,
      packLabel: 'Strip',
      looseLabel: 'Tab',
      rack: 'Rack B1',
      reorder: 30,
      batches: [
        {
          num: 'MOX-112',
          mfg: '2026-02-15',
          expiry: '2027-09-30',
          mrp: 17800, // ₹178.00 for 10 tabs
          rate: 17800,
          cost: 12500,
          qty: 300,
        },
      ],
    },
    {
      brand: 'Azee 500',
      generic: 'Azithromycin',
      strength: '500 mg',
      form: 'TABLET',
      mfg: 'Cipla Ltd',
      barcode: '8901031056033',
      hsn: '30042010',
      taxRate: 12,
      unitsPerPack: 5,
      packLabel: 'Strip',
      looseLabel: 'Tab',
      rack: 'Rack A2',
      reorder: 25,
      batches: [
        {
          num: 'AZ-902',
          mfg: '2026-04-01',
          expiry: '2028-03-31',
          mrp: 11950, // ₹119.50 for 5 tabs (₹23.90/tab)
          rate: 11950,
          cost: 8200,
          qty: 200,
        },
      ],
    },
    {
      brand: 'Pan 40',
      generic: 'Pantoprazole',
      strength: '40 mg',
      form: 'TABLET',
      mfg: 'Alkem Laboratories Ltd',
      barcode: '8901031067044',
      hsn: '30049099',
      taxRate: 12,
      unitsPerPack: 15,
      packLabel: 'Strip',
      looseLabel: 'Tab',
      rack: 'Rack C1',
      reorder: 40,
      batches: [
        {
          num: 'PAN-442',
          mfg: '2026-05-01',
          expiry: '2028-04-30',
          mrp: 15500, // ₹155.00 for 15 tabs
          rate: 15500,
          cost: 10400,
          qty: 450,
        },
      ],
    },
    {
      brand: 'Pan-D',
      generic: 'Pantoprazole + Domperidone',
      strength: '40 mg + 30 mg SR',
      form: 'CAPSULE',
      mfg: 'Alkem Laboratories Ltd',
      barcode: '8901031067055',
      hsn: '30049099',
      taxRate: 12,
      unitsPerPack: 15,
      packLabel: 'Strip',
      looseLabel: 'Cap',
      rack: 'Rack C1',
      reorder: 40,
      batches: [
        {
          num: 'PND-781',
          mfg: '2026-04-10',
          expiry: '2028-03-31',
          mrp: 21500, // ₹215.00 for 15 caps
          rate: 21500,
          cost: 14500,
          qty: 375,
        },
      ],
    },
    {
      brand: 'Glycomet 500 SR',
      generic: 'Metformin Hydrochloride',
      strength: '500 mg',
      form: 'TABLET',
      mfg: 'USV Ltd',
      barcode: '8901031078066',
      hsn: '30049099',
      taxRate: 12,
      unitsPerPack: 20,
      packLabel: 'Strip',
      looseLabel: 'Tab',
      rack: 'Rack D2',
      reorder: 50,
      batches: [
        {
          num: 'GLY-311',
          mfg: '2026-01-10',
          expiry: '2028-06-30',
          mrp: 5200, // ₹52.00 for 20 tabs
          rate: 5200,
          cost: 3400,
          qty: 800,
        },
      ],
    },
    {
      brand: 'Telma 40',
      generic: 'Telmisartan',
      strength: '40 mg',
      form: 'TABLET',
      mfg: 'Glenmark Pharmaceuticals',
      barcode: '8901031089077',
      hsn: '30049099',
      taxRate: 12,
      unitsPerPack: 30,
      packLabel: 'Strip',
      looseLabel: 'Tab',
      rack: 'Rack D1',
      reorder: 30,
      batches: [
        {
          num: 'TEL-550',
          mfg: '2026-03-15',
          expiry: '2028-02-28',
          mrp: 23500, // ₹235.00 for 30 tabs
          rate: 23500,
          cost: 16000,
          qty: 600,
        },
      ],
    },
    {
      brand: 'Montair LC',
      generic: 'Montelukast + Levocetirizine',
      strength: '10 mg + 5 mg',
      form: 'TABLET',
      mfg: 'Cipla Ltd',
      barcode: '8901031090088',
      hsn: '30049099',
      taxRate: 12,
      unitsPerPack: 15,
      packLabel: 'Strip',
      looseLabel: 'Tab',
      rack: 'Rack A3',
      reorder: 30,
      batches: [
        {
          num: 'MLC-910',
          mfg: '2026-02-01',
          expiry: '2027-11-30',
          mrp: 31000, // ₹310.00 for 15 tabs
          rate: 31000,
          cost: 21500,
          qty: 450,
        },
      ],
    },
    {
      brand: 'Ascoril D Plus Syrup',
      generic: 'Dextromethorphan + Phenylephrine + Chlorpheniramine',
      strength: '100 ml',
      form: 'SYRUP',
      mfg: 'Glenmark Pharmaceuticals',
      barcode: '8901031011099',
      hsn: '30049099',
      taxRate: 12,
      unitsPerPack: 1,
      packLabel: 'Bottle',
      looseLabel: 'Bottle',
      rack: 'Rack E1',
      reorder: 20,
      batches: [
        {
          num: 'ASC-104',
          mfg: '2026-04-01',
          expiry: '2028-03-31',
          mrp: 12900, // ₹129.00
          rate: 12900,
          cost: 8800,
          qty: 45,
        },
      ],
    },
    {
      brand: 'Shelcal 500',
      generic: 'Calcium + Vitamin D3',
      strength: '500 mg + 250 IU',
      form: 'TABLET',
      mfg: 'Torrent Pharmaceuticals Ltd',
      barcode: '8901031022010',
      hsn: '30049099',
      taxRate: 12,
      unitsPerPack: 15,
      packLabel: 'Strip',
      looseLabel: 'Tab',
      rack: 'Rack F1',
      reorder: 30,
      batches: [
        {
          num: 'SHL-661',
          mfg: '2026-01-15',
          expiry: '2027-12-31',
          mrp: 14200, // ₹142.00
          rate: 14200,
          cost: 9500,
          qty: 300,
        },
      ],
    },
    {
      brand: 'Volini Pain Relief Gel',
      generic: 'Diclofenac Diethylamine + Virgin Linseed Oil + Methyl Salicylate',
      strength: '30 g',
      form: 'CREAM',
      mfg: 'Sun Pharma Ltd',
      barcode: '8901031033020',
      hsn: '30049099',
      taxRate: 12,
      unitsPerPack: 1,
      packLabel: 'Tube',
      looseLabel: 'Tube',
      rack: 'Rack G1',
      reorder: 15,
      batches: [
        {
          num: 'VOL-802',
          mfg: '2026-03-01',
          expiry: '2028-02-28',
          mrp: 16500, // ₹165.00
          rate: 16500,
          cost: 11200,
          qty: 60,
        },
      ],
    },
    // Expired Batch Sample (for testing FR-EXP-2: Block sale of expired batches)
    {
      brand: 'Cetzine Expired Test Drug',
      generic: 'Cetirizine Hydrochloride',
      strength: '10 mg',
      form: 'TABLET',
      mfg: "Dr. Reddy's Laboratories",
      barcode: '8901031099999',
      hsn: '30049099',
      taxRate: 12,
      unitsPerPack: 10,
      packLabel: 'Strip',
      looseLabel: 'Tab',
      rack: 'Quarantine Box',
      reorder: 10,
      batches: [
        {
          num: 'EXP-TEST-99',
          mfg: '2024-01-01',
          expiry: '2025-10-31', // Expired
          mrp: 2200,
          rate: 2200,
          cost: 1400,
          qty: 50,
        },
      ],
    },
  ];

  for (const item of catalogue) {
    const prodId = generateUUIDv7();
    const barcodesJson = JSON.stringify([item.barcode]);

    await db.execute(
      `INSERT INTO products (id, store_id, brand_name, generic_name, strength, dosage_form, manufacturer, barcodes, hsn_code, tax_category, tax_rate_percent, units_per_pack, pack_unit_label, loose_unit_label, rack_location, reorder_level, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)`,
      [
        prodId,
        storeId,
        item.brand,
        item.generic,
        item.strength,
        item.form,
        item.mfg,
        barcodesJson,
        item.hsn,
        'GST_12',
        item.taxRate,
        item.unitsPerPack,
        item.packLabel,
        item.looseLabel,
        item.rack,
        item.reorder,
        1,
        nowIso,
        nowIso,
      ]
    );

    for (const b of item.batches) {
      const batchId = generateUUIDv7();
      await db.execute(
        `INSERT INTO batches (id, store_id, product_id, batch_number, mfg_date, expiry_date, mrp_paise, sale_rate_paise, purchase_rate_paise, quantity, supplier_id, rack_location, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
        [
          batchId,
          storeId,
          prodId,
          b.num,
          b.mfg,
          b.expiry,
          b.mrp,
          b.rate,
          b.cost,
          b.qty,
          suppliers[0]!.id,
          item.rack,
          nowIso,
          nowIso,
        ]
      );

      // Record positive stock movement (Opening stock / initial purchase)
      const movementId = generateUUIDv7();
      await db.execute(
        `INSERT INTO stock_movements (id, store_id, batch_id, movement_type, signed_quantity, source_document_type, source_document_id, user_id, device_id, notes, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          movementId,
          storeId,
          batchId,
          'PURCHASE',
          b.qty,
          'OPENING_STOCK',
          'DOC-INIT-OPENING',
          ownerId,
          primaryDeviceId,
          'Initial opening stock',
          nowIso,
        ]
      );
    }
  }

  // 8. Seed Chart of Accounts
  const initialAccounts = [
    { code: '1000', name: 'Cash in Hand', category: 'ASSET' },
    { code: '1010', name: 'HDFC Current Bank Account', category: 'ASSET' },
    { code: '1200', name: 'Accounts Receivable (Customers)', category: 'ASSET' },
    { code: '1300', name: 'Medicine Inventory Asset', category: 'ASSET' },
    { code: '2000', name: 'Accounts Payable (Suppliers)', category: 'LIABILITY' },
    { code: '2100', name: 'CGST Payable Output', category: 'LIABILITY' },
    { code: '2110', name: 'SGST Payable Output', category: 'LIABILITY' },
    { code: '2120', name: 'IGST Payable Output', category: 'LIABILITY' },
    { code: '4000', name: 'Retail Medicine Sales', category: 'REVENUE' },
    { code: '5000', name: 'Cost of Goods Sold (Purchases)', category: 'EXPENSE' },
  ];

  for (const acc of initialAccounts) {
    const entryId = generateUUIDv7();
    await db.execute(
      `INSERT INTO ledger_entries (id, store_id, transaction_id, entry_date, account_code, account_name, category, debit_paise, credit_paise, narration, reference_document_type, reference_document_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        entryId,
        storeId,
        'TX-INIT-001',
        '2026-11-01',
        acc.code,
        acc.name,
        acc.category,
        0,
        0,
        'Initial Chart of Accounts Opening',
        'SETUP',
        'SETUP-001',
        nowIso,
      ]
    );
  }

  console.log('✅ Seed completed successfully!');
  console.log('Store ID:', storeId);
  console.log('Owner credentials: username="owner", password="Owner@Algions2026!", PIN="9999"');
  console.log('Staff 1 credentials: username="staff1", password="Staff@Algions2026!", PIN="1234"');
  console.log('Staff 2 credentials: username="staff2", password="Staff@Algions2026!", PIN="5678"');
  console.log('Primary Workstation ID:', primaryDeviceId);
}

// Allow direct CLI execution
if (process.argv[1] && (process.argv[1].endsWith('seed.js') || process.argv[1].endsWith('seed.ts'))) {
  runSeed().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  });
}

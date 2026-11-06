-- ============================================================================
-- ALGIONS Pharmacy - SQLite Schema (Primary Offline Workstation & Local Engine)
-- Designed per Technical Architecture Document (TAD) v1.0 Section 9 & 10
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- Store info cache
CREATE TABLE IF NOT EXISTS local_store (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    legal_name TEXT NOT NULL,
    gstin TEXT NOT NULL,
    state_code TEXT NOT NULL DEFAULT '07',
    dl_number_20b TEXT NOT NULL,
    dl_number_21b TEXT NOT NULL,
    address TEXT NOT NULL,
    phone TEXT NOT NULL,
    is_primary_workstation INTEGER NOT NULL DEFAULT 1,
    cached_at TEXT NOT NULL
);

-- Cached user verifiers (Argon2id hashes)
CREATE TABLE IF NOT EXISTS local_users (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    username TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    account_type TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    quick_pin_hash TEXT,
    max_discount_percent REAL NOT NULL DEFAULT 10.0,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    updated_at TEXT NOT NULL
);

-- Cached Products snapshot
CREATE TABLE IF NOT EXISTS local_products (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    brand_name TEXT NOT NULL,
    generic_name TEXT NOT NULL,
    strength TEXT NOT NULL,
    dosage_form TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    barcodes_json TEXT NOT NULL DEFAULT '[]',
    hsn_code TEXT NOT NULL,
    tax_category TEXT NOT NULL,
    tax_rate_percent REAL NOT NULL,
    units_per_pack INTEGER NOT NULL,
    pack_unit_label TEXT NOT NULL,
    loose_unit_label TEXT NOT NULL,
    rack_location TEXT,
    reorder_level INTEGER NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1
);

-- Cached Batches snapshot with local stock balance
CREATE TABLE IF NOT EXISTS local_batches (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    batch_number TEXT NOT NULL,
    mfg_date TEXT,
    expiry_date TEXT NOT NULL,
    mrp_paise INTEGER NOT NULL,
    sale_rate_paise INTEGER NOT NULL,
    purchase_rate_paise INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    rack_location TEXT,
    FOREIGN KEY(product_id) REFERENCES local_products(id)
);

-- Offline Sales Invoices
CREATE TABLE IF NOT EXISTS local_sales_invoices (
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
    status TEXT NOT NULL DEFAULT 'POSTED',
    item_count INTEGER NOT NULL,
    total_units INTEGER NOT NULL,
    gross_total_paise INTEGER NOT NULL,
    line_discount_total_paise INTEGER NOT NULL,
    subtotal_paise INTEGER NOT NULL,
    bill_discount_paise INTEGER NOT NULL,
    total_discount_paise INTEGER NOT NULL,
    taxable_total_paise INTEGER NOT NULL,
    cgst_total_paise INTEGER NOT NULL,
    sgst_total_paise INTEGER NOT NULL,
    igst_total_paise INTEGER NOT NULL,
    tax_total_paise INTEGER NOT NULL,
    round_off_paise INTEGER NOT NULL,
    grand_total_paise INTEGER NOT NULL,
    idempotency_key TEXT NOT NULL UNIQUE,
    notes TEXT,
    occurred_at_local TEXT NOT NULL,
    sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK(sync_status IN ('PENDING', 'SYNCING', 'SYNCED', 'SYNC_EXCEPTION')),
    synced_at TEXT,
    created_at TEXT NOT NULL
);

-- Offline Sales Lines
CREATE TABLE IF NOT EXISTS local_sales_lines (
    id TEXT PRIMARY KEY,
    sales_invoice_id TEXT NOT NULL,
    product_id TEXT NOT NULL,
    batch_id TEXT NOT NULL,
    product_name TEXT NOT NULL,
    generic_name TEXT,
    batch_number TEXT NOT NULL,
    expiry_date TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    units_per_pack INTEGER NOT NULL,
    sale_rate_paise INTEGER NOT NULL,
    mrp_paise INTEGER NOT NULL,
    discount_percent REAL NOT NULL,
    discount_paise INTEGER NOT NULL,
    taxable_amount_paise INTEGER NOT NULL,
    tax_rate_percent REAL NOT NULL,
    cgst_paise INTEGER NOT NULL,
    sgst_paise INTEGER NOT NULL,
    igst_paise INTEGER NOT NULL,
    total_tax_paise INTEGER NOT NULL,
    final_line_total_paise INTEGER NOT NULL,
    FOREIGN KEY(sales_invoice_id) REFERENCES local_sales_invoices(id)
);

-- Offline Stock Movements
CREATE TABLE IF NOT EXISTS local_stock_movements (
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

-- Offline Payments
CREATE TABLE IF NOT EXISTS local_payments (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    sales_invoice_id TEXT NOT NULL,
    mode TEXT NOT NULL,
    amount_paise INTEGER NOT NULL,
    reference_number TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY(sales_invoice_id) REFERENCES local_sales_invoices(id)
);

-- Offline Double-Entry Ledger
CREATE TABLE IF NOT EXISTS local_ledger_entries (
    id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    transaction_id TEXT NOT NULL,
    entry_date TEXT NOT NULL,
    account_code TEXT NOT NULL,
    account_name TEXT NOT NULL,
    category TEXT NOT NULL,
    debit_paise INTEGER NOT NULL,
    credit_paise INTEGER NOT NULL,
    narration TEXT NOT NULL,
    reference_document_type TEXT NOT NULL,
    reference_document_id TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Offline Tamper-Evident Audit Log
CREATE TABLE IF NOT EXISTS local_audit_logs (
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
    prev_hash TEXT NOT NULL,
    current_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
);

-- Outbox Table: Transactions waiting to be uploaded to cloud
CREATE TABLE IF NOT EXISTS outbox_events (
    event_id TEXT PRIMARY KEY,
    store_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    local_sequence INTEGER NOT NULL UNIQUE,
    event_type TEXT NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    occurred_at_local TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    payload_hash TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING', 'IN_FLIGHT', 'ACKNOWLEDGED', 'FAILED')),
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_attempt_at TEXT,
    last_error TEXT,
    created_at TEXT NOT NULL
);

-- Sync State tracking
CREATE TABLE IF NOT EXISTS local_sync_state (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

-- Held bills
CREATE TABLE IF NOT EXISTS local_held_bills (
    id TEXT PRIMARY KEY,
    customer_name TEXT,
    customer_phone TEXT,
    lines_json TEXT NOT NULL,
    held_at TEXT NOT NULL
);

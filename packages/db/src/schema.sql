-- ============================================================================
-- ALGIONS Pharmacy - PostgreSQL Production Schema
-- Designed per Technical Architecture Document (TAD) v1.0 Section 7
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Stores (Single Shop Profile)
CREATE TABLE IF NOT EXISTS stores (
    id VARCHAR(36) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    legal_name VARCHAR(255) NOT NULL,
    gstin VARCHAR(15) NOT NULL,
    state_code VARCHAR(2) NOT NULL DEFAULT '07',
    dl_number_20b VARCHAR(100) NOT NULL,
    dl_number_21b VARCHAR(100) NOT NULL,
    address TEXT NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    active_mode VARCHAR(30) NOT NULL DEFAULT 'ONLINE' CHECK (active_mode IN ('ONLINE', 'OFFLINE_STORE', 'RECOVERY_SYNCING', 'DEGRADED_CONFLICT')),
    primary_device_id VARCHAR(36),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 2. Users (Owner & Staff Accounts Only - No granular roles/permission tables)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    username VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    account_type VARCHAR(10) NOT NULL CHECK (account_type IN ('OWNER', 'STAFF')),
    password_hash VARCHAR(255) NOT NULL,
    mfa_secret VARCHAR(255),
    is_mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    quick_pin_hash VARCHAR(255),
    max_discount_percent NUMERIC(5,2) NOT NULL DEFAULT 10.00,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'DISABLED')),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Devices Registry
CREATE TABLE IF NOT EXISTS devices (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    name VARCHAR(255) NOT NULL,
    is_primary_offline BOOLEAN NOT NULL DEFAULT FALSE,
    public_key TEXT NOT NULL,
    enrolment_code VARCHAR(50),
    app_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    last_heartbeat TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Store heartbeat lease (Split-brain prevention: exactly 1 active primary lease per store)
CREATE TABLE IF NOT EXISTS store_heartbeat_leases (
    store_id VARCHAR(36) PRIMARY KEY REFERENCES stores(id),
    primary_device_id VARCHAR(36) NOT NULL REFERENCES devices(id),
    lease_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    last_heartbeat TIMESTAMP WITH TIME ZONE NOT NULL,
    nonce VARCHAR(100) NOT NULL
);

-- 4. Products (Medicine Master)
CREATE TABLE IF NOT EXISTS products (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    brand_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255) NOT NULL,
    strength VARCHAR(100) NOT NULL DEFAULT '',
    dosage_form VARCHAR(50) NOT NULL,
    manufacturer VARCHAR(255) NOT NULL,
    barcodes JSONB NOT NULL DEFAULT '[]'::jsonb,
    hsn_code VARCHAR(20) NOT NULL DEFAULT '3004',
    tax_category VARCHAR(20) NOT NULL DEFAULT 'GST_12',
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 12.00,
    units_per_pack INTEGER NOT NULL DEFAULT 10,
    pack_unit_label VARCHAR(50) NOT NULL DEFAULT 'Strip',
    loose_unit_label VARCHAR(50) NOT NULL DEFAULT 'Tablet',
    rack_location VARCHAR(100),
    reorder_level INTEGER NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 5. Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    name VARCHAR(255) NOT NULL,
    gstin VARCHAR(15),
    phone VARCHAR(20),
    address TEXT,
    credit_period_days INTEGER NOT NULL DEFAULT 30,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Batches
CREATE TABLE IF NOT EXISTS batches (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    product_id VARCHAR(36) NOT NULL REFERENCES products(id),
    batch_number VARCHAR(100) NOT NULL,
    mfg_date VARCHAR(10),
    expiry_date VARCHAR(10) NOT NULL,
    mrp_paise BIGINT NOT NULL,
    sale_rate_paise BIGINT NOT NULL,
    purchase_rate_paise BIGINT NOT NULL DEFAULT 0,
    quantity INTEGER NOT NULL DEFAULT 0, -- Cached derived balance
    supplier_id VARCHAR(36) REFERENCES suppliers(id),
    rack_location VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_store_product_batch UNIQUE (store_id, product_id, batch_number, expiry_date, mrp_paise)
);

-- 7. Stock Movements (Immutable Ledger - NO UPDATE / NO DELETE)
CREATE TABLE IF NOT EXISTS stock_movements (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    batch_id VARCHAR(36) NOT NULL REFERENCES batches(id),
    movement_type VARCHAR(50) NOT NULL CHECK (movement_type IN (
        'PURCHASE', 'PURCHASE_RETURN', 'SALE', 'SALE_RETURN',
        'ADJUSTMENT_DAMAGE', 'ADJUSTMENT_CORRECTION', 'ADJUSTMENT_WRITE_OFF'
    )),
    signed_quantity INTEGER NOT NULL, -- Positive for in, negative for out
    source_document_type VARCHAR(50) NOT NULL,
    source_document_id VARCHAR(36) NOT NULL,
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    device_id VARCHAR(36) NOT NULL REFERENCES devices(id),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 8. Customers & Doctors
CREATE TABLE IF NOT EXISTS customers (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255),
    address TEXT,
    credit_limit_paise BIGINT NOT NULL DEFAULT 0,
    outstanding_balance_paise BIGINT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS doctors (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    name VARCHAR(255) NOT NULL,
    reg_number VARCHAR(100),
    specialization VARCHAR(100),
    hospital_clinic VARCHAR(255),
    phone VARCHAR(20),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 9. Sales Invoices
CREATE TABLE IF NOT EXISTS sales_invoices (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    device_id VARCHAR(36) NOT NULL REFERENCES devices(id),
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    customer_id VARCHAR(36) REFERENCES customers(id),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    doctor_id VARCHAR(36) REFERENCES doctors(id),
    doctor_name VARCHAR(255),
    invoice_series VARCHAR(20) NOT NULL,
    invoice_number VARCHAR(50) NOT NULL,
    full_invoice_number VARCHAR(100) NOT NULL,
    is_offline_origin BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(30) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED', 'VOIDED', 'RETURNED_PARTIAL', 'RETURNED_FULL')),
    item_count INTEGER NOT NULL,
    total_units INTEGER NOT NULL,
    gross_total_paise BIGINT NOT NULL,
    line_discount_total_paise BIGINT NOT NULL DEFAULT 0,
    subtotal_paise BIGINT NOT NULL,
    bill_discount_paise BIGINT NOT NULL DEFAULT 0,
    total_discount_paise BIGINT NOT NULL DEFAULT 0,
    taxable_total_paise BIGINT NOT NULL,
    cgst_total_paise BIGINT NOT NULL,
    sgst_total_paise BIGINT NOT NULL,
    igst_total_paise BIGINT NOT NULL,
    tax_total_paise BIGINT NOT NULL,
    round_off_paise BIGINT NOT NULL DEFAULT 0,
    grand_total_paise BIGINT NOT NULL,
    idempotency_key VARCHAR(100) NOT NULL,
    notes TEXT,
    occurred_at_local VARCHAR(50),
    void_reason TEXT,
    voided_at TIMESTAMP WITH TIME ZONE,
    voided_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_store_invoice UNIQUE (store_id, invoice_series, invoice_number),
    CONSTRAINT unique_store_idempotency UNIQUE (store_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS sales_lines (
    id VARCHAR(36) PRIMARY KEY,
    sales_invoice_id VARCHAR(36) NOT NULL REFERENCES sales_invoices(id),
    product_id VARCHAR(36) NOT NULL REFERENCES products(id),
    batch_id VARCHAR(36) NOT NULL REFERENCES batches(id),
    product_name VARCHAR(255) NOT NULL,
    generic_name VARCHAR(255),
    batch_number VARCHAR(100) NOT NULL,
    expiry_date VARCHAR(10) NOT NULL,
    quantity INTEGER NOT NULL,
    units_per_pack INTEGER NOT NULL DEFAULT 1,
    sale_rate_paise BIGINT NOT NULL,
    mrp_paise BIGINT NOT NULL,
    discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0.00,
    discount_paise BIGINT NOT NULL DEFAULT 0,
    taxable_amount_paise BIGINT NOT NULL,
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 12.00,
    cgst_paise BIGINT NOT NULL DEFAULT 0,
    sgst_paise BIGINT NOT NULL DEFAULT 0,
    igst_paise BIGINT NOT NULL DEFAULT 0,
    total_tax_paise BIGINT NOT NULL DEFAULT 0,
    final_line_total_paise BIGINT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    sales_invoice_id VARCHAR(36) REFERENCES sales_invoices(id),
    mode VARCHAR(20) NOT NULL CHECK (mode IN ('CASH', 'UPI', 'CARD', 'BANK', 'CREDIT')),
    amount_paise BIGINT NOT NULL,
    reference_number VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 10. Purchase Invoices
CREATE TABLE IF NOT EXISTS purchase_invoices (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    supplier_id VARCHAR(36) NOT NULL REFERENCES suppliers(id),
    supplier_invoice_number VARCHAR(100) NOT NULL,
    supplier_invoice_date VARCHAR(10) NOT NULL,
    total_amount_paise BIGINT NOT NULL,
    total_tax_paise BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'POSTED' CHECK (status IN ('PENDING_REVIEW', 'POSTED', 'REVERSED')),
    notes TEXT,
    created_by VARCHAR(36) NOT NULL REFERENCES users(id),
    reviewed_by VARCHAR(36) REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_lines (
    id VARCHAR(36) PRIMARY KEY,
    purchase_invoice_id VARCHAR(36) NOT NULL REFERENCES purchase_invoices(id),
    product_id VARCHAR(36) NOT NULL REFERENCES products(id),
    batch_id VARCHAR(36) NOT NULL REFERENCES batches(id),
    batch_number VARCHAR(100) NOT NULL,
    expiry_date VARCHAR(10) NOT NULL,
    quantity_packs INTEGER NOT NULL,
    free_quantity_packs INTEGER NOT NULL DEFAULT 0,
    units_per_pack INTEGER NOT NULL,
    purchase_rate_paise BIGINT NOT NULL,
    mrp_paise BIGINT NOT NULL,
    sale_rate_paise BIGINT NOT NULL,
    tax_rate_percent NUMERIC(5,2) NOT NULL DEFAULT 12.00,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 11. Accounting & General Ledger (Immutable double-entry ledger)
CREATE TABLE IF NOT EXISTS ledger_entries (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    transaction_id VARCHAR(36) NOT NULL,
    entry_date VARCHAR(10) NOT NULL,
    account_code VARCHAR(50) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    category VARCHAR(20) NOT NULL CHECK (category IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    debit_paise BIGINT NOT NULL DEFAULT 0,
    credit_paise BIGINT NOT NULL DEFAULT 0,
    narration TEXT NOT NULL,
    reference_document_type VARCHAR(50) NOT NULL,
    reference_document_id VARCHAR(36) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 12. Sync Engine Tables
CREATE TABLE IF NOT EXISTS sync_events (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    device_id VARCHAR(36) NOT NULL REFERENCES devices(id),
    local_sequence INTEGER NOT NULL,
    event_type VARCHAR(50) NOT NULL,
    schema_version INTEGER NOT NULL DEFAULT 1,
    occurred_at_local VARCHAR(50) NOT NULL,
    entity_id VARCHAR(36) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_device_sequence UNIQUE (device_id, local_sequence)
);

CREATE TABLE IF NOT EXISTS processed_events (
    event_id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    device_id VARCHAR(36) NOT NULL REFERENCES devices(id),
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    result_summary TEXT
);

CREATE TABLE IF NOT EXISTS reconciliation_exceptions (
    id VARCHAR(36) PRIMARY KEY,
    event_id VARCHAR(36) NOT NULL REFERENCES sync_events(id),
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    device_id VARCHAR(36) NOT NULL REFERENCES devices(id),
    entity_id VARCHAR(36) NOT NULL,
    exception_type VARCHAR(50) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RESOLVED', 'DISMISSED')),
    details JSONB NOT NULL,
    resolution_notes TEXT,
    resolved_by_user_id VARCHAR(36) REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 13. Audit Log (Tamper-evident append-only log with SHA-256 hash chaining)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    account_type VARCHAR(10) NOT NULL,
    device_id VARCHAR(36) NOT NULL REFERENCES devices(id),
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(36),
    before_state JSONB,
    after_state JSONB,
    reason TEXT,
    ip_address VARCHAR(45),
    prev_hash VARCHAR(64) NOT NULL,
    current_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 14. Held Bills
CREATE TABLE IF NOT EXISTS held_bills (
    id VARCHAR(36) PRIMARY KEY,
    store_id VARCHAR(36) NOT NULL REFERENCES stores(id),
    device_id VARCHAR(36) NOT NULL REFERENCES devices(id),
    user_id VARCHAR(36) NOT NULL REFERENCES users(id),
    customer_name VARCHAR(255),
    customer_phone VARCHAR(20),
    lines_json JSONB NOT NULL,
    held_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

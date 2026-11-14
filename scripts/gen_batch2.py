import os
from reportlab.lib import colors
from reportlab.platypus import Paragraph, Spacer, Table, TableStyle, PageBreak, HRFlowable
from scripts.doc_common import get_doc_styles, build_pdf

styles = get_doc_styles()

def generate_architecture_document():
    story = []
    story.append(Paragraph("ALGIONS PHARMACY ERP", styles['subtitle']))
    story.append(Paragraph("System Architecture & Design Document", styles['title']))
    story.append(Paragraph("<b>Version:</b> 1.0.0 &nbsp;|&nbsp; <b>Status:</b> Approved &nbsp;|&nbsp; <b>Classification:</b> Technical Architecture", styles['meta']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0F766E"), spaceAfter=15))

    story.append(Paragraph("1. Monorepo Clean Architecture Overview", styles['h1']))
    story.append(Paragraph(
        "<b>ALGIONS Pharmacy</b> is engineered as a high-cohesion, low-coupling TypeScript monorepo governed by "
        "<b>pnpm workspaces</b>. The architecture strictly enforces a unidirectional dependency hierarchy following Clean Architecture principles:",
        styles['body']
    ))

    arch_layers = [
        [Paragraph("Layer / Package", styles['th']), Paragraph("Package Name", styles['th']), Paragraph("Responsibilities & Constraints", styles['th'])],
        [
            Paragraph("<b>Domain Core</b>", styles['td']),
            Paragraph("<code>@algions/domain</code>", styles['code']),
            Paragraph("Pure deterministic business logic. Integer paise calculations, Indian GST CGST/SGST/IGST tax algorithms, DPCO ceiling checks, UUIDv7 time-sortable ID generators. Zero external I/O or database dependencies.", styles['td'])
        ],
        [
            Paragraph("<b>Contracts & DTOs</b>", styles['td']),
            Paragraph("<code>@algions/contracts</code>", styles['code']),
            Paragraph("Shared runtime Zod schemas, TypeScript types, API request/response contracts, and RFC 7807 Problem Details definitions shared between client and server.", styles['td'])
        ],
        [
            Paragraph("<b>Database Abstraction</b>", styles['td']),
            Paragraph("<code>@algions/db</code>", styles['code']),
            Paragraph("Unified database client abstraction (<code>IDatabase</code>). Seamlessly encapsulates SQLite 3 WAL for local high-availability workstations and PostgreSQL for cloud multi-counter deployments.", styles['td'])
        ],
        [
            Paragraph("<b>Design System & UI</b>", styles['td']),
            Paragraph("<code>@algions/ui</code>", styles['code']),
            Paragraph("Tailwind CSS component library, accessible modal dialogs, status badges, banners, and thermal receipt print layout primitives.", styles['td'])
        ],
        [
            Paragraph("<b>Backend API Service</b>", styles['td']),
            Paragraph("<code>@algions/api</code>", styles['code']),
            Paragraph("Express REST API service hosting transactional business endpoints, Argon2 authentication, TOTP MFA validation, and double-entry financial posting.", styles['td'])
        ],
        [
            Paragraph("<b>Primary Workstation POS</b>", styles['td']),
            Paragraph("<code>@algions/pos-desktop</code>", styles['code']),
            Paragraph("Vite + React 19 single page application designed for continuous keyboard/scanner navigation, offline IndexedDB transaction caching, and thermal printer output.", styles['td'])
        ]
    ]
    t_arch = Table(arch_layers, colWidths=[110, 120, 274])
    t_arch.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F766E')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(t_arch)

    story.append(Spacer(1, 15))
    story.append(Paragraph("2. Dual-Engine Database Architecture", styles['h1']))
    story.append(Paragraph(
        "A foundational innovation of ALGIONS Pharmacy is its dual database runtime. Independent community pharmacies face frequent "
        "internet disruptions, while modern multi-counter hospital pharmacies require centralized cloud reporting. The system solves both:",
        styles['body']
    ))
    story.append(Paragraph("• <b>Primary Offline Workstation (SQLite 3 WAL):</b> Uses Node.js native <code>DatabaseSync</code> with Write-Ahead Logging (<code>PRAGMA journal_mode = WAL</code>). Delivers sub-millisecond local queries, zero external network dependencies, and true offline billing autonomy.", styles['bullet']))
    story.append(Paragraph("• <b>Cloud Multi-Counter Sync (PostgreSQL 16):</b> Hosted on cloud infrastructure (Render, Neon, Supabase) with connection pooling (<code>pg.Pool</code>). Aggregates transactions from distributed counters and provides real-time Owner analytics.", styles['bullet']))

    story.append(Spacer(1, 15))
    story.append(Paragraph("3. Primary Workstation Lease Heartbeat Consensus", styles['h1']))
    story.append(Paragraph(
        "To prevent split-brain inventory divergence during network partitions, the system implements a cryptographic <b>Primary Workstation Lease Model</b>. "
        "The designated Primary Offline Workstation renews an active heartbeat lease every 30 seconds (valid for 90 seconds). "
        "If internet connectivity fails, the Primary Workstation autonomously continues billing while secondary non-primary terminals "
        "transition to <b>Fail-Closed Read-Only Mode</b> until the lease or network is restored.",
        styles['body']
    ))

    build_pdf("Application_Documentation/03_Architecture_Design/Architecture_Document.pdf", story)

def generate_er_diagram_doc():
    story = []
    story.append(Paragraph("ALGIONS PHARMACY ERP", styles['subtitle']))
    story.append(Paragraph("Entity-Relationship (ER) Architecture", styles['title']))
    story.append(Paragraph("<b>Database Schema Specification:</b> Relational & ACID Compliant &nbsp;|&nbsp; <b>Storage Engines:</b> SQLite 3 & PostgreSQL 16", styles['meta']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0F766E"), spaceAfter=15))

    story.append(Paragraph("1. Schema Entities & Key Relationships", styles['h1']))
    story.append(Paragraph(
        "The ALGIONS database schema is fully normalized to Third Normal Form (3NF) while maintaining denormalized snapshot data "
        "on invoice lines to ensure statutory invoice immutability across price changes.",
        styles['body']
    ))

    er_table = [
        [Paragraph("Entity", styles['th']), Paragraph("Primary Key", styles['th']), Paragraph("Foreign Keys", styles['th']), Paragraph("Key Attributes", styles['th']), Paragraph("Cardinality", styles['th'])],
        [Paragraph("<code>stores</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("—", styles['td']), Paragraph("name, gstin, dl_number_20b, dl_number_21b, active_mode", styles['td']), Paragraph("1 : M with users, devices, products", styles['td'])],
        [Paragraph("<code>users</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("store_id", styles['td']), Paragraph("username, account_type, password_hash, mfa_secret, quick_pin_hash", styles['td']), Paragraph("M : 1 with stores", styles['td'])],
        [Paragraph("<code>devices</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("store_id", styles['td']), Paragraph("name, is_primary_offline, public_key, status, last_heartbeat", styles['td']), Paragraph("M : 1 with stores", styles['td'])],
        [Paragraph("<code>products</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("store_id", styles['td']), Paragraph("brand_name, generic_name, strength, dosage_form, hsn_code, tax_category", styles['td']), Paragraph("1 : M with batches", styles['td'])],
        [Paragraph("<code>batches</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("product_id, supplier_id", styles['td']), Paragraph("batch_number, expiry_date, mrp_paise, sale_rate_paise, quantity, is_recalled", styles['td']), Paragraph("1 : M with sales_lines", styles['td'])],
        [Paragraph("<code>stock_movements</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("batch_id, user_id, device_id", styles['td']), Paragraph("movement_type, signed_quantity, source_document_type, source_document_id", styles['td']), Paragraph("M : 1 with batches", styles['td'])],
        [Paragraph("<code>suppliers</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("store_id", styles['td']), Paragraph("name, gstin, phone, address, credit_period_days, is_active", styles['td']), Paragraph("1 : M with purchases, debit_notes", styles['td'])],
        [Paragraph("<code>purchase_invoices</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("store_id, supplier_id", styles['td']), Paragraph("supplier_invoice_number, supplier_invoice_date, total_amount_paise, status", styles['td']), Paragraph("1 : M with purchase_lines", styles['td'])],
        [Paragraph("<code>debit_notes</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("store_id, supplier_id", styles['td']), Paragraph("debit_note_number, reason, total_amount_paise, total_tax_paise, status", styles['td']), Paragraph("1 : M with debit_note_lines", styles['td'])],
        [Paragraph("<code>sales_invoices</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("store_id, customer_id, doctor_id", styles['td']), Paragraph("full_invoice_number, taxable_total_paise, grand_total_paise, idempotency_key", styles['td']), Paragraph("1 : M with sales_lines", styles['td'])],
        [Paragraph("<code>customers</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("store_id", styles['td']), Paragraph("name, phone, credit_limit_paise, outstanding_balance_paise", styles['td']), Paragraph("1 : M with sales_invoices", styles['td'])],
        [Paragraph("<code>doctors</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("store_id", styles['td']), Paragraph("name, reg_number, specialization, hospital_clinic", styles['td']), Paragraph("1 : M with sales_invoices", styles['td'])],
        [Paragraph("<code>ledger_entries</code>", styles['code']), Paragraph("id (UUID)", styles['td']), Paragraph("store_id, account_id", styles['td']), Paragraph("entry_date, account_code, debit_paise, credit_paise, narration, voucher_type", styles['td']), Paragraph("Immutable audit trail", styles['td'])]
    ]
    t_er = Table(er_table, colWidths=[80, 60, 110, 154, 100])
    t_er.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F766E')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(t_er)

    story.append(Spacer(1, 15))
    story.append(Paragraph("2. Integrity Constraints & Foreign Key Rules", styles['h1']))
    story.append(Paragraph("• <b>Referential Action:</b> Foreign key deletion is guarded with <code>ON DELETE RESTRICT</code> across products, batches, and transactions to prevent accidental cascade deletions of statutory data.", styles['bullet']))
    story.append(Paragraph("• <b>Uniqueness Guarantees:</b> Strict unique constraints on <code>users.username</code>, <code>batches(store_id, product_id, batch_number, expiry_date, mrp_paise)</code>, and <code>sales_invoices.idempotency_key</code>.", styles['bullet']))

    build_pdf("Application_Documentation/03_Architecture_Design/ER_Diagram.pdf", story)

def generate_dfd_document():
    story = []
    story.append(Paragraph("ALGIONS PHARMACY ERP", styles['subtitle']))
    story.append(Paragraph("Data Flow Diagram (DFD) Specification", styles['title']))
    story.append(Paragraph("<b>Model:</b> Gane-Sarson Structured Analysis &nbsp;|&nbsp; <b>Levels:</b> Context (0), Level 1, Level 2", styles['meta']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0F766E"), spaceAfter=15))

    story.append(Paragraph("1. Level 0: Context Diagram", styles['h1']))
    story.append(Paragraph(
        "At the context level, the <b>ALGIONS Pharmacy System</b> interacts with 6 external entities: "
        "Retail Customer, Counter Staff, Store Owner / Pharmacist, Pharmaceutical Distributor, Drug Inspector, and Tax Authority (GSTN).",
        styles['body']
    ))

    dfd0_table = [
        [Paragraph("External Entity", styles['th']), Paragraph("Inflow Data to System", styles['th']), Paragraph("Outflow Data from System", styles['th'])],
        [Paragraph("<b>Retail Customer</b>", styles['td']), Paragraph("Prescription, payment (Cash/UPI/Card), customer details", styles['td']), Paragraph("Thermal receipt, dispensed medicines, credit account receipt", styles['td'])],
        [Paragraph("<b>Counter Staff / Cashier</b>", styles['td']), Paragraph("Barcode scans, quick PIN, bill hold requests, line discounts", styles['td']), Paragraph("Stock availability, generic substitute prompts, batch expiries", styles['td'])],
        [Paragraph("<b>Store Owner</b>", styles['td']), Paragraph("Product pricing, credit limit approvals, supplier creation, MFA codes", styles['td']), Paragraph("Executive financial dashboard, sales velocities, doctor volume reports", styles['td'])],
        [Paragraph("<b>Pharma Distributor</b>", styles['td']), Paragraph("Inward delivery challans, tax invoices, batch lot numbers", styles['td']), Paragraph("Purchase orders, payment UTR disbursements, GST debit notes", styles['td'])],
        [Paragraph("<b>Drug Inspector (CDSCO)</b>", styles['td']), Paragraph("Regulatory audit queries, batch recall notices", styles['td']), Paragraph("Schedule H/H1/X registers, customer contact recall trace logs", styles['td'])],
        [Paragraph("<b>GST Portal (GSTN)</b>", styles['td']), Paragraph("Tax slab rates, GSTIN validation responses", styles['td']), Paragraph("GSTR-1 outward invoice summaries, CGST/SGST/IGST breakdown", styles['td'])]
    ]
    t_dfd0 = Table(dfd0_table, colWidths=[120, 190, 194])
    t_dfd0.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F766E')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(t_dfd0)

    story.append(Spacer(1, 15))
    story.append(Paragraph("2. Level 1: Subsystem Data Flow Decomposition", styles['h1']))
    story.append(Paragraph("The system decomposes into 5 major core processes interacting with 5 internal data stores (D1–D5):", styles['body']))
    story.append(Paragraph("• <b>Process 1.0 (POS Billing & Dispensing):</b> Reads D2 (Batches), writes D3 (Sales Invoices), decrements D2 (Batches), writes D4 (Ledgers).", styles['bullet']))
    story.append(Paragraph("• <b>Process 2.0 (Batch & Expiry Control):</b> Evaluates FEFO queues from D2 (Batches), blocks expired stock, initiates batch quarantine (INV-012).", styles['bullet']))
    story.append(Paragraph("• <b>Process 3.0 (Procurement & Inward Goods):</b> Takes supplier invoice data, increments D2 (Batches), writes D4 (AP Ledger).", styles['bullet']))
    story.append(Paragraph("• <b>Process 4.0 (Sync & Heartbeat Consensus):</b> Verifies primary lease in D1 (Devices), synchronizes transactions between SQLite and Cloud PostgreSQL.", styles['bullet']))
    story.append(Paragraph("• <b>Process 5.0 (Statutory Reporting):</b> Extracts D3 (Sales) and D5 (Schedule Registers) for tax and drug compliance audits.", styles['bullet']))

    build_pdf("Application_Documentation/03_Architecture_Design/Data_Flow_Diagram.pdf", story)

def generate_technical_documentation():
    story = []
    story.append(Paragraph("ALGIONS PHARMACY ERP", styles['subtitle']))
    story.append(Paragraph("Technical & Codebase Documentation", styles['title']))
    story.append(Paragraph("<b>Runtime:</b> Node.js 22 LTS & TypeScript 5.8 &nbsp;|&nbsp; <b>Frameworks:</b> Express 4, React 19, Vite 6", styles['meta']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0F766E"), spaceAfter=15))

    story.append(Paragraph("1. Codebase Structure & Monorepo Organization", styles['h1']))
    story.append(Paragraph(
        "The application code is strictly partitioned into packages and apps inside the workspace:",
        styles['body']
    ))

    code_struct = [
        [Paragraph("Path", styles['th']), Paragraph("Package / App", styles['th']), Paragraph("Technical Scope & Dependencies", styles['th'])],
        [Paragraph("<code>packages/domain</code>", styles['code']), Paragraph("<code>@algions/domain</code>", styles['code']), Paragraph("Pure business rules, integer paise conversion, GST tax calculation, round-off math, UUIDv7 generator. Zero external dependencies.", styles['td'])],
        [Paragraph("<code>packages/contracts</code>", styles['code']), Paragraph("<code>@algions/contracts</code>", styles['code']), Paragraph("Type definitions and Zod validation schemas for Auth, Store, Catalog, POS, Purchases, Accounting, and RFC 7807 Error Models.", styles['td'])],
        [Paragraph("<code>packages/db</code>", styles['code']), Paragraph("<code>@algions/db</code>", styles['code']), Paragraph("Database client abstraction (IDatabase), SQLite DatabaseSync WAL client, PostgreSQL pg.Pool client, seed data, schema migrations.", styles['td'])],
        [Paragraph("<code>packages/ui</code>", styles['code']), Paragraph("<code>@algions/ui</code>", styles['code']), Paragraph("Design system, NavigationRail, TopBar, ReceiptPrintDialog, FullWidthBanner, Tailwind theme.", styles['td'])],
        [Paragraph("<code>apps/api</code>", styles['code']), Paragraph("<code>@algions/api</code>", styles['code']), Paragraph("Express REST API, Argon2 password verification, JWT issuance, TOTP MFA, route guards, double-entry financial posting.", styles['td'])],
        [Paragraph("<code>apps/pos-desktop</code>", styles['code']), Paragraph("<code>@algions/pos-desktop</code>", styles['code']), Paragraph("Vite React 19 Single Page App, barcode listener hooks, thermal print styles, offline IndexedDB transaction cache.", styles['td'])]
    ]
    t_cs = Table(code_struct, colWidths=[120, 110, 274])
    t_cs.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F766E')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 5),
        ('BOTTOMPADDING', (0,0), (-1,-1), 5),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(t_cs)

    story.append(Spacer(1, 15))
    story.append(Paragraph("2. Financial Precision & Fixed-Point Paise Arithmetic", styles['h1']))
    story.append(Paragraph(
        "To comply with financial auditing and Indian GST compliance standards, the codebase strictly forbids floating-point currency representations. "
        "All calculations inside <code>@algions/domain</code> operate on integer paise: "
        "<code>toPaise('120.50') = 12050</code> and <code>fromPaise(12050) = 120.50</code>. "
        "Cash rounding rules calculate the integer offset required to round cash sales to the nearest whole rupee.",
        styles['body']
    ))

    story.append(Spacer(1, 15))
    story.append(Paragraph("3. RFC 7807 Standardized Error Protocol", styles['h1']))
    story.append(Paragraph(
        "All API errors are serialized using the RFC 7807 (Problem Details for HTTP APIs) specification. "
        "Validation errors include granular <code>invalidParams</code> arrays identifying exact offending fields, eliminating opaque client errors.",
        styles['body']
    ))

    build_pdf("Application_Documentation/04_Technical_Documentation/Technical_Documentation.pdf", story)

def generate_api_documentation():
    story = []
    story.append(Paragraph("ALGIONS PHARMACY ERP", styles['subtitle']))
    story.append(Paragraph("REST API Specification & Reference", styles['title']))
    story.append(Paragraph("<b>Protocol:</b> HTTPS REST / JSON &nbsp;|&nbsp; <b>Auth:</b> Bearer JWT &nbsp;|&nbsp; <b>Base URL:</b> /api or Cloud Domain", styles['meta']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0F766E"), spaceAfter=15))

    story.append(Paragraph("1. API Module Endpoint Summary", styles['h1']))

    api_endpoints = [
        [Paragraph("Method & Route", styles['th']), Paragraph("Access Role", styles['th']), Paragraph("Description & Validation Schema", styles['th'])],
        [Paragraph("<code>POST /auth/login</code>", styles['code']), Paragraph("Public", styles['td']), Paragraph("Authenticates user with username, password, deviceId. Returns JWT or initiates MFA step.", styles['td'])],
        [Paragraph("<code>POST /auth/mfa/verify</code>", styles['code']), Paragraph("Public (Temp)", styles['td']), Paragraph("Verifies 6-digit TOTP code for Owner login; issues production access token.", styles['td'])],
        [Paragraph("<code>POST /auth/quick-unlock</code>", styles['code']), Paragraph("Public", styles['td']), Paragraph("Unlocks POS terminal using 4-digit quick PIN.", styles['td'])],
        [Paragraph("<code>GET /store/status</code>", styles['code']), Paragraph("Authenticated", styles['td']), Paragraph("Returns store license profile, active operating mode, and primary device lease.", styles['td'])],
        [Paragraph("<code>POST /devices/primary/heartbeat</code>", styles['code']), Paragraph("Primary Only", styles['td']), Paragraph("Renews 90-second offline billing lease for the primary terminal.", styles['td'])],
        [Paragraph("<code>GET /products/search?q=</code>", styles['code']), Paragraph("Authenticated", styles['td']), Paragraph("Sub-50ms type-ahead search matching brand names, salt generic names, and barcodes.", styles['td'])],
        [Paragraph("<code>POST /pos/sales</code>", styles['code']), Paragraph("Authenticated", styles['td']), Paragraph("Executes atomic sale checkout, posts stock movements, creates invoice, updates ledgers.", styles['td'])],
        [Paragraph("<code>GET /pos/held-bills</code>", styles['code']), Paragraph("Authenticated", styles['td']), Paragraph("Retrieves all customer baskets currently placed on hold.", styles['td'])],
        [Paragraph("<code>POST /pos/held-bills</code>", styles['code']), Paragraph("Authenticated", styles['td']), Paragraph("Saves active cart to held bills queue with timestamp and cashier notes.", styles['td'])],
        [Paragraph("<code>GET /suppliers</code>", styles['code']), Paragraph("Authenticated", styles['td']), Paragraph("Lists all active pharmaceutical distributors with current AP ledger balances.", styles['td'])],
        [Paragraph("<code>POST /suppliers</code>", styles['code']), Paragraph("Owner Only", styles['td']), Paragraph("Registers new distributor with GSTIN, credit period, and warehouse address.", styles['td'])],
        [Paragraph("<code>PUT /suppliers/:id</code>", styles['code']), Paragraph("Owner Only", styles['td']), Paragraph("Updates distributor details and credit terms (guarded from staff).", styles['td'])],
        [Paragraph("<code>POST /purchases</code>", styles['code']), Paragraph("Authenticated", styles['td']), Paragraph("Inward goods receipt; creates purchase invoice, increments batch stock, posts AP ledger.", styles['td'])],
        [Paragraph("<code>POST /purchases/returns</code>", styles['code']), Paragraph("Authenticated", styles['td']), Paragraph("Creates supplier debit note (PUR-006 / ACC-007) and deducts batch stock.", styles['td'])],
        [Paragraph("<code>POST /inventory/recall</code>", styles['code']), Paragraph("Owner Only", styles['td']), Paragraph("Emergency batch recall (INV-012); blocks POS dispensing and generates recall trace.", styles['td'])],
        [Paragraph("<code>GET /owner/dashboard</code>", styles['code']), Paragraph("Owner Only", styles['td']), Paragraph("Returns executive KPIs: today sales, gross profit, cash in hand, and receivables.", styles['td'])],
        [Paragraph("<code>GET /owner/reports/sales</code>", styles['code']), Paragraph("Owner Only", styles['td']), Paragraph("Exports date-filtered sales, taxable totals, and CGST/SGST/IGST tax summaries.", styles['td'])]
    ]
    t_api = Table(api_endpoints, colWidths=[150, 80, 274])
    t_api.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F766E')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(t_api)

    build_pdf("Application_Documentation/04_Technical_Documentation/API_Documentation.pdf", story)

def generate_database_documentation():
    story = []
    story.append(Paragraph("ALGIONS PHARMACY ERP", styles['subtitle']))
    story.append(Paragraph("Database Data Dictionary & Storage Architecture", styles['title']))
    story.append(Paragraph("<b>Engines:</b> SQLite 3 (WAL Mode) & PostgreSQL 16 &nbsp;|&nbsp; <b>Dialect Compatibility:</b> ANSI SQL", styles['meta']))
    story.append(HRFlowable(width="100%", thickness=1.5, color=colors.HexColor("#0F766E"), spaceAfter=15))

    story.append(Paragraph("1. Core Data Tables Specification", styles['h1']))

    db_dict = [
        [Paragraph("Table Name", styles['th']), Paragraph("Column Name", styles['th']), Paragraph("Data Type", styles['th']), Paragraph("Constraints / Description", styles['th'])],
        [Paragraph("<code>stores</code>", styles['code']), Paragraph("id<br/>name<br/>gstin<br/>dl_number_20b<br/>active_mode", styles['td']), Paragraph("TEXT (UUID)<br/>TEXT<br/>TEXT (15)<br/>TEXT<br/>TEXT", styles['td']), Paragraph("Primary Key<br/>Trade Name<br/>15-char Indian GSTIN<br/>Drug License Allopathic Retail<br/>ONLINE / OFFLINE_STORE", styles['td'])],
        [Paragraph("<code>users</code>", styles['code']), Paragraph("id<br/>username<br/>account_type<br/>password_hash<br/>is_mfa_enabled", styles['td']), Paragraph("TEXT (UUID)<br/>TEXT<br/>TEXT<br/>TEXT<br/>INTEGER", styles['td']), Paragraph("Primary Key<br/>Unique username<br/>OWNER or STAFF<br/>Argon2 memory-hard hash<br/>1 = TOTP enforced", styles['td'])],
        [Paragraph("<code>products</code>", styles['code']), Paragraph("id<br/>brand_name<br/>generic_name<br/>hsn_code<br/>units_per_pack", styles['td']), Paragraph("TEXT (UUID)<br/>TEXT<br/>TEXT<br/>TEXT<br/>INTEGER", styles['td']), Paragraph("Primary Key<br/>Commercial brand name<br/>Salt composition<br/>Statutory HSN (e.g. 3004)<br/>Tablets/capsules per strip", styles['td'])],
        [Paragraph("<code>batches</code>", styles['code']), Paragraph("id<br/>product_id<br/>batch_number<br/>expiry_date<br/>mrp_paise<br/>quantity<br/>is_recalled", styles['td']), Paragraph("TEXT (UUID)<br/>TEXT (FK)<br/>TEXT<br/>TEXT (Date)<br/>INTEGER<br/>INTEGER<br/>INTEGER", styles['td']), Paragraph("Primary Key<br/>FK to products.id<br/>Manufacturer Lot/Batch No<br/>YYYY-MM-DD<br/>Maximum Retail Price in paise<br/>Stock in loose units<br/>1 = Emergency recalled", styles['td'])],
        [Paragraph("<code>sales_invoices</code>", styles['code']), Paragraph("id<br/>full_invoice_number<br/>taxable_total_paise<br/>grand_total_paise<br/>idempotency_key", styles['td']), Paragraph("TEXT (UUID)<br/>TEXT<br/>INTEGER<br/>INTEGER<br/>TEXT", styles['td']), Paragraph("Primary Key<br/>e.g. ON/26-27/000001<br/>Net taxable value in paise<br/>Gross invoice total in paise<br/>Unique idempotency guard", styles['td'])],
        [Paragraph("<code>debit_notes</code>", styles['code']), Paragraph("id<br/>supplier_id<br/>debit_note_number<br/>total_amount_paise<br/>status", styles['td']), Paragraph("TEXT (UUID)<br/>TEXT (FK)<br/>TEXT<br/>INTEGER<br/>TEXT", styles['td']), Paragraph("Primary Key<br/>FK to suppliers.id<br/>Statutory Debit Note #<br/>Total return value in paise<br/>POSTED / REVERSED", styles['td'])]
    ]
    t_dd = Table(db_dict, colWidths=[100, 110, 94, 200])
    t_dd.setStyle(TableStyle([
        ('BACKGROUND', (0,0), (-1,0), colors.HexColor('#0F766E')),
        ('GRID', (0,0), (-1,-1), 0.5, colors.HexColor('#CBD5E1')),
        ('TOPPADDING', (0,0), (-1,-1), 4),
        ('BOTTOMPADDING', (0,0), (-1,-1), 4),
        ('ROWBACKGROUNDS', (0,1), (-1,-1), [colors.white, colors.HexColor('#F8FAFC')])
    ]))
    story.append(t_dd)

    story.append(Spacer(1, 15))
    story.append(Paragraph("2. Index Optimization Strategy", styles['h1']))
    story.append(Paragraph("To ensure sub-50ms search and checkout response times, indexes are deployed on:", styles['body']))
    story.append(Paragraph("• <code>idx_products_search</code>: B-Tree index on <code>(store_id, brand_name, generic_name)</code>.", styles['bullet']))
    story.append(Paragraph("• <code>idx_batches_fefo</code>: Composite index on <code>(store_id, product_id, expiry_date, quantity)</code> for instant FEFO retrieval.", styles['bullet']))
    story.append(Paragraph("• <code>idx_sales_idempotency</code>: Unique index on <code>(idempotency_key)</code> to eliminate duplicate bill submissions.", styles['bullet']))

    build_pdf("Application_Documentation/04_Technical_Documentation/Database_Documentation.pdf", story)

if __name__ == "__main__":
    generate_architecture_document()
    generate_er_diagram_doc()
    generate_dfd_document()
    generate_technical_documentation()
    generate_api_documentation()
    generate_database_documentation()

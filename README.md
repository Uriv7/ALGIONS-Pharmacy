# ALGIONS Pharmacy ERP

> **A Production-Grade, Cloud-First Pharmacy ERP with Primary Offline Workstation Architecture**  
> Built for Indian Retail Pharmacies in strict accordance with the Architectural & Functional Design Specifications.

---

## 🌟 Highlights & Architecture

- **Fail-Closed Dual-Write Protection**: Implements distributed store lease heartbeats (15s lease expiry) with deny-by-default server guards preventing split-brain inventory drift.
- **Primary Offline Workstation (Failover Ready)**: The designated Primary Workstation uses a local zero-dependency SQLite engine (`DatabaseSync`) with an ordered transactional outbox. Cash counter billing continues seamlessly with sub-50ms bill finalization during internet or cloud outages.
- **Deterministic Reconciliation (SYN-005 & S2)**: Strictly ordered sequence verification, SHA-256 payload integrity hashing, idempotent duplicate deduplication (`processed_events`), and step-up authorized Owner review for edge divergence.
- **Zero Financial Float**: Pure integer paise math (`Math.round`, standard round-off to nearest rupee) and dual-entry immutable general ledger posting for all transactions.
- **Indian Pharmaceutical Compliance**:
  - Full Indian GST engine (5%, 12%, 18%, 28% CGST/SGST and IGST split, inclusive retail MRP & exclusive wholesale receipt).
  - First-Expiry-First-Out (FEFO) batch allocation with automated near-expiry (<90 days) alerts and hard block on expired stock.
  - Pack & loose tablet fractional conversions (strip ↔ loose tablet) with accurate paise distribution.
  - Schedule H / H1 / X tracking flags, Doctor prescription capture, and customer credit ledger.
- **Tamper-Evident SHA-256 Audit Trail**: Hash-chained block log for all security, price overrides, stock write-offs, and reconciliations.

---

## 🏗 Monorepo Architecture

```
ALGIONS Pharmacy/
├── packages/
│   ├── domain/        # Pure TypeScript business rules (Money, FEFO, Tax, Units, UUIDv7)
│   ├── contracts/     # Strict Zod schemas, DTOs, and RFC 7807 ProblemDetails
│   ├── db/            # PostgreSQL & SQLite DDL, seed data, PBKDF2/scrypt & PIN hashing
│   └── ui/            # High-density pharmacy design system & status chips
├── apps/
│   ├── api/           # Production Express REST API with RBAC & lease guards
│   └── pos-desktop/   # High-speed React + Tailwind + Vite keyboard-first POS workstation
└── docs/              # System architecture, functional specifications, and tickets
```

---

## ⚡ Default Accounts & Demo Credentials

| Role | Username | Password | Second Factor / PIN | Permissions |
| :--- | :--- | :--- | :--- | :--- |
| **Owner** | `owner` | `Owner@Algions2026!` | MFA TOTP: `123456` (PIN: `9999`) | Full access, Financials, Gross Margins, Staff Admin, Reconciliations |
| **Staff 1** | `staff1` | `Staff@Algions2026!` | Quick Unlock PIN: `1234` | Billing, Medicine Search, Stock Check, Purchase GRN |
| **Staff 2** | `staff2` | `Staff@Algions2026!` | Quick Unlock PIN: `5678` | Billing, Medicine Search, Stock Check |

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v22.0.0 or higher
- **pnpm**: v9.0.0 or higher

### 2. Install & Build
```bash
# Install workspace dependencies
pnpm install

# Build all packages and applications in topological dependency order
pnpm run build

# Run unit and integration test suites
pnpm run test
```

### 3. Run Applications
In two terminal tabs:

**Start Cloud Backend API** (Port 3001):
```bash
pnpm --filter @algions/api run start
```

**Start POS Workstation UI** (Port 3000):
```bash
pnpm --filter @algions/pos-desktop run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ⌨️ POS Keyboard Shortcuts

| Shortcut | Action | Description |
| :--- | :--- | :--- |
| `F1` | Focus Search | Focus medicine search box to quickly scan or type |
| `F2` | Medicine Master | Open quick medicine search & composition substitute finder |
| `F4` | Hold Current Bill | Save current cart to local held bills queue |
| `F6` | Recall Held Bill | Open held bill selector to resume parked basket |
| `F9` | Settle / Pay | Open payment dialog (Cash, UPI QR, Card, Credit) |
| `F12` | Quick Complete | Instantly finalize bill with exact cash payment |
| `Esc` | Clear / Close | Clear search or close current modal |

---

## 🛡 Security & Permissions Model

- **Deny-by-Default Route Guards**: Express middleware strictly verifies JWT signatures and enforces role boundaries (`OWNER` vs `STAFF`).
- **Owner-Only Step-Up Authentication**: Reconciliation overrides and staff status modifications require an elevated step-up token.
- **Fail-Closed Write Guard**: If the Primary Workstation lease expires or disconnects without release, cloud sales are blocked to prevent stock desynchronization.
- **Cryptographic Audit Hashing**: Every sensitive action records `prev_hash` and `current_hash = SHA256(prev_hash + log_data)` creating an immutable ledger.

---

## 📜 License
Private & Proprietary — ALGIONS Health Technologies Pvt. Ltd.

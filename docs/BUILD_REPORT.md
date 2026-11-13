# Skyro Biller: Project Build Report & Implementation Progress

**Project:** Skyro Biller  
**Version:** 1.0.0-alpha  
**Platform:** Windows 10/11 Desktop (Offline-first, Multi-user)  
**Target Domain:** UAV Parts & Electronics Business (Indian GST Compliant)  
**Repository Working Directory:** `d:\Client\Dinesh Sadangi\Skyrobiller`  
**Last Updated:** 2026-11-14  

---

## 1. Executive Summary & Context

Skyro Biller is engineered to replace fragmented, repetitive billing workflows in an active UAV parts business with a high-performance Windows desktop application.
Key business and engineering requirements:
1. **Product & Customer Memory:** Instant retrieval (<10ms) of catalogued drone components (flight controllers, ESCs, motors, props) and customer profiles with automated tax splitting.
2. **Indian GST Statutory Compliance:** Automatic Intra-State (CGST + SGST) vs Inter-State (IGST) calculations, HSN code management, and statutory rounding.
3. **Atomic Sequential Invoicing:** Concurrent billing across multiple client PCs without duplicate invoice numbers via Supabase PostgreSQL transactions with row locks (`SELECT ... FOR UPDATE`).
4. **Hardware-Enforced Security:** Client machine fingerprinting and administrator approval workflow.
5. **Offline Continuity:** Billing clerks can prepare drafts, review products, and park invoices while disconnected, synchronizing automatically when connectivity is restored via the Outbox pattern.

---

## 2. Phase-by-Phase Progress Tracker

| Phase | Description | Status | Progress |
| :--- | :--- | :---: | :---: |
| **Phase 1** | **Desktop Foundation & Shell Architecture** (Electron, React, Vite, Tailwind, IPC, App Frame) | 🟢 Completed | 100% |
| **Phase 2** | **Local Storage Engine & Memory Systems** (SQLite, FTS5 Autocomplete, Catalogue/Customer Memory) | 🟡 In Progress | 20% |
| **Phase 3** | **Core Billing & Quotation Engine with GST** (Invoicing, Parking, Quotations, A4 PDF) | ⚪ Queued | 0% |
| **Phase 4** | **Cloud Infrastructure, Auth & Device Security** (Supabase, RLS, Machine Fingerprint Lock) | ⚪ Queued | 0% |
| **Phase 5** | **Bidirectional Synchronization & Offline Engine** (Outbox Pattern, Supabase Realtime CDC) | ⚪ Queued | 0% |
| **Phase 6** | **Atomic Invoice Integrity & Payments** (PostgreSQL RPC, Consecutive Numbers, Payments) | ⚪ Queued | 0% |
| **Phase 7** | **Google Sheets Reporting & Backup Engine** (Service Account Sync, SQLite Snapshotting) | ⚪ Queued | 0% |
| **Phase 8** | **Production Release Engineering** (NSIS Windows Installer, Auto-Updates, Stress Testing) | ⚪ Queued | 0% |

---

## 3. Product Modules Implementation Status

| Module | Core Functionality | Current State |
| :--- | :--- | :--- |
| **01. Dashboard** | Sales KPIs, pending collections, quick draft/quotation actions | ✅ Completed (`src/features/dashboard/DashboardView.tsx`) |
| **02. Invoice Management** | Form builder, item rows, tax split, draft parking, PDF preview | ✅ Core shell ready (`src/features/invoices/InvoicesView.tsx`) |
| **03. Quotation Management** | Quotations with validity periods and 1-click invoice conversion | ✅ Completed (`src/features/quotations/QuotationsView.tsx`) |
| **04. Product Memory** | UAV catalogue, SKU, brand, default pricing, HSN, aliases | ✅ Catalogue view ready (`src/features/products/ProductsView.tsx`) |
| **05. Customer Memory** | B2B (GSTIN) & B2C profiles, state code, address lookup | ✅ Directory view ready (`src/features/customers/CustomersView.tsx`) |
| **06. Payment Management** | Partial/full payment tracking, payment modes (UPI, NEFT, Cash) | ✅ Completed (`src/features/payments/PaymentsView.tsx`) |
| **07. Reports & Analytics** | Sales summaries, GST GSTR-1 summaries, Google Sheets sync | ✅ Completed (`src/features/reports/ReportsView.tsx`) |
| **08. Settings & Admin** | Company branding, bank details, device approval, backup restore | ✅ Completed (`src/features/settings/SettingsView.tsx`) |

---

## 4. Architectural Decisions & Changelog

### Phase 1 Accomplishments
1. **Reference Repositories Cloned & Integrated:**
   - `references/invoify`: Primary UI candidate for invoice form structures and PDF templates.
   - `references/solidinvoice`: Lifecycle models for quotations, convert-to-invoice workflows, and payment statuses.
   - `references/invoiceplane`: Saved product autocomplete paradigms.
2. **Scaffolded Hybrid Electron + React + Vite Architecture:**
   - Bundled Vite + React 18 + TypeScript + Tailwind CSS v4 design system.
   - Embedded `sql.js` (WebAssembly SQLite) for 100% portable, native-compilation-free persistence on Windows with zero `node-gyp` friction.
   - Deterministic hardware fingerprinting using `node-machine-id` for device authorization.
3. **IPC Bridge & Process Security:**
   - `electron/preload/preload.ts`: Safe `contextBridge` isolation.
   - `electron/main/main.ts`: Custom window controls, database IPC, hardware fingerprint query, and Chromium `printToPDF` pipeline.
4. **Desktop Navigation & UI Frame:**
   - Native Windows frameless title bar with drag region, minimize, maximize, and close controls.
   - Responsive sidebar connecting all 8 core modules.
   - Persistent Parked Bills slide-over drawer with instant resumption.
   - Indian Rupee (`₹`) formatters, Indian State Code to State Name mapping, and GSTIN validation regex helpers.
5. **Verified Production Build:**
   - `npm run build` runs `tsc && vite build`, successfully producing `dist/` and `dist-electron/` without errors or warnings.

---

## 5. Next Planned Activities (Phase 2 & Phase 3)
1. **Interactive Indian GST Billing Form:** Port Invoify's line item row editor into `src/features/invoices/`, binding it to our pure GST calculation engine (CGST/SGST vs IGST).
2. **SQLite FTS Autocomplete Engine:** Wire the product search combobox directly to `local_products` and `local_customers` in the main process SQLite database.
3. **Parked Invoice Persistence:** Save drafts to `local_drafts` table on typing, enabling clerks to park bills with a hotkey/click and restore them seamlessly.

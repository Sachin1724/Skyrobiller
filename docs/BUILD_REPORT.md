# Skyro Biller: Project Build Report & Implementation Progress

**Project:** Skyro Biller  
**Version:** 1.0.0-alpha  
**Platform:** Windows 10/11 Desktop (Offline-first, Multi-user)  
**Target Domain:** UAV Parts & Electronics Business (Indian GST Compliant)  
**Repository:** https://github.com/Sachin1724/Skyrobiller  
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

**Update 2026-11-14, local-first build (supersedes the table above and the module table below where they differ):**
- Build order changed: everything works on one computer first; Supabase and Google Sheets come last. See Revision 3 in the implementation plan.
- Working on local SQLite: products, customers, invoice editor with autosaved drafts and parking, local invoice issuing with consecutive numbers, payments, quotations with convert-to-invoice, PDF, dashboard, reports with CSV export, company settings, backup and restore.
- Interface redesigned: minimal, light and dark following Windows, system font.
- The app previously failed to start (three module-format bugs in the Electron main and preload build). Fixed; it now launches.
- Verified: `npm run check` (GST maths, amount in words, all SQL including issuing, immutability and payment rules), `npm run build`, and a launch of the built app visiting every screen with no console errors.
- Not verified by hand: clicking through issue, payment, PDF and restore in the running app.
- Added from the reference projects (plan Revision 4): 13 invoice templates with accent colour, density, logo, signature, UPI QR and copy markings; credit notes; duplicate invoice; in-app document view; custom invoice items that can be saved to the catalogue; CSV import for products and customers; customer billing history; aging and credit note reports.
- Not built: cloud login, device approval, multi-computer sync, Google Sheets, installer signing and auto-update.

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

### Phase 2: Invoicing, Payments & Branding Enhancements
1. **Click-to-Preview on Dashboard / Home (`DashboardView.tsx`)**:
   - Recent Invoices table rows are now clickable (`cursor-pointer hover:bg-surface-2 transition-colors`).
   - Clicking opens the full invoice preview modal with Print, Save PDF, and Open in Invoices buttons.
   - Menu actions for Print and Save PDF seamlessly handle open dashboard previews.

2. **Re-edit Issued Invoices (`InvoiceEditor.tsx`, `InvoicesView.tsx`, `schema.ts`, `db.ts`)**:
   - Updated the SQLite trigger `trg_invoice_immutable` in `electron/main/schema.ts` to strictly protect sequence number, financial year, and invoice identity, while allowing corrections to invoice content (customer, items, totals, notes, due date).
   - Added `updateInvoice` in `src/lib/db.ts`.
   - `InvoiceEditor.tsx` accepts an `existingInvoice` prop to load the invoice, displays `Editing Invoice · {invoiceNumber}`, and saves updates with "Save Changes" without consuming a new sequence number.
   - Added an Edit button (`Pencil` icon) to each row in the Issued tab of `InvoicesView.tsx` and directly inside the invoice preview modal.

3. **Auto Image Resizer and Compressor (`src/lib/image.ts`, `SettingsView.tsx`)**:
   - Integrated client-side canvas compressor in `SettingsView.tsx`.
   - Uploading high-resolution company logos or signatures now automatically downscales to invoice dimensions (max 400x160 for logo, 300x100 for signature) and encodes into compact format (typically 25-120 KB), removing the rigid 300 KB file-size rejection.

4. **Partial and Full Payment Support (`PaymentModal.tsx`, `db.ts`)**:
   - Added one-click quick-fill buttons (`Full`, `50%`, `25%`) in `PaymentModal.tsx`.
   - Displays live status indicator (`Paid in Full` vs `Partially Paid` with calculated remaining balance).
   - Added `listPaymentsForInvoice` to query and display all prior payment installments recorded for that invoice.

5. **Verification**:
   - `scripts/db.check.ts` passes (`db ok`).
   - `scripts/gst.check.ts` passes (`gst ok`).
   - `npm run build` succeeds cleanly.

---

## 5. Next Planned Activities (Phase 2 & Phase 3)
1. **Interactive Indian GST Billing Form:** Port Invoify's line item row editor into `src/features/invoices/`, binding it to our pure GST calculation engine (CGST/SGST vs IGST).
2. **SQLite FTS Autocomplete Engine:** Wire the product search combobox directly to `local_products` and `local_customers` in the main process SQLite database.
3. **Parked Invoice Persistence:** Save drafts to `local_drafts` table on typing, enabling clerks to park bills with a hotkey/click and restore them seamlessly.

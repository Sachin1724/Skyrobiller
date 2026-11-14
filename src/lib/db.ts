// Renderer-side access to the local SQLite database over the IPC bridge.
// Type-only imports here: scripts/db.check.ts loads this file directly under Node.
import type { InvoiceLine, InvoiceTotals } from './gst';
import type { Company } from '../store/useSystemStore';

export interface Product {
  id: string;
  sku: string;
  name: string;
  brand: string;
  description: string;
  unit: string;
  hsnCode: string;
  gstRate: number;
  defaultPrice: number;
  searchAliases: string; // comma-separated
}

export interface Customer {
  id: string;
  businessName: string;
  contactPerson: string;
  gstin: string; // empty for unregistered (B2C) customers
  email: string;
  phone: string;
  billingAddress: string;
  stateCode: string;
  stateName: string;
  pincode: string;
  paymentTermsDays: number;
}

export type DraftKind = 'invoice' | 'quotation';
export type QuotationStatus = 'draft' | 'sent' | 'accepted' | 'declined' | 'converted';

// An invoice draft, a parked invoice, or a quotation: all are editable documents without a GST number.
export interface Draft {
  draftId: string;
  kind: DraftKind;
  isParked: boolean;
  customer: Customer | null;
  items: InvoiceLine[];
  total: number;
  notes: string;
  validUntil: string; // quotations only, YYYY-MM-DD
  status: QuotationStatus; // quotations only
  updatedAt: number;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  financialYear: string;
  issueDate: string;
  dueDate: string;
  customer: Customer;
  company: Company;
  items: InvoiceLine[];
  totals: InvoiceTotals;
  total: number;
  notes: string;
  status: 'issued' | 'cancelled';
  paid: number;
  credited: number; // total of credit notes against this invoice
}

export interface CreditNote {
  id: string;
  creditNumber: string;
  issueDate: string;
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string;
  customer: Customer;
  company: Company;
  items: InvoiceLine[];
  totals: InvoiceTotals;
  total: number;
  reason: string;
}

export interface Payment {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  customerName: string;
  amount: number;
  paidOn: string;
  method: string;
  reference: string;
}

type Statement = { sql: string; params?: unknown[] };

async function query<T>(sql: string, params: unknown[] = []): Promise<T[]> {
  const res = await window.electronAPI.dbQuery<T>(sql, params as any[]);
  if (!res.success) throw new Error(res.error);
  return res.rows ?? [];
}

async function batch(statements: Statement[]): Promise<void> {
  const res = await window.electronAPI.dbBatch(statements as any);
  if (!res.success) throw new Error(res.error);
}

const execute = (sql: string, params: unknown[] = []) => batch([{ sql, params }]);

// Indian financial year (April to March) for a YYYY-MM-DD date, e.g. 2026-11-14 -> "2026-27"
export function financialYearOf(isoDate: string): string {
  const [y, m] = isoDate.split('-').map(Number);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String((start + 1) % 100).padStart(2, '0')}`;
}

// ---------- Products ----------

// Every whitespace-separated word must appear somewhere in the haystack ("f405 speedy" finds the SpeedyBee F405).
// ponytail: LIKE scan, sql.js ships without FTS5; fine to ~50k rows, switch to FTS5 if search lags
function wordFilter(haystack: string, q: string) {
  const words = q.trim().split(/\s+/).filter(Boolean);
  return {
    where: words.map(() => `${haystack} LIKE ?`).join(' AND ') || '1',
    params: words.map((w) => `%${w}%`),
  };
}

const PRODUCT_COLS = `id, sku, name, coalesce(brand,'') AS brand, coalesce(description,'') AS description, unit,
  hsn_code AS hsnCode, gst_rate AS gstRate, default_price AS defaultPrice, coalesce(search_aliases,'') AS searchAliases`;

export function searchProducts(q: string, limit = 200): Promise<Product[]> {
  const f = wordFilter(`(sku || ' ' || name || ' ' || coalesce(brand,'') || ' ' || coalesce(search_aliases,''))`, q);
  return query<Product>(
    `SELECT ${PRODUCT_COLS} FROM local_products WHERE is_active = 1 AND ${f.where}
     ORDER BY sku LIKE ? DESC, name LIMIT ?`,
    [...f.params, `${q.trim()}%`, limit],
  );
}

export function saveProduct(p: Omit<Product, 'id'> & { id?: string }): Promise<void> {
  return execute(
    `INSERT INTO local_products (id, sku, name, brand, description, unit, hsn_code, gst_rate, default_price, search_aliases, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET sku=excluded.sku, name=excluded.name, brand=excluded.brand, description=excluded.description,
       unit=excluded.unit, hsn_code=excluded.hsn_code, gst_rate=excluded.gst_rate, default_price=excluded.default_price,
       search_aliases=excluded.search_aliases, updated_at=excluded.updated_at`,
    [p.id ?? crypto.randomUUID(), p.sku, p.name, p.brand, p.description, p.unit, p.hsnCode, p.gstRate, p.defaultPrice, p.searchAliases, Date.now()],
  );
}

// Bulk import: one transaction, so a bad row imports nothing. An existing SKU is updated, not duplicated.
export function importProducts(rows: Omit<Product, 'id'>[]): Promise<void> {
  const now = Date.now();
  return batch(rows.map((p) => ({
    sql: `INSERT INTO local_products (id, sku, name, brand, description, unit, hsn_code, gst_rate, default_price, search_aliases, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(sku) DO UPDATE SET name=excluded.name, brand=excluded.brand, description=excluded.description, unit=excluded.unit,
            hsn_code=excluded.hsn_code, gst_rate=excluded.gst_rate, default_price=excluded.default_price,
            search_aliases=excluded.search_aliases, updated_at=excluded.updated_at`,
    params: [crypto.randomUUID(), p.sku, p.name, p.brand, p.description, p.unit, p.hsnCode, p.gstRate, p.defaultPrice, p.searchAliases, now],
  })));
}

// The only path that changes a catalogue price from the invoice editor; always behind an explicit confirm.
export function updateProductPrice(id: string, price: number): Promise<void> {
  return execute(`UPDATE local_products SET default_price = ?, updated_at = ? WHERE id = ?`, [price, Date.now(), id]);
}

// ---------- Customers ----------

const CUSTOMER_COLS = `id, business_name AS businessName, coalesce(contact_person,'') AS contactPerson, coalesce(gstin,'') AS gstin,
  coalesce(email,'') AS email, coalesce(phone,'') AS phone, billing_address AS billingAddress, state_code AS stateCode,
  state_name AS stateName, pincode, payment_terms_days AS paymentTermsDays`;

export function searchCustomers(q: string, limit = 200): Promise<Customer[]> {
  const f = wordFilter(`(business_name || ' ' || coalesce(contact_person,'') || ' ' || coalesce(gstin,'') || ' ' || coalesce(phone,''))`, q);
  return query<Customer>(
    `SELECT ${CUSTOMER_COLS} FROM local_customers WHERE is_active = 1 AND ${f.where} ORDER BY business_name LIMIT ?`,
    [...f.params, limit],
  );
}

export function saveCustomer(c: Omit<Customer, 'id'> & { id?: string }): Promise<void> {
  return execute(
    `INSERT INTO local_customers (id, business_name, contact_person, gstin, email, phone, billing_address, state_name, state_code, pincode, payment_terms_days, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET business_name=excluded.business_name, contact_person=excluded.contact_person, gstin=excluded.gstin,
       email=excluded.email, phone=excluded.phone, billing_address=excluded.billing_address, state_name=excluded.state_name,
       state_code=excluded.state_code, pincode=excluded.pincode, payment_terms_days=excluded.payment_terms_days, updated_at=excluded.updated_at`,
    [c.id ?? crypto.randomUUID(), c.businessName, c.contactPerson, c.gstin || null, c.email, c.phone, c.billingAddress, c.stateName, c.stateCode, c.pincode, c.paymentTermsDays, Date.now()],
  );
}

// Bulk import in one transaction. A row whose GSTIN is already saved is skipped, so re-importing a file adds no duplicates
// for registered customers. Unregistered rows have no such key and are always added.
export function importCustomers(rows: Omit<Customer, 'id'>[]): Promise<void> {
  const now = Date.now();
  return batch(rows.map((c) => ({
    sql: `INSERT INTO local_customers (id, business_name, contact_person, gstin, email, phone, billing_address, state_name, state_code, pincode, payment_terms_days, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM local_customers WHERE gstin = ?)`,
    params: [crypto.randomUUID(), c.businessName, c.contactPerson, c.gstin || null, c.email, c.phone, c.billingAddress, c.stateName, c.stateCode, c.pincode, c.paymentTermsDays, now, c.gstin || null],
  })));
}

// ---------- Drafts, parked invoices, quotations ----------

interface DraftRow {
  draft_id: string;
  kind: DraftKind;
  is_parked: number;
  customer_json: string | null;
  items_json: string;
  totals_json: string;
  notes: string | null;
  valid_until: string | null;
  status: QuotationStatus;
  updated_at: number;
}

const toDraft = (r: DraftRow): Draft => ({
  draftId: r.draft_id,
  kind: r.kind,
  isParked: r.is_parked === 1,
  customer: r.customer_json ? JSON.parse(r.customer_json) : null,
  items: JSON.parse(r.items_json),
  total: JSON.parse(r.totals_json).total ?? 0,
  notes: r.notes ?? '',
  validUntil: r.valid_until ?? '',
  status: r.status,
  updatedAt: r.updated_at,
});

export const newDraftId = (kind: DraftKind) =>
  `${kind === 'quotation' ? 'Q' : 'D'}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;

export async function listDrafts(kind: DraftKind, parkedOnly = false): Promise<Draft[]> {
  const rows = await query<DraftRow>(
    `SELECT * FROM local_drafts WHERE kind = ? ${parkedOnly ? 'AND is_parked = 1' : ''} ORDER BY updated_at DESC`,
    [kind],
  );
  return rows.map(toDraft);
}

export async function getDraft(draftId: string): Promise<Draft | null> {
  const rows = await query<DraftRow>(`SELECT * FROM local_drafts WHERE draft_id = ?`, [draftId]);
  return rows[0] ? toDraft(rows[0]) : null;
}

export function saveDraft(d: Omit<Draft, 'updatedAt'>): Promise<void> {
  const now = Date.now();
  return execute(
    `INSERT INTO local_drafts (draft_id, kind, is_parked, customer_json, items_json, totals_json, notes, valid_until, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(draft_id) DO UPDATE SET is_parked=excluded.is_parked, customer_json=excluded.customer_json,
       items_json=excluded.items_json, totals_json=excluded.totals_json, notes=excluded.notes,
       valid_until=excluded.valid_until, status=excluded.status, updated_at=excluded.updated_at`,
    [d.draftId, d.kind, d.isParked ? 1 : 0, d.customer ? JSON.stringify(d.customer) : null, JSON.stringify(d.items),
      JSON.stringify({ total: d.total }), d.notes, d.validUntil || null, d.status, now, now],
  );
}

export function setQuotationStatus(draftId: string, status: QuotationStatus): Promise<void> {
  return execute(`UPDATE local_drafts SET status = ?, updated_at = ? WHERE draft_id = ?`, [status, Date.now(), draftId]);
}

export function deleteDraft(draftId: string): Promise<void> {
  return execute(`DELETE FROM local_drafts WHERE draft_id = ?`, [draftId]);
}

// ---------- Issued invoices ----------

interface InvoiceRow {
  id: string;
  invoice_number: string;
  financial_year: string;
  issue_date: string;
  due_date: string;
  customer_json: string;
  company_json: string;
  items_json: string;
  totals_json: string;
  total: number;
  notes: string | null;
  status: Invoice['status'];
  paid: number;
  credited: number;
}

const toInvoice = (r: InvoiceRow): Invoice => ({
  id: r.id,
  invoiceNumber: r.invoice_number,
  financialYear: r.financial_year,
  issueDate: r.issue_date,
  dueDate: r.due_date,
  customer: JSON.parse(r.customer_json),
  company: JSON.parse(r.company_json),
  items: JSON.parse(r.items_json),
  totals: JSON.parse(r.totals_json),
  total: r.total,
  notes: r.notes ?? '',
  status: r.status,
  paid: r.paid,
  credited: r.credited,
});

const INVOICE_SELECT = `SELECT i.*,
    coalesce((SELECT sum(amount) FROM local_payments p WHERE p.invoice_id = i.id), 0) AS paid,
    coalesce((SELECT sum(total) FROM local_credit_notes c WHERE c.invoice_id = i.id), 0) AS credited
  FROM local_invoices i`;

export async function listInvoices(range?: { from: string; to: string }): Promise<Invoice[]> {
  const rows = await query<InvoiceRow>(
    `${INVOICE_SELECT} ${range ? 'WHERE i.issue_date BETWEEN ? AND ?' : ''} ORDER BY i.financial_year DESC, i.seq DESC`,
    range ? [range.from, range.to] : [],
  );
  return rows.map(toInvoice);
}

// Turns a draft into an issued invoice with the next consecutive number of its financial year.
// The invoice reuses the draft's id as primary key, so a retried or double-clicked issue fails instead of creating a second invoice.
// ponytail: numbers come from this computer's database; once the cloud DB is connected this INSERT moves into the Postgres RPC
export async function issueInvoice(input: {
  draftId: string;
  customer: Customer;
  company: Company;
  items: InvoiceLine[];
  totals: InvoiceTotals;
  notes: string;
  issueDate: string;
  dueDate: string;
}): Promise<Invoice> {
  const fy = financialYearOf(input.issueDate);
  await batch([
    {
      sql: `INSERT INTO local_invoices (id, invoice_number, financial_year, seq, issue_date, due_date, customer_id, customer_name,
              customer_json, company_json, items_json, totals_json, total, notes, created_at)
            SELECT ?, ? || '/' || ? || '/' || printf('%04d', coalesce(max(seq), 0) + 1), ?, coalesce(max(seq), 0) + 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
            FROM local_invoices WHERE financial_year = ?`,
      params: [input.draftId, input.company.invoicePrefix, fy, fy, input.issueDate, input.dueDate, input.customer.id,
        input.customer.businessName, JSON.stringify(input.customer), JSON.stringify(input.company), JSON.stringify(input.items),
        JSON.stringify(input.totals), input.totals.total, input.notes, Date.now(), fy],
    },
    { sql: `DELETE FROM local_drafts WHERE draft_id = ?`, params: [input.draftId] },
  ]);
  const rows = await query<InvoiceRow>(`${INVOICE_SELECT} WHERE i.id = ?`, [input.draftId]);
  return toInvoice(rows[0]);
}

// Updates an issued invoice's customer, items, totals, notes or due date while preserving its permanent invoice number and sequence.
export async function updateInvoice(input: {
  id: string;
  customer: Customer;
  items: InvoiceLine[];
  totals: InvoiceTotals;
  notes: string;
  dueDate: string;
}): Promise<void> {
  const [row] = await query<{ settled: number }>(
    `SELECT coalesce((SELECT sum(amount) FROM local_payments WHERE invoice_id = ?1), 0)
          + coalesce((SELECT sum(total) FROM local_credit_notes WHERE invoice_id = ?1), 0) AS settled`,
    [input.id],
  );
  if (input.totals.total < row.settled - 0.005) {
    throw new Error(`New total is below the ${row.settled.toFixed(2)} already paid or credited`);
  }
  return execute(
    `UPDATE local_invoices
     SET customer_id = ?, customer_name = ?, customer_json = ?, items_json = ?, totals_json = ?, total = ?, notes = ?, due_date = ?
     WHERE id = ? AND status = 'issued'`,
    [
      input.customer.id,
      input.customer.businessName,
      JSON.stringify(input.customer),
      JSON.stringify(input.items),
      JSON.stringify(input.totals),
      input.totals.total,
      input.notes,
      input.dueDate,
      input.id,
    ],
  );
}

// The number stays used and the record stays in place; only the status changes.
export function cancelInvoice(id: string): Promise<void> {
  return execute(`UPDATE local_invoices SET status = 'cancelled' WHERE id = ?`, [id]);
}

// ---------- Credit notes ----------

// Issues a credit note against an invoice with the next number of the CN series for its financial year.
// ponytail: only the total is capped (by trigger) at the invoice value; returned quantity per line across several notes is not tracked
export function issueCreditNote(input: { invoiceId: string; items: InvoiceLine[]; totals: InvoiceTotals; reason: string; issueDate: string }): Promise<void> {
  const fy = financialYearOf(input.issueDate);
  return execute(
    `INSERT INTO local_credit_notes (id, credit_number, financial_year, seq, issue_date, invoice_id, items_json, totals_json, total, reason, created_at)
     SELECT ?, 'CN/' || ? || '/' || printf('%04d', coalesce(max(seq), 0) + 1), ?, coalesce(max(seq), 0) + 1, ?, ?, ?, ?, ?, ?, ?
     FROM local_credit_notes WHERE financial_year = ?`,
    [crypto.randomUUID(), fy, fy, input.issueDate, input.invoiceId, JSON.stringify(input.items), JSON.stringify(input.totals),
      input.totals.total, input.reason, Date.now(), fy],
  );
}

export async function listCreditNotes(range?: { from: string; to: string }): Promise<CreditNote[]> {
  const rows = await query<any>(
    `SELECT c.*, i.invoice_number, i.issue_date AS invoice_date, i.customer_json, i.company_json
     FROM local_credit_notes c JOIN local_invoices i ON i.id = c.invoice_id
     ${range ? 'WHERE c.issue_date BETWEEN ? AND ?' : ''} ORDER BY c.financial_year DESC, c.seq DESC`,
    range ? [range.from, range.to] : [],
  );
  return rows.map((r) => ({
    id: r.id, creditNumber: r.credit_number, issueDate: r.issue_date, invoiceId: r.invoice_id, invoiceNumber: r.invoice_number,
    invoiceDate: r.invoice_date, customer: JSON.parse(r.customer_json), company: JSON.parse(r.company_json),
    items: JSON.parse(r.items_json), totals: JSON.parse(r.totals_json), total: r.total, reason: r.reason,
  }));
}

// ---------- Payments ----------

// Overpayment and payments against cancelled invoices are rejected by a database trigger
export function addPayment(p: { invoiceId: string; amount: number; paidOn: string; method: string; reference: string }): Promise<void> {
  return execute(
    `INSERT INTO local_payments (id, invoice_id, amount, paid_on, method, reference, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [crypto.randomUUID(), p.invoiceId, p.amount, p.paidOn, p.method, p.reference, Date.now()],
  );
}

export function listPayments(): Promise<Payment[]> {
  return query<Payment>(
    `SELECT p.id, p.invoice_id AS invoiceId, i.invoice_number AS invoiceNumber, i.customer_name AS customerName,
       p.amount, p.paid_on AS paidOn, p.method, coalesce(p.reference, '') AS reference
     FROM local_payments p JOIN local_invoices i ON i.id = p.invoice_id
     ORDER BY p.paid_on DESC, p.created_at DESC`,
  );
}

export function listPaymentsForInvoice(invoiceId: string): Promise<Payment[]> {
  return query<Payment>(
    `SELECT p.id, p.invoice_id AS invoiceId, i.invoice_number AS invoiceNumber, i.customer_name AS customerName,
       p.amount, p.paid_on AS paidOn, p.method, coalesce(p.reference, '') AS reference
     FROM local_payments p JOIN local_invoices i ON i.id = p.invoice_id
     WHERE p.invoice_id = ?
     ORDER BY p.paid_on ASC, p.created_at ASC`,
    [invoiceId],
  );
}

// ---------- Settings ----------

export async function getSetting<T>(key: string): Promise<T | null> {
  const rows = await query<{ value: string }>(`SELECT value FROM local_settings WHERE key = ?`, [key]);
  return rows[0] ? JSON.parse(rows[0].value) : null;
}

export function setSetting(key: string, value: unknown): Promise<void> {
  return execute(
    `INSERT INTO local_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, JSON.stringify(value)],
  );
}

// ---------- Derived values ----------

export const outstandingOf = (inv: Invoice) =>
  inv.status === 'cancelled' ? 0 : Math.max(0, Math.round((inv.total - inv.paid - inv.credited) * 100) / 100);

export function paymentStatusOf(inv: Invoice): { label: string; badge: string } {
  if (inv.status === 'cancelled') return { label: 'Cancelled', badge: 'badge badge-danger' };
  if (inv.credited >= inv.total - 0.005) return { label: 'Credited', badge: 'badge badge-accent' };
  if (outstandingOf(inv) < 0.01) return { label: 'Paid', badge: 'badge badge-success' };
  if (inv.paid > 0) return { label: 'Partly Paid', badge: 'badge badge-warn' };
  return { label: 'Unpaid', badge: 'badge' };
}

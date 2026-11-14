// Local SQLite schema. No imports, so scripts/db.check.ts can load the exact same DDL.
// Everything here is idempotent and runs on every start; it doubles as the migration step.

const SCHEMA = `
  -- Products Cache
  CREATE TABLE IF NOT EXISTS local_products (
    id TEXT PRIMARY KEY,
    sku TEXT NOT NULL,
    name TEXT NOT NULL,
    brand TEXT,
    model TEXT,
    description TEXT,
    unit TEXT NOT NULL DEFAULT 'PCS',
    hsn_code TEXT NOT NULL,
    gst_rate REAL NOT NULL DEFAULT 18.00,
    default_price REAL NOT NULL DEFAULT 0.00,
    search_aliases TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS ux_local_products_sku ON local_products(sku);

  -- Customers Cache
  CREATE TABLE IF NOT EXISTS local_customers (
    id TEXT PRIMARY KEY,
    business_name TEXT NOT NULL,
    contact_person TEXT,
    gstin TEXT,
    email TEXT,
    phone TEXT,
    billing_address TEXT NOT NULL,
    state_name TEXT NOT NULL,
    state_code TEXT NOT NULL,
    pincode TEXT NOT NULL,
    payment_terms_days INTEGER NOT NULL DEFAULT 15,
    is_active INTEGER NOT NULL DEFAULT 1,
    updated_at INTEGER NOT NULL
  );

  -- Invoice drafts, parked invoices and quotations (see DRAFT_COLUMNS for kind/valid_until/status)
  CREATE TABLE IF NOT EXISTS local_drafts (
    draft_id TEXT PRIMARY KEY,
    is_parked INTEGER NOT NULL DEFAULT 0,
    customer_json TEXT,
    items_json TEXT NOT NULL,
    totals_json TEXT NOT NULL,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Issued invoices: full snapshots of customer, company and lines at the moment of issue
  CREATE TABLE IF NOT EXISTS local_invoices (
    id TEXT PRIMARY KEY,
    invoice_number TEXT NOT NULL UNIQUE,
    financial_year TEXT NOT NULL,
    seq INTEGER NOT NULL,
    issue_date TEXT NOT NULL,
    due_date TEXT NOT NULL,
    customer_id TEXT,
    customer_name TEXT NOT NULL,
    customer_json TEXT NOT NULL,
    company_json TEXT NOT NULL,
    items_json TEXT NOT NULL,
    totals_json TEXT NOT NULL,
    total REAL NOT NULL,
    notes TEXT,
    status TEXT NOT NULL DEFAULT 'issued' CHECK (status IN ('issued', 'cancelled')),
    created_at INTEGER NOT NULL,
    UNIQUE (financial_year, seq)
  );

  -- Invoice numbering sequence and identity are strictly permanent. Content can be corrected, but cancelled invoices cannot be edited.
  DROP TRIGGER IF EXISTS trg_invoice_immutable;
  CREATE TRIGGER trg_invoice_immutable
  BEFORE UPDATE OF id, invoice_number, financial_year, seq, created_at ON local_invoices
  BEGIN
    SELECT RAISE(ABORT, 'Invoice number, financial year, and sequence cannot be altered');
  END;

  DROP TRIGGER IF EXISTS trg_invoice_cancelled_immutable;
  CREATE TRIGGER trg_invoice_cancelled_immutable
  BEFORE UPDATE ON local_invoices
  WHEN OLD.status = 'cancelled'
  BEGIN
    SELECT RAISE(ABORT, 'Cancelled invoices cannot be edited');
  END;

  CREATE TRIGGER IF NOT EXISTS trg_invoice_no_delete
  BEFORE DELETE ON local_invoices
  BEGIN
    SELECT RAISE(ABORT, 'Issued invoices cannot be deleted; cancel instead');
  END;

  CREATE TABLE IF NOT EXISTS local_payments (
    id TEXT PRIMARY KEY,
    invoice_id TEXT NOT NULL REFERENCES local_invoices(id),
    amount REAL NOT NULL CHECK (amount > 0),
    paid_on TEXT NOT NULL,
    method TEXT NOT NULL,
    reference TEXT,
    created_at INTEGER NOT NULL
  );

  -- Credit notes: the documented way to correct or reverse an issued invoice. Own number series, never edited.
  CREATE TABLE IF NOT EXISTS local_credit_notes (
    id TEXT PRIMARY KEY,
    credit_number TEXT NOT NULL UNIQUE,
    financial_year TEXT NOT NULL,
    seq INTEGER NOT NULL,
    issue_date TEXT NOT NULL,
    invoice_id TEXT NOT NULL REFERENCES local_invoices(id),
    items_json TEXT NOT NULL,
    totals_json TEXT NOT NULL,
    total REAL NOT NULL CHECK (total > 0),
    reason TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    UNIQUE (financial_year, seq)
  );

  CREATE TRIGGER IF NOT EXISTS trg_credit_note_immutable
  BEFORE UPDATE ON local_credit_notes
  BEGIN
    SELECT RAISE(ABORT, 'Credit notes cannot be edited');
  END;

  CREATE TRIGGER IF NOT EXISTS trg_credit_note_no_delete
  BEFORE DELETE ON local_credit_notes
  BEGIN
    SELECT RAISE(ABORT, 'Credit notes cannot be deleted');
  END;

  -- Credit notes against one invoice can never add up to more than the invoice
  CREATE TRIGGER IF NOT EXISTS trg_credit_within_invoice
  BEFORE INSERT ON local_credit_notes
  WHEN NEW.total > 0.005
      + coalesce((SELECT total FROM local_invoices WHERE id = NEW.invoice_id AND status = 'issued'), 0)
      - coalesce((SELECT sum(total) FROM local_credit_notes WHERE invoice_id = NEW.invoice_id), 0)
  BEGIN
    SELECT RAISE(ABORT, 'Credit is more than the invoice value');
  END;

  -- A payment can never exceed what is still outstanding (after credit notes), and cancelled invoices take no payments.
  -- Dropped and recreated on every start so a changed rule reaches existing databases.
  DROP TRIGGER IF EXISTS trg_payment_within_outstanding;
  CREATE TRIGGER trg_payment_within_outstanding
  BEFORE INSERT ON local_payments
  WHEN NEW.amount > 0.005
      + coalesce((SELECT total FROM local_invoices WHERE id = NEW.invoice_id AND status = 'issued'), 0)
      - coalesce((SELECT sum(amount) FROM local_payments WHERE invoice_id = NEW.invoice_id), 0)
      - coalesce((SELECT sum(total) FROM local_credit_notes WHERE invoice_id = NEW.invoice_id), 0)
  BEGIN
    SELECT RAISE(ABORT, 'Payment is more than the outstanding amount');
  END;

  -- Key/value store for company profile and app settings
  CREATE TABLE IF NOT EXISTS local_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Outbox Sync Queue (unused until cloud sync is connected)
  CREATE TABLE IF NOT EXISTS sync_outbox (
    id TEXT PRIMARY KEY,
    entity_type TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    operation TEXT NOT NULL,
    payload TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    retry_count INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at INTEGER NOT NULL
  );
`;

// Columns added to local_drafts after the first release of the table
const DRAFT_COLUMNS = [
  "kind TEXT NOT NULL DEFAULT 'invoice'", // 'invoice' | 'quotation'
  'valid_until TEXT',
  "status TEXT NOT NULL DEFAULT 'draft'", // quotations: draft | sent | accepted | declined | converted
];

export function applySchema(database: { run(sql: string): unknown }) {
  database.run(SCHEMA);
  for (const column of DRAFT_COLUMNS) {
    try {
      database.run(`ALTER TABLE local_drafts ADD COLUMN ${column}`);
    } catch {
      // column already exists
    }
  }
}

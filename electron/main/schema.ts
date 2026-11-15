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

  -- An issued invoice's content is locked. Corrections go through credit and debit notes; only cancelling changes the row.
  DROP TRIGGER IF EXISTS trg_invoice_content_locked;
  CREATE TRIGGER trg_invoice_content_locked
  BEFORE UPDATE OF issue_date, due_date, customer_id, customer_name, customer_json, company_json, items_json, totals_json, total, notes ON local_invoices
  BEGIN
    SELECT RAISE(ABORT, 'Issued invoices cannot be edited; issue a credit note or debit note instead');
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

  -- Debit notes: the documented way to raise an issued invoice (extra charge, price correction). Own number series, never edited.
  CREATE TABLE IF NOT EXISTS local_debit_notes (
    id TEXT PRIMARY KEY,
    debit_number TEXT NOT NULL UNIQUE,
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

  CREATE TRIGGER IF NOT EXISTS trg_debit_note_immutable
  BEFORE UPDATE ON local_debit_notes
  BEGIN
    SELECT RAISE(ABORT, 'Debit notes cannot be edited');
  END;

  CREATE TRIGGER IF NOT EXISTS trg_debit_note_no_delete
  BEFORE DELETE ON local_debit_notes
  BEGIN
    SELECT RAISE(ABORT, 'Debit notes cannot be deleted');
  END;

  CREATE TRIGGER IF NOT EXISTS trg_debit_on_issued_invoice
  BEFORE INSERT ON local_debit_notes
  WHEN NOT EXISTS (SELECT 1 FROM local_invoices WHERE id = NEW.invoice_id AND status = 'issued')
  BEGIN
    SELECT RAISE(ABORT, 'Debit notes can only be issued against an issued invoice');
  END;

  -- Credit notes against one invoice can never add up to more than the invoice plus its debit notes.
  -- Dropped and recreated on every start so a changed rule reaches existing databases.
  DROP TRIGGER IF EXISTS trg_credit_within_invoice;
  CREATE TRIGGER trg_credit_within_invoice
  BEFORE INSERT ON local_credit_notes
  WHEN NEW.total > 0.005
      + coalesce((SELECT total FROM local_invoices WHERE id = NEW.invoice_id AND status = 'issued'), 0)
      + coalesce((SELECT sum(total) FROM local_debit_notes WHERE invoice_id = NEW.invoice_id), 0)
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
      + coalesce((SELECT sum(total) FROM local_debit_notes WHERE invoice_id = NEW.invoice_id), 0)
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

// Recycle Bin: an invoice is hidden (deleted_at set), never removed, so its number stays used. Needs the deleted_at column, so it runs after the ALTER.
const TRASH_SCHEMA = `
  DROP TRIGGER IF EXISTS trg_invoice_cancelled_immutable;
  CREATE TRIGGER trg_invoice_cancelled_immutable
  BEFORE UPDATE ON local_invoices
  WHEN OLD.status = 'cancelled' AND NEW.deleted_at IS OLD.deleted_at
  BEGIN
    SELECT RAISE(ABORT, 'Cancelled invoices cannot be edited');
  END;

  DROP TRIGGER IF EXISTS trg_invoice_trash_guard;
  CREATE TRIGGER trg_invoice_trash_guard
  BEFORE UPDATE OF deleted_at ON local_invoices
  WHEN NEW.deleted_at IS NOT NULL
    AND (EXISTS (SELECT 1 FROM local_credit_notes WHERE invoice_id = NEW.id) OR EXISTS (SELECT 1 FROM local_debit_notes WHERE invoice_id = NEW.id))
  BEGIN
    SELECT RAISE(ABORT, 'Invoices with credit or debit notes cannot be moved to the Recycle Bin');
  END;
`;

// Audit log: written by triggers, so no screen or import path can skip it. Rows can never be edited or deleted.
const AUDIT_SCHEMA = `
  CREATE TABLE IF NOT EXISTS local_audit (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    at INTEGER NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL CHECK (action IN ('create', 'update', 'delete')),
    before_json TEXT,
    after_json TEXT
  );
  CREATE INDEX IF NOT EXISTS ix_local_audit_entity ON local_audit(entity, entity_id);
  CREATE TRIGGER IF NOT EXISTS trg_audit_no_edit BEFORE UPDATE ON local_audit BEGIN SELECT RAISE(ABORT, 'Audit log cannot be edited'); END;
  CREATE TRIGGER IF NOT EXISTS trg_audit_no_delete BEFORE DELETE ON local_audit BEGIN SELECT RAISE(ABORT, 'Audit log cannot be deleted'); END;
`;

// Columns recorded per table. Big blobs (items_json, logo) are left out on purpose; totals and status tell the story.
const AUDITED: Record<string, { entity: string; id: string; cols: string[] }> = {
  local_products: { entity: 'product', id: 'id', cols: ['sku', 'name', 'hsn_code', 'gst_rate', 'default_price', 'is_active'] },
  local_customers: { entity: 'customer', id: 'id', cols: ['business_name', 'gstin', 'state_code', 'phone', 'payment_terms_days', 'is_active'] },
  local_invoices: { entity: 'invoice', id: 'id', cols: ['invoice_number', 'customer_name', 'total', 'due_date', 'notes', 'status', 'deleted_at'] },
  local_payments: { entity: 'payment', id: 'id', cols: ['invoice_id', 'amount', 'paid_on', 'method', 'reference'] },
  local_credit_notes: { entity: 'credit_note', id: 'id', cols: ['credit_number', 'invoice_id', 'total', 'reason'] },
  local_debit_notes: { entity: 'debit_note', id: 'id', cols: ['debit_number', 'invoice_id', 'total', 'reason'] },
};

function auditTriggers(): string {
  return Object.entries(AUDITED).map(([table, { entity, id, cols }]) => {
    const snap = (row: 'OLD' | 'NEW') => `json_object(${cols.map((c) => `'${c}', ${row}.${c}`).join(', ')})`;
    const log = (action: string, row: 'OLD' | 'NEW', before: string, after: string) =>
      `DROP TRIGGER IF EXISTS trg_audit_${table}_${action}; CREATE TRIGGER trg_audit_${table}_${action} AFTER ${action === 'create' ? 'INSERT' : action.toUpperCase()} ON ${table} BEGIN ` +
      `INSERT INTO local_audit (at, entity, entity_id, action, before_json, after_json) ` +
      `VALUES (CAST(strftime('%s','now') AS INTEGER) * 1000, '${entity}', ${row}.${id}, '${action}', ${before}, ${after}); END;`;
    return [log('create', 'NEW', 'NULL', snap('NEW')), log('update', 'NEW', snap('OLD'), snap('NEW')), log('delete', 'OLD', snap('OLD'), 'NULL')].join('\n');
  }).join('\n');
}

export function applySchema(database: { run(sql: string): unknown }) {
  database.run(SCHEMA);
  database.run(AUDIT_SCHEMA);
  for (const [table, column] of [...DRAFT_COLUMNS.map((c) => ['local_drafts', c]), ['local_invoices', 'deleted_at INTEGER']]) {
    try {
      database.run(`ALTER TABLE ${table} ADD COLUMN ${column}`);
    } catch {
      // column already exists
    }
  }
  database.run(TRASH_SCHEMA);
  database.run(auditTriggers());
}

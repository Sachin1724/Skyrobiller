import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import initSqlJs, { Database } from 'sql.js';

let db: Database | null = null;
let dbFilePath = '';

export async function initDatabase(): Promise<Database> {
  if (db) return db;

  const userDataPath = app.getPath('userData');
  const dbDir = path.join(userDataPath, 'data');
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  dbFilePath = path.join(dbDir, 'skyro_local.db');

  const SQL = await initSqlJs();

  if (fs.existsSync(dbFilePath)) {
    const fileBuffer = fs.readFileSync(dbFilePath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    runInitialSchema(db);
    saveDatabase();
  }

  return db;
}

function runInitialSchema(database: Database) {
  const schema = `
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

    -- Drafts & Parked Invoices
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

    -- Outbox Sync Queue
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
  database.run(schema);
}

export function saveDatabase(): boolean {
  if (!db || !dbFilePath) return false;
  try {
    const binaryArray = db.export();
    const buffer = Buffer.from(binaryArray);
    fs.writeFileSync(dbFilePath, buffer);
    return true;
  } catch (err) {
    console.error('Failed to persist SQLite database:', err);
    return false;
  }
}

export function queryDb<T = any>(sql: string, params: any[] = []): { success: boolean; rows?: T[]; error?: string } {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows: T[] = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject() as unknown as T);
    }
    stmt.free();
    return { success: true, rows };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export function executeDb(sql: string, params: any[] = []): { success: boolean; rowsAffected?: number; error?: string } {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    db.run(sql, params);
    saveDatabase(); // Auto-persist on mutation
    return { success: true, rowsAffected: db.getRowsModified() };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

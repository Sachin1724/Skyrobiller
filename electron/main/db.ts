import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import initSqlJs, { Database } from 'sql.js';
import { applySchema } from './schema';

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
  db = fs.existsSync(dbFilePath) ? new SQL.Database(fs.readFileSync(dbFilePath)) : new SQL.Database();
  applySchema(db);
  saveDatabase();

  return db;
}

function writeAtomic(filePath: string, data: Uint8Array) {
  // Write-then-rename: a crash mid-write must never truncate the live DB
  const tmpPath = filePath + '.tmp';
  fs.writeFileSync(tmpPath, Buffer.from(data));
  fs.renameSync(tmpPath, filePath);
}

export function saveDatabase(): boolean {
  if (!db || !dbFilePath) return false;
  try {
    // ponytail: whole-file export per mutation, fine for a few MB; move to better-sqlite3 + WAL if saves get slow
    writeAtomic(dbFilePath, db.export());
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

// Runs all statements in one transaction and persists once; any failure rolls everything back.
export function batchDb(statements: { sql: string; params?: any[] }[]): { success: boolean; error?: string } {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    db.run('BEGIN');
    for (const s of statements) db.run(s.sql, s.params ?? []);
    db.run('COMMIT');
  } catch (err: any) {
    try { db.run('ROLLBACK'); } catch { /* no open transaction */ }
    return { success: false, error: err.message };
  }
  if (!saveDatabase()) return { success: false, error: 'Saved in memory but failed to write to disk' };
  return { success: true };
}

export function executeDb(sql: string, params: any[] = []) {
  return batchDb([{ sql, params }]);
}

export function backupDatabase(destPath: string): { success: boolean; error?: string } {
  if (!db) return { success: false, error: 'Database not initialized' };
  try {
    fs.writeFileSync(destPath, Buffer.from(db.export()));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export interface BackupPreview {
  products: number;
  customers: number;
  invoices: number;
  lastInvoiceDate: string | null;
  fileModified: number;
}

// What a backup file holds, so the user can check it is the right one before it replaces anything
export async function previewBackup(srcPath: string): Promise<{ success: boolean; preview?: BackupPreview; error?: string }> {
  try {
    const SQL = await initSqlJs();
    const candidate = new SQL.Database(fs.readFileSync(srcPath));
    const one = (sql: string) => candidate.exec(sql)[0]?.values[0]?.[0];
    const preview: BackupPreview = {
      products: Number(one('SELECT count(*) FROM local_products')),
      customers: Number(one('SELECT count(*) FROM local_customers')),
      invoices: Number(one('SELECT count(*) FROM local_invoices')),
      lastInvoiceDate: (one('SELECT max(issue_date) FROM local_invoices') as string | null) ?? null,
      fileModified: fs.statSync(srcPath).mtimeMs,
    };
    candidate.close();
    return { success: true, preview };
  } catch (err: any) {
    return { success: false, error: `Not a valid Skyro Biller backup: ${err.message}` };
  }
}

// Replaces the live database with a backup file. The current DB is kept next to it as .before-restore.
export async function restoreDatabase(srcPath: string): Promise<{ success: boolean; error?: string }> {
  try {
    const SQL = await initSqlJs();
    const candidate = new SQL.Database(fs.readFileSync(srcPath));
    candidate.exec('SELECT 1 FROM local_products LIMIT 1'); // throws unless this is a Skyro Biller database
    applySchema(candidate);
    if (fs.existsSync(dbFilePath)) fs.copyFileSync(dbFilePath, dbFilePath + '.before-restore');
    db = candidate;
    return saveDatabase() ? { success: true } : { success: false, error: 'Could not write the restored database to disk' };
  } catch (err: any) {
    return { success: false, error: `Not a valid Skyro Biller backup: ${err.message}` };
  }
}

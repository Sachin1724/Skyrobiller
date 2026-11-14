export interface DeviceInfo {
  machineId: string;
  hostname: string;
  platform: string;
  arch: string;
  appVersion: string;
}

export interface DbQueryResult<T = any> {
  success: boolean;
  rows?: T[];
  error?: string;
  rowsAffected?: number;
}

export interface BackupSettings {
  enabled: boolean;
  folder: string; // '' = default folder inside app data
  keep: number; // automatic backups kept
}

export interface BackupStatus extends BackupSettings {
  effectiveFolder: string;
  lastAt: number | null;
  lastFile: string | null;
  lastError: string | null;
}

// Result of choosing a backup file: what it holds, before anything is replaced
export interface RestorePick {
  success: boolean;
  error?: string;
  filePath?: string;
  preview?: { products: number; customers: number; invoices: number; lastInvoiceDate: string | null; fileModified: number };
}

export interface ElectronAPI {
  // Menu bar and window
  onMenu: (callback: (action: string) => void) => () => void;
  closeReady: () => Promise<void>;
  setTheme: (theme: 'light' | 'dark' | 'system') => Promise<void>;

  // Device & System
  getDeviceInfo: () => Promise<DeviceInfo>;

  // Local SQLite (sql.js / embedded)
  dbQuery: <T = any>(sql: string, params?: any[]) => Promise<DbQueryResult<T>>;
  dbExecute: (sql: string, params?: any[]) => Promise<DbQueryResult>;
  dbBatch: (statements: { sql: string; params?: any[] }[]) => Promise<DbQueryResult>;
  dbSave: () => Promise<{ success: boolean; error?: string }>;
  dbBackup: () => Promise<{ success: boolean; filePath?: string; error?: string }>;
  dbRestorePick: (startIn?: string) => Promise<RestorePick>;
  dbRestoreApply: (filePath: string) => Promise<{ success: boolean; error?: string }>;

  // Automatic backup and logs
  backupStatus: () => Promise<BackupStatus>;
  backupSet: (change: Partial<BackupSettings>) => Promise<BackupStatus>;
  backupRunNow: () => Promise<BackupStatus>;
  backupChooseFolder: () => Promise<BackupStatus>;
  logError: (where: string, message: string) => Promise<void>;
  exportLogs: () => Promise<{ success: boolean; filePath?: string; error?: string }>;

  // PDF Printing & Export
  generatePdf: (options: { htmlContent: string; title: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  printHtml: (options: { htmlContent: string }) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

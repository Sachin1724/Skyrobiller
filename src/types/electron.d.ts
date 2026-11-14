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
  dbRestore: () => Promise<{ success: boolean; error?: string }>;

  // PDF Printing & Export
  generatePdf: (options: { htmlContent: string; title: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;
  printHtml: (options: { htmlContent: string }) => Promise<{ success: boolean; error?: string }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

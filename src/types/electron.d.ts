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
  // Window controls
  minimize: () => Promise<void>;
  maximize: () => Promise<void>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;

  // Device & System
  getDeviceInfo: () => Promise<DeviceInfo>;

  // Local SQLite (sql.js / embedded)
  dbQuery: <T = any>(sql: string, params?: any[]) => Promise<DbQueryResult<T>>;
  dbExecute: (sql: string, params?: any[]) => Promise<DbQueryResult>;
  dbSave: () => Promise<{ success: boolean; error?: string }>;

  // PDF Printing & Export
  generatePdf: (options: { htmlContent: string; title: string }) => Promise<{ success: boolean; filePath?: string; error?: string }>;

  // Event Listeners
  onSyncStatusChange?: (callback: (status: any) => void) => () => void;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

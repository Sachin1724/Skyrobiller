import { contextBridge, ipcRenderer } from 'electron';
import type { DeviceInfo, DbQueryResult, RestorePick, BackupStatus, BackupSettings } from '../../src/types/electron';

const electronAPI = {
  // Menu bar: `callback` receives the action name of every menu item clicked. Returns an unsubscribe function.
  onMenu: (callback: (action: string) => void) => {
    const listener = (_event: unknown, action: string) => callback(action);
    ipcRenderer.on('menu', listener);
    return () => { ipcRenderer.removeListener('menu', listener); };
  },
  // Tells the main process that open work is saved and the window may close
  closeReady: () => ipcRenderer.invoke('app:closeReady'),
  setTheme: (theme: 'light' | 'dark' | 'system') => ipcRenderer.invoke('theme:set', theme),

  // Device & System
  getDeviceInfo: (): Promise<DeviceInfo> => ipcRenderer.invoke('device:getInfo'),

  // Updates: the main process reports available / progress / ready; the app asks for the restart
  onUpdate: (callback: (msg: { state: 'available' | 'progress' | 'ready'; version?: string; percent?: number }) => void) => {
    const listener = (_event: unknown, msg: any) => callback(msg);
    ipcRenderer.on('update', listener);
    return () => { ipcRenderer.removeListener('update', listener); };
  },
  installUpdate: () => ipcRenderer.invoke('update:install'),

  // Local SQLite
  dbQuery: <T = any>(sql: string, params?: any[]): Promise<DbQueryResult<T>> =>
    ipcRenderer.invoke('db:query', { sql, params }),
  dbExecute: (sql: string, params?: any[]): Promise<DbQueryResult> =>
    ipcRenderer.invoke('db:execute', { sql, params }),
  dbBatch: (statements: { sql: string; params?: any[] }[]): Promise<DbQueryResult> =>
    ipcRenderer.invoke('db:batch', statements),
  dbSave: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('db:save'),
  dbBackup: (): Promise<{ success: boolean; filePath?: string; error?: string }> =>
    ipcRenderer.invoke('db:backup'),
  dbRestorePick: (startIn?: string): Promise<RestorePick> => ipcRenderer.invoke('db:restorePick', startIn),
  dbRestoreApply: (filePath: string): Promise<{ success: boolean; error?: string }> => ipcRenderer.invoke('db:restoreApply', filePath),

  // Automatic backup and logs
  backupStatus: (): Promise<BackupStatus> => ipcRenderer.invoke('backup:status'),
  backupSet: (change: Partial<BackupSettings>): Promise<BackupStatus> => ipcRenderer.invoke('backup:set', change),
  backupRunNow: (): Promise<BackupStatus> => ipcRenderer.invoke('backup:runNow'),
  backupChooseFolder: (): Promise<BackupStatus> => ipcRenderer.invoke('backup:chooseFolder'),
  logError: (where: string, message: string) => ipcRenderer.invoke('log:error', where, message),
  exportLogs: (): Promise<{ success: boolean; filePath?: string; error?: string }> => ipcRenderer.invoke('log:export'),

  storeFetch: (options: { baseUrl: string; apiKey: string; path: string }): Promise<{ success: boolean; data?: any; error?: string }> =>
    ipcRenderer.invoke('store:fetch', options),

  // PDF Generation and printing
  generatePdf: (options: { htmlContent: string; title: string }) =>
    ipcRenderer.invoke('pdf:generate', options),
  printHtml: (options: { htmlContent: string }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('pdf:print', options),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

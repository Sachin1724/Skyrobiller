import { contextBridge, ipcRenderer } from 'electron';
import type { DeviceInfo, DbQueryResult } from '../../src/types/electron';

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
  dbRestore: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('db:restore'),

  // PDF Generation and printing
  generatePdf: (options: { htmlContent: string; title: string }) =>
    ipcRenderer.invoke('pdf:generate', options),
  printHtml: (options: { htmlContent: string }): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('pdf:print', options),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

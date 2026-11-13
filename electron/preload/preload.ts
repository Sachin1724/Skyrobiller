import { contextBridge, ipcRenderer } from 'electron';
import type { DeviceInfo, DbQueryResult } from '../../src/types/electron';

const electronAPI = {
  // Window controls
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  isMaximized: () => ipcRenderer.invoke('window:isMaximized'),

  // Device & System
  getDeviceInfo: (): Promise<DeviceInfo> => ipcRenderer.invoke('device:getInfo'),

  // Local SQLite
  dbQuery: <T = any>(sql: string, params?: any[]): Promise<DbQueryResult<T>> => 
    ipcRenderer.invoke('db:query', { sql, params }),
  dbExecute: (sql: string, params?: any[]): Promise<DbQueryResult> => 
    ipcRenderer.invoke('db:execute', { sql, params }),
  dbSave: (): Promise<{ success: boolean; error?: string }> => 
    ipcRenderer.invoke('db:save'),

  // PDF Generation
  generatePdf: (options: { htmlContent: string; title: string }) => 
    ipcRenderer.invoke('pdf:generate', options),
};

contextBridge.exposeInMainWorld('electronAPI', electronAPI);

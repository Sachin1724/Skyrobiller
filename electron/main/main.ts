import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { machineIdSync } from 'node-machine-id';
import { initDatabase, queryDb, executeDb, saveDatabase } from './db';
import type { DeviceInfo } from '../../src/types/electron';

// Set app identity
process.env.APP_ROOT = path.join(__dirname, '..');
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = app.isPackaged ? RENDERER_DIST : path.join(process.env.APP_ROOT, 'public');

let win: BrowserWindow | null = null;

const preload = path.join(__dirname, '../dist-electron/preload.js');
const devServerUrl = process.env.VITE_DEV_SERVER_URL;

async function createWindow() {
  win = new BrowserWindow({
    title: 'Skyro Biller',
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 700,
    frame: false, // Frameless for modern custom titlebar
    backgroundColor: '#020617', // slate-950
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  win.on('ready-to-show', () => {
    win?.show();
  });

  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }
}

// Window control handlers
ipcMain.handle('window:minimize', () => {
  win?.minimize();
});

ipcMain.handle('window:maximize', () => {
  if (win?.isMaximized()) {
    win.unmaximize();
  } else {
    win?.maximize();
  }
});

ipcMain.handle('window:close', () => {
  win?.close();
});

ipcMain.handle('window:isMaximized', () => {
  return win?.isMaximized() ?? false;
});

// Device Info handler
ipcMain.handle('device:getInfo', (): DeviceInfo => {
  let mid = 'UNKNOWN-DEVICE';
  try {
    mid = machineIdSync();
  } catch (err) {
    mid = os.hostname() + '-' + os.platform();
  }

  return {
    machineId: mid,
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    appVersion: app.getVersion(),
  };
});

// Database IPC handlers
ipcMain.handle('db:query', (_event, { sql, params }) => {
  return queryDb(sql, params);
});

ipcMain.handle('db:execute', (_event, { sql, params }) => {
  return executeDb(sql, params);
});

ipcMain.handle('db:save', () => {
  const success = saveDatabase();
  return { success };
});

// PDF Generation
ipcMain.handle('pdf:generate', async (_event, { htmlContent, title }) => {
  try {
    const printWin = new BrowserWindow({
      show: false,
      webPreferences: {
        nodeIntegration: false,
      },
    });

    await printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlContent)}`);

    const pdfBuffer = await printWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: {
        top: 0.4,
        bottom: 0.4,
        left: 0.4,
        right: 0.4,
      },
    });

    printWin.close();

    const { filePath } = await dialog.showSaveDialog({
      title: `Save ${title}`,
      defaultPath: `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    });

    if (filePath) {
      fs.writeFileSync(filePath, pdfBuffer);
      return { success: true, filePath };
    }
    return { success: false, error: 'Cancelled by user' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

app.whenReady().then(async () => {
  await initDatabase();
  await createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  saveDatabase();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

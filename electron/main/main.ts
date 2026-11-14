import { app, BrowserWindow, Menu, ipcMain, dialog, shell, nativeTheme } from 'electron';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { execSync } from 'child_process';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { initDatabase, queryDb, executeDb, batchDb, saveDatabase, backupDatabase, restoreDatabase, previewBackup } from './db';
import { getBackupStatus, runAutoBackup, writeBackupSettings, type BackupSettings } from './backup';
import { logError, logFilePath, installCrashLogging } from './log';
import { buildMenu } from './menu';
import electronUpdater from 'electron-updater';

const { autoUpdater } = electronUpdater; // CommonJS package, imported by default in this ES module
import type { DeviceInfo } from '../../src/types/electron';

// The bundle is an ES module ("type": "module"), which has no __dirname
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Set app identity
process.env.APP_ROOT = path.join(__dirname, '..');
export const MAIN_DIST = path.join(process.env.APP_ROOT, 'dist-electron');
export const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

process.env.VITE_PUBLIC = app.isPackaged ? RENDERER_DIST : path.join(process.env.APP_ROOT, 'public');

let win: BrowserWindow | null = null;

const preload = path.join(__dirname, 'preload.cjs');
const devServerUrl = process.env.VITE_DEV_SERVER_URL;
const iconPath = path.join(process.env.APP_ROOT, 'resources', 'icon.png'); // dev only; the installed app takes its icon from the exe

// Window size and position are remembered between runs
const windowStatePath = () => path.join(app.getPath('userData'), 'window-state.json');
function readWindowState(): { bounds?: Electron.Rectangle; maximized?: boolean } {
  try {
    return JSON.parse(fs.readFileSync(windowStatePath(), 'utf8'));
  } catch {
    return {}; // first run, or unreadable file: use defaults
  }
}

async function createWindow() {
  const state = readWindowState();
  win = new BrowserWindow({
    title: 'Skyro Biller',
    width: 1360,
    height: 860,
    ...state.bounds,
    minWidth: 1024,
    minHeight: 700,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#202020' : '#f3f3f3', // matches --bg in src/index.css
    show: true, // Make visible immediately on desktop
    webPreferences: {
      preload,
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });
  if (state.maximized) win.maximize();

  // Closing: remember the window, then let the renderer save any open draft before the window goes away
  let readyToClose = false;
  win.on('close', (e) => {
    if (!win) return;
    fs.writeFileSync(windowStatePath(), JSON.stringify({ bounds: win.getNormalBounds(), maximized: win.isMaximized() }));
    if (readyToClose) return;
    e.preventDefault();
    readyToClose = true;
    win.webContents.send('menu', 'flush-and-close');
    setTimeout(() => win?.destroy(), 1500); // never hang on close if the renderer does not answer
  });
  win.on('closed', () => { win = null; });

  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else if (fs.existsSync(path.join(RENDERER_DIST, 'index.html'))) {
    win.loadFile(path.join(RENDERER_DIST, 'index.html'));
  } else {
    win.loadURL('http://localhost:5173');
  }
}

ipcMain.handle('app:closeReady', () => {
  win?.destroy();
});

// Light, dark, or follow Windows. The CSS uses prefers-color-scheme, which follows this setting.
ipcMain.handle('theme:set', (_event, theme: 'light' | 'dark' | 'system') => {
  if (!['light', 'dark', 'system'].includes(theme)) return;
  nativeTheme.themeSource = theme;
  const menuItem = Menu.getApplicationMenu()?.getMenuItemById(`theme-${theme}`);
  if (menuItem) menuItem.checked = true;
});

// Device Info handler
ipcMain.handle('device:getInfo', (): DeviceInfo => {
  let mid = 'UNKNOWN-DEVICE';
  try {
    if (process.platform === 'win32') {
      const output = execSync('REG QUERY HKEY_LOCAL_MACHINE\\SOFTWARE\\Microsoft\\Cryptography /v MachineGuid', { encoding: 'utf8' });
      const match = output.match(/REG_SZ\s+([a-f0-9-]+)/i);
      if (match && match[1]) {
        mid = crypto.createHash('sha256').update(match[1].trim()).digest('hex');
      }
    } else {
      mid = crypto.createHash('sha256').update(os.hostname() + os.platform() + os.arch()).digest('hex');
    }
  } catch {
    mid = crypto.createHash('sha256').update(os.hostname() + '-' + os.platform()).digest('hex');
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

ipcMain.handle('db:batch', (_event, statements) => {
  return batchDb(statements);
});

const backupFilters = [{ name: 'Skyro Biller Backup', extensions: ['db'] }];

ipcMain.handle('db:backup', async () => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Save Backup',
    defaultPath: `skyro-backup-${new Date().toISOString().slice(0, 10)}.db`,
    filters: backupFilters,
  });
  if (!filePath) return { success: false, error: 'Cancelled' };
  return { ...backupDatabase(filePath), filePath };
});

// Restore is two steps so the user sees what they are about to load: pick a file (returns a preview), then apply it
ipcMain.handle('db:restorePick', async (_event, startIn?: string) => {
  const { filePaths } = await dialog.showOpenDialog({
    title: 'Restore Backup', properties: ['openFile'], filters: backupFilters,
    defaultPath: startIn || getBackupStatus().effectiveFolder,
  });
  if (!filePaths[0]) return { success: false, error: 'Cancelled' };
  return { ...(await previewBackup(filePaths[0])), filePath: filePaths[0] };
});

ipcMain.handle('db:restoreApply', async (_event, filePath: string) => {
  // The current data is kept beside the database as .before-restore, so a wrong restore can be undone.
  // Today's automatic backup is left alone: the user may be restoring from that very file.
  const result = await restoreDatabase(filePath);
  if (result.success) win?.reload(); // every screen re-reads from the restored database
  return result;
});

ipcMain.handle('backup:status', () => getBackupStatus());
ipcMain.handle('backup:set', (_event, change: Partial<BackupSettings>) => {
  writeBackupSettings(change);
  return runAutoBackup();
});
ipcMain.handle('backup:runNow', () => runAutoBackup(true));
ipcMain.handle('backup:chooseFolder', async () => {
  const { filePaths } = await dialog.showOpenDialog({ title: 'Choose Backup Folder', properties: ['openDirectory', 'createDirectory'] });
  if (!filePaths[0]) return getBackupStatus();
  writeBackupSettings({ folder: filePaths[0] });
  return runAutoBackup();
});

ipcMain.handle('log:error', (_event, where: string, message: string) => logError(`renderer ${where}`, message));
ipcMain.handle('log:export', async () => {
  const { filePath } = await dialog.showSaveDialog({
    title: 'Export Logs', defaultPath: `skyro-logs-${new Date().toISOString().slice(0, 10)}.txt`, filters: [{ name: 'Text', extensions: ['txt'] }],
  });
  if (!filePath) return { success: false, error: 'Cancelled' };
  const info = `Skyro Biller ${app.getVersion()} · Electron ${process.versions.electron} · ${os.platform()} ${os.release()} · ${os.hostname()}\n\n`;
  fs.writeFileSync(filePath, info + (fs.existsSync(logFilePath()) ? fs.readFileSync(logFilePath(), 'utf8') : 'No errors logged.\n'));
  return { success: true, filePath };
});

ipcMain.handle('db:save', () => {
  const success = saveDatabase();
  return { success };
});

// Loads document HTML into a hidden window, ready to print or turn into a PDF.
// Loaded from a temp file, not a data: URL: an embedded logo can push the page past Chromium's 2 MB URL limit.
async function loadDocumentWindow(htmlContent: string): Promise<BrowserWindow> {
  const printWin = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false } });
  const htmlPath = path.join(app.getPath('temp'), `skyro-print-${Date.now()}.html`);
  fs.writeFileSync(htmlPath, htmlContent);
  try {
    await printWin.loadFile(htmlPath);
  } finally {
    fs.rmSync(htmlPath, { force: true });
  }
  return printWin;
}

// PDF Generation
ipcMain.handle('pdf:generate', async (_event, { htmlContent, title }) => {
  try {
    const printWin = await loadDocumentWindow(htmlContent);
    const pdfBuffer = await printWin.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: true,
      margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
    });
    printWin.close();

    const { filePath } = await dialog.showSaveDialog({
      title: `Save ${title}`,
      defaultPath: `${title.replace(/[^a-zA-Z0-9_-]/g, '_')}.pdf`,
      filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
    });

    if (filePath) {
      fs.writeFileSync(filePath, pdfBuffer);
      shell.openPath(filePath); // opens in the default PDF viewer
      return { success: true, filePath };
    }
    return { success: false, error: 'Cancelled by user' };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Opens the Windows print dialog for a document
ipcMain.handle('pdf:print', async (_event, { htmlContent }) => {
  try {
    const printWin = await loadDocumentWindow(htmlContent);
    return await new Promise((resolve) => {
      printWin.webContents.print({ printBackground: true }, (success, reason) => {
        printWin.close();
        resolve(success || reason === 'cancelled' ? { success: true } : { success: false, error: reason });
      });
    });
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Updates come from GitHub Releases (see "publish" in electron-builder.yml). Only an installed build can update:
// the portable exe and a dev run cannot, and say so.
let updateReady = false;
function checkForUpdates(manual: boolean) {
  if (!app.isPackaged) {
    if (manual) dialog.showMessageBox({ type: 'info', title: 'Check for Updates', message: 'Updates work in the installed app.', detail: `This is a development run of ${app.getVersion()}.` });
    return;
  }
  autoUpdater.autoDownload = true;
  autoUpdater.removeAllListeners();
  autoUpdater.on('update-available', (info) => { if (manual) dialog.showMessageBox({ type: 'info', title: 'Update found', message: `Version ${info.version} is downloading.`, detail: 'You will be asked to restart when it is ready. Your data is not touched.' }); });
  autoUpdater.on('update-not-available', () => { if (manual) dialog.showMessageBox({ type: 'info', title: 'Check for Updates', message: `You have the latest version (${app.getVersion()}).` }); });
  autoUpdater.on('error', (err) => { logError('updater', err); if (manual) dialog.showMessageBox({ type: 'warning', title: 'Check for Updates', message: 'Could not check for updates.', detail: 'Check your internet connection and try again.' }); });
  autoUpdater.on('update-downloaded', async (info) => {
    if (updateReady) return;
    updateReady = true;
    const { response } = await dialog.showMessageBox({ type: 'question', buttons: ['Restart Now', 'Later'], defaultId: 0, cancelId: 1, title: 'Update ready', message: `Skyro Biller ${info.version} is ready.`, detail: 'Restart to finish updating. Your data is kept, and a backup is saved on exit.' });
    if (response === 0) { saveDatabase(); runAutoBackup(true); autoUpdater.quitAndInstall(); }
  });
  autoUpdater.checkForUpdates().catch((err) => logError('updater', err));
}

function installMenu() {
  Menu.setApplicationMenu(buildMenu({
    send: (action) => win?.webContents.send('menu', action),
    checkForUpdates: () => checkForUpdates(true),
    openDataFolder: () => shell.openPath(path.join(app.getPath('userData'), 'data')),
    about: () => dialog.showMessageBox({
      type: 'info',
      title: 'About Skyro Biller',
      message: `Skyro Biller ${app.getVersion()}`,
      detail: `Billing and invoicing for UAV parts.\n\nData folder: ${path.join(app.getPath('userData'), 'data')}\nElectron ${process.versions.electron} · Chromium ${process.versions.chrome}`,
    }),
  }));
}

// Only one copy of the app may run: two would each hold their own copy of the database in memory and overwrite each other
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });

  app.whenReady().then(async () => {
    try {
      installCrashLogging();
      await initDatabase();
      runAutoBackup();
      setInterval(() => runAutoBackup(), 60 * 60 * 1000); // catches the day rolling over while the app stays open
      installMenu();
      await createWindow();
      setTimeout(() => checkForUpdates(false), 8000); // quietly, a few seconds after start
    } catch (err: any) {
      console.error('Startup error:', err);
      dialog.showErrorBox('Skyro Biller could not start', err.message);
    }

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
      }
    });
  });

  app.on('window-all-closed', () => {
    saveDatabase();
    runAutoBackup(true); // end of day: today's backup holds the latest data
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });
}

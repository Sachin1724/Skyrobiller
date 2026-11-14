import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { backupDatabase } from './db';
import { logError } from './log';

export interface BackupSettings {
  enabled: boolean;
  folder: string; // '' = the default folder inside app data
  keep: number; // how many automatic backups to keep
}

export interface BackupStatus extends BackupSettings {
  effectiveFolder: string;
  lastAt: number | null; // ms since epoch of the newest automatic backup
  lastFile: string | null;
  lastError: string | null;
}

const settingsPath = () => path.join(app.getPath('userData'), 'backup-settings.json');
const defaultFolder = () => path.join(app.getPath('userData'), 'backups');
const AUTO_NAME = /^skyro-auto-\d{4}-\d{2}-\d{2}\.db$/;

let lastError: string | null = null;

export function readBackupSettings(): BackupSettings {
  try {
    return { enabled: true, folder: '', keep: 14, ...JSON.parse(fs.readFileSync(settingsPath(), 'utf8')) };
  } catch {
    return { enabled: true, folder: '', keep: 14 }; // first run, or unreadable file: safe defaults, backup on
  }
}

export function writeBackupSettings(change: Partial<BackupSettings>): BackupSettings {
  const current = readBackupSettings();
  const next: BackupSettings = {
    enabled: typeof change.enabled === 'boolean' ? change.enabled : current.enabled,
    // Reject UNC network paths (\\server\share) to avoid SMB credential leaks
    folder: typeof change.folder === 'string' && !change.folder.startsWith('\\\\') && !change.folder.startsWith('//')
      ? change.folder
      : current.folder,
    keep: typeof change.keep === 'number' ? Math.min(365, Math.max(1, Math.round(change.keep) || 14)) : current.keep,
  };
  fs.writeFileSync(settingsPath(), JSON.stringify(next));
  return next;
}

const folderOf = (s: BackupSettings) => s.folder || defaultFolder();

function autoBackups(folder: string): { file: string; mtime: number }[] {
  try {
    return fs.readdirSync(folder).filter((f) => AUTO_NAME.test(f))
      .map((file) => ({ file, mtime: fs.statSync(path.join(folder, file)).mtimeMs }))
      .sort((a, b) => b.mtime - a.mtime);
  } catch {
    return []; // folder missing or unplugged drive
  }
}

export function getBackupStatus(): BackupStatus {
  const s = readBackupSettings();
  const folder = folderOf(s);
  const [newest] = autoBackups(folder);
  return { ...s, effectiveFolder: folder, lastAt: newest?.mtime ?? null, lastFile: newest ? path.join(folder, newest.file) : null, lastError };
}

// Writes today's backup if there is none yet, then drops the oldest beyond `keep`. Safe to call as often as you like.
export function runAutoBackup(force = false): BackupStatus {
  const s = readBackupSettings();
  if (!s.enabled && !force) return getBackupStatus();
  const folder = folderOf(s);
  try {
    fs.mkdirSync(folder, { recursive: true });
    const name = `skyro-auto-${new Date().toLocaleDateString('en-CA')}.db`; // local date, YYYY-MM-DD
    // Today's file is rewritten only when asked (force); otherwise the daily one stands
    if (force || !autoBackups(folder).some((b) => b.file === name)) {
      const res = backupDatabase(path.join(folder, name));
      if (!res.success) throw new Error(res.error);
    }
    autoBackups(folder).slice(s.keep).forEach((b) => fs.rmSync(path.join(folder, b.file), { force: true }));
    lastError = null;
  } catch (err: any) {
    lastError = err.message;
    logError('auto backup', err);
  }
  return getBackupStatus();
}

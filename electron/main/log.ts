import path from 'path';
import fs from 'fs';
import { app } from 'electron';

const MAX_BYTES = 1024 * 1024; // past 1 MB the old log is kept as app.old.log and a fresh one starts

export const logFilePath = () => path.join(app.getPath('userData'), 'logs', 'app.log');

export function logError(where: string, err: unknown) {
  try {
    const file = logFilePath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > MAX_BYTES) fs.renameSync(file, file.replace(/app\.log$/, 'app.old.log'));
    const detail = err instanceof Error ? err.stack ?? err.message : String(err);
    fs.appendFileSync(file, `${new Date().toISOString()} [${where}] ${detail}\n`);
  } catch {
    // logging must never take the app down
  }
}

export function installCrashLogging() {
  process.on('uncaughtException', (err) => logError('uncaughtException', err));
  process.on('unhandledRejection', (err) => logError('unhandledRejection', err));
}

import React, { useEffect } from 'react';
import { useSystemStore } from '../../store/useSystemStore';
import { useNavStore } from '../../store/useNavStore';
import { financialYearOf } from '../../lib/db';
import { todayISO } from '../../lib/utils';

const HOUR = 60 * 60 * 1000;

function ago(ms: number): string {
  const h = Math.floor((Date.now() - ms) / HOUR);
  if (h < 1) return 'just now';
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// Always-visible footer: financial year, backup health, where the data lives
export const StatusBar: React.FC = () => {
  const { backup, refreshBackup, deviceInfo } = useSystemStore();
  const setCurrentModule = useNavStore((s) => s.setCurrentModule);

  useEffect(() => {
    const load = () => { refreshBackup().catch(() => undefined); };
    load();
    const timer = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(timer);
  }, [refreshBackup]);

  // Overdue = nothing in the last 2 days, a failed run, or no backup at all
  const stale = !backup || !!backup.lastError || !backup.lastAt || Date.now() - backup.lastAt > 48 * HOUR;
  const text = !backup ? 'Checking backup…'
    : backup.lastError ? 'Backup failed'
    : !backup.enabled && !backup.lastAt ? 'Backups are off'
    : backup.lastAt ? `Last backup ${ago(backup.lastAt)}` : 'No backup yet';

  return (
    <footer className="shrink-0 h-7 px-4 flex items-center gap-4 border-t border-line/60 bg-sidebar text-[11px] text-ink-2">
      <span>FY {financialYearOf(todayISO())}</span>
      <button onClick={() => setCurrentModule('settings')} className={`flex items-center gap-1.5 hover:text-ink ${stale ? 'text-warn' : ''}`} title={backup?.lastError ?? backup?.effectiveFolder}>
        <span aria-hidden className={`size-1.5 rounded-full ${stale ? 'bg-warn' : 'bg-success'}`} />
        {text}
      </button>
      <span className="ml-auto">{deviceInfo ? `${deviceInfo.hostname} · ` : ''}Data stored on this computer</span>
    </footer>
  );
};

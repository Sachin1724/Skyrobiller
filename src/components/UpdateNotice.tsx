import React, { useEffect, useState } from 'react';
import { Check, Download } from 'lucide-react';

type Msg = { state: 'available' | 'progress' | 'ready'; version?: string; percent?: number };

const R = 18;
const C = 2 * Math.PI * R;

// Update card: announces the new version, shows download progress as a ring, turns green when ready to install
export const UpdateNotice: React.FC = () => {
  const [state, setState] = useState<Msg['state'] | null>(null);
  const [version, setVersion] = useState('');
  const [percent, setPercent] = useState(0);
  const [hidden, setHidden] = useState(false);

  useEffect(() => window.electronAPI?.onUpdate((m) => {
    setState(m.state);
    if (m.version) setVersion(m.version);
    if (m.percent !== undefined) setPercent(m.percent);
    if (m.state === 'ready') setPercent(100);
    setHidden(false);
  }), []);

  if (!state || hidden) return null;
  const done = state === 'ready';

  return (
    <div role="status" aria-live="polite" className="fixed bottom-4 right-4 z-50 flex w-80 items-center gap-3 rounded-lg border border-line bg-surface p-3 shadow-lg">
      <div className="relative h-11 w-11 shrink-0">
        <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90" aria-hidden>
          <circle cx="22" cy="22" r={R} fill="none" strokeWidth="4" className="stroke-ink/10" />
          <circle cx="22" cy="22" r={R} fill="none" strokeWidth="4" strokeLinecap="round" strokeDasharray={C} strokeDashoffset={C * (1 - percent / 100)}
            className={`transition-[stroke-dashoffset] duration-300 ${done ? 'stroke-success' : 'stroke-accent'}`} />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold tabular-nums">
          {done ? <Check className="h-5 w-5 text-success" aria-hidden /> : state === 'available' ? <Download className="h-4 w-4 text-accent" aria-hidden /> : `${percent}%`}
        </span>
      </div>
      <div className="min-w-0 flex-1">
        <div className={`text-sm font-semibold ${done ? 'text-success' : ''}`}>{done ? 'Update ready' : 'New update available'}</div>
        <div className="text-xs text-ink-2">{done ? `Version ${version} downloaded. Your data is kept.` : `Version ${version} is downloading…`}</div>
        {done && (
          <div className="mt-2 flex gap-2">
            <button onClick={() => window.electronAPI.installUpdate()} className="btn btn-primary">Restart Now</button>
            <button onClick={() => setHidden(true)} className="btn">Later</button>
          </div>
        )}
      </div>
    </div>
  );
};

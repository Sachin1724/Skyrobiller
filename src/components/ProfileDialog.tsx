import React, { useEffect, useRef } from 'react';
import { Check, Circle, X } from 'lucide-react';
import { profileScore, type ProfileItem } from '../lib/profile';

// Colour says how far along you are: red under half, amber until done, green when complete
export const ringTone = (pct: number) => (pct >= 100 ? 'text-success' : pct >= 50 ? 'text-warn' : 'text-danger');

// Circular score. Draws the arc with a dash offset, so it needs no chart library.
export const ProgressRing: React.FC<{ pct: number; size?: number }> = ({ pct, size = 56 }) => {
  const stroke = 5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <span className={`relative inline-grid place-items-center ${ringTone(pct)}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity={0.15} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.23, 1, 0.32, 1)' }}
        />
      </svg>
      <span className="absolute text-sm font-semibold tabular-nums text-ink">{pct}%</span>
    </span>
  );
};

// Small centred window over a blurred page: what is done, what is missing, and a button to finish each missing thing
export const ProfileDialog: React.FC<{ items: ProfileItem[]; onGo: (item: ProfileItem) => void; onClose: () => void }> = ({ items, onGo, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (!ref.current?.open) ref.current?.showModal(); }, []);
  const pct = profileScore(items);
  const groups = [...new Set(items.map((i) => i.group))];

  return (
    <dialog
      ref={ref}
      aria-labelledby="profile-title"
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className="sheet sheet-blur max-w-md"
    >
      <div className="flex items-center gap-4 p-4 border-b border-line">
        <ProgressRing pct={pct} size={52} />
        <div className="min-w-0 flex-1">
          <h2 id="profile-title" className="text-base font-semibold">Your profile is {pct}% complete</h2>
          <p className="text-xs text-ink-2">{pct === 100 ? 'Everything is set up.' : `${items.filter((i) => !i.done).length} to go. Finish them for clean invoices and safe backups.`}</p>
        </div>
        <button onClick={onClose} className="btn btn-icon" aria-label="Close"><X className="h-4 w-4" aria-hidden /></button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-2">
        {groups.map((group) => (
          <div key={group} className="mb-2">
            <div className="px-2 py-1 text-xs font-semibold text-ink-3">{group}</div>
            {items.filter((i) => i.group === group).map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded px-2 py-1.5 hover:bg-ink/[0.03]">
                {item.done
                  ? <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-success/15 text-success"><Check className="h-3 w-3" aria-hidden /></span>
                  : <Circle className="h-5 w-5 shrink-0 text-ink-3" aria-hidden />}
                <div className="min-w-0 flex-1">
                  <div className={item.done ? 'text-ink-2' : 'font-medium'}>{item.label}</div>
                  {!item.done && <div className="text-xs text-ink-3">{item.hint}</div>}
                </div>
                {!item.done && <button onClick={() => onGo(item)} className="btn h-7 px-2 text-xs">Complete</button>}
              </div>
            ))}
          </div>
        ))}
      </div>
    </dialog>
  );
};

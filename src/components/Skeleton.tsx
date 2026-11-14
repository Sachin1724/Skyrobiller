import React from 'react';

// Placeholder table rows shown while a list loads, so "No invoices yet" never flashes before the data arrives
export const SkeletonRows: React.FC<{ columns: number; rows?: number }> = ({ columns, rows = 4 }) => (
  <>
    {Array.from({ length: rows }, (_, r) => (
      <tr key={r} aria-hidden>
        {Array.from({ length: columns }, (_, c) => (
          <td key={c}><div className="skeleton h-3.5" style={{ width: `${c === 0 ? 70 : 40 + ((r * 17 + c * 23) % 45)}%` }} /></td>
        ))}
      </tr>
    ))}
  </>
);

// Empty list with the one action that fixes it
export const EmptyState: React.FC<{ icon: React.ComponentType<{ className?: string }>; title: string; hint?: string; action?: { label: string; onClick: () => void } }> = ({ icon: Icon, title, hint, action }) => (
  <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
    <div className="grid h-11 w-11 place-items-center rounded-xl bg-accent/10 text-accent"><Icon className="h-5 w-5" /></div>
    <div className="font-medium">{title}</div>
    {hint && <p className="max-w-sm text-xs text-ink-2">{hint}</p>}
    {action && <button onClick={action.onClick} className="btn btn-primary mt-2">{action.label}</button>}
  </div>
);

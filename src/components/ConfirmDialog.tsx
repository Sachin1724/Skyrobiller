import React, { useEffect, useRef, useState } from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  headline?: { label: string; value: string }; // the figure being committed, shown large
  details?: [label: string, value: string][];
  confirmLabel: string;
  cancelLabel?: string; // when plain "Cancel" would be confused with the action, e.g. "Keep Invoice"
  danger?: boolean; // red button, and Cancel gets the first focus
}

type Pending = { options: ConfirmOptions; resolve: (ok: boolean) => void };
let open: ((p: Pending) => void) | null = null;

// In-app replacement for window.confirm: says what is about to happen, with the numbers that matter.
export const confirmDialog = (options: ConfirmOptions): Promise<boolean> =>
  new Promise((resolve) => (open ? open({ options, resolve }) : resolve(window.confirm(options.title))));

// Mount once, near the root
export const ConfirmHost: React.FC = () => {
  const [pending, setPending] = useState<Pending | null>(null);
  const ref = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const secondary = useRef<HTMLButtonElement>(null);

  useEffect(() => { open = setPending; return () => { open = null; }; }, []);
  useEffect(() => {
    if (!pending) return;
    if (!ref.current?.open) ref.current?.showModal();
    // showModal focuses the first button; put focus where Enter should land: the action, or Cancel for a destructive one
    (pending.options.danger ? secondary : primary).current?.focus();
  }, [pending]);

  if (!pending) return null;
  const { options, resolve } = pending;
  const finish = (ok: boolean) => { resolve(ok); setPending(null); };

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      className="sheet max-w-md"
      onCancel={(e) => { e.preventDefault(); finish(false); }} // Esc
      onClick={(e) => e.target === ref.current && finish(false)} // backdrop
    >
      <form method="dialog" onSubmit={(e) => { e.preventDefault(); finish(true); }} className="p-4 space-y-4">
        <h2 id="confirm-title" className="text-base font-semibold tracking-tight">{options.title}</h2>
        {options.headline && (
          <div className="rounded-md bg-ink/[0.04] px-4 py-3">
            <div className="text-xs text-ink-2">{options.headline.label}</div>
            <div className="text-lg font-semibold tracking-tight tabular-nums">{options.headline.value}</div>
          </div>
        )}
        {options.details && (
          <dl className="space-y-1.5">
            {options.details.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-6">
                <dt className="text-ink-2">{label}</dt>
                <dd className="font-medium text-right tabular-nums">{value}</dd>
              </div>
            ))}
          </dl>
        )}
        {options.message && <p className="text-ink-2 whitespace-pre-line">{options.message}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button ref={secondary} type="button" onClick={() => finish(false)} className="btn">{options.cancelLabel ?? 'Cancel'}</button>
          <button ref={primary} type="submit" className={`btn ${options.danger ? 'btn-danger-solid' : 'btn-primary'}`}>{options.confirmLabel}</button>
        </div>
      </form>
    </dialog>
  );
};

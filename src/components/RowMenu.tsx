import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface RowMenuItem {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean; // shown last, after a divider
  title?: string; // why it is disabled
}

// "⋯" button with a labelled menu. Fixed-positioned so a table card's overflow never clips it.
export const RowMenu: React.FC<{ label: string; items: RowMenuItem[] }> = ({ label, items }) => {
  const button = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const close = () => { setPos(null); button.current?.focus(); };

  useEffect(() => {
    if (!pos) return;
    menu.current?.querySelector<HTMLButtonElement>('button:not(:disabled)')?.focus();
    const onDown = (e: PointerEvent) => { if (!menu.current?.contains(e.target as Node) && !button.current?.contains(e.target as Node)) setPos(null); };
    const hide = () => setPos(null);
    document.addEventListener('pointerdown', onDown);
    window.addEventListener('resize', hide);
    document.querySelector('main')?.addEventListener('scroll', hide);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      window.removeEventListener('resize', hide);
      document.querySelector('main')?.removeEventListener('scroll', hide);
    };
  }, [pos]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const enabled = [...menu.current!.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')];
    const i = enabled.indexOf(document.activeElement as HTMLButtonElement);
    enabled[(i + (e.key === 'ArrowDown' ? 1 : -1) + enabled.length) % enabled.length]?.focus();
  };

  const normal = items.filter((i) => !i.danger);
  const danger = items.filter((i) => i.danger);
  const row = (item: RowMenuItem) => (
    <button
      key={item.label}
      role="menuitem"
      disabled={item.disabled}
      title={item.title}
      onClick={() => { setPos(null); item.onClick(); }}
      className={`flex w-full items-center gap-3 h-8 px-3 rounded text-left text-sm disabled:opacity-40 hover:bg-ink/5 focus-visible:bg-ink/5 ${item.danger ? 'text-danger' : ''}`}
    >
      <item.icon className="h-4 w-4 shrink-0" aria-hidden />
      {item.label}
    </button>
  );

  return (
    <>
      <button
        ref={button}
        onClick={() => { const r = button.current!.getBoundingClientRect(); setPos(pos ? null : { top: r.bottom + 4, right: window.innerWidth - r.right }); }}
        aria-haspopup="menu"
        aria-expanded={pos !== null}
        aria-label={label}
        title="More actions"
        className="btn btn-icon"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden />
      </button>
      {pos && (
        <div ref={menu} role="menu" aria-label={label} onKeyDown={onKeyDown} style={{ top: pos.top, right: pos.right }} className="menu-pop">
          {normal.map(row)}
          {danger.length > 0 && <hr className="my-1 border-line" />}
          {danger.map(row)}
        </div>
      )}
    </>
  );
};

import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface Command { id: string; label: string; hint?: string; keywords?: string }

// Ctrl+K: type a few letters of a screen or an action and press Enter. Words may come in any order.
export const CommandPalette: React.FC<{ commands: Command[]; onRun: (id: string) => void; onClose: () => void }> = ({ commands, onRun, onClose }) => {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);

  useEffect(() => { if (!ref.current?.open) ref.current?.showModal(); }, []);

  const shown = useMemo(() => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    return commands.filter((c) => words.every((w) => `${c.label} ${c.hint ?? ''} ${c.keywords ?? ''}`.toLowerCase().includes(w)));
  }, [commands, query]);

  const run = (c: Command | undefined) => { if (!c) return; onClose(); onRun(c.id); };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); run(shown[active]); }
  };

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && onClose()} aria-label="Command palette" className="sheet mt-[12vh] max-w-xl">
      <input
        autoFocus
        role="combobox"
        aria-expanded="true"
        aria-controls="palette-list"
        aria-activedescendant={shown[active] ? `cmd-${shown[active].id}` : undefined}
        aria-label="Type a command or screen"
        placeholder="Go to a screen or run a command…"
        autoComplete="off"
        spellCheck={false}
        value={query}
        onChange={(e) => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={onKeyDown}
        className="w-full h-12 px-5 bg-transparent text-[15px] border-b border-line outline-none placeholder:text-ink-3"
      />
      <ul id="palette-list" role="listbox" className="max-h-80 overflow-y-auto p-2">
        {shown.length === 0 && <li className="empty">Nothing matches “{query}”.</li>}
        {shown.map((c, i) => (
          <li
            key={c.id}
            id={`cmd-${c.id}`}
            role="option"
            aria-selected={i === active}
            onMouseMove={() => setActive(i)}
            onClick={() => run(c)}
            className={`flex items-center justify-between gap-4 h-9 px-3 rounded-lg cursor-default ${i === active ? 'bg-accent text-white' : ''}`}
          >
            <span>{c.label}</span>
            {c.hint && <span className={`text-xs ${i === active ? 'text-white/80' : 'text-ink-3'}`}>{c.hint}</span>}
          </li>
        ))}
      </ul>
    </dialog>
  );
};

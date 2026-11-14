import React, { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

interface SearchBoxProps<T> {
  search: (q: string) => Promise<T[]>;
  onPick: (item: T) => void;
  renderItem: (item: T) => React.ReactNode;
  label: string;
  placeholder: string;
  emptyText: string; // shown when nothing matches; should say what to do next
  autoFocus?: boolean;
}

// Autocomplete over the local database: type, arrow keys to move, Enter to pick.
export function SearchBox<T>({ search, onPick, renderItem, label, placeholder, emptyText, autoFocus }: SearchBoxProps<T>) {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<T[]>([]);
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    let current = true;
    search(q).then((r) => {
      if (current) { setRows(r); setActive(0); }
    }).catch(() => current && setRows([]));
    return () => { current = false; };
  }, [q, open]);

  const pick = (item: T) => {
    onPick(item);
    setQ('');
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(a + 1, rows.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter' && !e.ctrlKey && open && rows[active]) { e.preventDefault(); pick(rows[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  return (
    <div className="relative">
      <Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-3 pointer-events-none" aria-hidden />
      <input
        type="text"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-autocomplete="list"
        autoComplete="off"
        spellCheck={false}
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
        className="field pl-8"
      />
      {open && (
        <ul role="listbox" aria-label={label} className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-line bg-surface shadow-xl p-1">
          {rows.length === 0 && <li className="px-2.5 py-2 text-ink-2">{emptyText}</li>}
          {rows.map((item, i) => (
            <li
              key={i}
              role="option"
              aria-selected={i === active}
              // mousedown, not click: fires before the input's blur closes the list
              onMouseDown={(e) => { e.preventDefault(); pick(item); }}
              onMouseEnter={() => setActive(i)}
              className={`px-2.5 py-1.5 rounded-lg cursor-default ${i === active ? 'bg-accent text-white' : ''}`}
            >
              {renderItem(item)}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

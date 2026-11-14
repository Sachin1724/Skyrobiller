// CSV in and out. No imports, so scripts/gst.check.ts can load it under Node.

// RFC 4180: quoted fields, doubled quotes, and commas or line breaks inside quotes. Blank lines are dropped.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c !== '"') field += c;
      else if (text[i + 1] === '"') { field += '"'; i++; }
      else quoted = false;
    } else if (c === '"') {
      quoted = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

// Turns a CSV with a header row into objects keyed by lower-cased header. Throws if a required column is missing.
export function csvRecords(text: string, required: string[]): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text.replace(/^﻿/, ''));
  const names = (header ?? []).map((h) => h.trim().toLowerCase());
  const missing = required.filter((r) => !names.includes(r));
  if (missing.length) throw new Error(`Missing column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}. Download the template to see the expected columns.`);
  return rows.map((r) => Object.fromEntries(names.map((n, i) => [n, (r[i] ?? '').trim()])));
}

export function toCsv(rows: (string | number)[][]): string {
  const quote = (c: string | number) => `"${String(c).replace(/"/g, '""')}"`;
  return rows.map((r) => r.map(quote).join(',')).join('\r\n');
}

export function downloadCsv(name: string, rows: (string | number)[][]) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + toCsv(rows)], { type: 'text/csv' })); // BOM so Excel reads ₹ and names correctly
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

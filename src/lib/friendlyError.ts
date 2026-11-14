// Turns database and system errors into plain language. Raw messages are logged, never shown.

const RULES: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  [/UNIQUE constraint failed: local_products\.sku/i, 'That SKU is already in the catalogue. Use a different SKU, or pick the existing product.'],
  [/UNIQUE constraint failed: local_invoices|PRIMARY KEY.*local_invoices/i, 'This invoice was already issued. Close the editor and check the Issued list.'],
  [/UNIQUE constraint failed: local_(credit|debit)_notes/i, 'Another note was issued at the same moment. Try again.'],
  [/UNIQUE|PRIMARY KEY/i, 'That already exists.'],
  [/FOREIGN KEY/i, 'This is linked to other records and cannot be changed.'],
  [/NOT NULL constraint failed: \w+\.(\w+)/i, (m) => `A required value is missing: ${m[1].replace(/_/g, ' ')}.`],
  [/CHECK constraint failed/i, 'One of the values is not allowed. Check the amounts and dates.'],
  [/ENOSPC|no space left/i, 'The disk is full. Free some space and try again.'],
  [/EACCES|EPERM|EBUSY|database is locked|readonly/i, 'The data file could not be written. Close any other program using it and try again.'],
  [/not initialized/i, 'The database is not ready yet. Restart the app.'],
];

// Messages written by this app's own database rules and import checks are already plain language
const OWN = /^(Payment is more|Credit is more|Issued invoices|Cancelled invoices|Invoice number, financial|Debit notes|Credit notes|Audit log|Not a valid Skyro|The file has no|Nothing was imported|Missing column|Cancelled)/;

export function friendlyError(e: unknown): string {
  const raw = e instanceof Error ? e.message : typeof e === 'string' ? e : JSON.stringify(e);
  if (OWN.test(raw)) return raw.replace(/[.\s]*$/, '.');
  for (const [pattern, out] of RULES) {
    const match = raw.match(pattern);
    if (match) return typeof out === 'string' ? out : out(match);
  }
  window.electronAPI?.logError('unexpected', raw);
  return 'Something went wrong. Try again. If it keeps happening, export the logs from Settings > Backup and send them to support.';
}

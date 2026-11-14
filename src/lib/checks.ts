// Everything that can be wrong with a bill, found in one pass so the editor can show all of it at once.
// Errors block issuing; warnings can be issued over. Type-only imports: scripts/gst.check.ts loads this file under Node.
import type { InvoiceLine } from './gst.ts';
import type { Customer } from './db.ts';

export interface Issue {
  field: string; // where it belongs: customer, items, qty, hsn, description, rate, discount, gst, total, company, dues, duplicate
  line?: number; // 0-based item row, when the problem is on one line
  level: 'error' | 'warning';
  message: string;
  empty?: boolean; // "nothing entered yet": held back until the user tries to issue
}

export interface CheckInput {
  kind: 'invoice' | 'quotation';
  customer: Customer | null;
  items: InvoiceLine[];
  total: number;
  company: { legalName: string; gstin: string; accountNumber: string };
  dues: { outstanding: number; overdue: number } | null;
  issuedToday: { total: number; items: number }[]; // invoices already issued today to this customer
}

// GSTIN: 2-digit state, PAN, entity number, Z, check character
const GSTIN_FORMAT = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function gstinCheckChar(first14: string): string {
  let sum = 0;
  for (let i = 0; i < 14; i++) {
    const v = CHARS.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(v / 36) + (v % 36);
  }
  return CHARS[(36 - (sum % 36)) % 36];
}

export const isValidGstin = (gstin: string) => GSTIN_FORMAT.test(gstin) && gstinCheckChar(gstin.slice(0, 14)) === gstin[14];

// The sample profile the app ships with: bills must not go out under these details
const PLACEHOLDER = { gstins: ['21AAACS1234D1Z5', '21AAACS1234D1Z8'], account: '50200088991234' };

export function checkInvoice({ kind, customer, items, total, company, dues, issuedToday }: CheckInput): Issue[] {
  const issues: Issue[] = [];
  const error = (field: string, message: string, extra: Partial<Issue> = {}) => issues.push({ field, level: 'error', message, ...extra });
  const warn = (field: string, message: string, extra: Partial<Issue> = {}) => issues.push({ field, level: 'warning', message, ...extra });

  // --- Errors
  if (!customer) error('customer', 'Choose a customer.', { empty: true });
  if (items.length === 0) error('items', 'Add at least one item.', { empty: true });
  items.forEach((l, line) => {
    const n = `Item ${line + 1}`;
    if (!l.description.trim()) error('description', `${n}: enter a name.`, { line });
    if (!(l.qty > 0)) error('qty', `${n}: quantity must be above zero.`, { line });
    if (!/^[0-9]{4,8}$/.test(l.hsnCode)) error('hsn', `${n}: HSN code must be 4 to 8 digits.`, { line });
  });
  if (items.length > 0 && items.every((l) => l.qty > 0) && total <= 0) error('total', 'The total is zero. Check the rates.');
  if (customer?.gstin) {
    if (!isValidGstin(customer.gstin)) error('customer', `Customer GSTIN ${customer.gstin} is not valid (format or check character). Correct it in Customers.`);
    else if (customer.gstin.slice(0, 2) !== customer.stateCode) error('customer', `Customer GSTIN starts with state ${customer.gstin.slice(0, 2)} but the place of supply is ${customer.stateCode}. Correct it in Customers.`);
  }

  // --- Warnings
  items.forEach((l, line) => {
    const n = `Item ${line + 1}`;
    if (l.catalogRate && l.rate < l.catalogRate) warn('rate', `${n}: rate is below the catalogue price.`, { line });
    if (l.discountPct > 20) warn('discount', `${n}: discount is ${l.discountPct}%.`, { line });
    if (l.gstRate === 0 && l.description.trim()) warn('gst', `${n}: GST is 0%. Parts are normally taxed.`, { line });
  });
  if (kind === 'invoice') {
    if (dues && dues.overdue > 0) warn('dues', `This customer has ${dues.overdue} overdue invoice${dues.overdue > 1 ? 's' : ''}.`);
    if (items.length > 0 && issuedToday.some((i) => Math.abs(i.total - total) < 0.005 && i.items === items.length)) {
      warn('duplicate', 'An invoice with the same total and item count was already issued to this customer today.');
    }
    if (PLACEHOLDER.gstins.includes(company.gstin) || company.accountNumber === PLACEHOLDER.account) {
      warn('company', 'The company profile still has the sample details. Set the real ones in Settings.');
    }
  }
  return issues;
}

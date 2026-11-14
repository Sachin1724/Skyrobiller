// A4 HTML for invoices and quotations, rendered to PDF by Electron's printToPDF.
// One shared body and thirteen looks (CSS only), one per layout in Invoify's template gallery (references/invoify),
// plus its accent presets and density setting.
// Type-only static imports here: scripts/gst.check.ts loads this file directly under Node.
import type { InvoiceLine, InvoiceTotals } from './gst';
import type { Customer, Invoice, CreditNote, DebitNote } from './db';
import type { Company } from '../store/useSystemStore';

export const TEMPLATES = {
  minimal: 'Minimal',
  classic: 'Classic',
  modern: 'Modern',
  bordered: 'Bordered',
  boldheader: 'Bold Header',
  corner: 'Corner',
  statement: 'Statement',
  twotone: 'Two-Tone',
  letterhead: 'Letterhead',
  leftrail: 'Left Rail',
  sidebar: 'Sidebar',
  column: 'Column',
  compact: 'Compact',
} as const;
export type TemplateId = keyof typeof TEMPLATES;

export const ACCENT_PRESETS = {
  Blue: '#2a54e0', Indigo: '#4f46e5', Slate: '#334155', Teal: '#0f766e', Forest: '#15803d', Plum: '#7e22ce', Rust: '#c2410c', Crimson: '#be123c', Ink: '#111827',
} as const;

export const DENSITIES = { compact: 'Compact', comfortable: 'Comfortable', spacious: 'Spacious' } as const;
export type Density = keyof typeof DENSITIES;

export const COPY_LABELS = ['Original for Recipient', 'Duplicate for Transporter', 'Triplicate for Supplier'];

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
  'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const upTo99 = (n: number) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? ' ' + ONES[n % 10] : ''}`);
const upTo999 = (n: number) =>
  [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', upTo99(n % 100)].filter(Boolean).join(' ');

// Indian numbering: crore, lakh, thousand. Whole rupees only (invoice totals are rounded to the rupee).
export function rupeesInWords(amount: number): string {
  let n = Math.round(amount);
  if (n === 0) return 'Zero Rupees Only';
  const parts: string[] = [];
  for (const [size, name] of [[1e7, 'Crore'], [1e5, 'Lakh'], [1e3, 'Thousand']] as const) {
    const q = Math.floor(n / size);
    if (q) parts.push(`${q > 999 ? rupeesInWords(q).replace(' Rupees Only', '') : upTo999(q)} ${name}`);
    n %= size;
  }
  if (n) parts.push(upTo999(n));
  return `${parts.join(' ')} Rupees Only`;
}

const esc = (v: unknown) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const inr = (n: number) => new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
const date = (iso: string) =>
  iso ? new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)) : '';

export interface PrintableDocument {
  title: 'Tax Invoice' | 'Quotation' | 'Credit Note' | 'Debit Note';
  number: string;
  date: string;
  secondDateLabel: 'Due Date' | 'Valid Until';
  secondDate: string;
  reference?: string; // e.g. the invoice a credit note is issued against
  cancelled?: boolean;
  company: Company;
  customer: Customer;
  items: InvoiceLine[];
  totals: InvoiceTotals;
  notes: string;
}

// How the document looks; comes from the current Settings, not from the invoice snapshot
export interface Look {
  template: TemplateId;
  accent: string; // #rrggbb
  density: Density;
  logo: string; // data URL, or ''
  signature: string; // data URL printed above "Authorised Signatory", or ''
  copies: string[]; // one full copy of the document per label; [''] prints a single unmarked copy
  qrSvg?: string; // UPI payment QR
}

// Tax per HSN code and rate, as GST invoices customarily show. Line tax = line total - line taxable.
function hsnSummary(items: InvoiceLine[], t: InvoiceTotals): string {
  const groups = new Map<string, { hsn: string; rate: number; taxable: number; tax: number }>();
  items.forEach((l, i) => {
    const key = `${l.hsnCode}|${l.gstRate}`;
    const g = groups.get(key) ?? { hsn: l.hsnCode, rate: l.gstRate, taxable: 0, tax: 0 };
    g.taxable += t.lineTaxable[i];
    g.tax += t.lineTotals[i] - t.lineTaxable[i];
    groups.set(key, g);
  });
  const taxCells = (tax: number) =>
    t.intraState ? `<td>${inr(tax / 2)}</td><td>${inr(tax / 2)}</td>` : `<td>${inr(tax)}</td>`;
  return `
    <table class="hsn">
      <thead><tr><th>HSN/SAC</th><th>Rate</th><th>Taxable</th>${t.intraState ? '<th>CGST</th><th>SGST</th>' : '<th>IGST</th>'}</tr></thead>
      <tbody>${[...groups.values()].map((g) =>
        `<tr><td>${esc(g.hsn)}</td><td>${g.rate}%</td><td>${inr(g.taxable)}</td>${taxCells(g.tax)}</tr>`).join('')}</tbody>
    </table>`;
}

const CSS = `
  * { box-sizing: border-box; margin: 0; }
  body { font: 10.5px/1.5 "Segoe UI", system-ui, sans-serif; color: #1d1d1f; font-variant-numeric: tabular-nums; --accent: #0071e3; }
  .copy { padding: 24px 28px; }
  .copy + .copy { break-before: page; }
  small, .muted { color: #6e6e73; }
  .eyebrow { font-size: 9px; font-weight: 600; letter-spacing: .18em; text-transform: uppercase; color: #6e6e73; margin-bottom: 4px; }
  header { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-bottom: 24px; }
  .brand { display: flex; gap: 12px; align-items: flex-start; min-width: 0; }
  .brand img { max-height: 56px; max-width: 140px; object-fit: contain; flex: none; }
  .co { font-size: 15px; font-weight: 600; letter-spacing: -.01em; }
  .doc { text-align: right; white-space: nowrap; }
  .number { font-size: 22px; font-weight: 300; letter-spacing: -.02em; line-height: 1.15; }
  .copy-label { font-size: 9px; color: #6e6e73; margin-top: 2px; }
  .cancelled { color: #d70015; font-weight: 600; letter-spacing: .1em; }
  .parties { display: grid; grid-template-columns: 1.4fr 1fr; gap: 24px; }
  table { width: 100%; border-collapse: collapse; }
  .items { margin-top: 22px; }
  .items th { font-size: 9px; font-weight: 600; text-transform: uppercase; letter-spacing: .06em; color: #6e6e73; text-align: left; padding: 6px; border-bottom: 1px solid #1d1d1f; }
  .items td { padding: 7px 6px; border-bottom: 1px solid #e5e5ea; vertical-align: top; }
  .items tr { break-inside: avoid; }
  .n, .items th.n { text-align: right; white-space: nowrap; }
  .summary { display: flex; justify-content: space-between; align-items: flex-start; gap: 24px; margin-top: 16px; break-inside: avoid; }
  .hsn { width: 54%; font-size: 9.5px; }
  .hsn th, .hsn td { padding: 3px 6px; border-bottom: 1px solid #e5e5ea; text-align: right; font-weight: 400; }
  .hsn th { color: #6e6e73; }
  .hsn th:first-child, .hsn td:first-child { text-align: left; }
  .totals { width: 40%; }
  .totals td { padding: 3px 6px; }
  .totals .grand td { font-size: 14px; font-weight: 600; color: var(--accent); border-top: 1px solid #1d1d1f; padding-top: 8px; }
  .words { margin-top: 8px; text-align: right; }
  footer { display: grid; grid-template-columns: 1.3fr 1.3fr 1fr; gap: 24px; margin-top: 26px; padding-top: 14px; border-top: 1px solid #e5e5ea; break-inside: avoid; }
  .pay { display: flex; gap: 10px; align-items: flex-start; }
  .pay svg { width: 72px; height: 72px; flex: none; }
  .sign { text-align: right; }
  .sign .line { margin-top: 44px; }
  pre { font: inherit; white-space: pre-wrap; }

  .due, .due-by, .strip { display: none; }
  .strip { grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 20px; padding: 10px 14px; }
  .strip b { display: block; font-size: 13px; }
  .sign img { display: block; margin: 6px 0 0 auto; max-height: 44px; max-width: 150px; object-fit: contain; }
  .sign img + .line { margin-top: 4px; }
  .d-compact .copy { zoom: .9; }
  .d-spacious .copy { zoom: 1.1; }

  /* Classic: logo and sender left, a large title right */
  .classic .doc .eyebrow { font-size: 24px; font-weight: 700; letter-spacing: -.01em; text-transform: none; color: var(--accent); margin-bottom: 0; }
  .classic .number { font-size: 13px; font-weight: 600; letter-spacing: 0; }
  .classic .items th { color: var(--accent); border-bottom-color: var(--accent); }

  /* Modern: stacked header, sender above a wide rule */
  .modern header { flex-direction: column; gap: 10px; border-bottom: 3px solid var(--accent); padding-bottom: 14px; }
  .modern .doc { text-align: left; display: flex; gap: 12px; align-items: baseline; }
  .modern .number { font-size: 18px; font-weight: 600; }
  .modern .eyebrow { color: var(--accent); }

  /* Bordered: every block boxed with black rules, the way government invoice forms look */
  .bordered header, .bordered .parties, .bordered .summary, .bordered .words, .bordered footer { border: 1px solid #1d1d1f; margin: 0; padding: 10px 12px; }
  .bordered .parties, .bordered .summary, .bordered .words, .bordered footer { border-top: 0; }
  .bordered .parties { gap: 0; padding: 0; }
  .bordered .parties > div { padding: 8px 12px; }
  .bordered .parties > div + div { border-left: 1px solid #1d1d1f; }
  .bordered .items { margin: 0; }
  .bordered .items th, .bordered .items td { border: 1px solid #1d1d1f; }
  .bordered .items th { background: #f0f0f2; color: #1d1d1f; border-top: 0; }
  .bordered .number { font-size: 16px; font-weight: 600; letter-spacing: 0; }
  .bordered .doc .eyebrow { font-size: 11px; color: #1d1d1f; }
  .bordered .totals .grand td { color: #1d1d1f; }
  .bordered .words { text-align: left; color: #1d1d1f; font-weight: 600; }
  .bordered .hsn th, .bordered .hsn td { border: 1px solid #1d1d1f; }

  /* Bold Header: accent band carrying the title and the total */
  .boldheader header { background: var(--accent); color: #fff; padding: 18px 20px; border-radius: 10px; align-items: center; }
  .boldheader header .eyebrow, .boldheader header .muted, .boldheader header .copy-label { color: rgba(255, 255, 255, .82); }
  .boldheader header .cancelled { color: #fff; }
  .boldheader .brand img { background: #fff; border-radius: 6px; padding: 4px; }
  .boldheader .number { font-size: 14px; font-weight: 600; }
  .boldheader .due { display: block; font-size: 22px; font-weight: 700; letter-spacing: -.01em; }
  .boldheader .eyebrow { color: var(--accent); }
  .boldheader .items th { background: #f5f5f7; border-bottom: 0; color: #1d1d1f; }
  .boldheader .items tbody tr:nth-child(even) td { background: #fafafc; }
  .boldheader .totals .grand td { background: var(--accent); color: #fff; border-top: 0; padding: 8px 10px; }

  /* Corner: an accent block top-right holds the amount and the due date, like a stamp */
  .corner .doc { background: var(--accent); color: #fff; padding: 16px 18px; border-radius: 0 0 0 14px; margin: -24px -28px 0 0; }
  .corner .doc .eyebrow, .corner .doc .copy-label, .corner .doc .due-by { color: rgba(255, 255, 255, .82); }
  .corner .doc .cancelled { color: #fff; }
  .corner .number { font-size: 13px; font-weight: 600; }
  .corner .due { display: block; font-size: 22px; font-weight: 700; margin-top: 6px; }
  .corner .due-by { display: block; font-size: 9px; }

  /* Statement: a strip of key figures first, detail beneath */
  .statement .strip { display: grid; background: #f5f5f7; border-radius: 8px; }
  .statement .strip b { color: var(--accent); }
  .statement .number { font-size: 15px; font-weight: 600; }

  /* Two-Tone: a soft tint of the accent behind header and summary */
  .twotone header, .twotone .summary { background: color-mix(in srgb, var(--accent) 10%, #fff); padding: 16px 18px; border-radius: 10px; }
  .twotone .eyebrow { color: var(--accent); }

  /* Letterhead: centred masthead between double rules */
  .letterhead header { flex-direction: column; align-items: center; text-align: center; gap: 8px; border-top: 3px double #1d1d1f; border-bottom: 3px double #1d1d1f; padding: 14px 0; }
  .letterhead .brand { flex-direction: column; align-items: center; }
  .letterhead .doc { text-align: center; }
  .letterhead .number { font-size: 15px; font-weight: 600; }

  /* Left Rail: one accent stripe down the left edge, the only colour on the page */
  .leftrail .copy { border-left: 5px solid var(--accent); }
  .leftrail .eyebrow { color: var(--accent); }
  .leftrail .totals .grand td { color: #1d1d1f; }

  /* Sidebar: an accent rail carries the sender and document details; the main column holds the rest */
  .sidebar .copy { display: grid; grid-template-columns: 172px 1fr; column-gap: 22px; padding: 0 28px 0 0; }
  .sidebar header { grid-column: 1; grid-row: 1 / span 6; flex-direction: column; background: var(--accent); color: #fff; padding: 24px 16px; margin: 0; }
  .sidebar header .muted, .sidebar header .eyebrow, .sidebar header .copy-label { color: rgba(255, 255, 255, .82); }
  .sidebar header .cancelled { color: #fff; }
  .sidebar .brand { flex-direction: column; }
  .sidebar .brand img { background: #fff; border-radius: 6px; padding: 4px; }
  .sidebar .doc { text-align: left; white-space: normal; }
  .sidebar .number { font-size: 15px; font-weight: 600; }
  .sidebar .parties, .sidebar .items, .sidebar .summary, .sidebar .words, .sidebar footer { grid-column: 2; }
  .sidebar .parties { margin-top: 24px; }
  .sidebar footer { margin-bottom: 24px; }

  /* Column: a narrow column of metadata runs beside the items, hairlines only */
  .column .copy { display: grid; grid-template-columns: 150px 1fr; column-gap: 22px; }
  .column header { grid-column: 1 / -1; border-bottom: 1px solid #1d1d1f; padding-bottom: 14px; }
  .column .parties { grid-column: 1; grid-row: 2 / span 5; display: block; border-right: 1px solid #e5e5ea; padding-right: 14px; }
  .column .parties > div + div { margin-top: 16px; }
  .column .items, .column .summary, .column .words, .column footer { grid-column: 2; }
  .column .items { margin-top: 0; }
  .column .number { font-size: 16px; font-weight: 600; }

  /* Compact: receipt-tight; dates run as one strip under the header */
  .compact .copy { padding: 14px 18px; line-height: 1.35; }
  .compact header { margin-bottom: 10px; }
  .compact .number { font-size: 15px; font-weight: 600; }
  .compact .strip { display: grid; padding: 6px 0; margin-bottom: 10px; border-top: 1px solid #1d1d1f; border-bottom: 1px solid #1d1d1f; }
  .compact .strip b { font-size: 11px; }
  .compact .parties { grid-template-columns: 1fr; }
  .compact .parties > div + div { display: none; }
  .compact .items { margin-top: 10px; }
  .compact .items td { padding: 3px 6px; }
  .compact .summary { margin-top: 8px; }
  .compact footer { margin-top: 12px; padding-top: 8px; }
  .compact .sign .line { margin-top: 24px; }
`;

export function documentHtml(d: PrintableDocument, look: Look): string {
  const { company: co, customer: cu, totals: t } = d;

  const rows = d.items.map((l, i) => `
    <tr>
      <td>${i + 1}</td>
      <td><strong>${esc(l.description)}</strong><br><small>${esc(l.sku)}</small></td>
      <td>${esc(l.hsnCode)}</td>
      <td class="n">${l.qty} ${esc(l.unit)}</td>
      <td class="n">${inr(l.rate)}</td>
      <td class="n">${l.discountPct ? l.discountPct + '%' : ''}</td>
      <td class="n">${inr(t.lineTaxable[i])}</td>
      <td class="n">${l.gstRate}%</td>
      <td class="n">${inr(t.lineTotals[i])}</td>
    </tr>`).join('');

  const taxRows = t.intraState
    ? `<tr><td>CGST</td><td class="n">${inr(t.cgst)}</td></tr><tr><td>SGST</td><td class="n">${inr(t.sgst)}</td></tr>`
    : `<tr><td>IGST</td><td class="n">${inr(t.igst)}</td></tr>`;

  const copy = (copyLabel: string) => `
  <div class="copy">
    <header>
      <div class="brand">
        ${look.logo ? `<img src="${esc(look.logo)}" alt="">` : ''}
        <div>
          <p class="co">${esc(co.legalName)}</p>
          <p>${esc(co.address)}</p>
          <p>GSTIN ${esc(co.gstin)}</p>
          <p class="muted">${esc([co.phone, co.email].filter(Boolean).join(' · '))}</p>
        </div>
      </div>
      <div class="doc">
        <p class="eyebrow">${esc(d.title)}</p>
        <p class="number">${esc(d.number)}</p>
        <p class="due">₹ ${inr(t.total)}</p>
        ${d.secondDate ? `<p class="due-by">${d.secondDateLabel} ${date(d.secondDate)}</p>` : ''}
        ${copyLabel ? `<p class="copy-label">${esc(copyLabel)}</p>` : ''}
        ${d.cancelled ? '<p class="cancelled">CANCELLED</p>' : ''}
      </div>
    </header>

    <div class="strip">
      <div><span class="muted">Number</span><b>${esc(d.number)}</b></div>
      <div><span class="muted">Date</span><b>${date(d.date)}</b></div>
      <div><span class="muted">${d.secondDateLabel}</span><b>${date(d.secondDate) || '-'}</b></div>
      <div><span class="muted">Total</span><b>₹ ${inr(t.total)}</b></div>
    </div>

    <section class="parties">
      <div>
        <p class="eyebrow">Bill To</p>
        <strong>${esc(cu.businessName)}</strong><br>
        ${esc(cu.billingAddress)} - ${esc(cu.pincode)}<br>
        ${cu.gstin ? `GSTIN ${esc(cu.gstin)}` : 'Unregistered'}<br>
        Place of Supply: ${esc(cu.stateName)} (${esc(cu.stateCode)})<br>
        <span class="muted">${esc([cu.contactPerson, cu.phone].filter(Boolean).join(' · '))}</span>
      </div>
      <div>
        <p class="eyebrow">Details</p>
        Date: ${date(d.date)}<br>
        ${d.secondDate ? `${d.secondDateLabel}: ${date(d.secondDate)}<br>` : ''}
        ${d.reference ? esc(d.reference) : ''}
      </div>
    </section>

    <table class="items">
      <thead><tr>
        <th>#</th><th>Item</th><th>HSN/SAC</th><th class="n">Qty</th><th class="n">Rate</th><th class="n">Disc</th>
        <th class="n">Taxable</th><th class="n">GST</th><th class="n">Amount</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>

    <div class="summary">
      ${hsnSummary(d.items, t)}
      <table class="totals">
        <tr><td>Taxable Value</td><td class="n">${inr(t.taxable)}</td></tr>
        ${taxRows}
        ${t.roundOff ? `<tr><td>Round-off</td><td class="n">${inr(t.roundOff)}</td></tr>` : ''}
        <tr class="grand"><td>Total</td><td class="n">₹ ${inr(t.total)}</td></tr>
      </table>
    </div>
    <p class="words muted">${rupeesInWords(t.total)}</p>

    <footer>
      <div>
        <p class="eyebrow">Notes &amp; Terms</p>
        <pre>${esc([d.notes, co.terms].filter(Boolean).join('\n'))}</pre>
      </div>
      <div>
        <p class="eyebrow">Payment</p>
        <div class="pay">
          ${look.qrSvg ?? ''}
          <div>
            ${esc(co.bankName)}<br>
            A/C ${esc(co.accountNumber)}<br>
            IFSC ${esc(co.ifscCode)}<br>
            ${co.upiId ? `UPI ${esc(co.upiId)}` : ''}
          </div>
        </div>
      </div>
      <div class="sign">
        <p>For ${esc(co.legalName)}</p>
        ${look.signature ? `<img src="${esc(look.signature)}" alt="">` : ''}
        <p class="line muted">Authorised Signatory</p>
      </div>
    </footer>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><title>${esc(d.number)}</title><style>${CSS}</style></head>
<body class="${look.template} d-${look.density}" style="--accent: ${/^#[0-9a-f]{6}$/i.test(look.accent) ? look.accent : '#2a54e0'}">${(look.copies.length ? look.copies : ['']).map(copy).join('')}</body></html>`;
}

export const invoiceDocument = (inv: Invoice): PrintableDocument => ({
  title: 'Tax Invoice',
  number: inv.invoiceNumber,
  date: inv.issueDate,
  secondDateLabel: 'Due Date',
  secondDate: inv.dueDate,
  cancelled: inv.status === 'cancelled',
  company: inv.company,
  customer: inv.customer,
  items: inv.items,
  totals: inv.totals,
  notes: inv.notes,
});

// Scan-to-pay QR carrying the payee, the amount and the invoice number
export async function upiQrSvg(company: Company, amount: number, note: string): Promise<string> {
  const QRCode = await import('qrcode');
  const uri = `upi://pay?${new URLSearchParams({ pa: company.upiId, pn: company.legalName, am: amount.toFixed(2), cu: 'INR', tn: note })}`;
  return QRCode.toString(uri, { type: 'svg', margin: 0, errorCorrectionLevel: 'M' });
}

export const creditNoteDocument = (cn: CreditNote): PrintableDocument => ({
  title: 'Credit Note',
  number: cn.creditNumber,
  date: cn.issueDate,
  secondDateLabel: 'Due Date',
  secondDate: '',
  reference: `Against invoice ${cn.invoiceNumber} dated ${date(cn.invoiceDate)}`,
  company: cn.company,
  customer: cn.customer,
  items: cn.items,
  totals: cn.totals,
  notes: `Reason: ${cn.reason}`,
});

export const debitNoteDocument = (dn: DebitNote): PrintableDocument => ({
  title: 'Debit Note',
  number: dn.debitNumber,
  date: dn.issueDate,
  secondDateLabel: 'Due Date',
  secondDate: '',
  reference: `Against invoice ${dn.invoiceNumber} dated ${date(dn.invoiceDate)}`,
  company: dn.company,
  customer: dn.customer,
  items: dn.items,
  totals: dn.totals,
  notes: `Reason: ${dn.reason}`,
});

// `settings` is the current company profile: it decides template, colours, logo, signature, copies and the UPI id for the QR.
export async function buildLook(d: PrintableDocument, settings: Company): Promise<Look> {
  const isInvoice = d.title === 'Tax Invoice';
  return {
    template: settings.template,
    accent: settings.accent,
    density: settings.density,
    logo: settings.logo,
    signature: settings.signature,
    copies: isInvoice ? settings.copies : [],
    qrSvg: isInvoice && !d.cancelled && settings.upiId ? await upiQrSvg(settings, d.totals.total, d.number) : undefined,
  };
}

export async function printDocument(d: PrintableDocument, settings: Company): Promise<void> {
  const res = await window.electronAPI.printHtml({ htmlContent: documentHtml(d, await buildLook(d, settings)) });
  if (!res.success) throw new Error(res.error);
}

export async function savePdf(d: PrintableDocument, settings: Company): Promise<void> {
  const res = await window.electronAPI.generatePdf({ htmlContent: documentHtml(d, await buildLook(d, settings)), title: d.number });
  if (!res.success && res.error !== 'Cancelled by user') throw new Error(res.error);
}

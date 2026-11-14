import React, { useEffect, useState } from 'react';
import { friendlyError } from '../../lib/friendlyError';
import { Download, FileSpreadsheet, FileJson, Info, AlertTriangle } from 'lucide-react';
import { computeInvoice } from '../../lib/gst';
import { listInvoices, listCreditNotes, listDebitNotes, financialYearOf, outstandingOf, paymentStatusOf, type Invoice, type CreditNote, type DebitNote } from '../../lib/db';
import { buildGstr1, isB2cl } from '../../lib/gstr1';
import { downloadCsv } from '../../lib/csv';
import { todayISO } from '../../lib/utils';
import { useMenuAction } from '../../store/useNavStore';
import { useSystemStore } from '../../store/useSystemStore';
import { AuditLog } from './AuditLog';

type Cell = string | number;
interface Report { columns: string[]; rows: Cell[][] }

const round2 = (n: number) => Math.round(n * 100) / 100;

// Groups items by a key and sums numeric columns. First column is the key.
function groupSum<T>(items: T[], key: (item: T) => string, values: (item: T) => number[]): Cell[][] {
  const groups = new Map<string, number[]>();
  for (const item of items) {
    const v = values(item);
    const acc = groups.get(key(item));
    if (acc) v.forEach((n, i) => { acc[i] += n; });
    else groups.set(key(item), [...v]);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => [k, ...v.map(round2)]);
}

// Days past the due date, bucketed the usual receivables way
const AGE_BUCKETS = ['Not Due', '1-30 Days', '31-60 Days', '61-90 Days', 'Over 90 Days'];
function ageBucket(dueDate: string, today: string): number {
  const days = Math.floor((Date.parse(today) - Date.parse(dueDate)) / 86_400_000);
  return days <= 0 ? 0 : days <= 30 ? 1 : days <= 60 ? 2 : days <= 90 ? 3 : 4;
}

// 2026-11-14 -> 14-Nov-2026, the date format of the GST offline tool
const gstDate = (iso: string) =>
  new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(iso)).replace(/ /g, '-');
const placeOfSupply = (i: Invoice) => `${i.customer.stateCode}-${i.customer.stateName}`;
const taxOf = (i: Invoice) => i.totals.cgst + i.totals.sgst + i.totals.igst;

// Every invoice line with its own tax, by re-running the GST engine on that line alone
const taxedLines = (invoices: Invoice[]) =>
  invoices.flatMap((inv) => inv.items.map((line) => ({ inv, line, t: computeInvoice([line], 'a', inv.totals.intraState ? 'a' : 'b') })));

// `sheet` is the tab name in the Excel workbook: at most 31 characters, and the GST ones match the GSTR-1 offline tool
const REPORTS: Record<string, { label: string; sheet: string; group: string; build: (invoices: Invoice[], credits: CreditNote[], debits: DebitNote[]) => Report }> = {
  register: {
    label: 'Invoice Register',
    sheet: 'Invoice Register',
    group: 'Bills',
    build: (inv) => ({
      columns: ['Invoice No.', 'Date', 'Customer', 'GSTIN', 'Place of Supply', 'Taxable', 'CGST', 'SGST', 'IGST', 'Total', 'Received', 'Credited', 'Outstanding', 'Status'],
      rows: [...inv].reverse().map((i) => [
        i.invoiceNumber, gstDate(i.issueDate), i.customer.businessName, i.customer.gstin || 'Unregistered', placeOfSupply(i),
        i.totals.taxable, i.totals.cgst, i.totals.sgst, i.totals.igst, i.total, i.paid, i.credited, outstandingOf(i), paymentStatusOf(i).label,
      ]),
    }),
  },
  sales: {
    label: 'Monthly Summary',
    sheet: 'Monthly Summary',
    group: 'Bills',
    build: (inv) => ({
      columns: ['Month', 'Invoices', 'Taxable', 'Tax', 'Total', 'Received', 'Outstanding'],
      rows: groupSum(inv, (i) => i.issueDate.slice(0, 7), (i) => [1, i.totals.taxable, taxOf(i), i.total, i.paid, outstandingOf(i)]),
    }),
  },
  customers: {
    label: 'Customers',
    sheet: 'Customers',
    group: 'Bills',
    build: (inv) => ({
      columns: ['Customer', 'Invoices', 'Total', 'Outstanding'],
      rows: groupSum(inv, (i) => i.customer.businessName, (i) => [1, i.total, outstandingOf(i)]),
    }),
  },
  products: {
    label: 'Products',
    sheet: 'Products',
    group: 'Bills',
    build: (inv) => ({
      columns: ['Product', 'Quantity', 'Taxable'],
      rows: groupSum(taxedLines(inv), (x) => `${x.line.sku} · ${x.line.description}`, (x) => [x.line.qty, x.t.taxable]),
    }),
  },
  outstanding: {
    label: 'Outstanding',
    sheet: 'Outstanding',
    group: 'Payments',
    build: (inv) => ({
      columns: ['Invoice No.', 'Customer', 'Due Date', 'Total', 'Outstanding'],
      rows: inv.filter((i) => outstandingOf(i) >= 0.01).map((i) => [i.invoiceNumber, i.customer.businessName, gstDate(i.dueDate), i.total, outstandingOf(i)]),
    }),
  },
  aging: {
    label: 'Aging',
    sheet: 'Aging',
    group: 'Payments',
    build: (inv) => {
      const today = todayISO();
      return {
        columns: ['Customer', ...AGE_BUCKETS, 'Total Outstanding'],
        rows: groupSum(inv.filter((i) => outstandingOf(i) >= 0.01), (i) => i.customer.businessName, (i) => {
          const buckets = AGE_BUCKETS.map(() => 0);
          buckets[ageBucket(i.dueDate, today)] = outstandingOf(i);
          return [...buckets, outstandingOf(i)];
        }),
      };
    },
  },
  // Column layouts below follow the GSTR-1 offline tool sheets (b2b, b2cs, hsn, cdnr)
  b2b: {
    label: 'GSTR-1 B2B (Registered Customers)',
    sheet: 'b2b',
    group: 'GST Filing',
    build: (inv) => {
      const lines = taxedLines(inv.filter((i) => i.customer.gstin));
      const perInvoiceRate = new Map<string, { inv: Invoice; rate: number; taxable: number }>();
      for (const x of lines) {
        const key = `${x.inv.id}|${x.line.gstRate}`;
        const g = perInvoiceRate.get(key) ?? { inv: x.inv, rate: x.line.gstRate, taxable: 0 };
        g.taxable += x.t.taxable;
        perInvoiceRate.set(key, g);
      }
      return {
        columns: ['GSTIN/UIN of Recipient', 'Receiver Name', 'Invoice Number', 'Invoice Date', 'Invoice Value', 'Place Of Supply', 'Reverse Charge', 'Invoice Type', 'Rate', 'Taxable Value', 'Cess Amount'],
        rows: [...perInvoiceRate.values()].reverse().map((g) => [
          g.inv.customer.gstin, g.inv.customer.businessName, g.inv.invoiceNumber, gstDate(g.inv.issueDate), g.inv.total, placeOfSupply(g.inv), 'N', 'Regular B2B', g.rate, round2(g.taxable), 0,
        ]),
      };
    },
  },
  b2cl: {
    label: 'GSTR-1 B2C Large (Unregistered, Other State, Above ₹1 Lakh)',
    sheet: 'b2cl',
    group: 'GST Filing',
    build: (inv) => {
      const lines = taxedLines(inv.filter((i) => isB2cl(i, i.total)));
      const perInvoiceRate = new Map<string, { inv: Invoice; rate: number; taxable: number }>();
      for (const x of lines) {
        const key = `${x.inv.id}|${x.line.gstRate}`;
        const g = perInvoiceRate.get(key) ?? { inv: x.inv, rate: x.line.gstRate, taxable: 0 };
        g.taxable += x.t.taxable;
        perInvoiceRate.set(key, g);
      }
      return {
        columns: ['Invoice Number', 'Invoice Date', 'Invoice Value', 'Place Of Supply', 'Rate', 'Taxable Value', 'Cess Amount'],
        rows: [...perInvoiceRate.values()].reverse().map((g) => [g.inv.invoiceNumber, gstDate(g.inv.issueDate), g.inv.total, placeOfSupply(g.inv), g.rate, round2(g.taxable), 0]),
      };
    },
  },
  b2c: {
    label: 'GSTR-1 B2C Small (Other Unregistered Sales)',
    sheet: 'b2cs',
    group: 'GST Filing',
    build: (inv) => ({
      columns: ['Type', 'Place Of Supply', 'Rate', 'Taxable Value', 'Cess Amount'],
      rows: groupSum(taxedLines(inv.filter((i) => !i.customer.gstin && !isB2cl(i, i.total))), (x) => `${placeOfSupply(x.inv)}|${String(x.line.gstRate).padStart(2, '0')}`, (x) => [x.t.taxable])
        .map(([key, taxable]) => { const [pos, rate] = String(key).split('|'); return ['OE', pos, Number(rate), taxable, 0]; }),
    }),
  },
  hsn: {
    label: 'GSTR-1 HSN Summary',
    sheet: 'hsn',
    group: 'GST Filing',
    build: (inv) => ({
      columns: ['HSN', 'UQC', 'Rate', 'Total Quantity', 'Total Value', 'Taxable Value', 'Integrated Tax', 'Central Tax', 'State/UT Tax'],
      rows: groupSum(taxedLines(inv), (x) => `${x.line.hsnCode}|${x.line.unit}|${String(x.line.gstRate).padStart(2, '0')}`,
        (x) => [x.line.qty, x.t.taxable + x.t.cgst + x.t.sgst + x.t.igst, x.t.taxable, x.t.igst, x.t.cgst, x.t.sgst])
        .map(([key, ...sums]) => { const [hsn, unit, rate] = String(key).split('|'); return [hsn, unit, Number(rate), ...sums]; }),
    }),
  },
  gst: {
    label: 'Tax by Rate',
    sheet: 'Tax by Rate',
    group: 'GST Filing',
    build: (inv) => ({
      columns: ['GST Rate %', 'Taxable', 'CGST', 'SGST', 'IGST'],
      rows: groupSum(taxedLines(inv), (x) => String(x.line.gstRate).padStart(2, '0'), (x) => [x.t.taxable, x.t.cgst, x.t.sgst, x.t.igst]),
    }),
  },
  credits: {
    label: 'Credit and Debit Notes (GSTR-1 CDNR)',
    sheet: 'cdnr',
    group: 'GST Filing',
    build: (_inv, credits, debits) => ({
      columns: ['GSTIN/UIN of Recipient', 'Receiver Name', 'Note Number', 'Note Date', 'Note Type', 'Against Invoice', 'Place Of Supply', 'Note Value', 'Taxable Value', 'Tax'],
      rows: [
        ...credits.map((c) => ({ n: c, number: c.creditNumber, type: 'C' })),
        ...debits.map((d) => ({ n: d, number: d.debitNumber, type: 'D' })),
      ].sort((a, b) => b.n.issueDate.localeCompare(a.n.issueDate) || b.number.localeCompare(a.number)).map(({ n, number, type }) => [
        n.customer.gstin || 'Unregistered', n.customer.businessName, number, gstDate(n.issueDate), type, n.invoiceNumber,
        `${n.customer.stateCode}-${n.customer.stateName}`, n.total, n.totals.taxable, round2(n.totals.cgst + n.totals.sgst + n.totals.igst),
      ]),
    }),
  },
};

const GROUPS = [...new Set(Object.values(REPORTS).map((r) => r.group))];
const number = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });
const monthBounds = (month: string) => {
  const [y, m] = month.split('-').map(Number);
  return { from: `${month}-01`, to: `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}` };
};

// Totals for every numeric column except rates, and except Invoice Value (repeated on each rate row of one invoice)
const totalsOf = (report: Report) => report.columns.map((c, i) =>
  typeof report.rows[0]?.[i] === 'number' && !/rate|invoice value/i.test(c) ? round2(report.rows.reduce((sum, r) => sum + (r[i] as number), 0)) : null);

// One .xlsx file with every report as its own tab: bold frozen header, real numbers, bold totals row
async function downloadWorkbook(fileName: string, invoices: Invoice[], credits: CreditNote[], debits: DebitNote[]) {
  const { default: writeExcelFile } = await import('write-excel-file/browser');
  const bold = (value: Cell | null) => (value === null || value === '' ? null : { value, fontWeight: 'bold' as const });
  await writeExcelFile(Object.values(REPORTS).map((r) => {
    const report = r.build(invoices, credits, debits);
    const totals = totalsOf(report);
    const data = [
      report.columns.map(bold),
      ...report.rows,
      ...(report.rows.length ? [totals.map((t, i) => bold(t ?? (i === 0 ? 'Total' : null)))] : []),
    ];
    // Width from the longest value in each column, within sensible bounds
    const columns = report.columns.map((c, i) => ({ width: Math.min(40, Math.max(10, c.length, ...report.rows.map((row) => String(row[i]).length)) + 2) }));
    return { data, sheet: r.sheet, columns, stickyRowsCount: 1 };
  })).toFile(fileName);
}

type StatusFilter = 'all' | 'paid' | 'unpaid';
type Period = 'month' | 'lastMonth' | 'quarter' | 'fy' | 'custom';
const PERIODS: [Period, string][] = [['month', 'This month'], ['lastMonth', 'Last month'], ['quarter', 'This quarter'], ['fy', 'This financial year'], ['custom', 'Custom range']];

// Date range for each preset, as YYYY-MM-DD. Quarters are the Indian financial ones: Apr-Jun, Jul-Sep, Oct-Dec, Jan-Mar.
function rangeFor(period: Exclude<Period, 'custom'>, today: string): { from: string; to: string } {
  const [y, m] = today.split('-').map(Number);
  const monthStart = (yy: number, mm: number) => `${yy}-${String(mm).padStart(2, '0')}-01`;
  if (period === 'month') return { from: monthStart(y, m), to: today };
  if (period === 'lastMonth') return monthBounds(`${m === 1 ? y - 1 : y}-${String(m === 1 ? 12 : m - 1).padStart(2, '0')}`);
  if (period === 'quarter') {
    const startMonth = m >= 4 && m <= 6 ? 4 : m >= 7 && m <= 9 ? 7 : m >= 10 ? 10 : 1;
    return { from: monthStart(y, startMonth), to: today };
  }
  return { from: `${financialYearOf(today).slice(0, 4)}-04-01`, to: today };
}

const toDisplay = (iso: string) => iso.split('-').reverse().join('-'); // 2026-11-01 -> 01-11-2026
const fromDisplay = (text: string) => {
  const m = text.trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
  if (!m) return null;
  const iso = `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  const d = new Date(`${iso}T00:00:00`);
  return Number.isNaN(d.getTime()) || d.getDate() !== Number(m[1]) ? null : iso;
};

// dd-mm-yyyy text box: the browser's date input follows the system's US layout, which does not match the tables
const DateText: React.FC<{ label: string; value: string; onChange: (iso: string) => void }> = ({ label, value, onChange }) => {
  const [text, setText] = useState(toDisplay(value));
  const [bad, setBad] = useState(false);
  React.useEffect(() => { setText(toDisplay(value)); setBad(false); }, [value]);
  return (
    <label className="label">{label}
      <input
        value={text}
        placeholder="dd-mm-yyyy"
        inputMode="numeric"
        aria-invalid={bad || undefined}
        onChange={(e) => { setText(e.target.value); const iso = fromDisplay(e.target.value); setBad(!iso && e.target.value !== ''); if (iso) onChange(iso); }}
        className="field w-32 tabular-nums"
      />
    </label>
  );
};

export const ReportsView: React.FC = () => {
  const company = useSystemStore((s) => s.company);
  const today = todayISO();
  const [period, setPeriod] = useState<Period>('month');
  const [custom, setCustom] = useState({ from: `${today.slice(0, 7)}-01`, to: today });
  const { from, to } = period === 'custom' ? custom : rangeFor(period, today);
  const [kind, setKind] = useState('register');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]); // cancelled ones too: GSTR-1 counts them in the document summary
  const [credits, setCredits] = useState<CreditNote[]>([]);
  const [debits, setDebits] = useState<DebitNote[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listInvoices({ from, to }), listCreditNotes({ from, to }), listDebitNotes({ from, to })])
      .then(([list, notes, raised]) => {
        setAllInvoices(list);
        setInvoices(list.filter((i) => i.status === 'issued')); // cancelled invoices are not sales
        setCredits(notes);
        setDebits(raised);
      })
      .catch((e) => setError(friendlyError(e)));
  }, [from, to]);

  useMenuAction({ 'export-sheet': () => exportCsv(), 'export-workbook': () => { exportWorkbook(); } });

  const shown = invoices.filter((i) => status === 'all' || (status === 'paid') === (outstandingOf(i) < 0.01));
  const isAudit = kind === 'audit'; // not a sheet: it reads its own table and is not part of the Excel workbook
  const report = REPORTS[isAudit ? 'register' : kind].build(shown, credits, debits);
  const totals = totalsOf(report);
  const isNumeric = (i: number) => typeof report.rows[0]?.[i] === 'number';

  const suffix = `${from}-to-${to}${status === 'all' ? '' : `-${status}`}`;
  const exportCsv = () => downloadCsv(`${kind}-${suffix}`, [report.columns, ...report.rows]);
  const exportWorkbook = () => downloadWorkbook(`skyro-reports-${suffix}.xlsx`, shown, credits, debits).catch((e) => setError(`Excel export failed. ${friendlyError(e)}`));

  // GSTR-1 is filed per calendar month and read by the GST offline tool as JSON
  const exportGstr1 = () => {
    if (from.slice(0, 7) !== to.slice(0, 7)) { setError('GSTR-1 is filed one month at a time. Choose This month, Last month, or a custom range inside one month.'); return; }
    const gstr1 = buildGstr1({ gstin: company.gstin, period: to.slice(0, 7), invoices: allInvoices, credits, debits });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(gstr1, null, 1)], { type: 'application/json' }));
    a.download = `GSTR1_${company.gstin}_${gstr1.fp}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    setError('');
  };

  const group = isAudit ? 'System' : REPORTS[kind].group;
  const pickGroup = (g: string) => setKind(g === 'System' ? 'audit' : Object.keys(REPORTS).find((id) => REPORTS[id].group === g)!);
  const b2clCount = shown.filter((i) => isB2cl(i, i.total)).length;
  // Zeros are noise in a wide table: a dash lets the real figures stand out (rates keep their 0)
  const cellText = (cell: Cell, column: string) => (typeof cell !== 'number' ? cell : cell === 0 && !/rate/i.test(column) ? '—' : number.format(cell));

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-4">
        <div className="segmented" role="tablist" aria-label="Report group">
          {[...GROUPS, 'System'].map((g) => (
            <button key={g} role="tab" aria-selected={group === g} aria-pressed={group === g} onClick={() => pickGroup(g)}>{g === 'Bills' ? 'Sales' : g === 'Payments' ? 'Receivables' : g === 'System' ? 'Audit Log' : g}</button>
          ))}
        </div>
        <div className={`flex gap-2 ${isAudit ? 'hidden' : ''}`}>
          {group === 'GST Filing' && (
            <button onClick={exportGstr1} disabled={allInvoices.length === 0 && credits.length === 0 && debits.length === 0} className="btn" title="JSON file for the GST offline tool: B2B, B2C Large and Small, notes, HSN, documents issued">
              <FileJson className="h-4 w-4" aria-hidden />
              GSTR-1 (JSON)
            </button>
          )}
          <button onClick={exportCsv} disabled={report.rows.length === 0} className="btn">
            <Download className="h-4 w-4" aria-hidden />
            This Sheet (CSV)
          </button>
          <button onClick={exportWorkbook} disabled={shown.length === 0 && credits.length === 0 && debits.length === 0} className="btn btn-primary">
            <FileSpreadsheet className="h-4 w-4" aria-hidden />
            All Sheets (Excel)
          </button>
        </div>
      </div>

      {/* One row of filters: Report, Period, Payment */}
      <div className="flex items-end gap-4">
        {!isAudit && (
          <label className="label min-w-0">Report
            <select value={kind} onChange={(e) => setKind(e.target.value)} className="field w-72">
              {Object.entries(REPORTS).filter(([, r]) => r.group === group).map(([id, r]) => <option key={id} value={id}>{r.label}</option>)}
            </select>
          </label>
        )}
        <label className="label">Period
          <select value={period} onChange={(e) => { const next = e.target.value as Period; if (next === 'custom') setCustom({ from, to }); setPeriod(next); }} className="field w-44">
            {PERIODS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        {period === 'custom' ? (
          <>
            <DateText label="From" value={custom.from} onChange={(iso) => setCustom((c) => ({ ...c, from: iso }))} />
            <DateText label="To" value={custom.to} onChange={(iso) => setCustom((c) => ({ ...c, to: iso }))} />
          </>
        ) : (
          <span className="pb-2 text-ink-2 tabular-nums">{toDisplay(from)} to {toDisplay(to)}</span>
        )}
        {!isAudit && (
          <div className="label ml-auto">Payment
            <div className="segmented" role="group" aria-label="Payment status">
              {(['all', 'paid', 'unpaid'] as const).map((s) => (
                <button key={s} aria-pressed={status === s} onClick={() => setStatus(s)}>{s[0].toUpperCase() + s.slice(1)}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {error && <p role="alert" className="error">{error}</p>}

      {isAudit ? <AuditLog from={from} to={to} /> : <>
      {/* What this report does and does not include */}
      <div className="flex items-start gap-3 rounded border border-line bg-ink/[0.03] px-3 py-2 text-xs text-ink-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        <p>
          Cancelled invoices are excluded; credit and debit notes are listed separately. The Payment filter applies to invoice reports.
          {group === 'GST Filing' && ' The sheets follow the GSTR-1 offline tool columns and the JSON file is built for its Import. Have your accountant confirm both before filing.'}
        </p>
      </div>
      {group === 'GST Filing' && b2clCount > 0 && (
        <div role="status" className="flex items-start gap-3 rounded border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>{b2clCount} invoice{b2clCount > 1 ? 's are' : ' is'} B2C Large (unregistered customer in another state, above ₹1 lakh). {b2clCount > 1 ? 'They belong' : 'It belongs'} in the B2C Large sheet, not B2C Small.</p>
        </div>
      )}

      {/* Spreadsheet-style grid: header and totals stay in view, and so do the first two columns when scrolling sideways */}
      <div className="card overflow-auto max-h-[calc(100vh-20rem)]">
        <table className="grid-tbl freeze-2">
          <thead>
            <tr>
              <th className="num w-10">#</th>
              {report.columns.map((c, i) => <th key={c} className={isNumeric(i) ? 'num' : ''}>{c}</th>)}
            </tr>
          </thead>
          <tbody>
            {report.rows.length === 0 && (
              <tr><td colSpan={report.columns.length + 1} className="empty">Nothing to show for this period and filter.</td></tr>
            )}
            {report.rows.map((row, r) => (
              <tr key={r}>
                <td className="num text-ink-2">{r + 1}</td>
                {row.map((cell, i) => (
                  <td key={i} className={typeof cell === 'number' ? 'num' : ''}>
                    {cellText(cell, report.columns[i])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          {report.rows.length > 0 && (
            <tfoot>
              <tr>
                <td />
                {totals.map((t, i) => (
                  <td key={i} className={t === null ? '' : 'num'}>{t === null ? (i === 0 ? `Total · ${report.rows.length} rows` : '') : t === 0 ? '—' : number.format(t)}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      </>}
    </div>
  );
};

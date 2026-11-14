// GSTR-1 for the GST offline tool: the JSON it imports (b2b, b2cl, b2cs, cdnr, cdnur, hsn, doc_issue).
// Type-only imports here: scripts/gst.check.ts loads this file directly under Node.
import { computeInvoice, type InvoiceLine, type InvoiceTotals } from './gst';
import type { Invoice, Note, CreditNote, DebitNote } from './db';

// An unregistered customer in another state, invoice value above ₹1 lakh (limit in force since 1 Aug 2024)
export const B2CL_LIMIT = 100000;

type Doc = { customer: { gstin: string }; totals: InvoiceTotals };
export const isB2cl = (d: Doc, invoiceValue: number) => !d.customer.gstin && !d.totals.intraState && invoiceValue > B2CL_LIMIT;

const r2 = (n: number) => Math.round(n * 100) / 100;
const ddmmyyyy = (iso: string) => iso.split('-').reverse().join('-');

// Tax of one line on its own, split the way the document was taxed
const taxOf = (line: InvoiceLine, intra: boolean) => computeInvoice([line], 'a', intra ? 'a' : 'b');

interface Item { num: number; itm_det: { rt: number; txval: number; iamt: number; camt: number; samt: number; csamt: number } }

// One entry per GST rate: the shape every section of GSTR-1 uses for the tax detail
function itemsOf(lines: InvoiceLine[], intra: boolean, sign = 1): Item[] {
  const byRate = new Map<number, { txval: number; iamt: number; camt: number; samt: number }>();
  for (const l of lines) {
    const t = taxOf(l, intra);
    const g = byRate.get(l.gstRate) ?? { txval: 0, iamt: 0, camt: 0, samt: 0 };
    g.txval += t.taxable; g.iamt += t.igst; g.camt += t.cgst; g.samt += t.sgst;
    byRate.set(l.gstRate, g);
  }
  return [...byRate].sort(([a], [b]) => a - b).map(([rt, g], i) => ({
    num: i + 1,
    itm_det: { rt, txval: r2(sign * g.txval), iamt: r2(sign * g.iamt), camt: r2(sign * g.camt), samt: r2(sign * g.samt), csamt: 0 },
  }));
}
// B2CL has no CGST/SGST: inter-state by definition
const interOnly = (items: Item[]) => items.map((i) => ({ num: i.num, itm_det: { rt: i.itm_det.rt, txval: i.itm_det.txval, iamt: i.itm_det.iamt, csamt: 0 } }));

const group = <T>(rows: T[], key: (r: T) => string): Map<string, T[]> => {
  const m = new Map<string, T[]>();
  for (const r of rows) m.set(key(r), [...(m.get(key(r)) ?? []), r]);
  return m;
};

const UQC = new Set('BAG BAL BDL BKL BOU BOX BTL BUN CAN CBM CCM CMS CTN DOZ DRM GGK GMS GRS GYD KGS KLR KME LTR MLT MTR MTS NOS OTH PAC PCS PRS QTL ROL SET SQF SQM SQY TBS TGM THD TON TUB UGS UNT YDS'.split(' '));
const uqcOf = (unit: string) => (UQC.has(unit.toUpperCase()) ? unit.toUpperCase() : 'OTH');

export interface Gstr1Input {
  gstin: string;
  period: string; // YYYY-MM: the return month
  invoices: Invoice[]; // all in the period, cancelled included (they are counted in the document summary)
  credits: CreditNote[];
  debits: DebitNote[];
}

export function buildGstr1({ gstin, period, invoices, credits, debits }: Gstr1Input) {
  const issued = invoices.filter((i) => i.status === 'issued');
  const notes: (Note & { type: 'C' | 'D' })[] = [
    ...credits.map((c) => ({ ...c, type: 'C' as const })),
    ...debits.map((d) => ({ ...d, type: 'D' as const })),
  ];
  const noteNumber = (n: Note & { type: 'C' | 'D' }) => ('creditNumber' in n ? (n as CreditNote).creditNumber : (n as unknown as DebitNote).debitNumber);

  // --- Invoices
  const b2b = [...group(issued.filter((i) => i.customer.gstin), (i) => i.customer.gstin)].map(([ctin, list]) => ({
    ctin,
    inv: list.map((i) => ({
      inum: i.invoiceNumber, idt: ddmmyyyy(i.issueDate), val: i.total, pos: i.customer.stateCode, rchrg: 'N', inv_typ: 'R',
      itms: itemsOf(i.items, i.totals.intraState),
    })),
  }));

  const b2clInvoices = issued.filter((i) => isB2cl(i, i.total));
  const b2cl = [...group(b2clInvoices, (i) => i.customer.stateCode)].map(([pos, list]) => ({
    pos,
    inv: list.map((i) => ({ inum: i.invoiceNumber, idt: ddmmyyyy(i.issueDate), val: i.total, itms: interOnly(itemsOf(i.items, false)) })),
  }));

  // --- B2C Small: everything else to unregistered customers, by state and rate, net of their credit and debit notes
  const small: { pos: string; intra: boolean; items: Item[] }[] = [
    ...issued.filter((i) => !i.customer.gstin && !isB2cl(i, i.total)).map((i) => ({ pos: i.customer.stateCode, intra: i.totals.intraState, items: itemsOf(i.items, i.totals.intraState) })),
    ...notes.filter((n) => !n.customer.gstin && !isB2cl(n, n.invoiceTotal))
      .map((n) => ({ pos: n.customer.stateCode, intra: n.totals.intraState, items: itemsOf(n.items, n.totals.intraState, n.type === 'C' ? -1 : 1) })),
  ];
  const b2csMap = new Map<string, { sply_ty: string; rt: number; typ: string; pos: string; txval: number; iamt: number; camt: number; samt: number; csamt: number }>();
  for (const s of small) {
    for (const it of s.items) {
      const key = `${s.intra}|${s.pos}|${it.itm_det.rt}`;
      const g = b2csMap.get(key) ?? { sply_ty: s.intra ? 'INTRA' : 'INTER', rt: it.itm_det.rt, typ: 'OE', pos: s.pos, txval: 0, iamt: 0, camt: 0, samt: 0, csamt: 0 };
      g.txval = r2(g.txval + it.itm_det.txval); g.iamt = r2(g.iamt + it.itm_det.iamt); g.camt = r2(g.camt + it.itm_det.camt); g.samt = r2(g.samt + it.itm_det.samt);
      b2csMap.set(key, g);
    }
  }

  // --- Credit and debit notes: to registered customers (cdnr), and to unregistered ones for B2C Large invoices (cdnur)
  const noteRow = (n: Note & { type: 'C' | 'D' }, itms: Item[] | ReturnType<typeof interOnly>) => ({
    ntty: n.type, nt_num: noteNumber(n), nt_dt: ddmmyyyy(n.issueDate), val: n.total, pos: n.customer.stateCode, rchrg: 'N', inv_typ: 'R', itms,
  });
  const cdnr = [...group(notes.filter((n) => n.customer.gstin), (n) => n.customer.gstin)].map(([ctin, list]) => ({
    ctin, nt: list.map((n) => noteRow(n, itemsOf(n.items, n.totals.intraState))),
  }));
  const cdnur = notes.filter((n) => isB2cl(n, n.invoiceTotal)).map((n) => {
    const { rchrg, inv_typ, ...row } = noteRow(n, interOnly(itemsOf(n.items, false)));
    return { ...row, typ: 'B2CL' };
  });

  // --- HSN summary: invoices plus debit notes, less credit notes
  const hsnMap = new Map<string, { hsn_sc: string; uqc: string; rt: number; qty: number; val: number; txval: number; iamt: number; camt: number; samt: number }>();
  // Quantity is counted for invoices and returns, not for debit notes: those correct a price, not the goods supplied
  const addHsn = (lines: InvoiceLine[], intra: boolean, sign: number, countQty = true) => {
    for (const l of lines) {
      const t = taxOf(l, intra);
      const key = `${l.hsnCode}|${uqcOf(l.unit)}|${l.gstRate}`;
      const g = hsnMap.get(key) ?? { hsn_sc: l.hsnCode, uqc: uqcOf(l.unit), rt: l.gstRate, qty: 0, val: 0, txval: 0, iamt: 0, camt: 0, samt: 0 };
      if (countQty) g.qty += sign * l.qty;
       g.txval += sign * t.taxable; g.iamt += sign * t.igst; g.camt += sign * t.cgst; g.samt += sign * t.sgst;
      g.val += sign * (t.taxable + t.igst + t.cgst + t.sgst);
      hsnMap.set(key, g);
    }
  };
  issued.forEach((i) => addHsn(i.items, i.totals.intraState, 1));
  notes.forEach((n) => addHsn(n.items, n.totals.intraState, n.type === 'C' ? -1 : 1, n.type === 'C'));

  // --- Document summary: first and last number of each series, with the cancelled ones counted
  const series = (nums: { number: string; cancelled: boolean }[], doc_num: number) => {
    if (nums.length === 0) return [];
    const sorted = [...nums].sort((a, b) => a.number.localeCompare(b.number));
    const cancel = nums.filter((n) => n.cancelled).length;
    return [{ doc_num, docs: [{ num: 1, from: sorted[0].number, to: sorted[sorted.length - 1].number, totnum: nums.length, cancel, net_issue: nums.length - cancel }] }];
  };

  return {
    gstin,
    fp: `${period.slice(5, 7)}${period.slice(0, 4)}`,
    gt: 0, // aggregate turnover is not tracked; enter it in the offline tool
    cur_gt: 0,
    b2b, b2cl,
    b2cs: [...b2csMap.values()].filter((r) => r.txval !== 0 || r.iamt !== 0 || r.camt !== 0 || r.samt !== 0),
    cdnr, cdnur,
    hsn: {
      data: [...hsnMap.values()].map((h, i) => ({
        num: i + 1, hsn_sc: h.hsn_sc, desc: '', uqc: h.uqc, qty: r2(h.qty), val: r2(h.val), txval: r2(h.txval),
        iamt: r2(h.iamt), camt: r2(h.camt), samt: r2(h.samt), csamt: 0, rt: h.rt,
      })),
    },
    doc_issue: {
      doc_det: [
        ...series(invoices.map((i) => ({ number: i.invoiceNumber, cancelled: i.status === 'cancelled' })), 1),
        ...series(debits.map((d) => ({ number: d.debitNumber, cancelled: false })), 4),
        ...series(credits.map((c) => ({ number: c.creditNumber, cancelled: false })), 5),
      ],
    },
  };
}

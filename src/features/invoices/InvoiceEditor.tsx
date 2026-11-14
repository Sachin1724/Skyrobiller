import React, { useEffect, useRef, useState } from 'react';
import { toast } from '../../store/useToastStore';
import { friendlyError } from '../../lib/friendlyError';
import { ArrowLeft, PauseCircle, Trash2, CheckCircle2, FileDown, Plus, AlertTriangle, Printer } from 'lucide-react';
import { SearchBox } from '../../components/SearchBox';
import { NumInput } from '../../components/NumInput';
import { confirmDialog } from '../../components/ConfirmDialog';
import { computeInvoice, type InvoiceLine } from '../../lib/gst';
import {
  searchCustomers, searchProducts, getDraft, saveDraft, saveProduct, newDraftId, updateProductPrice, issueInvoice, listInvoices, outstandingOf, nextInvoiceNumber,
  type Customer, type Product, type DraftKind, type QuotationStatus, type Invoice,
} from '../../lib/db';
import { savePdf, printDocument, invoiceDocument, type PrintableDocument } from '../../lib/pdf';
import { useMenuAction, setFlushOpenWork } from '../../store/useNavStore';
import { formatCurrencyINR, formatDate, todayISO, addDaysISO } from '../../lib/utils';
import { useSystemStore } from '../../store/useSystemStore';
import { useNavStore } from '../../store/useNavStore';
import { checkInvoice, type Issue } from '../../lib/checks';

const AUTOSAVE_MS = 600;
const num = (v: string, max = Infinity) => Math.min(max, Math.max(0, Number(v) || 0));

interface Props {
  draftId: string; // a new id starts an empty document
  kind: DraftKind;
  onClose: (issuedNumber?: string) => void;
}

const clock = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// What the customer already owes: shown beside the bill so a credit decision is made before issuing, not after
interface Dues { outstanding: number; overdue: number; last: Invoice | null; issuedToday: { total: number; items: number }[] }

// Editor for an invoice draft or a quotation. Issued invoices are never edited here: corrections are credit and debit notes.
export const InvoiceEditor: React.FC<Props> = ({ draftId, kind, onClose }) => {
  const company = useSystemStore((s) => s.company);
  const itemsSection = useRef<HTMLElement>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dues, setDues] = useState<Dues | null>(null);
  const [attempted, setAttempted] = useState(false); // set on the first try to issue: from then on every error shows
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<InvoiceLine[]>([]);
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState(kind === 'quotation' ? addDaysISO(todayISO(), 15) : '');
  const [status, setStatus] = useState<QuotationStatus>('draft');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const defaultGstRate = useSystemStore((s) => s.prefs.defaultGstRate);

  const totals = computeInvoice(items, company.stateCode, customer?.stateCode ?? company.stateCode);

  // Latest values for saves that run outside render (debounce timer, unmount flush)
  const latest = useRef({ customer, items, notes, validUntil, status, total: totals.total });
  latest.current = { customer, items, notes, validUntil, status, total: totals.total };
  const timer = useRef<number | undefined>(undefined);
  const closed = useRef(false); // set once the draft is issued or saved, so no late autosave can recreate it

  const persist = (isParked: boolean): Promise<void> => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    if (closed.current || (!latest.current.customer && latest.current.items.length === 0)) {
      return Promise.resolve(); // nothing worth saving to drafts
    }
    const d = latest.current;
    return saveDraft({ draftId, kind, isParked, ...d }).then(() => setSavedAt(Date.now())).catch((e) => setError(`Not saved. ${friendlyError(e)}`));
  };

  useEffect(() => {
    getDraft(draftId).then((d) => {
      if (d) {
        setCustomer(d.customer); setItems(d.items); setNotes(d.notes); setStatus(d.status);
        if (d.validUntil) setValidUntil(d.validUntil);
      }
      setLoaded(true);
    }).catch((e) => setError(friendlyError(e)));
  }, [draftId]);

  // Autosave while typing; editing a parked invoice makes it an active draft again
  useEffect(() => {
    if (!loaded) return;
    timer.current = window.setTimeout(() => persist(false), AUTOSAVE_MS);
    return () => window.clearTimeout(timer.current);
  }, [customer, items, notes, validUntil, loaded]);

  // Dues for the chosen customer, refreshed when the customer changes
  useEffect(() => {
    if (!customer) { setDues(null); return; }
    let stale = false;
    listInvoices().then((all) => {
      if (stale) return;
      const theirs = all.filter((i) => i.customer.id === customer.id && i.status === 'issued');
      const open = theirs.filter((i) => outstandingOf(i) >= 0.01);
      setDues({
        outstanding: open.reduce((sum, i) => sum + outstandingOf(i), 0),
        overdue: open.filter((i) => i.dueDate < todayISO()).length,
        last: theirs[0] ?? null, // newest first
        issuedToday: theirs.filter((i) => i.issueDate === todayISO()).map((i) => ({ total: i.total, items: i.items.length })),
      });
    }).catch(() => setDues(null));
    return () => { stale = true; };
  }, [customer?.id]);

  // Closing the window saves this document first
  useEffect(() => {
    setFlushOpenWork(() => persist(false));
    return () => setFlushOpenWork(null);
  }, []);

  // Flush a pending autosave if the editor is torn down mid-debounce
  useEffect(() => () => { if (timer.current !== undefined) persist(false); }, []);

  const setLine = (i: number, patch: Partial<InvoiceLine>) =>
    setItems((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));

  const addProduct = (p: Product) =>
    setItems((prev) => {
      const i = prev.findIndex((l) => l.productId === p.id);
      if (i >= 0) return prev.map((l, j) => (j === i ? { ...l, qty: l.qty + 1 } : l));
      return [...prev, {
        productId: p.id, catalogRate: p.defaultPrice, sku: p.sku, description: p.name, hsnCode: p.hsnCode,
        unit: p.unit, qty: 1, rate: p.defaultPrice, discountPct: 0, gstRate: p.gstRate,
      }];
    });

  // A one-off item typed straight into the invoice; it can be saved to the catalogue from its row
  const addCustomLine = () =>
    setItems((prev) => [...prev, { sku: '', description: '', hsnCode: '', unit: 'PCS', qty: 1, rate: 0, discountPct: 0, gstRate: defaultGstRate }]);

  // Product memory learning from billing: turns a one-off line into a catalogue product
  const addLineToCatalogue = async (i: number) => {
    const l = items[i];
    if (!l.sku.trim() || !l.description.trim() || !/^[0-9]{4,8}$/.test(l.hsnCode)) {
      setError('To save this item to the catalogue, fill its name, SKU and a 4 to 8 digit HSN code.');
      return;
    }
    const id = crypto.randomUUID();
    const sku = l.sku.trim().toUpperCase();
    try {
      await saveProduct({ id, sku, name: l.description.trim(), brand: '', description: '', unit: l.unit, hsnCode: l.hsnCode, gstRate: l.gstRate, defaultPrice: l.rate, searchAliases: '' });
      setLine(i, { productId: id, catalogRate: l.rate, sku });
      setError('');
    } catch (e: any) {
      setError(friendlyError(e));
    }
  };

  const saveToCatalogue = async (i: number) => {
    const l = items[i];
    if (!l.productId) return;
    if (!(await confirmDialog({
      title: `Change the catalogue price of ${l.sku}?`, details: [['Now', formatCurrencyINR(l.catalogRate ?? 0)], ['New default', formatCurrencyINR(l.rate)]],
      message: 'Applies to all future invoices. Issued invoices keep their price.', confirmLabel: 'Change Price',
    }))) return;
    try {
      await updateProductPrice(l.productId, l.rate);
      setLine(i, { catalogRate: l.rate });
    } catch (e: any) {
      setError(friendlyError(e));
    }
  };

  const close = (isParked: boolean) => persist(isParked).then(() => onClose());

  // Every problem at once. "Nothing entered yet" errors wait until the user tries to issue.
  const allIssues = checkInvoice({ kind, customer, items, total: totals.total, company, dues, issuedToday: dues?.issuedToday ?? [] });
  const issues = allIssues.filter((i) => i.level === 'warning' || attempted || !i.empty);
  const errorCount = issues.filter((i) => i.level === 'error').length;
  const warningCount = issues.length - errorCount;
  const forField = (field: string, line?: number) => issues.filter((i) => i.field === field && i.line === line);
  const bad = (field: string, line?: number) => forField(field, line).some((i) => i.level === 'error') || undefined; // aria-invalid
  const key = (i: Issue) => (i.line === undefined ? i.field : `${i.field}-${i.line}`);

  // Each message in the checklist jumps to the field it is about
  const jumpTo = (issue: Issue) => {
    if (issue.field === 'company') { useNavStore.getState().setCurrentModule('settings'); return; }
    const target = document.querySelector<HTMLElement>(`[data-field="${key(issue)}"]`);
    if (!target) return;
    target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    (target.matches('input, select, button') ? target : target.querySelector<HTMLElement>('input, button'))?.focus({ preventScroll: true });
  };

  // Returns the customer when the document can be issued or printed; otherwise shows every error and jumps to the first
  const validate = (): Customer | null => {
    setAttempted(true);
    const firstError = allIssues.find((i) => i.level === 'error');
    if (firstError || !customer) {
      setError('');
      if (firstError) window.setTimeout(() => jumpTo(firstError), 0); // after the errors have rendered
      return null;
    }
    setError('');
    return customer;
  };

  const handleIssue = async (print: boolean) => {
    const cust = validate();
    if (!cust || busy) return;
    const issueDate = todayISO();
    const nextNumber = await nextInvoiceNumber(company.invoicePrefix, issueDate).catch(() => '');
    if (!(await confirmDialog({
      title: print ? 'Issue and print this invoice?' : 'Issue this invoice?',
      headline: { label: `Invoice total, ${totals.intraState ? 'CGST + SGST' : 'IGST'}`, value: formatCurrencyINR(totals.total) },
      details: [
        ['Customer', cust.businessName],
        ['Invoice number', nextNumber || 'Next in sequence'],
        ['Items', String(items.length)],
        ['Due', formatDate(addDaysISO(issueDate, cust.paymentTermsDays))],
        ...(dues && dues.outstanding >= 0.01 ? [['Already owed', `${formatCurrencyINR(dues.outstanding)}${dues.overdue ? ` (${dues.overdue} overdue)` : ''}`] as [string, string]] : []),
      ],
      message: `${allIssues.filter((i) => i.level === 'warning').map((i) => `• ${i.message}`).join('\n')}${allIssues.some((i) => i.level === 'warning') ? '\n\n' : ''}Once issued it cannot be edited. Corrections are made with credit or debit notes.`,
      confirmLabel: print ? 'Issue & Print' : 'Issue Invoice',
    }))) return;
    setBusy(true);
    try {
      window.clearTimeout(timer.current);
      timer.current = undefined;
      const invoice = await issueInvoice({
        // Logo and signature are look settings, not invoice content: keep the images out of every invoice snapshot
        draftId, customer: cust, company: { ...company, logo: '', signature: '' }, items, totals, notes,
        issueDate, dueDate: addDaysISO(issueDate, cust.paymentTermsDays),
      });
      closed.current = true;
      if (print) await printDocument(invoiceDocument(invoice), company).catch((e) => toast.error(`Issued as ${invoice.invoiceNumber}, but printing failed. ${friendlyError(e)} Print it from the Issued list.`));
      onClose(invoice.invoiceNumber);
    } catch (e: any) {
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  // The quotation as a printable document, or null (with a message) when it is incomplete or this is an invoice draft
  const quotationDocument = (): PrintableDocument | null => {
    if (kind === 'invoice') { setError('A draft has no invoice number yet. Issue the invoice first, then save or print it from the Issued list.'); return null; }
    const cust = validate();
    return cust && {
      title: 'Quotation', number: draftId, date: todayISO(), secondDateLabel: 'Valid Until', secondDate: validUntil,
      company, customer: cust, items, totals, notes,
    };
  };

  const output = async (send: (d: PrintableDocument, settings: typeof company) => Promise<void>) => {
    const doc = quotationDocument();
    if (!doc) return;
    await persist(false);
    send(doc, company).catch((e) => setError(friendlyError(e)));
  };
  const handleQuotationPdf = () => output(savePdf);

  useMenuAction({
    'save': () => { persist(false).then(() => toast.success(`Saved ${draftId}.`)); },
    'save-copy': () => {
      const copyId = newDraftId(kind);
      const d = latest.current;
      saveDraft({ draftId: copyId, kind, isParked: false, ...d, status: 'draft' })
        .then(() => toast.success(`Copy saved as ${copyId}. Find it in the ${kind === 'invoice' ? 'Drafts' : 'Quotations'} list.`))
        .catch((e) => setError(friendlyError(e)));
    },
    'save-pdf': () => { output(savePdf); },
    'print': () => { output(printDocument); },
  });

  // Keyboard first: Ctrl+Enter issues and prints, F9 parks
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (kind !== 'invoice') return;
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleIssue(true); }
      else if (e.key === 'F9') { e.preventDefault(); close(true); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Enter moves to the next field of the item table; after the last field it returns to the product search for the next line
  const onItemsKeyDown = (e: React.KeyboardEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (e.key !== 'Enter' || e.ctrlKey || target.tagName !== 'INPUT' || !target.closest('tbody')) return;
    e.preventDefault();
    const fields = [...e.currentTarget.querySelectorAll<HTMLElement>('tbody input, tbody select')];
    const next = fields[fields.indexOf(target) + 1];
    (next ?? itemsSection.current?.querySelector<HTMLElement>('input[role="combobox"], input[type="search"]'))?.focus();
  };

  const customerDues = dues && dues.outstanding >= 0.01;

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => close(false)} className="btn">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          <span className="badge tabular-nums">{draftId}</span>
          <span className="text-xs text-ink-2 truncate" aria-live="polite">
            {kind === 'invoice' ? 'Draft' : 'Quotation'} · {savedAt ? `saved ${clock(savedAt)}` : 'saved automatically'}
            {kind === 'invoice' && ' · no invoice number is used until you issue it'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {kind === 'invoice' ? (
            <>
              <button onClick={() => close(true)} className="btn" title="Park (F9)">
                <PauseCircle className="h-4 w-4" aria-hidden />
                Park <kbd className="kbd">F9</kbd>
              </button>
              <button onClick={() => handleIssue(false)} disabled={busy} className="btn">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                Issue Only
              </button>
              <button onClick={() => handleIssue(true)} disabled={busy} className="btn btn-primary" title="Issue and print (Ctrl+Enter)">
                <Printer className="h-4 w-4" aria-hidden />
                {busy ? 'Issuing…' : 'Issue & Print'} <kbd className="kbd">Ctrl ↵</kbd>
              </button>
            </>
          ) : (
            <button onClick={handleQuotationPdf} className="btn btn-primary">
              <FileDown className="h-4 w-4" aria-hidden />
              Save PDF
            </button>
          )}
        </div>
      </div>
      {error && <p role="alert" className="error">{error}</p>}

      {issues.length > 0 && (
        <section aria-label="Checks" className={`card p-3 ${errorCount ? 'border-danger/50' : 'border-warn/50'}`}>
          <div className={`flex items-center gap-2 text-sm font-semibold ${errorCount ? 'text-danger' : 'text-warn'}`} role="status">
            <AlertTriangle className="h-4 w-4" aria-hidden />
            {[errorCount && `${errorCount} error${errorCount > 1 ? 's' : ''}`, warningCount && `${warningCount} warning${warningCount > 1 ? 's' : ''}`].filter(Boolean).join(', ')}
            <span className="font-normal text-ink-2">{errorCount ? 'Fix the errors to issue. Click one to go to it.' : 'You can still issue.'}</span>
          </div>
          <ul className="mt-2 space-y-0.5">
            {issues.map((i, n) => (
              <li key={n}>
                <button onClick={() => jumpTo(i)} className="flex w-full items-start gap-2 rounded px-2 py-1 text-left text-sm hover:bg-ink/5">
                  <span aria-hidden className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${i.level === 'error' ? 'bg-danger' : 'bg-warn'}`} />
                  <span className="sr-only">{i.level}: </span>
                  {i.message}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Customer */}
      <section className="card p-4 space-y-2" aria-label="Customer" data-field="customer">
        {customer ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-base font-semibold tracking-tight truncate">{customer.businessName}</div>
              <div className="text-ink-2 truncate">{customer.billingAddress} - {customer.pincode}</div>
              <div className="text-ink-2">
                {customer.gstin || 'Unregistered'} · Place of supply: {customer.stateName} ({customer.stateCode}) ·{' '}
                {customer.paymentTermsDays === 0 ? 'Immediate payment' : `${customer.paymentTermsDays} days credit`}
              </div>
              {dues && (
                <div className={`mt-1 flex items-center gap-2 text-xs ${customerDues && dues.overdue > 0 ? 'text-warn font-medium' : 'text-ink-2'}`} aria-live="polite">
                  {customerDues && dues.overdue > 0 && <AlertTriangle className="h-3.5 w-3.5" aria-hidden />}
                  {customerDues
                    ? `Due ${formatCurrencyINR(dues.outstanding)}${dues.overdue > 0 ? ` · ${dues.overdue} overdue` : ''}`
                    : 'Nothing outstanding'}
                  {dues.last && ` · last invoice ${dues.last.invoiceNumber} on ${formatDate(dues.last.issueDate)}`}
                </div>
              )}
            </div>
            <button onClick={() => setCustomer(null)} className="btn">Change</button>
          </div>
        ) : (
          <SearchBox<Customer>
            autoFocus
            label="Customer"
            placeholder="Search customer by name, GSTIN or phone…"
            emptyText="No matching customer. Add customers in the Customers screen."
            search={(q) => searchCustomers(q, 8)}
            onPick={setCustomer}
            renderItem={(c) => (
              <div className="flex justify-between gap-3">
                <span className="font-medium truncate">{c.businessName}</span>
                <span className="opacity-70 whitespace-nowrap">{c.gstin || 'Unregistered'} · {c.stateName}</span>
              </div>
            )}
          />
        )}
        {forField('customer').map((i, n) => <p key={n} role="alert" className={i.level === 'error' ? 'error' : 'text-xs text-warn'}>{i.message}</p>)}
        {kind === 'quotation' && (
          <label className="label w-44">Valid Until
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="field" />
          </label>
        )}
      </section>

      {/* Line items */}
      <section className="card" aria-label="Items" ref={itemsSection} onKeyDown={onItemsKeyDown} data-field="items">
        <div className="p-4 flex items-start gap-2">
          <div className="flex-1 min-w-0">
          <SearchBox<Product>
            label="Add product"
            placeholder="Add product: search name, SKU, brand or alias…"
            emptyText="No matching product. Use Custom Item to bill it now and save it to the catalogue."
            search={(q) => searchProducts(q, 8)}
            onPick={addProduct}
            renderItem={(p) => (
              <div className="flex justify-between gap-3">
                <span className="truncate"><span className="font-medium">{p.sku}</span> {p.name}</span>
                <span className="opacity-70 tabular-nums whitespace-nowrap">{formatCurrencyINR(p.defaultPrice)} · GST {p.gstRate}%</span>
              </div>
            )}
          />
          </div>
          <button onClick={addCustomLine} className="btn">
            <Plus className="h-4 w-4" aria-hidden />
            Custom Item
          </button>
        </div>

        <table className="tbl">
          <thead>
            <tr>
              <th>Item</th>
              <th className="w-28">HSN</th>
              <th className="num w-24">Qty</th>
              <th className="num w-32">Rate (₹)</th>
              <th className="num w-24">Disc %</th>
              <th className="num w-24">GST</th>
              <th className="num w-36">Amount</th>
              <th className="w-12 text-center"><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={8} className={forField('items').length ? 'empty text-danger' : 'empty'}>{forField('items')[0]?.message ?? 'No items yet.'} Search above to add a product, or add a custom item.</td></tr>
            )}
            {items.map((l, i) => (
              <tr key={i}>
                {l.productId ? (
                  <>
                    <td className="min-w-0">
                      <div className="font-medium truncate">{l.description}</div>
                      <div className="text-xs text-ink-2">{l.sku} · {l.unit}</div>
                      <LineMessages issues={issues.filter((x) => x.line === i)} />
                    </td>
                    <td className="tabular-nums">{l.hsnCode}</td>
                  </>
                ) : (
                  <>
                    <td className="space-y-1">
                      <input aria-label={`Name of item ${i + 1}`} data-field={`description-${i}`} aria-invalid={bad('description', i)} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Item name…" autoComplete="off" className="field" />
                      <div className="flex items-center gap-1">
                        <input aria-label={`SKU of item ${i + 1}`} value={l.sku} onChange={(e) => setLine(i, { sku: e.target.value })} placeholder="SKU (optional)…" autoComplete="off" spellCheck={false} className="field" />
                        <button onClick={() => addLineToCatalogue(i)} className="btn">Save to Catalogue</button>
                      </div>
                      <LineMessages issues={issues.filter((x) => x.line === i)} />
                    </td>
                    <td>
                      <input aria-label={`HSN code of item ${i + 1}`} data-field={`hsn-${i}`} aria-invalid={bad('hsn', i)} value={l.hsnCode} onChange={(e) => setLine(i, { hsnCode: e.target.value.replace(/\D/g, '').slice(0, 8) })} inputMode="numeric" placeholder="HSN…" autoComplete="off" className="field w-full" />
                    </td>
                  </>
                )}
                <td>
                  <NumInput aria-label={`Quantity of item ${i + 1}`} data-field={`qty-${i}`} aria-invalid={bad('qty', i)} step="1" value={l.qty} onChange={(n) => setLine(i, { qty: n })} className="field num" />
                </td>
                <td>
                  <NumInput aria-label={`Rate of item ${i + 1}`} data-field={`rate-${i}`} step="0.01" value={l.rate} onChange={(n) => setLine(i, { rate: n })} className="field num" />
                  {l.productId && l.rate !== l.catalogRate && (
                    <div className="mt-1 text-right text-xs text-ink-2">
                      Catalogue {formatCurrencyINR(l.catalogRate ?? 0)}{' · '}
                      <button onClick={() => saveToCatalogue(i)} className="text-accent hover:underline">make default</button>
                    </div>
                  )}
                </td>
                <td>
                  <NumInput aria-label={`Discount percent on item ${i + 1}`} data-field={`discount-${i}`} max={100} step="0.5" value={l.discountPct} onChange={(n) => setLine(i, { discountPct: n })} className="field num" />
                </td>
                <td className="num">
                  {l.productId ? `${l.gstRate}%` : (
                    <select aria-label={`GST rate of item ${i + 1}`} value={l.gstRate} onChange={(e) => setLine(i, { gstRate: Number(e.target.value) })} className="field w-full text-right">
                      {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  )}
                </td>
                <td className="num font-medium">{formatCurrencyINR(totals.lineTotals[i])}</td>
                <td className="w-12 text-center">
                  <button onClick={() => setItems((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove item ${i + 1}`} className="btn btn-icon btn-danger">
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Notes + totals */}
      <div className="grid grid-cols-2 gap-4 items-start">
        <label className="label">Notes (Printed on the Document)
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} className="field" />
        </label>
        <dl className="card p-4 space-y-1.5" aria-live="polite">
          <Row label="Taxable value" value={totals.taxable} />
          {totals.intraState ? (
            <>
              <Row label="CGST" value={totals.cgst} />
              <Row label="SGST" value={totals.sgst} />
            </>
          ) : (
            <Row label="IGST" value={totals.igst} />
          )}
          <Row label="Round-off" value={totals.roundOff} />
          <div className="flex justify-between pt-2 mt-1 border-t border-line text-lg font-semibold tracking-tight">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatCurrencyINR(totals.total)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
};

const Row: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex justify-between">
    <dt className="text-ink-2">{label}</dt>
    <dd className="tabular-nums">{formatCurrencyINR(value)}</dd>
  </div>
);

// Problems on one item row, shown under its name
const LineMessages: React.FC<{ issues: Issue[] }> = ({ issues }) => (
  <>{issues.map((i, n) => (
    <div key={n} className={`mt-0.5 text-xs ${i.level === 'error' ? 'text-danger' : 'text-warn'}`}>{i.message.replace(/^Item \d+: /, '')}</div>
  ))}</>
);

import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, PauseCircle, Trash2, CheckCircle2, FileDown, Plus } from 'lucide-react';
import { SearchBox } from '../../components/SearchBox';
import { computeInvoice, type InvoiceLine } from '../../lib/gst';
import {
  searchCustomers, searchProducts, getDraft, saveDraft, saveProduct, newDraftId, updateProductPrice, issueInvoice,
  type Customer, type Product, type DraftKind, type QuotationStatus,
} from '../../lib/db';
import { savePdf, printDocument, type PrintableDocument } from '../../lib/pdf';
import { useMenuAction, setFlushOpenWork } from '../../store/useNavStore';
import { formatCurrencyINR, todayISO, addDaysISO } from '../../lib/utils';
import { useSystemStore } from '../../store/useSystemStore';

const AUTOSAVE_MS = 600;
const num = (v: string, max = Infinity) => Math.min(max, Math.max(0, Number(v) || 0));

interface Props {
  draftId: string; // a new id starts an empty document
  kind: DraftKind;
  onClose: (issuedNumber?: string) => void;
}

// Editor for an invoice draft or a quotation. Everything typed is autosaved to the local database.
export const InvoiceEditor: React.FC<Props> = ({ draftId, kind, onClose }) => {
  const company = useSystemStore((s) => s.company);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [items, setItems] = useState<InvoiceLine[]>([]);
  const [notes, setNotes] = useState('');
  const [validUntil, setValidUntil] = useState(kind === 'quotation' ? addDaysISO(todayISO(), 15) : '');
  const [status, setStatus] = useState<QuotationStatus>('draft');
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const defaultGstRate = useSystemStore((s) => s.prefs.defaultGstRate);

  const totals = computeInvoice(items, company.stateCode, customer?.stateCode ?? company.stateCode);

  // Latest values for saves that run outside render (debounce timer, unmount flush)
  const latest = useRef({ customer, items, notes, validUntil, status, total: totals.total });
  latest.current = { customer, items, notes, validUntil, status, total: totals.total };
  const timer = useRef<number | undefined>(undefined);
  const closed = useRef(false); // set once the draft is issued, so no late autosave can recreate it

  const persist = (isParked: boolean): Promise<void> => {
    window.clearTimeout(timer.current);
    timer.current = undefined;
    const d = latest.current;
    if (closed.current || (!d.customer && d.items.length === 0)) return Promise.resolve(); // nothing worth saving
    return saveDraft({ draftId, kind, isParked, ...d }).catch((e) => setError(`Not saved: ${e.message}. Check disk space and try again.`));
  };

  useEffect(() => {
    getDraft(draftId).then((d) => {
      if (d) {
        setCustomer(d.customer); setItems(d.items); setNotes(d.notes); setStatus(d.status);
        if (d.validUntil) setValidUntil(d.validUntil);
      }
      setLoaded(true);
    }).catch((e) => setError(e.message));
  }, [draftId]);

  // Autosave while typing; editing a parked invoice makes it an active draft again
  useEffect(() => {
    if (!loaded) return;
    timer.current = window.setTimeout(() => persist(false), AUTOSAVE_MS);
    return () => window.clearTimeout(timer.current);
  }, [customer, items, notes, validUntil, loaded]);

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
      setError(/UNIQUE/.test(e.message) ? `SKU ${sku} is already in the catalogue. Pick that product from the search instead, or use a different SKU.` : e.message);
    }
  };

  const saveToCatalogue = async (i: number) => {
    const l = items[i];
    if (!l.productId) return;
    if (!window.confirm(`Change the catalogue price of ${l.sku} from ${formatCurrencyINR(l.catalogRate ?? 0)} to ${formatCurrencyINR(l.rate)} for all future invoices?`)) return;
    try {
      await updateProductPrice(l.productId, l.rate);
      setLine(i, { catalogRate: l.rate });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const close = (isParked: boolean) => persist(isParked).then(() => onClose());

  // Returns the customer when the document is complete enough to issue or print
  const validate = (): Customer | null => {
    if (!customer) { setError('Choose a customer first.'); return null; }
    if (items.length === 0) { setError('Add at least one product.'); return null; }
    if (items.some((l) => l.qty <= 0)) { setError('Every line needs a quantity above zero.'); return null; }
    if (items.some((l) => !l.description.trim() || !/^[0-9]{4,8}$/.test(l.hsnCode))) { setError('Every custom item needs a name and a 4 to 8 digit HSN code.'); return null; }
    setError('');
    return customer;
  };

  const handleIssue = async () => {
    const cust = validate();
    if (!cust) return;
    if (!window.confirm(`Issue this invoice to ${cust.businessName} for ${formatCurrencyINR(totals.total)}? It gets the next invoice number and can no longer be edited.`)) return;
    setBusy(true);
    try {
      window.clearTimeout(timer.current);
      timer.current = undefined;
      const issueDate = todayISO();
      const invoice = await issueInvoice({
        // Logo and signature are look settings, not invoice content: keep the images out of every invoice snapshot
        draftId, customer: cust, company: { ...company, logo: '', signature: '' }, items, totals, notes,
        issueDate, dueDate: addDaysISO(issueDate, cust.paymentTermsDays),
      });
      closed.current = true;
      onClose(invoice.invoiceNumber);
    } catch (e: any) {
      setError(/UNIQUE|PRIMARY/i.test(e.message) ? 'This invoice was already issued. Close the editor and check the Issued list.' : e.message);
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
    send(doc, company).catch((e) => setError(e.message));
  };
  const handleQuotationPdf = () => output(savePdf);

  useMenuAction({
    'save': () => { persist(false).then(() => setNotice(`Saved ${draftId}.`)); },
    'save-copy': () => {
      const copyId = newDraftId(kind);
      const d = latest.current;
      saveDraft({ draftId: copyId, kind, isParked: false, ...d, status: 'draft' })
        .then(() => setNotice(`Copy saved as ${copyId}. Find it in the ${kind === 'invoice' ? 'Drafts' : 'Quotations'} list.`))
        .catch((e) => setError(e.message));
    },
    'save-pdf': () => { output(savePdf); },
    'print': () => { output(printDocument); },
  });

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <button onClick={() => close(false)} className="btn">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </button>
          <span className="badge tabular-nums">{draftId}</span>
          <span className="text-xs text-ink-2 truncate">
            {kind === 'invoice' ? 'Draft. Saved automatically. No invoice number is used until you issue it.' : 'Quotation. Saved automatically.'}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {kind === 'invoice' ? (
            <>
              <button onClick={() => close(true)} className="btn">
                <PauseCircle className="h-4 w-4" aria-hidden />
                Park
              </button>
              <button onClick={handleIssue} disabled={busy} className="btn btn-primary">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {busy ? 'Issuing…' : 'Issue Invoice'}
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

      <p aria-live="polite" className="text-success font-medium empty:hidden">{notice}</p>
      {error && <p role="alert" className="error">{error}</p>}

      {/* Customer */}
      <section className="card p-4 space-y-2" aria-label="Customer">
        {customer ? (
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold tracking-tight truncate">{customer.businessName}</div>
              <div className="text-ink-2 truncate">{customer.billingAddress} - {customer.pincode}</div>
              <div className="text-ink-2">
                {customer.gstin || 'Unregistered'} · Place of supply: {customer.stateName} ({customer.stateCode}) ·{' '}
                {customer.paymentTermsDays === 0 ? 'Immediate payment' : `${customer.paymentTermsDays} days credit`}
              </div>
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
        {kind === 'quotation' && (
          <label className="label w-44">Valid Until
            <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="field" />
          </label>
        )}
      </section>

      {/* Line items */}
      <section className="card" aria-label="Items">
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
              <th>HSN</th>
              <th className="num w-24">Qty</th>
              <th className="num w-32">Rate (₹)</th>
              <th className="num w-24">Disc %</th>
              <th className="num">GST</th>
              <th className="num">Amount</th>
              <th><span className="sr-only">Remove</span></th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr><td colSpan={8} className="empty">No items yet. Search above to add a product, or add a custom item.</td></tr>
            )}
            {items.map((l, i) => (
              <tr key={i}>
                {l.productId ? (
                  <>
                    <td className="max-w-xs">
                      <div className="font-medium truncate">{l.description}</div>
                      <div className="text-xs text-ink-2">{l.sku} · {l.unit}</div>
                    </td>
                    <td className="tabular-nums">{l.hsnCode}</td>
                  </>
                ) : (
                  <>
                    <td className="space-y-1">
                      <input aria-label={`Name of item ${i + 1}`} value={l.description} onChange={(e) => setLine(i, { description: e.target.value })} placeholder="Item name…" autoComplete="off" className="field" />
                      <div className="flex items-center gap-1">
                        <input aria-label={`SKU of item ${i + 1}`} value={l.sku} onChange={(e) => setLine(i, { sku: e.target.value })} placeholder="SKU (optional)…" autoComplete="off" spellCheck={false} className="field" />
                        <button onClick={() => addLineToCatalogue(i)} className="btn">Save to Catalogue</button>
                      </div>
                    </td>
                    <td>
                      <input aria-label={`HSN code of item ${i + 1}`} value={l.hsnCode} onChange={(e) => setLine(i, { hsnCode: e.target.value.replace(/\D/g, '').slice(0, 8) })} inputMode="numeric" placeholder="HSN…" autoComplete="off" className="field w-24" />
                    </td>
                  </>
                )}
                <td>
                  <input aria-label={`Quantity of item ${i + 1}`} type="number" min="0" step="1" value={l.qty} onChange={(e) => setLine(i, { qty: num(e.target.value) })} className="field num" />
                </td>
                <td>
                  <input aria-label={`Rate of item ${i + 1}`} type="number" min="0" step="0.01" value={l.rate} onChange={(e) => setLine(i, { rate: num(e.target.value) })} className="field num" />
                  {l.productId && l.rate !== l.catalogRate && (
                    <button onClick={() => saveToCatalogue(i)} className="mt-1 block ml-auto text-[11px] text-accent hover:underline">
                      Save to catalogue
                    </button>
                  )}
                </td>
                <td>
                  <input aria-label={`Discount percent on item ${i + 1}`} type="number" min="0" max="100" step="0.5" value={l.discountPct} onChange={(e) => setLine(i, { discountPct: num(e.target.value, 100) })} className="field num" />
                </td>
                <td className="num">
                  {l.productId ? `${l.gstRate}%` : (
                    <select aria-label={`GST rate of item ${i + 1}`} value={l.gstRate} onChange={(e) => setLine(i, { gstRate: Number(e.target.value) })} className="field w-20">
                      {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                    </select>
                  )}
                </td>
                <td className="num font-medium">{formatCurrencyINR(totals.lineTotals[i])}</td>
                <td className="num">
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
      <div className="grid grid-cols-2 gap-5 items-start">
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

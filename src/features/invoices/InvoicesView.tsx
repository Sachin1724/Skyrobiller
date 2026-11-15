import React, { useEffect, useState } from 'react';
import { toast } from '../../store/useToastStore';
import { friendlyError } from '../../lib/friendlyError';
import { Search, Play, Trash2, FileDown, FileText, Wrench, IndianRupee, Ban, Eye, Copy, Undo2, Printer, FilePlus, Trash, RotateCcw } from 'lucide-react';
import { formatCurrencyINR, formatDate, todayISO } from '../../lib/utils';
import { useNavStore, useMenuAction } from '../../store/useNavStore';
import { useSystemStore } from '../../store/useSystemStore';
import {
  listDrafts, listInvoices, listTrashedInvoices, trashInvoice, restoreInvoice, listCreditNotes, listDebitNotes, listPaymentsForInvoice, saveDraft, deleteDraft, cancelInvoice, newDraftId, outstandingOf, paymentStatusOf, daysOverdue,
  type Draft, type Invoice, type CreditNote, type DebitNote,
} from '../../lib/db';
import { invoiceDocument, creditNoteDocument, debitNoteDocument, documentHtml, buildLook, savePdf, printDocument, type PrintableDocument } from '../../lib/pdf';
import { Modal } from '../../components/Modal';
import { confirmDialog } from '../../components/ConfirmDialog';
import { RowMenu } from '../../components/RowMenu';
import { Reveal } from '../../components/Reveal';
import { SkeletonRows, EmptyState } from '../../components/Skeleton';
import { InvoiceEditor } from './InvoiceEditor';
import { CreditNoteModal } from './CreditNoteModal';
import { DebitNoteModal } from './DebitNoteModal';
import { CorrectInvoiceModal } from './CorrectInvoiceModal';
import { fetchStoreOrders, orderDocument, storeInvoiceNumber, paymentIdOf, type StoreOrder } from '../../lib/skyrostore';
import { PaymentModal } from '../payments/PaymentModal';

type Tab = 'issued' | 'drafts' | 'parked' | 'credits' | 'debits' | 'online' | 'trash';

// Quick filters on the issued list; each one is a plain rule on the invoice
const FILTERS = {
  all: { label: 'All', test: (_i: Invoice) => true },
  unpaid: { label: 'Unpaid', test: (i: Invoice) => outstandingOf(i) >= 0.01 },
  overdue: { label: 'Overdue', test: (i: Invoice) => outstandingOf(i) >= 0.01 && i.dueDate < todayISO() },
  paid: { label: 'Paid', test: (i: Invoice) => i.status === 'issued' && outstandingOf(i) < 0.01 },
  cancelled: { label: 'Cancelled', test: (i: Invoice) => i.status === 'cancelled' },
};
type FilterId = keyof typeof FILTERS;

export const InvoicesView: React.FC = () => {
  const { activeInvoiceDraftId, setActiveInvoiceDraftId, invoicesRequest, clearInvoicesRequest } = useNavStore();
  const company = useSystemStore((s) => s.company);
  const [tab, setTab] = useState<Tab>('issued');
  const [searchTerm, setSearchTerm] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [credits, setCredits] = useState<CreditNote[]>([]);
  const [debits, setDebits] = useState<DebitNote[]>([]);
  const [trashed, setTrashed] = useState<Invoice[]>([]);
  const [filter, setFilter] = useState<FilterId>('all');
  const [loaded, setLoaded] = useState(false);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [crediting, setCrediting] = useState<Invoice | null>(null);
  const [debiting, setDebiting] = useState<Invoice | null>(null);
  const [correcting, setCorrecting] = useState<Invoice | null>(null);
  const [preview, setPreview] = useState<{ doc: PrintableDocument; html: string; invoice?: Invoice } | null>(null);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<StoreOrder[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(false);

  const isEditorOpen = activeInvoiceDraftId !== null;

  const reload = () =>
    Promise.all([listDrafts('invoice'), listInvoices(), listCreditNotes(), listDebitNotes(), listTrashedInvoices()])
      .then(([d, i, c, dn, t]) => { setDrafts(d); setInvoices(i); setCredits(c); setDebits(dn); setTrashed(t); setLoaded(true); })
      .catch((e) => setError(friendlyError(e)));
  // Refresh when the editor closes and when the parked list closes (it can delete drafts)
  useEffect(() => { if (!isEditorOpen) reload(); }, [isEditorOpen]);

  // Online tab: the store does the matching (order no., email, name); debounced while typing
  useEffect(() => {
    if (tab !== 'online') return;
    setOrdersLoading(true);
    const t = setTimeout(() => fetchStoreOrders(searchTerm).then((o) => { setOrders(o); setError(''); }).catch((e) => setError(friendlyError(e))).finally(() => setOrdersLoading(false)), 300);
    return () => clearTimeout(t);
  }, [tab, searchTerm]);

  // Opened from the dashboard or the Parked command: jump to the requested tab and filter
  useEffect(() => {
    if (!invoicesRequest) return;
    if (invoicesRequest.tab) setTab(invoicesRequest.tab);
    setFilter(invoicesRequest.filter ?? 'all');
    clearInvoicesRequest();
  }, [invoicesRequest]);

  // File > Save As PDF and File > Print work on the invoice or credit note open in the viewer
  useMenuAction({
    'save-pdf': () => { if (!preview) return false; savePdf(preview.doc, company).catch((e) => setError(friendlyError(e))); },
    'print': () => { if (!preview) return false; printDocument(preview.doc, company).catch((e) => setError(friendlyError(e))); },
  });

  if (activeInvoiceDraftId !== null) {
    return (
      <Reveal key="editor" x={14} y={0}>
      <InvoiceEditor
        key={activeInvoiceDraftId}
        draftId={activeInvoiceDraftId}
        kind="invoice"
        onClose={(issuedNumber) => {
          if (issuedNumber) toast.success(`Issued as ${issuedNumber}.`);
          setTab(issuedNumber ? 'issued' : 'drafts');
          setActiveInvoiceDraftId(null);
        }}
      />
      </Reveal>
    );
  }

  const fail = (e: any) => setError(friendlyError(e));
  const run = (action: Promise<unknown>) => action.then(reload).catch(fail);

  const handleDeleteDraft = async (d: Draft) => {
    if (await confirmDialog({ title: `Delete draft ${d.draftId}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })) run(deleteDraft(d.draftId));
  };

  const handleCancel = async (inv: Invoice) => {
    if (await confirmDialog({
      title: `Cancel invoice ${inv.invoiceNumber}?`, details: [['Customer', inv.customer.businessName], ['Total', formatCurrencyINR(inv.total)]],
      message: 'The number stays used and the invoice is kept as cancelled. This cannot be undone.', confirmLabel: 'Cancel Invoice', cancelLabel: 'Keep Invoice', danger: true,
    })) run(cancelInvoice(inv.id));
  };

  // Hidden, not deleted: the number stays used and the invoice can be restored from the Recycle Bin
  const handleTrash = async (inv: Invoice) => {
    if (await confirmDialog({
      title: `Move ${inv.invoiceNumber} to the Recycle Bin?`, details: [['Customer', inv.customer.businessName], ['Total', formatCurrencyINR(inv.total)]],
      message: `The invoice${inv.paid > 0 ? ' and its payments are' : ' is'} hidden from lists, reports and GSTR-1. The number ${inv.invoiceNumber} stays used and is never reissued. You can restore it any time.`,
      confirmLabel: 'Move to Recycle Bin', danger: true,
    })) run(trashInvoice(inv.id).then(() => toast.info(`${inv.invoiceNumber} moved to the Recycle Bin.`)));
  };

  // "Start again": the editable copy is saved first, so a failure never leaves the user with neither bill
  const handleRestart = async (inv: Invoice) => {
    if (!(await confirmDialog({
      title: `Cancel ${inv.invoiceNumber} and start a new bill?`, details: [['Customer', inv.customer.businessName], ['Total', formatCurrencyINR(inv.total)]],
      message: 'The invoice is cancelled (its number stays used, shown as cancelled). A new draft with the same customer and items opens so you can fix it and issue it again.',
      confirmLabel: 'Cancel and Start New Bill', cancelLabel: 'Keep Invoice', danger: true,
    }))) return;
    const draftId = newDraftId('invoice');
    try {
      await saveDraft({ draftId, kind: 'invoice', isParked: false, customer: inv.customer, items: inv.items, total: inv.total, notes: inv.notes, validUntil: '', status: 'draft' });
      await cancelInvoice(inv.id);
      toast.info(`${inv.invoiceNumber} cancelled. Fix the new bill and issue it.`);
      setActiveInvoiceDraftId(draftId);
    } catch (e) {
      fail(e);
    }
  };

  // Same customer and lines in a fresh draft, for repeat orders
  const handleDuplicate = async (inv: Invoice) => {
    const draftId = newDraftId('invoice');
    try {
      await saveDraft({ draftId, kind: 'invoice', isParked: false, customer: inv.customer, items: inv.items, total: inv.total, notes: inv.notes, validUntil: '', status: 'draft' });
      setActiveInvoiceDraftId(draftId);
    } catch (e) {
      fail(e);
    }
  };

  const openPreview = (doc: PrintableDocument, invoice?: Invoice) =>
    buildLook(doc, company).then((look) => setPreview({ doc, html: documentHtml(doc, look), invoice })).catch(fail);

  const handlePreviewInvoice = async (inv: Invoice) => {
    try {
      const payments = await listPaymentsForInvoice(inv.id);
      openPreview(invoiceDocument(inv, payments), inv);
    } catch {
      openPreview(invoiceDocument(inv), inv);
    }
  };

  const handlePdfInvoice = async (inv: Invoice) => {
    try {
      const payments = await listPaymentsForInvoice(inv.id);
      await savePdf(invoiceDocument(inv, payments), company);
    } catch (e) {
      fail(e);
    }
  };

  const term = searchTerm.toLowerCase();
  const matches = (...values: (string | undefined)[]) => values.some((v) => v && v.toLowerCase().includes(term));
  const shownInvoices = invoices.filter((i) => FILTERS[filter].test(i) && matches(i.invoiceNumber, i.customer.businessName, i.customer.gstin, i.paymentReferences));
  const shownTrashed = trashed.filter((i) => matches(i.invoiceNumber, i.customer.businessName, i.customer.gstin, i.paymentReferences));
  const shownDrafts = drafts.filter((d) => matches(d.draftId, d.customer?.businessName ?? '', d.customer?.gstin ?? '') && (tab === 'parked') === d.isParked);
  const shownCredits = credits.filter((c) => matches(c.creditNumber, c.invoiceNumber, c.customer.businessName));
  const shownDebits = debits.filter((d) => matches(d.debitNumber, d.invoiceNumber, d.customer.businessName));

  return (
    <Reveal key="list">
    <div className="page">
      <div className="flex items-center justify-between gap-4">
        <div className="segmented" role="group" aria-label="Invoice list">
          <button aria-pressed={tab === 'issued'} onClick={() => setTab('issued')}>Issued</button>
          <button aria-pressed={tab === 'drafts'} onClick={() => setTab('drafts')}>Drafts ({drafts.filter((d) => !d.isParked).length})</button>
          <button aria-pressed={tab === 'parked'} onClick={() => setTab('parked')}>Parked ({drafts.filter((d) => d.isParked).length})</button>
          <button aria-pressed={tab === 'credits'} onClick={() => setTab('credits')}>Credit Notes ({credits.length})</button>
          <button aria-pressed={tab === 'debits'} onClick={() => setTab('debits')}>Debit Notes ({debits.length})</button>
          <button aria-pressed={tab === 'online'} onClick={() => setTab('online')}>Online Store</button>
          <button aria-pressed={tab === 'trash'} onClick={() => setTab('trash')}>Recycle Bin ({trashed.length})</button>
        </div>
        <div className="relative w-80">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-3 pointer-events-none" aria-hidden />
          <input
            type="search"
            aria-label="Search invoices"
            autoComplete="off"
            spellCheck={false}
            placeholder={tab === 'online' ? 'Search order #, customer or email…' : 'Search invoice #, transaction ID, customer or GSTIN…'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field pl-8"
          />
        </div>
      </div>

      {tab === 'issued' && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter invoices">
          {(Object.keys(FILTERS) as FilterId[]).map((id) => (
            <button key={id} aria-pressed={filter === id} onClick={() => setFilter(id)} className={`chip ${id === 'overdue' && invoices.some(FILTERS.overdue.test) ? 'chip-alert' : ''}`}>
              {FILTERS[id].label}
              <span className="tabular-nums opacity-70">{invoices.filter(FILTERS[id].test).length}</span>
            </button>
          ))}
        </div>
      )}
      {error && <p role="alert" className="error">{error}</p>}

      <div className="card overflow-hidden">
        {tab === 'issued' && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Due</th>
                <th>Customer</th>
                <th className="num">Total</th>
                <th className="num">Outstanding</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {!loaded && <SkeletonRows columns={8} />}
              {loaded && shownInvoices.length === 0 && (
                <tr><td colSpan={8}>
                  {searchTerm || filter !== 'all'
                    ? <p className="empty">No invoices match this search and filter.</p>
                    : <EmptyState icon={FileText} title="No invoices issued yet" hint="Pick a customer, search for parts, and the invoice fills itself in: HSN, GST and the next invoice number." action={{ label: 'Create Your First Invoice', onClick: () => setActiveInvoiceDraftId(newDraftId('invoice')) }} />}
                </td></tr>
              )}
              {shownInvoices.map((inv) => {
                const status = paymentStatusOf(inv);
                const due = outstandingOf(inv);
                const late = daysOverdue(inv);
                const n = inv.invoiceNumber;
                return (
                  <tr key={inv.id}>
                    <td className="font-medium tabular-nums whitespace-nowrap">{n}</td>
                    <td className="whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                    <td className="whitespace-nowrap">
                      {formatDate(inv.dueDate)}
                      {late > 0 && <div className="text-xs text-danger">{late} day{late > 1 ? 's' : ''} overdue</div>}
                    </td>
                    <td className="max-w-xs">
                      <div className="truncate">{inv.customer.businessName}</div>
                      <div className="text-xs text-ink-2 truncate">{inv.customer.gstin || 'Unregistered'}</div>
                    </td>
                    <td className="num">{formatCurrencyINR(inv.total)}</td>
                    <td className={`num ${late > 0 ? 'text-danger font-medium' : ''}`}>{formatCurrencyINR(due)}</td>
                    <td><span className={status.badge}>{status.label}</span></td>
                    <td className="num">
                      <button onClick={() => handlePreviewInvoice(inv)} className="btn btn-icon" aria-label={`View ${n}`} title="View">
                        <Eye className="h-4 w-4" aria-hidden />
                      </button>
                      <button onClick={() => handlePdfInvoice(inv)} className="btn btn-icon" aria-label={`Save PDF of ${n}`} title="Save PDF">
                        <FileDown className="h-4 w-4" aria-hidden />
                      </button>
                      <button onClick={() => setPaying(inv)} disabled={due < 0.01} className="btn btn-icon" aria-label={`Record payment for ${n}`} title="Record payment">
                        <IndianRupee className="h-4 w-4" aria-hidden />
                      </button>
                      <RowMenu
                        label={`More actions for ${n}`}
                        items={[
                          { label: 'Correct this invoice…', icon: Wrench, onClick: () => setCorrecting(inv), disabled: inv.status === 'cancelled' || inv.paid > 0 || inv.credited > 0 || inv.debited > 0, title: inv.paid > 0 || inv.credited > 0 || inv.debited > 0 ? 'Has payments or notes. Use a credit note, a debit note, or create a new bill' : 'Wrong customer, items or amount? Start here' },
                          { label: 'Reduce amount (credit note)', icon: Undo2, onClick: () => setCrediting(inv), disabled: inv.status === 'cancelled' || inv.credited >= inv.total + inv.debited - 0.005, title: 'Goods returned or a discount: the customer owes less' },
                          { label: 'Charge extra (debit note)', icon: FilePlus, onClick: () => setDebiting(inv), disabled: inv.status === 'cancelled', title: 'Forgot a charge or the price was too low: the customer owes more' },
                          { label: 'Create new from this', icon: Copy, onClick: () => handleDuplicate(inv), title: 'Starts a new draft with the same customer and items. This invoice stays as it is' },
                          { label: 'Move to Recycle Bin', icon: Trash, danger: true, onClick: () => handleTrash(inv), disabled: inv.credited > 0 || inv.debited > 0, title: inv.credited > 0 || inv.debited > 0 ? 'Has credit or debit notes' : 'Hide this invoice. You can restore it' },
                          {
                            label: 'Cancel this invoice', icon: Ban, danger: true, onClick: () => handleCancel(inv),
                            disabled: inv.status === 'cancelled' || inv.paid > 0 || inv.credited > 0 || inv.debited > 0,
                            title: inv.paid > 0 || inv.credited > 0 || inv.debited > 0 ? 'Invoices with payments, credit notes or debit notes cannot be cancelled' : undefined,
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {(tab === 'drafts' || tab === 'parked') && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Draft</th>
                <th>Last Saved</th>
                <th>Customer</th>
                <th className="num">Items</th>
                <th className="num">Total</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {!loaded && <SkeletonRows columns={6} />}
              {loaded && shownDrafts.length === 0 && (
                <tr><td colSpan={6} className="empty">{searchTerm ? 'No drafts match this search.' : tab === 'parked' ? 'Nothing parked. Park a bill from the editor (F9) to set it aside for a waiting customer.' : 'No drafts. A bill you start is saved here automatically until you issue it.'}</td></tr>
              )}
              {shownDrafts.map((d) => (
                <tr key={d.draftId}>
                  <td className="whitespace-nowrap">
                    <span className="font-medium tabular-nums">{d.draftId}</span>{' '}
                    {d.isParked && <span className="badge badge-warn">Parked</span>}
                  </td>
                  <td className="whitespace-nowrap">{formatDate(d.updatedAt)}</td>
                  <td className="max-w-xs"><div className="truncate">{d.customer?.businessName ?? 'No customer yet'}</div></td>
                  <td className="num">{d.items.length}</td>
                  <td className="num">{formatCurrencyINR(d.total)}</td>
                  <td className="num">
                    <RowMenu
                      label={`Actions for ${d.draftId}`}
                      items={[
                        { label: 'Resume draft', icon: Play, onClick: () => setActiveInvoiceDraftId(d.draftId) },
                        { label: 'Delete draft', icon: Trash2, danger: true, onClick: () => handleDeleteDraft(d) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'credits' && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Credit Note No.</th>
                <th>Date</th>
                <th>Against Invoice</th>
                <th>Customer</th>
                <th>Reason</th>
                <th className="num">Total</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {!loaded && <SkeletonRows columns={7} />}
              {loaded && shownCredits.length === 0 && (
                <tr><td colSpan={7} className="empty">{searchTerm ? 'No credit notes match this search.' : 'No credit notes. Issue one from an invoice in the Issued list.'}</td></tr>
              )}
              {shownCredits.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium tabular-nums whitespace-nowrap">{c.creditNumber}</td>
                  <td className="whitespace-nowrap">{formatDate(c.issueDate)}</td>
                  <td className="tabular-nums whitespace-nowrap">{c.invoiceNumber}</td>
                  <td className="max-w-[14rem]"><div className="truncate">{c.customer.businessName}</div></td>
                  <td className="max-w-[14rem]"><div className="truncate">{c.reason}</div></td>
                  <td className="num">{formatCurrencyINR(c.total)}</td>
                  <td className="num">
                    <RowMenu
                      label={`Actions for ${c.creditNumber}`}
                      items={[
                        { label: 'View', icon: Eye, onClick: () => openPreview(creditNoteDocument(c)) },
                        { label: 'Save PDF', icon: FileDown, onClick: () => savePdf(creditNoteDocument(c), company).catch(fail) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'debits' && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Debit Note No.</th>
                <th>Date</th>
                <th>Against Invoice</th>
                <th>Customer</th>
                <th>Reason</th>
                <th className="num">Total</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {!loaded && <SkeletonRows columns={7} />}
              {loaded && shownDebits.length === 0 && (
                <tr><td colSpan={7} className="empty">{searchTerm ? 'No debit notes match this search.' : 'No debit notes. Issue one from an invoice in the Issued list.'}</td></tr>
              )}
              {shownDebits.map((d) => (
                <tr key={d.id}>
                  <td className="font-medium tabular-nums whitespace-nowrap">{d.debitNumber}</td>
                  <td className="whitespace-nowrap">{formatDate(d.issueDate)}</td>
                  <td className="tabular-nums whitespace-nowrap">{d.invoiceNumber}</td>
                  <td className="max-w-[14rem]"><div className="truncate">{d.customer.businessName}</div></td>
                  <td className="max-w-[14rem]"><div className="truncate">{d.reason}</div></td>
                  <td className="num">{formatCurrencyINR(d.total)}</td>
                  <td className="num">
                    <RowMenu
                      label={`Actions for ${d.debitNumber}`}
                      items={[
                        { label: 'View', icon: Eye, onClick: () => openPreview(debitNoteDocument(d)) },
                        { label: 'Save PDF', icon: FileDown, onClick: () => savePdf(debitNoteDocument(d), company).catch(fail) },
                      ]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'trash' && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice No.</th><th>Date</th><th>Customer</th><th>Status</th><th>Deleted</th>
                <th className="num">Total</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {!loaded && <SkeletonRows columns={7} />}
              {loaded && shownTrashed.length === 0 && <tr><td colSpan={7} className="empty">{searchTerm ? 'No deleted invoices match this search.' : 'Recycle Bin is empty. Invoices you delete wait here and can be restored.'}</td></tr>}
              {shownTrashed.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-medium tabular-nums whitespace-nowrap">{inv.invoiceNumber}</td>
                  <td className="whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                  <td className="max-w-xs"><div className="truncate">{inv.customer.businessName}</div></td>
                  <td><span className={paymentStatusOf(inv).badge}>{paymentStatusOf(inv).label}</span></td>
                  <td className="whitespace-nowrap">{inv.deletedAt ? formatDate(inv.deletedAt) : ''}</td>
                  <td className="num">{formatCurrencyINR(inv.total)}</td>
                  <td className="num">
                    <button onClick={() => handlePreviewInvoice(inv)} className="btn btn-icon" aria-label={`View ${inv.invoiceNumber}`} title="View"><Eye className="h-4 w-4" aria-hidden /></button>
                    <button onClick={() => run(restoreInvoice(inv.id).then(() => toast.success(`${inv.invoiceNumber} restored.`)))} className="btn">
                      <RotateCcw className="h-4 w-4" aria-hidden />
                      Restore
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === 'online' && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice No.</th><th>Order</th><th>Date</th><th>Customer</th><th>Payment</th><th>Delivery</th>
                <th className="num">Total</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {ordersLoading && orders.length === 0 && <SkeletonRows columns={8} />}
              {!ordersLoading && orders.length === 0 && <tr><td colSpan={8} className="empty">{error ? 'Could not load online orders.' : 'No online orders found.'}</td></tr>}
              {orders.map((o) => {
                const doc = orderDocument(o, company);
                const payId = paymentIdOf(o);
                return (
                  <tr key={o.id}>
                    <td className="font-medium tabular-nums whitespace-nowrap">{storeInvoiceNumber(o)}</td>
                    <td className="tabular-nums">#{o.display_id}</td>
                    <td className="whitespace-nowrap">{formatDate(o.created_at)}</td>
                    <td className="max-w-xs">
                      <div className="truncate">{doc.customer.businessName}</div>
                      <div className="text-xs text-ink-2 truncate">{doc.customer.gstin || doc.customer.email}</div>
                    </td>
                    <td>
                      <span className="badge">{o.payment_status ?? '-'}</span>
                      {payId && <div className="text-xs text-ink-2 truncate">{payId}</div>}
                    </td>
                    <td><span className="badge">{o.fulfillment_status ?? '-'}</span></td>
                    <td className="num">{formatCurrencyINR(doc.totals.total)}</td>
                    <td className="num">
                      <button onClick={() => openPreview(doc)} className="btn btn-icon" aria-label={`View ${doc.number}`} title="View"><Eye className="h-4 w-4" aria-hidden /></button>
                      <button onClick={() => savePdf(doc, company).catch(fail)} className="btn btn-icon" aria-label={`Save PDF of ${doc.number}`} title="Save PDF"><FileDown className="h-4 w-4" aria-hidden /></button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {paying && <PaymentModal invoice={paying} onClose={(saved) => { setPaying(null); if (saved) reload(); }} />}
      {crediting && (
        <CreditNoteModal
          invoice={crediting}
          onClose={(saved) => { setCrediting(null); if (saved) { setTab('credits'); reload(); } }}
        />
      )}
      {correcting && (
        <CorrectInvoiceModal
          invoice={correcting}
          onClose={() => setCorrecting(null)}
          onChoose={(fix) => {
            const inv = correcting;
            setCorrecting(null);
            if (fix === 'reduce') setCrediting(inv); else if (fix === 'increase') setDebiting(inv); else handleRestart(inv);
          }}
        />
      )}
      {debiting && (
        <DebitNoteModal
          invoice={debiting}
          onClose={(saved) => { setDebiting(null); if (saved) { setTab('debits'); reload(); } }}
        />
      )}
      {preview && (
        <Modal wide title={`${preview.doc.title} · ${preview.doc.number}`} onClose={() => setPreview(null)}>
          <iframe title={`${preview.doc.title} ${preview.doc.number}`} sandbox="" srcDoc={preview.html} className="w-full h-[68vh] rounded border border-line bg-white" />
          <div className="flex justify-end pt-4">
            <button onClick={() => printDocument(preview.doc, company).catch(fail)} className="btn mr-2">
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </button>
            <button onClick={() => savePdf(preview.doc, company).catch(fail)} className="btn btn-primary">
              <FileDown className="h-4 w-4" aria-hidden />
              Save PDF
            </button>
          </div>
        </Modal>
      )}
    </div>
    </Reveal>
  );
};

import React, { useEffect, useState } from 'react';
import { Search, Play, Trash2, FileDown, IndianRupee, Ban, Eye, Copy, Undo2, Printer, Pencil } from 'lucide-react';
import { formatCurrencyINR, formatDate } from '../../lib/utils';
import { useNavStore, useMenuAction } from '../../store/useNavStore';
import { useSystemStore } from '../../store/useSystemStore';
import {
  listDrafts, listInvoices, listCreditNotes, saveDraft, deleteDraft, cancelInvoice, newDraftId, outstandingOf, paymentStatusOf,
  type Draft, type Invoice, type CreditNote,
} from '../../lib/db';
import { invoiceDocument, creditNoteDocument, documentHtml, buildLook, savePdf, printDocument, type PrintableDocument } from '../../lib/pdf';
import { Modal } from '../../components/Modal';
import { InvoiceEditor } from './InvoiceEditor';
import { CreditNoteModal } from './CreditNoteModal';
import { PaymentModal } from '../payments/PaymentModal';

type Tab = 'issued' | 'drafts' | 'credits';

export const InvoicesView: React.FC = () => {
  const { activeInvoiceDraftId, setActiveInvoiceDraftId, isParkedDrawerOpen } = useNavStore();
  const company = useSystemStore((s) => s.company);
  const [tab, setTab] = useState<Tab>('issued');
  const [searchTerm, setSearchTerm] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [credits, setCredits] = useState<CreditNote[]>([]);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [crediting, setCrediting] = useState<Invoice | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [preview, setPreview] = useState<{ doc: PrintableDocument; html: string; invoice?: Invoice } | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const isEditorOpen = activeInvoiceDraftId !== null || editingInvoice !== null;

  const reload = () =>
    Promise.all([listDrafts('invoice'), listInvoices(), listCreditNotes()])
      .then(([d, i, c]) => { setDrafts(d); setInvoices(i); setCredits(c); })
      .catch((e) => setError(e.message));
  // Refresh when the editor closes and when the parked list closes (it can delete drafts)
  useEffect(() => { if (!isEditorOpen) reload(); }, [isEditorOpen, isParkedDrawerOpen]);

  // File > Save As PDF and File > Print work on the invoice or credit note open in the viewer
  useMenuAction({
    'save-pdf': () => { if (!preview) return false; savePdf(preview.doc, company).catch((e) => setError(e.message)); },
    'print': () => { if (!preview) return false; printDocument(preview.doc, company).catch((e) => setError(e.message)); },
  });

  if (editingInvoice !== null) {
    return (
      <InvoiceEditor
        key={editingInvoice.id}
        draftId={editingInvoice.id}
        kind="invoice"
        existingInvoice={editingInvoice}
        onClose={(savedNum) => {
          setNotice(savedNum ? `Saved changes to invoice ${savedNum}.` : '');
          setEditingInvoice(null);
          reload();
        }}
      />
    );
  }

  if (activeInvoiceDraftId !== null) {
    return (
      <InvoiceEditor
        key={activeInvoiceDraftId}
        draftId={activeInvoiceDraftId}
        kind="invoice"
        onClose={(issuedNumber) => {
          setNotice(issuedNumber ? `Issued as ${issuedNumber}.` : '');
          setTab(issuedNumber ? 'issued' : 'drafts');
          setActiveInvoiceDraftId(null);
        }}
      />
    );
  }

  const fail = (e: any) => setError(e.message);
  const run = (action: Promise<unknown>) => action.then(reload).catch(fail);

  const handleDeleteDraft = (d: Draft) => {
    if (window.confirm(`Delete draft ${d.draftId}? This cannot be undone.`)) run(deleteDraft(d.draftId));
  };

  const handleCancel = (inv: Invoice) => {
    if (window.confirm(`Cancel invoice ${inv.invoiceNumber}? The number stays used and the invoice is kept as cancelled. This cannot be undone.`)) run(cancelInvoice(inv.id));
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

  const term = searchTerm.toLowerCase();
  const matches = (...values: string[]) => values.some((v) => v.toLowerCase().includes(term));
  const shownInvoices = invoices.filter((i) => matches(i.invoiceNumber, i.customer.businessName, i.customer.gstin));
  const shownDrafts = drafts.filter((d) => matches(d.draftId, d.customer?.businessName ?? '', d.customer?.gstin ?? ''));
  const shownCredits = credits.filter((c) => matches(c.creditNumber, c.invoiceNumber, c.customer.businessName));

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-4">
        <div className="segmented" role="group" aria-label="Invoice list">
          <button aria-pressed={tab === 'issued'} onClick={() => setTab('issued')}>Issued</button>
          <button aria-pressed={tab === 'drafts'} onClick={() => setTab('drafts')}>Drafts ({drafts.length})</button>
          <button aria-pressed={tab === 'credits'} onClick={() => setTab('credits')}>Credit Notes ({credits.length})</button>
        </div>
        <div className="relative w-80">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-3 pointer-events-none" aria-hidden />
          <input
            type="search"
            aria-label="Search invoices"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search number, customer or GSTIN…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field pl-8"
          />
        </div>
      </div>

      <p aria-live="polite" className="text-success font-medium empty:hidden">{notice}</p>
      {error && <p role="alert" className="error">{error}</p>}

      <div className="card overflow-hidden">
        {tab === 'issued' && (
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="num">Total</th>
                <th className="num">Outstanding</th>
                <th>Status</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {shownInvoices.length === 0 && (
                <tr><td colSpan={7} className="empty">{searchTerm ? 'No invoices match this search.' : 'No invoices issued yet. Use New Invoice to create one.'}</td></tr>
              )}
              {shownInvoices.map((inv) => {
                const status = paymentStatusOf(inv);
                const due = outstandingOf(inv);
                const n = inv.invoiceNumber;
                return (
                  <tr key={inv.id}>
                    <td className="font-medium tabular-nums whitespace-nowrap">{n}</td>
                    <td className="whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                    <td className="max-w-xs">
                      <div className="truncate">{inv.customer.businessName}</div>
                      <div className="text-xs text-ink-2 truncate">{inv.customer.gstin || 'Unregistered'}</div>
                    </td>
                    <td className="num font-medium">{formatCurrencyINR(inv.total)}</td>
                    <td className="num">{formatCurrencyINR(due)}</td>
                    <td><span className={status.badge}>{status.label}</span></td>
                    <td className="num">
                      <button onClick={() => openPreview(invoiceDocument(inv), inv)} className="btn btn-icon" aria-label={`View ${n}`} title="View">
                        <Eye className="h-4 w-4" aria-hidden />
                      </button>
                      <button onClick={() => setEditingInvoice(inv)} disabled={inv.status === 'cancelled'} className="btn btn-icon" aria-label={`Edit ${n}`} title={inv.status === 'cancelled' ? 'Cancelled invoices cannot be edited' : 'Edit invoice'}>
                        <Pencil className="h-4 w-4" aria-hidden />
                      </button>
                      <button onClick={() => savePdf(invoiceDocument(inv), company).catch(fail)} className="btn btn-icon" aria-label={`Save PDF of ${n}`} title="Save PDF">
                        <FileDown className="h-4 w-4" aria-hidden />
                      </button>
                      <button onClick={() => setPaying(inv)} disabled={due < 0.01} className="btn btn-icon" aria-label={`Record payment for ${n}`} title="Record payment">
                        <IndianRupee className="h-4 w-4" aria-hidden />
                      </button>
                      <button onClick={() => setCrediting(inv)} disabled={inv.status === 'cancelled' || inv.credited >= inv.total - 0.005} className="btn btn-icon" aria-label={`Issue credit note for ${n}`} title="Issue credit note">
                        <Undo2 className="h-4 w-4" aria-hidden />
                      </button>
                      <button onClick={() => handleDuplicate(inv)} className="btn btn-icon" aria-label={`Duplicate ${n} as a new draft`} title="Duplicate as new draft">
                        <Copy className="h-4 w-4" aria-hidden />
                      </button>
                      <button onClick={() => handleCancel(inv)} disabled={inv.status === 'cancelled' || inv.paid > 0 || inv.credited > 0} className="btn btn-icon btn-danger" aria-label={`Cancel ${n}`} title={inv.paid > 0 || inv.credited > 0 ? 'Invoices with payments or credit notes cannot be cancelled' : 'Cancel invoice'}>
                        <Ban className="h-4 w-4" aria-hidden />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {tab === 'drafts' && (
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
              {shownDrafts.length === 0 && (
                <tr><td colSpan={6} className="empty">{searchTerm ? 'No drafts match this search.' : 'No drafts.'}</td></tr>
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
                  <td className="num font-medium">{formatCurrencyINR(d.total)}</td>
                  <td className="num">
                    <button onClick={() => setActiveInvoiceDraftId(d.draftId)} className="btn btn-icon" aria-label={`Resume ${d.draftId}`} title="Resume">
                      <Play className="h-4 w-4" aria-hidden />
                    </button>
                    <button onClick={() => handleDeleteDraft(d)} className="btn btn-icon btn-danger" aria-label={`Delete ${d.draftId}`} title="Delete">
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
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
              {shownCredits.length === 0 && (
                <tr><td colSpan={7} className="empty">{searchTerm ? 'No credit notes match this search.' : 'No credit notes. Issue one from an invoice in the Issued list.'}</td></tr>
              )}
              {shownCredits.map((c) => (
                <tr key={c.id}>
                  <td className="font-medium tabular-nums whitespace-nowrap">{c.creditNumber}</td>
                  <td className="whitespace-nowrap">{formatDate(c.issueDate)}</td>
                  <td className="tabular-nums whitespace-nowrap">{c.invoiceNumber}</td>
                  <td className="max-w-[14rem]"><div className="truncate">{c.customer.businessName}</div></td>
                  <td className="max-w-[14rem]"><div className="truncate">{c.reason}</div></td>
                  <td className="num font-medium">{formatCurrencyINR(c.total)}</td>
                  <td className="num">
                    <button onClick={() => openPreview(creditNoteDocument(c))} className="btn btn-icon" aria-label={`View ${c.creditNumber}`} title="View">
                      <Eye className="h-4 w-4" aria-hidden />
                    </button>
                    <button onClick={() => savePdf(creditNoteDocument(c), company).catch(fail)} className="btn btn-icon" aria-label={`Save PDF of ${c.creditNumber}`} title="Save PDF">
                      <FileDown className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
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
      {preview && (
        <Modal wide title={`${preview.doc.title} · ${preview.doc.number}`} onClose={() => setPreview(null)}>
          <iframe title={`${preview.doc.title} ${preview.doc.number}`} sandbox="" srcDoc={preview.html} className="w-full h-[68vh] rounded-lg border border-line bg-white" />
          <div className="flex justify-end pt-4">
            {preview.invoice && preview.invoice.status !== 'cancelled' && (
              <button
                onClick={() => {
                  const inv = preview.invoice!;
                  setPreview(null);
                  setEditingInvoice(inv);
                }}
                className="btn mr-2"
              >
                <Pencil className="h-4 w-4" aria-hidden />
                Edit Invoice
              </button>
            )}
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
  );
};

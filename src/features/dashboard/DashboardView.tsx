import React, { useEffect, useState } from 'react';
import { FileText, FileCheck2, Printer, FileDown, ArrowRight } from 'lucide-react';
import { formatCurrencyINR, formatDate, todayISO } from '../../lib/utils';
import { useNavStore, useMenuAction } from '../../store/useNavStore';
import { useSystemStore } from '../../store/useSystemStore';
import { listInvoices, listDrafts, listPaymentsForInvoice, newDraftId, financialYearOf, outstandingOf, paymentStatusOf, type Invoice } from '../../lib/db';
import { invoiceDocument, documentHtml, buildLook, savePdf, printDocument, type PrintableDocument } from '../../lib/pdf';
import { Modal } from '../../components/Modal';

export const DashboardView: React.FC = () => {
  const { setCurrentModule, setActiveInvoiceDraftId } = useNavStore();
  const company = useSystemStore((s) => s.company);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [draftCount, setDraftCount] = useState(0);
  const [openQuotes, setOpenQuotes] = useState(0);
  const [preview, setPreview] = useState<{ doc: PrintableDocument; html: string; invoice: Invoice } | null>(null);
  const [error, setError] = useState('');
  const hiddenCards = useSystemStore((s) => s.prefs.hiddenCards);

  useEffect(() => {
    Promise.all([listInvoices(), listDrafts('invoice'), listDrafts('quotation')])
      .then(([inv, drafts, quotes]) => {
        setInvoices(inv);
        setDraftCount(drafts.length);
        setOpenQuotes(quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length);
      })
      .catch((e) => setError(e.message));
  }, []);

  useMenuAction({
    'save-pdf': () => { if (!preview) return false; savePdf(preview.doc, company).catch((e) => setError(e.message)); },
    'print': () => { if (!preview) return false; printDocument(preview.doc, company).catch((e) => setError(e.message)); },
  });

  const openPreview = async (inv: Invoice) => {
    try {
      const payments = await listPaymentsForInvoice(inv.id);
      const doc = invoiceDocument(inv, payments);
      const look = await buildLook(doc, company);
      setPreview({ doc, html: documentHtml(doc, look), invoice: inv });
    } catch (e: any) {
      setError(e.message);
    }
  };

  const today = todayISO();
  const live = invoices.filter((i) => i.status === 'issued');
  const sum = (list: Invoice[]) => list.reduce((s, i) => s + i.total, 0);
  const thisMonth = live.filter((i) => i.issueDate.slice(0, 7) === today.slice(0, 7));
  const thisYear = live.filter((i) => i.financialYear === financialYearOf(today));
  const outstanding = live.reduce((s, i) => s + outstandingOf(i), 0);

  const stats = [
    { key: 'month', label: 'Sales This Month', value: formatCurrencyINR(sum(thisMonth)), detail: `${thisMonth.length} invoices` },
    { key: 'year', label: `Sales FY ${financialYearOf(today)}`, value: formatCurrencyINR(sum(thisYear)), detail: `${thisYear.length} invoices` },
    { key: 'outstanding', label: 'Outstanding', value: formatCurrencyINR(outstanding), detail: `${live.filter((i) => outstandingOf(i) >= 0.01).length} unpaid invoices` },
    { key: 'progress', label: 'In Progress', value: String(draftCount + openQuotes), detail: `${draftCount} drafts · ${openQuotes} open quotations` },
  ].filter((s) => !hiddenCards.includes(s.key));

  const newInvoice = () => {
    setActiveInvoiceDraftId(newDraftId('invoice'));
    setCurrentModule('invoices');
  };

  return (
    <div className="page">
      {error && <p role="alert" className="error">{error}</p>}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 min-w-0">
            <div className="text-xs font-medium text-ink-2">{s.label}</div>
            <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums truncate">{s.value}</div>
            <div className="mt-0.5 text-xs text-ink-2">{s.detail}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button onClick={newInvoice} className="btn btn-primary">
          <FileText className="h-4 w-4" aria-hidden />
          New Invoice
        </button>
        <button onClick={() => setCurrentModule('quotations')} className="btn">
          <FileCheck2 className="h-4 w-4" aria-hidden />
          Quotations
        </button>
      </div>

      <section className="space-y-2">
        <h2 className="text-[15px] font-semibold tracking-tight">Recent Invoices</h2>
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Date</th>
                <th>Customer</th>
                <th className="num">Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && <tr><td colSpan={5} className="empty">No invoices issued yet. Start with New Invoice.</td></tr>}
              {invoices.slice(0, 8).map((inv) => {
                const status = paymentStatusOf(inv);
                return (
                  <tr
                    key={inv.id}
                    onClick={() => openPreview(inv)}
                    className="cursor-pointer hover:bg-surface-2 transition-colors"
                    title="Click to preview invoice"
                  >
                    <td className="font-medium tabular-nums whitespace-nowrap text-accent hover:underline">{inv.invoiceNumber}</td>
                    <td className="whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                    <td className="max-w-xs"><div className="truncate">{inv.customer?.businessName ?? 'Unknown Customer'}</div></td>
                    <td className="num font-medium">{formatCurrencyINR(inv.total)}</td>
                    <td><span className={status.badge}>{status.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {preview && (
        <Modal wide title={`${preview.doc.title} · ${preview.doc.number}`} onClose={() => setPreview(null)}>
          <iframe title={`${preview.doc.title} ${preview.doc.number}`} sandbox="" srcDoc={preview.html} className="w-full h-[68vh] rounded-lg border border-line bg-white" />
          <div className="flex justify-end pt-4">
            <button
              onClick={() => {
                setPreview(null);
                setCurrentModule('invoices');
              }}
              className="btn mr-2"
            >
              <ArrowRight className="h-4 w-4" aria-hidden />
              Open in Invoices
            </button>
            <button onClick={() => printDocument(preview.doc, company).catch((e) => setError(e.message))} className="btn mr-2">
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </button>
            <button onClick={() => savePdf(preview.doc, company).catch((e) => setError(e.message))} className="btn btn-primary">
              <FileDown className="h-4 w-4" aria-hidden />
              Save PDF
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

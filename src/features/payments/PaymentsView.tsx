import React, { useEffect, useState } from 'react';
import { Search, Eye, FileDown, Printer } from 'lucide-react';
import { friendlyError } from '../../lib/friendlyError';
import { formatCurrencyINR, formatDate, todayISO } from '../../lib/utils';
import { listInvoices, listPayments, listPaymentsForInvoice, outstandingOf, type Invoice, type Payment } from '../../lib/db';
import { invoiceDocument, documentHtml, buildLook, savePdf, printDocument, type PrintableDocument } from '../../lib/pdf';
import { Modal } from '../../components/Modal';
import { useSystemStore } from '../../store/useSystemStore';
import { useMenuAction } from '../../store/useNavStore';
import { PaymentModal } from './PaymentModal';

export const PaymentsView: React.FC = () => {
  const company = useSystemStore((s) => s.company);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [preview, setPreview] = useState<{ doc: PrintableDocument; html: string; invoice: Invoice } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState('');

  const reload = () =>
    Promise.all([listInvoices(), listPayments()])
      .then(([i, p]) => { setInvoices(i); setPayments(p); })
      .catch((e) => setError(friendlyError(e)));
  useEffect(() => { reload(); }, []);

  useMenuAction({
    'save-pdf': () => { if (!preview) return false; savePdf(preview.doc, company).catch((e) => setError(friendlyError(e))); },
    'print': () => { if (!preview) return false; printDocument(preview.doc, company).catch((e) => setError(friendlyError(e))); },
  });

  const openInvoicePreview = async (inv: Invoice) => {
    try {
      const payments = await listPaymentsForInvoice(inv.id);
      const doc = invoiceDocument(inv, payments);
      const look = await buildLook(doc, company);
      setPreview({ doc, html: documentHtml(doc, look), invoice: inv });
    } catch (e: any) {
      setError(friendlyError(e));
    }
  };

  const openPaymentInvoicePreview = (payment: Payment) => {
    const inv = invoices.find((i) => i.id === payment.invoiceId || i.invoiceNumber === payment.invoiceNumber);
    if (inv) openInvoicePreview(inv);
  };

  const term = searchTerm.toLowerCase();
  const matches = (...values: (string | undefined)[]) => values.some((v) => v && v.toLowerCase().includes(term));
  const unpaid = invoices.filter((i) => outstandingOf(i) >= 0.01).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const filteredUnpaid = unpaid.filter((i) => matches(i.invoiceNumber, i.customer.businessName, i.customer.gstin, i.paymentReferences));
  const filteredPayments = payments.filter((p) => matches(p.invoiceNumber, p.customerName, p.method, p.reference));
  const today = todayISO();

  return (
    <div className="page">
      {error && <p role="alert" className="error">{error}</p>}

      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold tracking-tight">Payments &amp; Collections</h1>
        <div className="relative w-80">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-3 pointer-events-none" aria-hidden />
          <input
            type="search"
            aria-label="Search payments"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search transaction ID, invoice #, customer…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field pl-8"
          />
        </div>
      </div>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight">
          Outstanding · <span className="tabular-nums">{formatCurrencyINR(unpaid.reduce((sum, i) => sum + outstandingOf(i), 0))}</span>
        </h2>
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Customer</th>
                <th>Due</th>
                <th className="num">Total</th>
                <th className="num">Received</th>
                <th className="num">Outstanding</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredUnpaid.length === 0 && <tr><td colSpan={7} className="empty">{searchTerm ? 'No outstanding invoices match this search.' : 'Nothing outstanding.'}</td></tr>}
              {filteredUnpaid.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-medium tabular-nums whitespace-nowrap text-accent hover:underline cursor-pointer" onClick={() => openInvoicePreview(inv)} title="Click to view invoice">{inv.invoiceNumber}</td>
                  <td className="max-w-xs"><div className="truncate">{inv.customer.businessName}</div></td>
                  <td className="whitespace-nowrap">
                    {formatDate(inv.dueDate)} {inv.dueDate < today && <span className="badge badge-danger">Overdue</span>}
                  </td>
                  <td className="num">{formatCurrencyINR(inv.total)}</td>
                  <td className="num">{formatCurrencyINR(inv.paid)}</td>
                  <td className="num">{formatCurrencyINR(outstandingOf(inv))}</td>
                  <td className="num">
                    <button onClick={() => setPaying(inv)} className="btn">Record Payment</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight">Payments Received</h2>
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice No.</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Reference</th>
                <th className="num">Amount</th>
                <th className="w-12 text-center"><span className="sr-only">Receipt</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredPayments.length === 0 && <tr><td colSpan={7} className="empty">{searchTerm ? 'No payments match this search.' : 'No payments recorded yet.'}</td></tr>}
              {filteredPayments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{formatDate(p.paidOn)}</td>
                  <td className="tabular-nums whitespace-nowrap font-medium text-accent hover:underline cursor-pointer" onClick={() => openPaymentInvoicePreview(p)} title="Click to view invoice">{p.invoiceNumber}</td>
                  <td className="max-w-xs"><div className="truncate">{p.customerName}</div></td>
                  <td><span className="badge">{p.method}</span></td>
                  <td className="max-w-[12rem] font-mono text-xs"><div className="truncate" title={p.reference}>{p.reference || '—'}</div></td>
                  <td className="num font-semibold">{formatCurrencyINR(p.amount)}</td>
                  <td className="w-12 text-center">
                    <button onClick={() => openPaymentInvoicePreview(p)} className="btn btn-icon" aria-label={`View paid invoice ${p.invoiceNumber}`} title="View Paid Invoice / Receipt">
                      <Eye className="h-4 w-4" aria-hidden />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {paying && <PaymentModal invoice={paying} onClose={(saved) => { setPaying(null); if (saved) reload(); }} />}

      {preview && (
        <Modal wide title={`${preview.doc.title} · ${preview.doc.number}`} onClose={() => setPreview(null)}>
          <iframe title={`${preview.doc.title} ${preview.doc.number}`} sandbox="" srcDoc={preview.html} className="w-full h-[68vh] rounded border border-line bg-white" />
          <div className="flex justify-end pt-4">
            <button onClick={() => printDocument(preview.doc, company).catch((e) => setError(friendlyError(e)))} className="btn mr-2">
              <Printer className="h-4 w-4 mr-1.5" aria-hidden />
              Print
            </button>
            <button onClick={() => savePdf(preview.doc, company).catch((e) => setError(friendlyError(e)))} className="btn btn-primary">
              <FileDown className="h-4 w-4 mr-1.5" aria-hidden />
              Save PDF
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

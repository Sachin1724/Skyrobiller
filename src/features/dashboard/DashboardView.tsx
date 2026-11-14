import React, { useEffect, useState } from 'react';
import { friendlyError } from '../../lib/friendlyError';
import { FileText, FileCheck2, Printer, FileDown, ArrowRight, CheckCircle2, Circle, CalendarDays, TrendingUp, Wallet, PenLine } from 'lucide-react';
import { formatCurrencyINR, formatDate, todayISO } from '../../lib/utils';
import { useNavStore, useMenuAction, type AppModule } from '../../store/useNavStore';
import { useSystemStore } from '../../store/useSystemStore';
import { listInvoices, listDrafts, getSetupCounts, getSetting, setSetting, newDraftId, financialYearOf, outstandingOf, paymentStatusOf, type Invoice } from '../../lib/db';
import { invoiceDocument, documentHtml, buildLook, savePdf, printDocument, type PrintableDocument } from '../../lib/pdf';
import { Modal } from '../../components/Modal';
import { SkeletonRows, EmptyState } from '../../components/Skeleton';

export const DashboardView: React.FC = () => {
  const { setCurrentModule, setActiveInvoiceDraftId } = useNavStore();
  const company = useSystemStore((s) => s.company);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [draftCount, setDraftCount] = useState(0);
  const [openQuotes, setOpenQuotes] = useState(0);
  const [preview, setPreview] = useState<{ doc: PrintableDocument; html: string; invoice: Invoice } | null>(null);
  const [error, setError] = useState('');
  const hiddenCards = useSystemStore((s) => s.prefs.hiddenCards);
  const backup = useSystemStore((s) => s.backup);
  const [setup, setSetup] = useState<{ company: boolean; products: number; customers: number; invoices: number; dismissed: boolean } | null>(null);

  useEffect(() => {
    Promise.all([getSetupCounts(), getSetting('company'), getSetting<boolean>('setupDismissed')])
      .then(([counts, savedCompany, dismissed]) => setSetup({ ...counts, company: savedCompany !== null, dismissed: !!dismissed }))
      .catch(() => setSetup(null)); // the checklist is a nicety: never block the dashboard
  }, []);

  // First-run checklist: each step opens the screen that completes it
  const steps: { label: string; done: boolean; go: AppModule }[] = setup ? [
    { label: 'Save your company profile', done: setup.company, go: 'settings' },
    { label: 'Add your logo', done: !!company.logo, go: 'settings' },
    { label: 'Add your first product', done: setup.products > 0, go: 'products' },
    { label: 'Add your first customer', done: setup.customers > 0, go: 'customers' },
    { label: 'Issue your first invoice', done: setup.invoices > 0, go: 'invoices' },
    { label: 'Choose a backup folder', done: !!backup?.folder, go: 'settings' },
  ] : [];
  const stepsDone = steps.filter((x) => x.done).length;
  const showChecklist = setup && !setup.dismissed && stepsDone < steps.length;

  useEffect(() => {
    Promise.all([listInvoices(), listDrafts('invoice'), listDrafts('quotation')])
      .then(([inv, drafts, quotes]) => {
        setInvoices(inv);
        setLoaded(true);
        setDraftCount(drafts.length);
        setOpenQuotes(quotes.filter((q) => q.status === 'draft' || q.status === 'sent').length);
      })
      .catch((e) => setError(friendlyError(e)));
  }, []);

  useMenuAction({
    'save-pdf': () => { if (!preview) return false; savePdf(preview.doc, company).catch((e) => setError(friendlyError(e))); },
    'print': () => { if (!preview) return false; printDocument(preview.doc, company).catch((e) => setError(friendlyError(e))); },
  });

  const openPreview = (doc: PrintableDocument, invoice: Invoice) => {
    buildLook(doc, company)
      .then((look) => setPreview({ doc, html: documentHtml(doc, look), invoice }))
      .catch((e) => setError(friendlyError(e)));
  };

  const today = todayISO();
  const live = invoices.filter((i) => i.status === 'issued');
  const sum = (list: Invoice[]) => list.reduce((s, i) => s + i.total, 0);
  const thisMonth = live.filter((i) => i.issueDate.slice(0, 7) === today.slice(0, 7));
  const thisYear = live.filter((i) => i.financialYear === financialYearOf(today));
  const outstanding = live.reduce((s, i) => s + outstandingOf(i), 0);

  const stats = [
    { key: 'month', icon: CalendarDays, label: 'Sales This Month', value: formatCurrencyINR(sum(thisMonth)), detail: `${thisMonth.length} invoices` },
    { key: 'year', icon: TrendingUp, label: `Sales FY ${financialYearOf(today)}`, value: formatCurrencyINR(sum(thisYear)), detail: `${thisYear.length} invoices` },
    { key: 'outstanding', icon: Wallet, label: 'Outstanding', value: formatCurrencyINR(outstanding), detail: `${live.filter((i) => outstandingOf(i) >= 0.01).length} unpaid invoices` },
    { key: 'progress', icon: PenLine, label: 'In Progress', value: String(draftCount + openQuotes), detail: `${draftCount} drafts · ${openQuotes} open quotations` },
  ].filter((s) => !hiddenCards.includes(s.key));

  const newInvoice = () => {
    setActiveInvoiceDraftId(newDraftId('invoice'));
    setCurrentModule('invoices');
  };

  return (
    <div className="page">
      {error && <p role="alert" className="error">{error}</p>}

      {showChecklist && (
        <section data-reveal className="card p-4" aria-label="Setup checklist">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-semibold tracking-tight">Get set up</h2>
              <p className="text-xs text-ink-2">{stepsDone} of {steps.length} done. Each step opens the screen that finishes it.</p>
            </div>
            <button onClick={() => { setSetting('setupDismissed', true).catch(() => undefined); setSetup((x) => x && { ...x, dismissed: true }); }} className="btn btn-plain">Hide</button>
          </div>
          <div className="mt-3 h-1.5 rounded-full bg-ink/10" role="progressbar" aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={stepsDone}>
            <div className="h-full rounded-full bg-accent transition-[width] duration-300" style={{ width: `${(stepsDone / steps.length) * 100}%` }} />
          </div>
          <ul className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6">
            {steps.map((step) => (
              <li key={step.label}>
                <button onClick={() => setCurrentModule(step.go)} disabled={step.done} className="flex w-full items-center gap-3 h-9 text-left disabled:cursor-default hover:text-accent disabled:hover:text-ink">
                  {step.done ? <CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden /> : <Circle className="h-4 w-4 text-ink-3 shrink-0" aria-hidden />}
                  <span className={step.done ? 'text-ink-2 line-through' : 'font-medium'}>{step.label}</span>
                  {!step.done && <ArrowRight className="h-3.5 w-3.5 ml-auto" aria-hidden />}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <div key={s.label} data-reveal className="card p-4 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-ink-2">{s.label}</div>
              <span className="grid h-7 w-7 place-items-center rounded bg-accent/10 text-accent"><s.icon className="h-3.5 w-3.5" aria-hidden /></span>
            </div>
            {loaded ? (
              <>
                <div className="mt-2 text-lg font-semibold tracking-tight tabular-nums truncate">{s.value}</div>
                <div className="mt-0.5 text-xs text-ink-2">{s.detail}</div>
              </>
            ) : (
              <div aria-hidden className="mt-3 space-y-2"><div className="skeleton h-6 w-3/4" /><div className="skeleton h-3 w-1/2" /></div>
            )}
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

      <section data-reveal className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight">Recent Invoices</h2>
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
              {!loaded && <SkeletonRows columns={5} />}
              {loaded && invoices.length === 0 && (
                <tr><td colSpan={5}><EmptyState icon={FileText} title="No invoices yet" hint="Your latest invoices will appear here." action={{ label: 'New Invoice', onClick: newInvoice }} /></td></tr>
              )}
              {invoices.slice(0, 8).map((inv) => {
                const status = paymentStatusOf(inv);
                return (
                  <tr
                    key={inv.id}
                    onClick={() => openPreview(invoiceDocument(inv), inv)}
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
          <iframe title={`${preview.doc.title} ${preview.doc.number}`} sandbox="" srcDoc={preview.html} className="w-full h-[68vh] rounded border border-line bg-white" />
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
            <button onClick={() => printDocument(preview.doc, company).catch((e) => setError(friendlyError(e)))} className="btn mr-2">
              <Printer className="h-4 w-4" aria-hidden />
              Print
            </button>
            <button onClick={() => savePdf(preview.doc, company).catch((e) => setError(friendlyError(e)))} className="btn btn-primary">
              <FileDown className="h-4 w-4" aria-hidden />
              Save PDF
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

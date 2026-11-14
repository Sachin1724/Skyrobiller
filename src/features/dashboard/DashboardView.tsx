import React, { useEffect, useState } from 'react';
import { friendlyError } from '../../lib/friendlyError';
import { FileText, Printer, FileDown, ArrowRight, CheckCircle2, CalendarDays, TrendingUp, Wallet, CalendarClock, AlertTriangle, FilePen, PauseCircle, ImageOff, DatabaseBackup, ShieldCheck, ClipboardList } from 'lucide-react';
import { formatCurrencyINR, formatDate, todayISO, addDaysISO } from '../../lib/utils';
import { useNavStore, useMenuAction, type AppModule } from '../../store/useNavStore';
import { useSystemStore } from '../../store/useSystemStore';
import { listInvoices, listDrafts, getSetupCounts, getSetting, setSetting, newDraftId, financialYearOf, outstandingOf, paymentStatusOf, daysOverdue, type Invoice, type Draft } from '../../lib/db';
import { invoiceDocument, documentHtml, buildLook, savePdf, printDocument, type PrintableDocument } from '../../lib/pdf';
import { Modal } from '../../components/Modal';
import { SkeletonRows, EmptyState } from '../../components/Skeleton';
import { ProgressRing, ProfileDialog } from '../../components/ProfileDialog';
import { profileItems, profileScore, type ProfileItem } from '../../lib/profile';

export const DashboardView: React.FC = () => {
  const { setCurrentModule, setActiveInvoiceDraftId, openInvoices, openSettings } = useNavStore();
  const company = useSystemStore((s) => s.company);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [drafts, setDrafts] = useState<Draft[]>([]);
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

  // Live clock for the greeting: minute precision is enough, so it ticks every 15 seconds
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(t); }, []);
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const dateText = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const timeText = now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', hour12: true });

  // The profile ring: company details plus the first steps, in one list
  const [profileOpen, setProfileOpen] = useState(false);
  const items = setup ? profileItems({ company, savedCompany: setup.company, products: setup.products, customers: setup.customers, invoices: setup.invoices, backupFolder: !!backup?.folder }) : [];
  const score = profileScore(items.length ? items : [{ done: false } as ProfileItem]);
  const toGo = items.filter((i) => !i.done).length;
  const goTo = (item: ProfileItem) => {
    setProfileOpen(false);
    if (item.go.module === 'settings' && item.go.section) openSettings(item.go.section); else setCurrentModule(item.go.module);
  };

  useEffect(() => {
    Promise.all([listInvoices(), listDrafts('invoice'), listDrafts('quotation')])
      .then(([inv, drafts, quotes]) => {
        setInvoices(inv);
        setLoaded(true);
        setDrafts(drafts);
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
  const owed = (list: Invoice[]) => list.reduce((s, i) => s + outstandingOf(i), 0);
  const thisMonth = live.filter((i) => i.issueDate.slice(0, 7) === today.slice(0, 7));
  const thisYear = live.filter((i) => i.financialYear === financialYearOf(today));
  const open = live.filter((i) => outstandingOf(i) >= 0.01);
  const overdue = open.filter((i) => i.dueDate < today);
  const oldest = overdue.reduce((m, i) => Math.max(m, daysOverdue(i)), 0);
  const dueSoon = open.filter((i) => i.dueDate >= today && i.dueDate <= addDaysISO(today, 7));

  const stats = [
    { key: 'month', icon: CalendarDays, label: 'Sales This Month', value: formatCurrencyINR(sum(thisMonth)), detail: `${thisMonth.length} invoices`, go: () => openInvoices({}) },
    { key: 'year', icon: TrendingUp, label: `Sales FY ${financialYearOf(today)}`, value: formatCurrencyINR(sum(thisYear)), detail: `${thisYear.length} invoices`, go: () => openInvoices({}) },
    {
      key: 'outstanding', icon: Wallet, label: 'Outstanding', value: formatCurrencyINR(owed(live)), tone: open.length ? 'warn' : '',
      detail: overdue.length ? `${overdue.length} overdue · oldest ${oldest} day${oldest > 1 ? 's' : ''}` : `${open.length} unpaid invoices`, go: () => openInvoices({ filter: 'unpaid' }),
    },
    { key: 'due', icon: CalendarClock, label: 'Due This Week', value: formatCurrencyINR(owed(dueSoon)), detail: `${dueSoon.length} invoice${dueSoon.length === 1 ? '' : 's'} due in 7 days`, go: () => openInvoices({ filter: 'unpaid' }) },
  ].filter((s) => !hiddenCards.includes(s.key));

  const newInvoice = () => {
    setActiveInvoiceDraftId(newDraftId('invoice'));
    setCurrentModule('invoices');
  };

  // Things that need doing, most urgent first
  const backupStale = !!backup && (!!backup.lastError || !backup.lastAt || Date.now() - backup.lastAt > 3 * 24 * 60 * 60 * 1000);
  const liveDrafts = drafts.filter((d) => !d.isParked).length;
  const parked = drafts.filter((d) => d.isParked).length;
  const attention: { id: string; icon: React.ComponentType<{ className?: string }>; tone: 'danger' | 'warn' | 'info'; text: string; action: string; run: () => void }[] = [
    ...(overdue.length ? [{ id: 'overdue', icon: AlertTriangle, tone: 'danger' as const, text: `${overdue.length} overdue invoice${overdue.length > 1 ? 's' : ''}, ${formatCurrencyINR(owed(overdue))}`, action: 'View', run: () => openInvoices({ filter: 'overdue' }) }] : []),
    ...(liveDrafts ? [{ id: 'drafts', icon: FilePen, tone: 'warn' as const, text: `${liveDrafts} draft${liveDrafts > 1 ? 's' : ''} not issued`, action: 'Open', run: () => openInvoices({ tab: 'drafts' }) }] : []),
    ...(parked ? [{ id: 'parked', icon: PauseCircle, tone: 'info' as const, text: `${parked} parked invoice${parked > 1 ? 's' : ''} waiting`, action: 'Open', run: () => openInvoices({ tab: 'parked' }) }] : []),
    ...(openQuotes ? [{ id: 'quotes', icon: ClipboardList, tone: 'info' as const, text: `${openQuotes} open quotation${openQuotes > 1 ? 's' : ''}`, action: 'Open', run: () => setCurrentModule('quotations') }] : []),
    ...(backupStale ? [{ id: 'backup', icon: DatabaseBackup, tone: 'warn' as const, text: backup?.lastAt ? 'The last backup is more than 3 days old' : 'No backup has been taken yet', action: 'Fix', run: () => setCurrentModule('settings') }] : []),
    ...(!company.logo ? [{ id: 'logo', icon: ImageOff, tone: 'info' as const, text: 'Logo not uploaded', action: 'Add', run: () => setCurrentModule('settings') }] : []),
    ...((company.gstin === '21AAACS1234D1Z5' || company.gstin === '21AAACS1234D1Z8') ? [{ id: 'profile', icon: ShieldCheck, tone: 'warn' as const, text: 'Company profile still has sample details', action: 'Edit', run: () => setCurrentModule('settings') }] : []),
  ];
  const TONE = { danger: 'text-danger bg-danger/10', warn: 'text-warn bg-warn/10', info: 'text-accent bg-accent/10' };

  return (
    <div className="page">
      {error && <p role="alert" className="error">{error}</p>}

      {/* Greeting with today's date and time, and the profile score */}
      <header data-reveal className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold tracking-tight truncate">{greeting}, {company.tradeName}</h2>
          <p className="text-sm text-ink-2 tabular-nums">{dateText} · {timeText}</p>
        </div>
        {setup && (
          <button
            onClick={() => setProfileOpen(true)}
            aria-label={`Profile ${score}% complete. See what is missing`}
            className="flex shrink-0 items-center gap-3 rounded-md border border-line bg-surface py-2 pl-4 pr-3 text-left hover:border-ink/30 transition-colors"
          >
            <span>
              <span className="block text-xs text-ink-2">Profile</span>
              <span className="block text-sm font-medium">{toGo === 0 ? 'All set' : `${toGo} to complete`}</span>
            </span>
            <ProgressRing pct={score} size={44} />
          </button>
        )}
      </header>
      {profileOpen && <ProfileDialog items={items} onGo={goTo} onClose={() => setProfileOpen(false)} />}

      {/* Each figure opens the list behind it */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map((s) => (
          <button key={s.label} data-reveal onClick={s.go} className="card p-4 min-w-0 text-left hover:border-ink/30 transition-colors" aria-label={`${s.label}: open the list`}>
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-medium text-ink-2">{s.label}</div>
              <span className="grid h-7 w-7 place-items-center rounded bg-accent/10 text-accent"><s.icon className="h-3.5 w-3.5" aria-hidden /></span>
            </div>
            {loaded ? (
              <>
                <div className={`mt-2 text-lg font-semibold tracking-tight tabular-nums truncate ${'tone' in s && s.tone === 'warn' ? 'text-warn' : ''}`}>{s.value}</div>
                <div className={`mt-0.5 text-xs ${s.key === 'outstanding' && overdue.length ? 'text-danger' : 'text-ink-2'}`}>{s.detail}</div>
              </>
            ) : (
              <div aria-hidden className="mt-3 space-y-2"><div className="skeleton h-6 w-3/4" /><div className="skeleton h-3 w-1/2" /></div>
            )}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_20rem] gap-4 items-start">
        <section data-reveal className="space-y-2 min-w-0">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold tracking-tight">Recent Invoices</h2>
            <button onClick={() => openInvoices({})} className="text-xs text-accent hover:underline">View all</button>
          </div>
          <div className="card overflow-hidden">
            <table className="tbl">
              <thead>
                <tr>
                  <th>Invoice No.</th>
                  <th>Customer</th>
                  <th>Due</th>
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
                  const late = daysOverdue(inv);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => openPreview(invoiceDocument(inv), inv)}
                      className="cursor-pointer"
                      title="Click to preview invoice"
                    >
                      <td className="font-medium tabular-nums whitespace-nowrap text-accent hover:underline">{inv.invoiceNumber}</td>
                      <td className="max-w-xs"><div className="truncate">{inv.customer?.businessName ?? 'Unknown Customer'}</div></td>
                      <td className="whitespace-nowrap">{formatDate(inv.dueDate)}</td>
                      <td className="num">{formatCurrencyINR(inv.total)}</td>
                      <td className="whitespace-nowrap">
                        <span className={status.badge}>{status.label}</span>
                        {late > 0 && <span className="ml-2 text-xs text-danger">{late}d</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section data-reveal className="space-y-2" aria-label="Needs attention">
          <h2 className="text-base font-semibold tracking-tight">Needs Attention</h2>
          <div className="card divide-y divide-line">
            {!loaded && <div aria-hidden className="p-4 space-y-2"><div className="skeleton h-4 w-3/4" /><div className="skeleton h-4 w-1/2" /></div>}
            {loaded && attention.length === 0 && (
              <div className="flex items-center gap-3 p-4 text-ink-2"><CheckCircle2 className="h-4 w-4 text-success shrink-0" aria-hidden />All clear. Nothing needs your attention.</div>
            )}
            {attention.map((a) => (
              <div key={a.id} className="flex items-center gap-3 p-3">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded ${TONE[a.tone]}`}><a.icon className="h-3.5 w-3.5" aria-hidden /></span>
                <span className="flex-1 min-w-0 text-sm">{a.text}</span>
                <button onClick={a.run} className="btn h-7 px-2 text-xs">{a.action}</button>
              </div>
            ))}
          </div>
        </section>
      </div>

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

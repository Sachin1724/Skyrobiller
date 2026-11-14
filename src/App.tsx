import React, { useCallback, useEffect, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { HeaderBar } from './components/layout/HeaderBar';
import { ParkedInvoicesDrawer } from './components/layout/ParkedInvoicesDrawer';
import { useNavStore, runFlushOpenWork, type AppModule } from './store/useNavStore';
import { useSystemStore } from './store/useSystemStore';
import { newDraftId, getSetting } from './lib/db';
import { StatusBar } from './components/layout/StatusBar';
import { CommandPalette, type Command } from './components/CommandPalette';
import { AppLoader } from './components/AppLoader';
import { ConfirmHost } from './components/ConfirmSheet';
import { Reveal } from './components/Reveal';
import { Tour } from './components/Tour';

// Views
import { DashboardView } from './features/dashboard/DashboardView';
import { InvoicesView } from './features/invoices/InvoicesView';
import { QuotationsView } from './features/quotations/QuotationsView';
import { ProductsView } from './features/products/ProductsView';
import { CustomersView } from './features/customers/CustomersView';
import { PaymentsView } from './features/payments/PaymentsView';
import { ReportsView } from './features/reports/ReportsView';
import { SettingsView } from './features/settings/SettingsView';
import { HelpView } from './features/help/HelpView';

// Menu commands that belong to one screen: go there first, then the screen carries the command out
const COMMAND_SCREEN: Record<string, AppModule> = {
  'new-quotation': 'quotations', 'new-customer': 'customers', 'new-product': 'products',
  'import-products': 'products', 'import-customers': 'customers',
  'export-sheet': 'reports', 'export-workbook': 'reports',
  'backup': 'settings', 'restore': 'settings', 'invoice-design': 'settings', 'customize': 'settings',
  'shortcuts': 'help',
};

const PALETTE_COMMANDS: Command[] = [
  { id: 'nav:dashboard', label: 'Go to Dashboard', hint: 'Ctrl+1' },
  { id: 'nav:invoices', label: 'Go to Invoices', hint: 'Ctrl+2' },
  { id: 'nav:quotations', label: 'Go to Quotations', hint: 'Ctrl+3' },
  { id: 'nav:payments', label: 'Go to Payments', hint: 'Ctrl+4', keywords: 'receivables ageing outstanding' },
  { id: 'nav:products', label: 'Go to Products', hint: 'Ctrl+5', keywords: 'catalogue stock' },
  { id: 'nav:customers', label: 'Go to Customers', hint: 'Ctrl+6' },
  { id: 'nav:reports', label: 'Go to Reports', hint: 'Ctrl+7', keywords: 'gst gstr audit' },
  { id: 'nav:settings', label: 'Go to Settings', hint: 'Ctrl+8', keywords: 'company backup template' },
  { id: 'nav:help', label: 'Go to Help', hint: 'F1' },
  { id: 'new-invoice', label: 'New invoice', hint: 'Ctrl+N', keywords: 'bill create' },
  { id: 'new-quotation', label: 'New quotation', hint: 'Ctrl+Shift+N', keywords: 'estimate' },
  { id: 'new-customer', label: 'Add customer' },
  { id: 'new-product', label: 'Add product' },
  { id: 'parked', label: 'Show parked invoices', hint: 'Ctrl+Shift+P' },
  { id: 'backup-now', label: 'Back up now', keywords: 'save copy database' },
  { id: 'export-workbook', label: 'Export all reports to Excel', keywords: 'workbook xlsx' },
  { id: 'tour', label: 'Start the tutorial', keywords: 'help guide' },
];

// Commands that need an open document; if no screen takes them, say what to do instead of doing nothing
const DOCUMENT_COMMANDS = ['save', 'save-copy', 'save-pdf', 'print'];

export const App: React.FC = () => {
  const { currentModule, tourOpen } = useNavStore();
  const { setIsOnline, setDeviceInfo, loadCompany, loadPrefs, updatePrefs, prefs } = useSystemStore();
  const [toast, setToast] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [ready, setReady] = useState(false); // profile and preferences loaded: the start-up loader can leave

  useEffect(() => {
    // 1. Online / Offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Screen errors go to the log file so "Export Logs" can show what happened on a client's computer
    const logIt = (where: string) => (e: ErrorEvent | PromiseRejectionEvent) =>
      window.electronAPI?.logError(where, String('reason' in e ? (e.reason?.stack ?? e.reason) : (e.error?.stack ?? e.message)));
    const onError = logIt('error');
    const onRejection = logIt('unhandledrejection');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    const company = loadCompany().catch((err) => console.warn('Failed to load company profile:', err));
    const prefs = loadPrefs()
      .then((saved) => {
        useNavStore.getState().setCurrentModule(saved.startScreen);
        // First run: show the tutorial once
        return getSetting<boolean>('tourDone').then((done) => { if (!done) useNavStore.getState().setTourOpen(true); });
      })
      .catch((err) => console.warn('Failed to load preferences:', err));
    Promise.all([company, prefs]).finally(() => setReady(true));

    // 2. Fetch hardware fingerprint and device info via Electron IPC
    if (window.electronAPI) {
      window.electronAPI.getDeviceInfo().then((info) => {
        if (info) setDeviceInfo(info);
      }).catch((err) => {
        console.warn('Failed to retrieve device info via IPC:', err);
      });
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, [setIsOnline, setDeviceInfo, loadCompany, loadPrefs]);

  // 3. Apply appearance preferences
  useEffect(() => {
    const root = document.documentElement;
    if (/^#[0-9a-f]{6}$/i.test(prefs.accent)) {
      root.style.setProperty('--accent', [1, 3, 5].map((i) => parseInt(prefs.accent.slice(i, i + 2), 16)).join(' '));
    } else {
      root.style.removeProperty('--accent');
    }
    root.dataset.density = prefs.density;
    window.electronAPI?.setTheme(prefs.theme);
  }, [prefs.accent, prefs.density, prefs.theme]);

  // 4. Commands from the menu bar and the Ctrl+K palette
  const runCommand = useCallback((action: string) => {
    const nav = useNavStore.getState();
    if (action === 'flush-and-close') {
      runFlushOpenWork().finally(() => window.electronAPI.closeReady());
    } else if (action.startsWith('nav:')) {
      nav.setCurrentModule(action.slice(4) as AppModule);
    } else if (action.startsWith('theme:')) {
      updatePrefs({ theme: action.slice(6) as 'light' | 'dark' | 'system' })
        .catch((err) => setToast(`Theme changed, but the choice could not be saved: ${err.message}`));
    } else if (action === 'new-invoice') {
      nav.setActiveInvoiceDraftId(newDraftId('invoice'));
      nav.setCurrentModule('invoices');
    } else if (action === 'palette') {
      setPaletteOpen(true);
    } else if (action === 'tour') {
      nav.setTourOpen(true);
    } else if (action === 'parked') {
      nav.toggleParkedDrawer();
    } else if (action === 'backup-now') {
      window.electronAPI.backupRunNow().then((status) => {
        useSystemStore.getState().setBackup(status);
        setToast(status.lastError ? `Backup failed: ${status.lastError}` : 'Backup saved.');
      });
    } else if (action === 'find') {
      document.querySelector<HTMLInputElement>('main input[type="search"], main input[role="combobox"]')?.focus();
    } else {
      if (COMMAND_SCREEN[action]) nav.setCurrentModule(COMMAND_SCREEN[action]);
      nav.dispatchMenu(action);
      if (DOCUMENT_COMMANDS.includes(action)) {
        // Screens pick commands up in an effect; anything still waiting after that had no document to act on
        setTimeout(() => {
          if (useNavStore.getState().menuAction?.name !== action) return;
          useNavStore.setState({ menuAction: null });
          setToast('Open a draft or quotation, or view an issued invoice, to use Save, Save As PDF and Print.');
        }, 200);
      }
    }
  }, [updatePrefs]);

  useEffect(() => window.electronAPI?.onMenu(runCommand), [runCommand]);

  // Ctrl+K opens the palette from anywhere
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaletteOpen((open) => !open); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(''), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  const renderModuleView = () => {
    switch (currentModule) {
      case 'dashboard':
        return <DashboardView />;
      case 'invoices':
        return <InvoicesView />;
      case 'quotations':
        return <QuotationsView />;
      case 'products':
        return <ProductsView />;
      case 'customers':
        return <CustomersView />;
      case 'payments':
        return <PaymentsView />;
      case 'reports':
        return <ReportsView />;
      case 'settings':
        return <SettingsView />;
      case 'help':
        return <HelpView />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden">
      <div className="flex flex-1 min-h-0">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Content Area: the translucent header is sticky inside the scroller so content passes under it */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          <HeaderBar />
          {/* Each screen eases in when you switch to it */}
          <Reveal key={currentModule}>{renderModuleView()}</Reveal>
        </main>
      </div>
      <StatusBar />

      {tourOpen && <Tour />}
      <ConfirmHost />
      <AppLoader ready={ready} />
      {paletteOpen && <CommandPalette commands={PALETTE_COMMANDS} onRun={runCommand} onClose={() => setPaletteOpen(false)} />}

      {/* Parked Invoices Drawer Overlay */}
      <ParkedInvoicesDrawer />

      <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        {toast && <p className="card px-4 py-2.5 shadow-xl">{toast}</p>}
      </div>
    </div>
  );
};

export default App;

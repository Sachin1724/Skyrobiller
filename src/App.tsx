import React, { useEffect, useState } from 'react';
import { Sidebar } from './components/layout/Sidebar';
import { HeaderBar } from './components/layout/HeaderBar';
import { ParkedInvoicesDrawer } from './components/layout/ParkedInvoicesDrawer';
import { useNavStore, runFlushOpenWork, type AppModule } from './store/useNavStore';
import { useSystemStore } from './store/useSystemStore';
import { newDraftId } from './lib/db';

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

// Commands that need an open document; if no screen takes them, say what to do instead of doing nothing
const DOCUMENT_COMMANDS = ['save', 'save-copy', 'save-pdf', 'print'];

export const App: React.FC = () => {
  const { currentModule } = useNavStore();
  const { setIsOnline, setDeviceInfo, loadCompany, loadPrefs, updatePrefs, prefs } = useSystemStore();
  const [toast, setToast] = useState('');

  useEffect(() => {
    // 1. Online / Offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    loadCompany().catch((err) => console.warn('Failed to load company profile:', err));
    loadPrefs()
      .then((saved) => useNavStore.getState().setCurrentModule(saved.startScreen))
      .catch((err) => console.warn('Failed to load preferences:', err));

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

  // 4. Menu bar commands
  useEffect(() => {
    if (!window.electronAPI) return;
    return window.electronAPI.onMenu((action) => {
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
      } else if (action === 'parked') {
        nav.toggleParkedDrawer();
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
    });
  }, [updatePrefs]);

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
    <div className="h-screen w-screen flex overflow-hidden">
      {/* Navigation Sidebar */}
      <Sidebar />

      {/* Content Area: the translucent header is sticky inside the scroller so content passes under it */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <HeaderBar />
        {renderModuleView()}
      </main>

      {/* Parked Invoices Drawer Overlay */}
      <ParkedInvoicesDrawer />

      <div role="status" aria-live="polite" className="fixed bottom-5 left-1/2 -translate-x-1/2 z-50 pointer-events-none">
        {toast && <p className="card px-4 py-2.5 shadow-xl">{toast}</p>}
      </div>
    </div>
  );
};

export default App;

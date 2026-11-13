import React, { useEffect } from 'react';
import { TitleBar } from './components/layout/TitleBar';
import { Sidebar } from './components/layout/Sidebar';
import { HeaderBar } from './components/layout/HeaderBar';
import { ParkedInvoicesDrawer } from './components/layout/ParkedInvoicesDrawer';
import { useNavStore } from './store/useNavStore';
import { useSystemStore } from './store/useSystemStore';

// Views
import { DashboardView } from './features/dashboard/DashboardView';
import { InvoicesView } from './features/invoices/InvoicesView';
import { QuotationsView } from './features/quotations/QuotationsView';
import { ProductsView } from './features/products/ProductsView';
import { CustomersView } from './features/customers/CustomersView';
import { PaymentsView } from './features/payments/PaymentsView';
import { ReportsView } from './features/reports/ReportsView';
import { SettingsView } from './features/settings/SettingsView';

export const App: React.FC = () => {
  const { currentModule } = useNavStore();
  const { setIsOnline, setDeviceInfo } = useSystemStore();

  useEffect(() => {
    // 1. Online / Offline listeners
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

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
  }, [setIsOnline, setDeviceInfo]);

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
      default:
        return <DashboardView />;
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden font-sans">
      {/* 1. Custom Frameless Windows Titlebar */}
      <TitleBar />

      {/* 2. Main Application Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Navigation Sidebar */}
        <Sidebar />

        {/* Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden bg-slate-950">
          <HeaderBar />
          <div className="flex-1 overflow-y-auto">
            {renderModuleView()}
          </div>
        </main>
      </div>

      {/* 3. Parked Invoices Drawer Overlay */}
      <ParkedInvoicesDrawer />
    </div>
  );
};

export default App;

import React from 'react';
import { Plus, PauseCircle, Wifi, WifiOff, RefreshCw } from 'lucide-react';
import { useNavStore, AppModule } from '../../store/useNavStore';
import { useSystemStore } from '../../store/useSystemStore';

const moduleTitles: Record<AppModule, { title: string; subtitle: string }> = {
  dashboard: { title: 'Billing Dashboard', subtitle: 'Overview of UAV sales, cashflows, and active invoices' },
  invoices: { title: 'Invoices Management', subtitle: 'Create, issue, park, and print official GST invoices' },
  quotations: { title: 'Quotations & Estimates', subtitle: 'Prepare price quotes with 1-click invoice conversion' },
  products: { title: 'Product Memory Catalogue', subtitle: 'Saved UAV components, flight controllers, motors, and HSN rates' },
  customers: { title: 'Customer Directory', subtitle: 'B2B GST and retail client database with place of supply memory' },
  payments: { title: 'Payments & Receipts', subtitle: 'Track payments received, outstanding amounts, and payment modes' },
  reports: { title: 'Reports & Analytics', subtitle: 'Sales summaries, GSTR-1 summaries, and Google Sheets sync' },
  settings: { title: 'Settings & Administration', subtitle: 'Company profile, GST configuration, device approvals, and backups' },
};

export const HeaderBar: React.FC = () => {
  const { currentModule, setCurrentModule, toggleParkedDrawer } = useNavStore();
  const { isOnline, syncStatus, setSyncStatus } = useSystemStore();
  const info = moduleTitles[currentModule];

  const handleManualSync = () => {
    setSyncStatus('syncing');
    setTimeout(() => {
      setSyncStatus('success');
    }, 1200);
  };

  return (
    <header className="h-16 border-b border-slate-800/80 bg-slate-900/60 backdrop-blur px-6 flex items-center justify-between select-none">
      {/* Title & Context */}
      <div>
        <h1 className="text-base font-bold text-slate-100 flex items-center gap-2">
          {info.title}
        </h1>
        <p className="text-xs text-slate-400">{info.subtitle}</p>
      </div>

      {/* Right Controls & Quick Actions */}
      <div className="flex items-center gap-3">
        {/* Connectivity Chip */}
        <div className={`px-2.5 py-1 rounded-full text-xs font-medium flex items-center gap-1.5 border ${
          isOnline 
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
            : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
        }`}>
          {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          <span>{isOnline ? 'Cloud Online' : 'Offline Mode'}</span>
        </div>

        {/* Sync Trigger */}
        <button
          onClick={handleManualSync}
          disabled={syncStatus === 'syncing'}
          className="p-2 rounded-lg border border-slate-800 bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          title="Trigger Cloud Sync"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${syncStatus === 'syncing' ? 'animate-spin text-blue-400' : ''}`} />
        </button>

        {/* Parked Bills Drawer Button */}
        <button
          onClick={toggleParkedDrawer}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-all text-xs font-semibold"
        >
          <PauseCircle className="h-3.5 w-3.5" />
          <span>Parked Bills</span>
          <span className="h-4 px-1.5 rounded-full bg-amber-500/30 text-amber-300 text-[10px] flex items-center justify-center font-bold">
            2
          </span>
        </button>

        {/* Primary New Invoice Action */}
        <button
          onClick={() => setCurrentModule('invoices')}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs transition-all shadow-sm shadow-blue-500/20"
        >
          <Plus className="h-4 w-4" />
          <span>New Invoice</span>
        </button>
      </div>
    </header>
  );
};

import React, { useEffect, useState } from 'react';
import { Plus, PauseCircle } from 'lucide-react';
import { useNavStore, AppModule } from '../../store/useNavStore';
import { listDrafts, newDraftId } from '../../lib/db';

const moduleTitles: Record<AppModule, string> = {
  dashboard: 'Dashboard',
  invoices: 'Invoices',
  quotations: 'Quotations',
  products: 'Products',
  customers: 'Customers',
  payments: 'Payments',
  reports: 'Reports',
  settings: 'Settings',
  help: 'Help',
};

export const HeaderBar: React.FC = () => {
  const { currentModule, setCurrentModule, isParkedDrawerOpen, toggleParkedDrawer, activeInvoiceDraftId, setActiveInvoiceDraftId } = useNavStore();
  const [parkedCount, setParkedCount] = useState(0);

  // Parked count can change whenever the editor or the parked list closes, or the screen changes
  useEffect(() => {
    listDrafts('invoice', true).then((d) => setParkedCount(d.length)).catch(() => {});
  }, [currentModule, isParkedDrawerOpen, activeInvoiceDraftId]);

  const handleNewInvoice = () => {
    setActiveInvoiceDraftId(newDraftId('invoice'));
    setCurrentModule('invoices');
  };

  return (
    <header className="toolbar h-14 px-6 flex items-center justify-between">
      <h1 className="text-xl font-semibold tracking-tight">{moduleTitles[currentModule]}</h1>

      <div className="flex items-center gap-2">
        <button onClick={toggleParkedDrawer} className="btn">
          <PauseCircle className="h-4 w-4" aria-hidden />
          <span>Parked</span>
          {parkedCount > 0 && <span className="badge badge-warn tabular-nums">{parkedCount}</span>}
        </button>
        <button onClick={handleNewInvoice} className="btn btn-primary">
          <Plus className="h-4 w-4" aria-hidden />
          <span>New Invoice</span>
        </button>
      </div>
    </header>
  );
};

import React from 'react';
import { Plus } from 'lucide-react';
import { useNavStore, AppModule } from '../../store/useNavStore';
import { newDraftId } from '../../lib/db';

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

// New Invoice sits where bills are started: Dashboard and Invoices. Other screens keep their own actions.
export const HeaderBar: React.FC = () => {
  const { currentModule, setCurrentModule, setActiveInvoiceDraftId } = useNavStore();
  const showNew = currentModule === 'dashboard' || currentModule === 'invoices';

  const handleNewInvoice = () => {
    setActiveInvoiceDraftId(newDraftId('invoice'));
    setCurrentModule('invoices');
  };

  return (
    <header className="toolbar h-14 px-6 flex items-center justify-between">
      <h1 className="text-lg font-semibold tracking-tight">{moduleTitles[currentModule]}</h1>
      {showNew && (
        <div data-tour="header-actions" className="flex items-center gap-2">
          <button onClick={handleNewInvoice} className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            <span>New Invoice</span>
          </button>
        </div>
      )}
    </header>
  );
};

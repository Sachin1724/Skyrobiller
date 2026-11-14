import { useEffect } from 'react';
import { create } from 'zustand';

export type AppModule =
  | 'dashboard'
  | 'invoices'
  | 'quotations'
  | 'products'
  | 'customers'
  | 'payments'
  | 'reports'
  | 'settings'
  | 'help';

export interface InvoicesRequest { tab?: 'issued' | 'drafts' | 'parked' | 'credits' | 'debits'; filter?: 'all' | 'unpaid' | 'overdue' | 'paid' | 'cancelled' }

interface NavState {
  currentModule: AppModule;
  // Another screen asking the Invoices screen to open on a tab and/or filter (dashboard cards, the Parked command)
  invoicesRequest: InvoicesRequest | null;
  activeInvoiceDraftId: string | null;
  // A menu-bar command waiting for the screen that can carry it out. A new object each time, so repeats re-trigger.
  menuAction: { name: string } | null;
  tourOpen: boolean;
  setCurrentModule: (mod: AppModule) => void;
  openInvoices: (request?: InvoicesRequest) => void;
  clearInvoicesRequest: () => void;
  setActiveInvoiceDraftId: (id: string | null) => void;
  dispatchMenu: (name: string) => void;
  setTourOpen: (open: boolean) => void;
}

export const useNavStore = create<NavState>((set) => ({
  currentModule: 'dashboard',
  invoicesRequest: null,
  activeInvoiceDraftId: null,
  menuAction: null,
  tourOpen: false,
  setCurrentModule: (mod) => set({ currentModule: mod }),
  openInvoices: (request = {}) => set({ currentModule: 'invoices', invoicesRequest: request, activeInvoiceDraftId: null }),
  clearInvoicesRequest: () => set({ invoicesRequest: null }),
  setActiveInvoiceDraftId: (id) => set({ activeInvoiceDraftId: id }),
  dispatchMenu: (name) => set({ menuAction: { name } }),
  setTourOpen: (open) => set({ tourOpen: open }),
}));

// Lets a screen carry out menu-bar commands. A handler that returns false passes: the command stays for another screen.
// Runs on mount too, so a command sent just before navigating here is picked up when the screen appears.
export function useMenuAction(handlers: Record<string, () => boolean | void>) {
  const action = useNavStore((s) => s.menuAction);
  useEffect(() => {
    if (!action) return;
    const handler = handlers[action.name];
    if (handler && handler() !== false && useNavStore.getState().menuAction === action) {
      useNavStore.setState({ menuAction: null });
    }
  }, [action]);
}

// The open editor registers how to save its work, so closing the window can save first
let flushOpenWork: (() => Promise<void>) | null = null;
export const setFlushOpenWork = (flush: (() => Promise<void>) | null) => { flushOpenWork = flush; };
export const runFlushOpenWork = () => flushOpenWork?.() ?? Promise.resolve();

import { create } from 'zustand';

export type AppModule = 
  | 'dashboard'
  | 'invoices'
  | 'quotations'
  | 'products'
  | 'customers'
  | 'payments'
  | 'reports'
  | 'settings';

interface NavState {
  currentModule: AppModule;
  isParkedDrawerOpen: boolean;
  activeInvoiceDraftId: string | null;
  setCurrentModule: (mod: AppModule) => void;
  toggleParkedDrawer: () => void;
  setParkedDrawerOpen: (open: boolean) => void;
  setActiveInvoiceDraftId: (id: string | null) => void;
}

export const useNavStore = create<NavState>((set) => ({
  currentModule: 'dashboard',
  isParkedDrawerOpen: false,
  activeInvoiceDraftId: null,
  setCurrentModule: (mod) => set({ currentModule: mod }),
  toggleParkedDrawer: () => set((state) => ({ isParkedDrawerOpen: !state.isParkedDrawerOpen })),
  setParkedDrawerOpen: (open) => set({ isParkedDrawerOpen: open }),
  setActiveInvoiceDraftId: (id) => set({ activeInvoiceDraftId: id }),
}));

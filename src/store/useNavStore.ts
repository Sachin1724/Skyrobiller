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

interface NavState {
  currentModule: AppModule;
  isParkedDrawerOpen: boolean;
  activeInvoiceDraftId: string | null;
  // A menu-bar command waiting for the screen that can carry it out. A new object each time, so repeats re-trigger.
  menuAction: { name: string } | null;
  setCurrentModule: (mod: AppModule) => void;
  toggleParkedDrawer: () => void;
  setParkedDrawerOpen: (open: boolean) => void;
  setActiveInvoiceDraftId: (id: string | null) => void;
  dispatchMenu: (name: string) => void;
}

export const useNavStore = create<NavState>((set) => ({
  currentModule: 'dashboard',
  isParkedDrawerOpen: false,
  activeInvoiceDraftId: null,
  menuAction: null,
  setCurrentModule: (mod) => set({ currentModule: mod }),
  toggleParkedDrawer: () => set((state) => ({ isParkedDrawerOpen: !state.isParkedDrawerOpen })),
  setParkedDrawerOpen: (open) => set({ isParkedDrawerOpen: open }),
  setActiveInvoiceDraftId: (id) => set({ activeInvoiceDraftId: id }),
  dispatchMenu: (name) => set({ menuAction: { name } }),
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

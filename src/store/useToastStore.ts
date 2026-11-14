import { create } from 'zustand';

export type ToastKind = 'success' | 'info' | 'error';
export interface ToastItem { id: number; kind: ToastKind; message: string }

interface ToastState {
  items: ToastItem[];
  push: (kind: ToastKind, message: string) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;
const LIFETIME_MS: Record<ToastKind, number> = { success: 3000, info: 3000, error: 7000 }; // errors stay long enough to read

export const useToastStore = create<ToastState>((set, get) => ({
  items: [],
  push: (kind, message) => {
    const id = nextId++;
    set((s) => ({ items: [...s.items.slice(-2), { id, kind, message }] })); // at most 3 on screen
    setTimeout(() => get().dismiss(id), LIFETIME_MS[kind]);
  },
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));

// Call from anywhere: toast.success('Saved.')
export const toast = {
  success: (message: string) => useToastStore.getState().push('success', message),
  info: (message: string) => useToastStore.getState().push('info', message),
  error: (message: string) => useToastStore.getState().push('error', message),
};

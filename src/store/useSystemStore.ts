import { create } from 'zustand';
import type { DeviceInfo } from '../types/electron';

interface CompanyConfig {
  legalName: string;
  tradeName: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  phone: string;
  email: string;
  address: string;
  financialYear: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
}

interface SystemState {
  isOnline: boolean;
  syncStatus: 'idle' | 'syncing' | 'error' | 'success';
  lastSyncedAt: Date | null;
  deviceInfo: DeviceInfo | null;
  company: CompanyConfig;
  setIsOnline: (online: boolean) => void;
  setSyncStatus: (status: 'idle' | 'syncing' | 'error' | 'success') => void;
  setDeviceInfo: (info: DeviceInfo) => void;
  updateCompany: (config: Partial<CompanyConfig>) => void;
}

export const useSystemStore = create<SystemState>((set) => ({
  isOnline: navigator.onLine,
  syncStatus: 'idle',
  lastSyncedAt: new Date(),
  deviceInfo: null,
  company: {
    legalName: 'Skyro Technologies Pvt Ltd',
    tradeName: 'Skyro UAV Systems',
    gstin: '21AAACS1234D1Z5',
    stateCode: '21',
    stateName: 'Odisha',
    phone: '+91 98765 43210',
    email: 'billing@skyrouav.in',
    address: 'Plot 42, Infocity Tech Park, Bhubaneswar, Odisha - 751024',
    financialYear: '2026-27',
    bankName: 'HDFC Bank',
    accountNumber: '50200088991234',
    ifscCode: 'HDFC0001234',
    upiId: 'skyro@hdfcbank',
  },
  setIsOnline: (online) => set({ isOnline: online }),
  setSyncStatus: (syncStatus) => set({ syncStatus, lastSyncedAt: syncStatus === 'success' ? new Date() : undefined }),
  setDeviceInfo: (deviceInfo) => set({ deviceInfo }),
  updateCompany: (config) => set((state) => ({ company: { ...state.company, ...config } })),
}));

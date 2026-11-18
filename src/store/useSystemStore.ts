import { create } from 'zustand';
import type { DeviceInfo, BackupStatus } from '../types/electron';
import { getSetting, setSetting } from '../lib/db';
import { TEMPLATES, type TemplateId, type Density } from '../lib/pdf';
import type { AppModule } from './useNavStore';

export interface Company {
  legalName: string;
  tradeName: string;
  gstin: string;
  stateCode: string;
  stateName: string;
  phone: string;
  email: string;
  address: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  upiId: string;
  invoicePrefix: string; // first part of the invoice number, e.g. SKY/2026-27/0001
  terms: string; // printed on every invoice and quotation
  template: TemplateId; // PDF look
  accent: string; // PDF accent colour, #rrggbb
  density: Density; // PDF spacing and text size
  signature: string; // image data URL printed above "Authorised Signatory", or ''
  logo: string; // image data URL printed on PDFs, or ''
  copies: string[]; // copy markings printed per invoice PDF, one full copy each
}

// How the app itself looks and behaves on this computer (Tools > Customize)
export interface Prefs {
  theme: 'system' | 'light' | 'dark';
  accent: string; // #rrggbb, or '' for the built-in blue
  density: 'comfortable' | 'compact'; // table row height
  startScreen: AppModule;
  defaultGstRate: number; // pre-selected for new products and custom items
  defaultTermsDays: number; // pre-filled for new customers
  hiddenCards: string[]; // dashboard cards switched off
  editorLayout: 'split' | 'form'; // invoice editor: form beside a live preview, or the form alone
}

interface SystemState {
  isOnline: boolean;
  deviceInfo: DeviceInfo | null;
  company: Company;
  prefs: Prefs;
  backup: BackupStatus | null; // shown in the status bar and Settings
  setBackup: (status: BackupStatus) => void;
  refreshBackup: () => Promise<void>;
  setIsOnline: (online: boolean) => void;
  setDeviceInfo: (info: DeviceInfo) => void;
  loadCompany: () => Promise<void>;
  updateCompany: (config: Partial<Company>) => Promise<void>;
  loadPrefs: () => Promise<Prefs>;
  updatePrefs: (change: Partial<Prefs>) => Promise<void>;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  isOnline: navigator.onLine,
  deviceInfo: null,
  // Placeholder profile until the real one is saved in Settings
  company: {
    legalName: 'Skyro Technologies Pvt Ltd',
    tradeName: 'Skyro UAV Systems',
    gstin: '21AAACS1234D1Z8', // sample: passes the check-character test so Settings can be saved before the real one is known
    stateCode: '21',
    stateName: 'Odisha',
    phone: '+91 98765 43210',
    email: 'billing@skyrouav.in',
    address: 'Plot 42, Infocity Tech Park, Bhubaneswar, Odisha - 751024',
    bankName: 'HDFC Bank',
    accountNumber: '50200088991234',
    ifscCode: 'HDFC0001234',
    upiId: 'skyro@hdfcbank',
    invoicePrefix: 'SKY',
    terms: 'Goods once sold will not be taken back. Subject to Bhubaneswar jurisdiction.',
    template: 'minimal',
    accent: '#2a54e0',
    density: 'comfortable',
    signature: '',
    logo: '',
    copies: ['Original for Recipient'],
  },
  prefs: { theme: 'system', accent: '', density: 'comfortable', startScreen: 'dashboard', defaultGstRate: 18, defaultTermsDays: 15, hiddenCards: [], editorLayout: 'split' },
  backup: null,
  setBackup: (backup) => set({ backup }),
  refreshBackup: async () => set({ backup: await window.electronAPI.backupStatus() }),
  setIsOnline: (online) => set({ isOnline: online }),
  setDeviceInfo: (deviceInfo) => set({ deviceInfo }),
  loadCompany: async () => {
    const saved = await getSetting<Partial<Company>>('company');
    if (saved) set((state) => ({ company: { ...state.company, ...saved, template: saved.template && saved.template in TEMPLATES ? saved.template : 'minimal' } })); // older profiles may name a layout that was retired
  },
  updateCompany: async (config) => {
    const company = { ...get().company, ...config };
    await setSetting('company', company);
    set({ company });
  },
  loadPrefs: async () => {
    const saved = await getSetting<Partial<Prefs>>('prefs');
    const prefs = { ...get().prefs, ...saved };
    set({ prefs });
    return prefs;
  },
  updatePrefs: async (change) => {
    const prefs = { ...get().prefs, ...change };
    set({ prefs }); // apply at once; the save follows
    await setSetting('prefs', prefs);
  },
}));

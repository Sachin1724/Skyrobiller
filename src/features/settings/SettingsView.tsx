import React, { useState } from 'react';
import { Settings, Building, CreditCard, Laptop, ShieldCheck, Database, Save } from 'lucide-react';
import { useSystemStore } from '../../store/useSystemStore';

export const SettingsView: React.FC = () => {
  const { company, updateCompany, deviceInfo } = useSystemStore();
  const [savedSuccess, setSavedSuccess] = useState(false);

  const [formData, setFormData] = useState({ ...company });

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateCompany(formData);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2000);
  };

  return (
    <div className="space-y-6 animate-fade-in p-6 max-w-5xl">
      <form onSubmit={handleSave} className="space-y-6">
        {/* Company Profile & GSTIN */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Building className="h-4 w-4 text-blue-400" />
            <h2 className="text-sm font-bold text-slate-100">Company Identity & Statutory GST</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Legal Registered Name</label>
              <input
                type="text"
                value={formData.legalName}
                onChange={(e) => setFormData({ ...formData, legalName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Trade Name / Brand</label>
              <input
                type="text"
                value={formData.tradeName}
                onChange={(e) => setFormData({ ...formData, tradeName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">GSTIN (15 Digits)</label>
              <input
                type="text"
                value={formData.gstin}
                onChange={(e) => setFormData({ ...formData, gstin: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-blue-400 font-bold focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">State Code & Name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={formData.stateCode}
                  onChange={(e) => setFormData({ ...formData, stateCode: e.target.value })}
                  className="w-16 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-200 text-center"
                />
                <input
                  type="text"
                  value={formData.stateName}
                  onChange={(e) => setFormData({ ...formData, stateName: e.target.value })}
                  className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                />
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="block text-slate-400 mb-1 font-medium">Registered Address</label>
              <input
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {/* Banking & UPI */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <CreditCard className="h-4 w-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-100">Bank Details & Invoice UPI QR Code</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Bank Name</label>
              <input
                type="text"
                value={formData.bankName}
                onChange={(e) => setFormData({ ...formData, bankName: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Account Number</label>
              <input
                type="text"
                value={formData.accountNumber}
                onChange={(e) => setFormData({ ...formData, accountNumber: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-200"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">IFSC Code</label>
              <input
                type="text"
                value={formData.ifscCode}
                onChange={(e) => setFormData({ ...formData, ifscCode: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-200"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">UPI VPA (Generates Dynamic QR on Invoices)</label>
              <input
                type="text"
                value={formData.upiId}
                onChange={(e) => setFormData({ ...formData, upiId: e.target.value })}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-emerald-400 font-bold"
              />
            </div>
          </div>
        </div>

        {/* Device Authorization Status */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur p-5 space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-800/80 pb-3">
            <Laptop className="h-4 w-4 text-purple-400" />
            <h2 className="text-sm font-bold text-slate-100">Machine Identity & Device Authorization</h2>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3.5 rounded-lg border border-slate-800 bg-slate-950/60 text-xs gap-3">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-200">{deviceInfo?.hostname || 'Host PC'}</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Approved & Authorized
                </span>
              </div>
              <div className="text-[11px] font-mono text-slate-500 mt-1">
                Hardware Fingerprint: {deviceInfo?.machineId || 'FINGERPRINT-DEV-LOCAL-001'}
              </div>
            </div>
          </div>
        </div>

        {/* Save Bar */}
        <div className="flex items-center justify-end gap-3 pt-2">
          {savedSuccess && (
            <span className="text-xs text-emerald-400 flex items-center gap-1 font-medium">
              <ShieldCheck className="h-4 w-4" />
              Settings saved successfully!
            </span>
          )}
          <button
            type="submit"
            className="flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Save className="h-4 w-4" />
            <span>Save Configuration</span>
          </button>
        </div>
      </form>
    </div>
  );
};

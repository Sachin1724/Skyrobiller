import React, { useState } from 'react';
import { BarChart3, Sheet, RefreshCw, CheckCircle2, Download, ArrowUpRight, Calendar } from 'lucide-react';
import { formatCurrencyINR } from '../../lib/utils';

export const ReportsView: React.FC = () => {
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState('2 mins ago');

  const handleSyncToSheets = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      setLastSyncTime('Just now');
    }, 1500);
  };

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Google Sheets Sync Card */}
      <div className="p-5 rounded-xl border border-emerald-500/20 bg-emerald-950/20 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
            <Sheet className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-slate-100">Google Sheets Reporting Bridge</h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Connected
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Target Spreadsheet: <span className="text-slate-300 font-mono">Skyro_Sales_Ledger_2026_27</span>
            </p>
            <p className="text-[11px] text-slate-500">Last synchronized: {lastSyncTime}</p>
          </div>
        </div>

        <button
          onClick={handleSyncToSheets}
          disabled={isSyncing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-all"
        >
          <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing to Sheets...' : 'Sync to Google Sheets Now'}</span>
        </button>
      </div>

      {/* Indian GST Monthly Summary Grid */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-100">GSTR-1 Statutory Tax Summary (November 2026)</h2>
            <p className="text-xs text-slate-400">Aggregated figures for Indian Goods and Services Tax filing</p>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-800 bg-slate-850 hover:bg-slate-800 text-xs font-medium text-slate-300">
            <Download className="h-3.5 w-3.5" />
            <span>Export GSTR-1 JSON</span>
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-2">
          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60">
            <span className="text-[11px] text-slate-500 block">B2B Registered Taxable</span>
            <span className="text-sm font-bold font-mono text-slate-200 mt-1 block">
              {formatCurrencyINR(321450.00)}
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60">
            <span className="text-[11px] text-slate-500 block">B2C Retail Consumer Taxable</span>
            <span className="text-sm font-bold font-mono text-slate-200 mt-1 block">
              {formatCurrencyINR(48920.00)}
            </span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60">
            <span className="text-[11px] text-slate-500 block">Total CGST + SGST (Intra-state)</span>
            <span className="text-sm font-bold font-mono text-blue-400 mt-1 block">
              {formatCurrencyINR(33333.30)}
            </span>
            <span className="text-[10px] text-slate-500">₹16,666.65 each</span>
          </div>

          <div className="p-3.5 rounded-lg border border-slate-800 bg-slate-950/60">
            <span className="text-[11px] text-slate-500 block">Total IGST (Inter-state)</span>
            <span className="text-sm font-bold font-mono text-purple-400 mt-1 block">
              {formatCurrencyINR(33280.00)}
            </span>
            <span className="text-[10px] text-slate-500">Out of state supplies</span>
          </div>
        </div>
      </div>
    </div>
  );
};

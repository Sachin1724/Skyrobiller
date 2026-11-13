import React from 'react';
import { X, Play, Trash2, Clock, PauseCircle, ArrowRight } from 'lucide-react';
import { useNavStore } from '../../store/useNavStore';
import { formatCurrencyINR } from '../../lib/utils';

export const ParkedInvoicesDrawer: React.FC = () => {
  const { isParkedDrawerOpen, setParkedDrawerOpen, setCurrentModule, setActiveInvoiceDraftId } = useNavStore();

  if (!isParkedDrawerOpen) return null;

  // Mock parked invoices for shell display (to be wired to local SQLite in Phase 2/3)
  const parkedDrafts = [
    {
      draftId: 'DRF-PC1-20261114-001',
      customerName: 'Garuda Aerospace Hub',
      placeOfSupply: 'Odisha (21)',
      itemsCount: 4,
      totalAmount: 18450.00,
      parkedAt: '12 mins ago',
      notes: 'Customer comparing ESC options'
    },
    {
      draftId: 'DRF-PC1-20261114-002',
      customerName: 'DroneTech Labs',
      placeOfSupply: 'Karnataka (29)',
      itemsCount: 2,
      totalAmount: 8900.00,
      parkedAt: '45 mins ago',
      notes: 'Waiting for customer PO confirmation'
    }
  ];

  const handleResume = (draftId: string) => {
    setActiveInvoiceDraftId(draftId);
    setParkedDrawerOpen(false);
    setCurrentModule('invoices');
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-md h-full bg-slate-900 border-l border-slate-800 flex flex-col justify-between shadow-2xl">
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PauseCircle className="h-5 w-5 text-amber-400" />
            <div>
              <h2 className="text-sm font-bold text-slate-100">Parked Invoices</h2>
              <p className="text-[11px] text-slate-400">Bills on hold across current counter</p>
            </div>
          </div>
          <button
            onClick={() => setParkedDrawerOpen(false)}
            className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Drawer Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {parkedDrafts.map((draft) => (
            <div
              key={draft.draftId}
              className="p-3.5 rounded-lg border border-slate-800 hover:border-amber-500/40 bg-slate-950/60 transition-all space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 font-semibold">
                  {draft.draftId}
                </span>
                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                  <Clock className="h-3 w-3" />
                  <span>{draft.parkedAt}</span>
                </div>
              </div>

              <div>
                <h3 className="text-xs font-bold text-slate-200">{draft.customerName}</h3>
                <p className="text-[11px] text-slate-400">POS: {draft.placeOfSupply} · {draft.itemsCount} Items</p>
                {draft.notes && (
                  <p className="text-[10px] text-slate-500 italic mt-0.5">"{draft.notes}"</p>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between">
                <div>
                  <span className="text-[10px] text-slate-500 block">Estimated Total</span>
                  <span className="text-xs font-bold text-slate-100 font-mono">
                    {formatCurrencyINR(draft.totalAmount)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleResume(draft.draftId)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition-colors"
                  >
                    <Play className="h-3 w-3 fill-current" />
                    <span>Resume</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Drawer Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/50 text-center text-[11px] text-slate-500">
          Parked invoices do not consume official GST numbers until issued.
        </div>
      </div>
    </div>
  );
};

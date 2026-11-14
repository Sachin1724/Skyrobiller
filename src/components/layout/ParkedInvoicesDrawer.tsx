import React, { useEffect, useState } from 'react';
import { Play, Trash2 } from 'lucide-react';
import { useNavStore } from '../../store/useNavStore';
import { formatCurrencyINR } from '../../lib/utils';
import { listDrafts, deleteDraft, type Draft } from '../../lib/db';
import { Modal } from '../Modal';
import { confirmSheet } from '../ConfirmSheet';

export const ParkedInvoicesDrawer: React.FC = () => {
  const { isParkedDrawerOpen, setParkedDrawerOpen, setCurrentModule, setActiveInvoiceDraftId } = useNavStore();
  const [parkedDrafts, setParkedDrafts] = useState<Draft[]>([]);

  const reload = () => listDrafts('invoice', true).then(setParkedDrafts).catch(() => setParkedDrafts([]));
  useEffect(() => { if (isParkedDrawerOpen) reload(); }, [isParkedDrawerOpen]);

  if (!isParkedDrawerOpen) return null;

  const handleResume = (draftId: string) => {
    setActiveInvoiceDraftId(draftId);
    setParkedDrawerOpen(false);
    setCurrentModule('invoices');
  };

  const handleDelete = async (draftId: string) => {
    if (!(await confirmSheet({ title: `Delete parked invoice ${draftId}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true }))) return;
    await deleteDraft(draftId).catch(() => {});
    reload();
  };

  return (
    <Modal title="Parked Invoices" onClose={() => setParkedDrawerOpen(false)}>
      {parkedDrafts.length === 0 && <p className="empty">No parked invoices.</p>}
      <ul className="space-y-2 max-h-[60vh] overflow-y-auto overscroll-contain">
        {parkedDrafts.map((draft) => (
          <li key={draft.draftId} className="flex items-center gap-3 p-3 rounded-xl border border-line">
            <div className="min-w-0 flex-1">
              <div className="font-medium truncate">{draft.customer?.businessName ?? 'No customer yet'}</div>
              <div className="text-xs text-ink-2 truncate">
                {draft.draftId} · {draft.items.length} items ·{' '}
                {new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(draft.updatedAt)}
              </div>
              {draft.notes && <div className="text-xs text-ink-2 truncate">{draft.notes}</div>}
            </div>
            <div className="font-medium tabular-nums">{formatCurrencyINR(draft.total)}</div>
            <button onClick={() => handleDelete(draft.draftId)} className="btn btn-icon btn-danger" aria-label={`Delete ${draft.draftId}`}>
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
            <button onClick={() => handleResume(draft.draftId)} className="btn btn-primary">
              <Play className="h-3.5 w-3.5" aria-hidden />
              Resume
            </button>
          </li>
        ))}
      </ul>
      <p className="pt-3 text-xs text-ink-2">Parked invoices do not use a GST invoice number until issued.</p>
    </Modal>
  );
};

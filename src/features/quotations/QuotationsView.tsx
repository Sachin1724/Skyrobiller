import React, { useEffect, useState } from 'react';
import { friendlyError } from '../../lib/friendlyError';
import { confirmDialog } from '../../components/ConfirmDialog';
import { Plus, Pencil, Trash2, ArrowRightCircle } from 'lucide-react';
import { formatCurrencyINR, formatDate, todayISO } from '../../lib/utils';
import { useNavStore, useMenuAction } from '../../store/useNavStore';
import { listDrafts, saveDraft, deleteDraft, setQuotationStatus, newDraftId, type Draft, type QuotationStatus } from '../../lib/db';
import { InvoiceEditor } from '../invoices/InvoiceEditor';
import { RowMenu } from '../../components/RowMenu';

// Lifecycle follows SolidInvoice's quote states (references/solidinvoice): draft, sent, accepted, declined, then converted
const STATUSES: QuotationStatus[] = ['draft', 'sent', 'accepted', 'declined'];
const label = (s: string) => s[0].toUpperCase() + s.slice(1);

export const QuotationsView: React.FC = () => {
  const { setCurrentModule, setActiveInvoiceDraftId } = useNavStore();
  const [quotations, setQuotations] = useState<Draft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const reload = () => listDrafts('quotation').then(setQuotations).catch((e) => setError(friendlyError(e)));
  useEffect(() => { if (!editingId) reload(); }, [editingId]);
  useMenuAction({ 'new-quotation': () => setEditingId(newDraftId('quotation')) });

  if (editingId) {
    return <InvoiceEditor key={editingId} draftId={editingId} kind="quotation" onClose={() => setEditingId(null)} />;
  }

  const run = (action: Promise<unknown>) => action.then(reload).catch((e) => setError(friendlyError(e)));

  // Copies the quotation into a fresh invoice draft and opens it; the quotation is kept and marked converted
  const handleConvert = async (q: Draft) => {
    const draftId = newDraftId('invoice');
    try {
      await saveDraft({ ...q, draftId, kind: 'invoice', isParked: false, validUntil: '', status: 'draft' });
      await setQuotationStatus(q.draftId, 'converted');
      setActiveInvoiceDraftId(draftId);
      setCurrentModule('invoices');
    } catch (e: any) {
      setError(friendlyError(e));
    }
  };

  const handleDelete = async (q: Draft) => {
    if (await confirmDialog({ title: `Delete quotation ${q.draftId}?`, message: 'This cannot be undone.', confirmLabel: 'Delete', danger: true })) run(deleteDraft(q.draftId));
  };

  const today = todayISO();

  return (
    <div className="page">
      <div className="flex justify-end">
        <button onClick={() => setEditingId(newDraftId('quotation'))} className="btn btn-primary">
          <Plus className="h-4 w-4" aria-hidden />
          New Quotation
        </button>
      </div>

      {error && <p role="alert" className="error">{error}</p>}

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Quotation</th>
              <th>Customer</th>
              <th>Valid Until</th>
              <th className="num">Total</th>
              <th>Status</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {quotations.length === 0 && <tr><td colSpan={6} className="empty">No quotations yet. Create your first quotation.</td></tr>}
            {quotations.map((q) => (
              <tr key={q.draftId}>
                <td className="font-medium tabular-nums whitespace-nowrap">{q.draftId}</td>
                <td className="max-w-xs"><div className="truncate">{q.customer?.businessName ?? 'No customer yet'}</div></td>
                <td className="whitespace-nowrap">
                  {q.validUntil && formatDate(q.validUntil)}{' '}
                  {q.validUntil && q.validUntil < today && q.status !== 'converted' && <span className="badge badge-danger">Expired</span>}
                </td>
                <td className="num">{formatCurrencyINR(q.total)}</td>
                <td>
                  {q.status === 'converted' ? (
                    <span className="badge badge-success">Converted</span>
                  ) : (
                    <select
                      aria-label={`Status of ${q.draftId}`}
                      value={q.status}
                      onChange={(e) => run(setQuotationStatus(q.draftId, e.target.value as QuotationStatus))}
                      className="field w-28"
                    >
                      {STATUSES.map((s) => <option key={s} value={s}>{label(s)}</option>)}
                    </select>
                  )}
                </td>
                <td className="num">
                  <RowMenu
                    label={`Actions for ${q.draftId}`}
                    items={[
                      { label: 'Edit quotation', icon: Pencil, onClick: () => setEditingId(q.draftId) },
                      { label: 'Convert to invoice', icon: ArrowRightCircle, onClick: () => handleConvert(q), disabled: !q.customer || q.items.length === 0, title: !q.customer || q.items.length === 0 ? 'Add a customer and items first' : undefined },
                      { label: 'Delete quotation', icon: Trash2, danger: true, onClick: () => handleDelete(q) },
                    ]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

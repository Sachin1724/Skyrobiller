import React, { useState } from 'react';
import { friendlyError } from '../../lib/friendlyError';
import { Plus, Trash2 } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { confirmDialog } from '../../components/ConfirmDialog';
import { computeInvoice, type InvoiceLine } from '../../lib/gst';
import { issueDebitNote, type Invoice } from '../../lib/db';
import { formatCurrencyINR, todayISO } from '../../lib/utils';

interface Row extends InvoiceLine { custom: boolean }
const num = (v: string) => Math.max(0, Number(v) || 0);

// Debit note against an issued invoice: raises what the customer owes (price correction, extra charge).
// Each invoice line carries an "extra per unit" amount; a charge not on the invoice, such as freight, is added as its own line.
export const DebitNoteModal: React.FC<{ invoice: Invoice; onClose: (saved: boolean) => void }> = ({ invoice, onClose }) => {
  // Lines start at billed quantity with no extra rate, so correcting a price means typing only the difference
  const [rows, setRows] = useState<Row[]>(() => invoice.items.map((l) => ({ ...l, rate: 0, discountPct: 0, custom: false })));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const setRow = (i: number, patch: Partial<Row>) => setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const items: InvoiceLine[] = rows.filter((r) => r.qty > 0 && r.rate > 0).map(({ custom, ...line }) => line);
  // Same tax treatment (CGST+SGST or IGST) as the original invoice
  const totals = computeInvoice(items, 'a', invoice.totals.intraState ? 'a' : 'b');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.length === 0) { setError('Enter a quantity and an extra rate above zero on at least one line.'); return; }
    if (rows.some((r) => r.custom && r.qty > 0 && r.rate > 0 && (!r.description.trim() || !/^[0-9]{4,8}$/.test(r.hsnCode)))) {
      setError('Every added charge needs a description and a 4 to 8 digit HSN or SAC code.');
      return;
    }
    const reason = String(new FormData(e.currentTarget).get('reason')).trim();
    if (!(await confirmDialog({
      title: 'Issue this debit note?', headline: { label: 'Debit note total', value: formatCurrencyINR(totals.total) },
      details: [['Against invoice', invoice.invoiceNumber], ['Customer', invoice.customer.businessName]],
      message: 'The customer will owe this on top of the invoice. It gets the next debit note number and cannot be edited or deleted.', confirmLabel: 'Issue Debit Note',
    }))) return;
    setBusy(true);
    try {
      await issueDebitNote({ invoiceId: invoice.id, items, totals, reason, issueDate: todayISO() });
      onClose(true);
    } catch (err: any) {
      setError(friendlyError(err));
      setBusy(false);
    }
  };

  return (
    <Modal wide title={`Charge Extra (Debit Note) · ${invoice.invoiceNumber}`} onClose={() => onClose(false)}>
      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
        <p className="text-ink-2">
          {invoice.customer.businessName} · Invoice {formatCurrencyINR(invoice.total)}{invoice.debited > 0 && ` · Already debited ${formatCurrencyINR(invoice.debited)}`}.
          Enter only the extra amount per unit; the customer then owes that on top of the invoice.
        </p>

        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th>HSN / SAC</th>
                <th className="num w-24">Qty</th>
                <th className="num w-32">Extra Rate (₹)</th>
                <th className="num">GST</th>
                <th><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i}>
                  <td className="max-w-xs">
                    {r.custom
                      ? <input aria-label={`Description of charge ${i + 1}`} value={r.description} onChange={(e) => setRow(i, { description: e.target.value })} placeholder="Freight, handling…" className="field" />
                      : <div className="truncate">{r.description}</div>}
                  </td>
                  <td>
                    {r.custom
                      ? <input aria-label={`HSN or SAC of charge ${i + 1}`} value={r.hsnCode} onChange={(e) => setRow(i, { hsnCode: e.target.value.replace(/\D/g, '').slice(0, 8) })} inputMode="numeric" className="field w-24" />
                      : <span className="tabular-nums">{r.hsnCode}</span>}
                  </td>
                  <td><input aria-label={`Quantity of ${r.description || `charge ${i + 1}`}`} type="number" min="0" step="1" value={r.qty} onChange={(e) => setRow(i, { qty: num(e.target.value) })} className="field num" /></td>
                  <td><input aria-label={`Extra rate of ${r.description || `charge ${i + 1}`}`} type="number" min="0" step="0.01" value={r.rate} onChange={(e) => setRow(i, { rate: num(e.target.value) })} className="field num" /></td>
                  <td className="num">
                    {r.custom
                      ? <select aria-label={`GST rate of charge ${i + 1}`} value={r.gstRate} onChange={(e) => setRow(i, { gstRate: Number(e.target.value) })} className="field w-20">{[0, 5, 12, 18, 28].map((g) => <option key={g} value={g}>{g}%</option>)}</select>
                      : `${r.gstRate}%`}
                  </td>
                  <td className="num">
                    {r.custom && <button type="button" onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))} aria-label={`Remove charge ${i + 1}`} className="btn btn-icon btn-danger"><Trash2 className="h-4 w-4" aria-hidden /></button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-end justify-between gap-4">
          <button type="button" onClick={() => setRows((prev) => [...prev, { sku: '', description: '', hsnCode: '', unit: 'NOS', qty: 1, rate: 0, discountPct: 0, gstRate: 18, custom: true }])} className="btn">
            <Plus className="h-4 w-4" aria-hidden />
            Add Charge
          </button>
          <div className="text-right" aria-live="polite">
            <div className="text-xs text-ink-2">Debit Note Total (Including GST)</div>
            <div className="text-lg font-semibold tracking-tight tabular-nums">{formatCurrencyINR(totals.total)}</div>
          </div>
        </div>

        <label className="label">Reason (Printed on the Debit Note)
          <input name="reason" required placeholder="Price correction, freight not billed…" className="field" />
        </label>

        {error && <p role="alert" className="error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="btn">Cancel</button>
          <button type="submit" disabled={busy} className="btn btn-primary">{busy ? 'Issuing…' : 'Issue Debit Note'}</button>
        </div>
      </form>
    </Modal>
  );
};

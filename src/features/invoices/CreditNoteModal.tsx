import React, { useState } from 'react';
import { friendlyError } from '../../lib/friendlyError';
import { Modal } from '../../components/Modal';
import { NumInput } from '../../components/NumInput';
import { confirmDialog } from '../../components/ConfirmDialog';
import { computeInvoice } from '../../lib/gst';
import { issueCreditNote, type Invoice } from '../../lib/db';
import { formatCurrencyINR, todayISO } from '../../lib/utils';

// Credit note against an issued invoice: pick how much of each line is being credited back.
export const CreditNoteModal: React.FC<{ invoice: Invoice; onClose: (saved: boolean) => void }> = ({ invoice, onClose }) => {
  const [qty, setQty] = useState<number[]>(() => invoice.items.map(() => 0));
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const items = invoice.items.map((l, i) => ({ ...l, qty: qty[i] })).filter((l) => l.qty > 0);
  // Same tax treatment (CGST+SGST or IGST) as the original invoice
  const totals = computeInvoice(items, 'a', invoice.totals.intraState ? 'a' : 'b');
  const available = Math.round((invoice.total + invoice.debited - invoice.credited) * 100) / 100;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (items.length === 0) { setError('Enter a quantity above zero on at least one line.'); return; }
    const reason = String(new FormData(e.currentTarget).get('reason')).trim();
    if (!(await confirmDialog({
      title: 'Issue this credit note?', headline: { label: 'Credit note total', value: formatCurrencyINR(totals.total) },
      details: [['Against invoice', invoice.invoiceNumber], ['Customer', invoice.customer.businessName]],
      message: 'It gets the next credit note number and cannot be edited or deleted.', confirmLabel: 'Issue Credit Note',
    }))) return;
    setBusy(true);
    try {
      await issueCreditNote({ invoiceId: invoice.id, items, totals, reason, issueDate: todayISO() });
      onClose(true);
    } catch (err: any) {
      setError(`${friendlyError(err)} At most ${formatCurrencyINR(available)} can still be credited on this invoice.`);
      setBusy(false);
    }
  };

  return (
    <Modal wide title={`Reduce Amount (Credit Note) · ${invoice.invoiceNumber}`} onClose={() => onClose(false)}>
      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
        <p className="text-ink-2">
          {invoice.customer.businessName} · Invoice {formatCurrencyINR(invoice.total)} · Already credited {formatCurrencyINR(invoice.credited)}
        </p>

        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Item</th>
                <th className="num">Billed Qty</th>
                <th className="num">Rate</th>
                <th className="num w-28">Credit Qty</th>
              </tr>
            </thead>
            <tbody>
              {invoice.items.map((l, i) => (
                <tr key={i}>
                  <td className="max-w-xs"><div className="truncate">{l.description}</div></td>
                  <td className="num">{l.qty} {l.unit}</td>
                  <td className="num">{formatCurrencyINR(l.rate)}</td>
                  <td>
                    <NumInput
                      aria-label={`Credit quantity for ${l.description}`}
                      max={l.qty} step="1" value={qty[i]}
                      onChange={(n) => setQty((prev) => prev.map((q, j) => (j === i ? n : q)))}
                      className="field num"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-end justify-between gap-4">
          <button type="button" onClick={() => setQty(invoice.items.map((l) => l.qty))} className="btn">Credit Full Invoice</button>
          <div className="text-right" aria-live="polite">
            <div className="text-xs text-ink-2">Credit Note Total (Including GST)</div>
            <div className="text-lg font-semibold tracking-tight tabular-nums">{formatCurrencyINR(totals.total)}</div>
          </div>
        </div>

        <label className="label">Reason (Printed on the Credit Note)
          <input name="reason" required placeholder="Goods returned, wrong item, price correction…" className="field" />
        </label>

        {error && <p role="alert" className="error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="btn">Cancel</button>
          <button type="submit" disabled={busy} className="btn btn-primary">{busy ? 'Issuing…' : 'Issue Credit Note'}</button>
        </div>
      </form>
    </Modal>
  );
};

import React, { useState } from 'react';
import { Modal } from '../../components/Modal';
import { addPayment, outstandingOf, type Invoice } from '../../lib/db';
import { formatCurrencyINR, todayISO } from '../../lib/utils';

const METHODS = ['UPI', 'NEFT / RTGS', 'Cash', 'Cheque', 'Card'];

export const PaymentModal: React.FC<{ invoice: Invoice; onClose: (saved: boolean) => void }> = ({ invoice, onClose }) => {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const due = outstandingOf(invoice);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    setBusy(true);
    try {
      await addPayment({ invoiceId: invoice.id, amount: Number(f.amount), paidOn: f.paidOn, method: f.method, reference: f.reference.trim() });
      onClose(true);
    } catch (err: any) {
      setError(`${err.message}. Enter ${formatCurrencyINR(due)} or less.`);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Record Payment · ${invoice.invoiceNumber}`} onClose={() => onClose(false)}>
      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
        <p className="text-ink-2">
          {invoice.customer.businessName} · Outstanding <span className="font-medium text-ink tabular-nums">{formatCurrencyINR(due)}</span>
        </p>
        <div className="grid grid-cols-2 gap-3">
          <label className="label">Amount Received (₹)
            <input name="amount" type="number" required autoFocus min="0.01" max={due} step="0.01" defaultValue={due} className="field" />
          </label>
          <label className="label">Payment Date
            <input name="paidOn" type="date" required max={todayISO()} defaultValue={todayISO()} className="field" />
          </label>
          <label className="label">Method
            <select name="method" className="field">
              {METHODS.map((m) => <option key={m}>{m}</option>)}
            </select>
          </label>
          <label className="label">Transaction Reference
            <input name="reference" spellCheck={false} placeholder="UTR or cheque number" className="field" />
          </label>
        </div>
        {error && <p role="alert" className="error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="btn">Cancel</button>
          <button type="submit" disabled={busy} className="btn btn-primary">{busy ? 'Saving…' : 'Record Payment'}</button>
        </div>
      </form>
    </Modal>
  );
};

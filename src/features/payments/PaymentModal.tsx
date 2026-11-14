import React, { useEffect, useState } from 'react';
import { friendlyError } from '../../lib/friendlyError';
import { Modal } from '../../components/Modal';
import { addPayment, listPaymentsForInvoice, outstandingOf, type Invoice, type Payment } from '../../lib/db';
import { formatCurrencyINR, formatDate, todayISO } from '../../lib/utils';

const METHODS = ['UPI', 'NEFT / RTGS', 'Cash', 'Cheque', 'Card'];

export const PaymentModal: React.FC<{ invoice: Invoice; onClose: (saved: boolean) => void }> = ({ invoice, onClose }) => {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const due = outstandingOf(invoice);
  const [amount, setAmount] = useState<string>(due > 0 ? due.toFixed(2) : '0');
  const [history, setHistory] = useState<Payment[]>([]);

  useEffect(() => {
    listPaymentsForInvoice(invoice.id).then(setHistory).catch(() => {});
  }, [invoice.id]);

  const entered = Number(amount) || 0;
  const remaining = Math.max(0, Math.round((due - entered) * 100) / 100);
  const isFull = remaining < 0.01 && entered > 0;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    const payAmount = Number(f.amount);
    if (!payAmount || payAmount <= 0) {
      setError('Please enter a valid payment amount greater than zero.');
      return;
    }
    if (payAmount > due + 0.005) {
      setError(`Payment cannot exceed the outstanding balance of ${formatCurrencyINR(due)}.`);
      return;
    }
    setBusy(true);
    try {
      await addPayment({
        invoiceId: invoice.id,
        amount: payAmount,
        paidOn: f.paidOn,
        method: f.method,
        reference: f.reference.trim(),
      });
      onClose(true);
    } catch (err: any) {
      setError(`${friendlyError(err)} Enter ${formatCurrencyINR(due)} or less.`);
      setBusy(false);
    }
  };

  return (
    <Modal title={`Record Payment · ${invoice.invoiceNumber}`} onClose={() => onClose(false)}>
      <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-ink-2">
          <div>
            <span className="font-semibold text-ink">{invoice.customer.businessName}</span>
            <span className="text-xs ml-2">Total {formatCurrencyINR(invoice.total)}</span>
            {invoice.paid > 0 && <span className="text-xs ml-2 text-success">· Paid {formatCurrencyINR(invoice.paid)}</span>}
          </div>
          <div>
            Outstanding: <span className="font-semibold text-ink tabular-nums">{formatCurrencyINR(due)}</span>
          </div>
        </div>

        {/* Quick-fill payment buttons */}
        <div className="space-y-1.5">
          <div className="text-xs font-medium text-ink-2">Quick Amount</div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAmount(due.toFixed(2))}
              className={`btn text-xs ${Math.abs(entered - due) < 0.01 ? 'btn-primary' : ''}`}
            >
              Full ({formatCurrencyINR(due)})
            </button>
            {due > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setAmount((Math.round(due * 0.5 * 100) / 100).toFixed(2))}
                  className={`btn text-xs ${Math.abs(entered - due * 0.5) < 0.01 ? 'btn-primary' : ''}`}
                >
                  50% ({formatCurrencyINR(Math.round(due * 0.5 * 100) / 100)})
                </button>
                <button
                  type="button"
                  onClick={() => setAmount((Math.round(due * 0.25 * 100) / 100).toFixed(2))}
                  className={`btn text-xs ${Math.abs(entered - due * 0.25) < 0.01 ? 'btn-primary' : ''}`}
                >
                  25% ({formatCurrencyINR(Math.round(due * 0.25 * 100) / 100)})
                </button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="label">Amount Received (₹)
            <input
              name="amount"
              type="number"
              required
              autoFocus
              min="0.01"
              max={due}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="field"
            />
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

        {/* Live status after payment */}
        <div className="flex items-center justify-between text-xs px-3 py-2 rounded bg-surface-2 border border-line">
          <span className="text-ink-2">Status after this payment:</span>
          {isFull ? (
            <span className="badge badge-success">Paid in Full (₹0.00 Remaining)</span>
          ) : (
            <span className="badge badge-warn">
              Partially Paid ({formatCurrencyINR(remaining)} Remaining)
            </span>
          )}
        </div>

        {/* Prior installments history */}
        {history.length > 0 && (
          <div className="space-y-1.5 pt-2 border-t border-line">
            <div className="text-xs font-semibold text-ink-2">Prior Payments ({history.length})</div>
            <div className="max-h-28 overflow-y-auto rounded border border-line bg-surface-2/40">
              <table className="tbl text-xs">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th className="num">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => (
                    <tr key={p.id}>
                      <td className="whitespace-nowrap">{formatDate(p.paidOn)}</td>
                      <td>{p.method}</td>
                      <td className="text-ink-2 truncate max-w-[120px]">{p.reference || '—'}</td>
                      <td className="num font-medium">{formatCurrencyINR(p.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && <p role="alert" className="error">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onClose(false)} className="btn">Cancel</button>
          <button type="submit" disabled={busy} className="btn btn-primary">{busy ? 'Saving…' : 'Record Payment'}</button>
        </div>
      </form>
    </Modal>
  );
};

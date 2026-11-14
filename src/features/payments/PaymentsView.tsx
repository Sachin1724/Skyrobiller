import React, { useEffect, useState } from 'react';
import { friendlyError } from '../../lib/friendlyError';
import { formatCurrencyINR, formatDate, todayISO } from '../../lib/utils';
import { listInvoices, listPayments, outstandingOf, type Invoice, type Payment } from '../../lib/db';
import { PaymentModal } from './PaymentModal';

export const PaymentsView: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paying, setPaying] = useState<Invoice | null>(null);
  const [error, setError] = useState('');

  const reload = () =>
    Promise.all([listInvoices(), listPayments()])
      .then(([i, p]) => { setInvoices(i); setPayments(p); })
      .catch((e) => setError(friendlyError(e)));
  useEffect(() => { reload(); }, []);

  const unpaid = invoices.filter((i) => outstandingOf(i) >= 0.01).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const today = todayISO();

  return (
    <div className="page">
      {error && <p role="alert" className="error">{error}</p>}

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight">
          Outstanding · <span className="tabular-nums">{formatCurrencyINR(unpaid.reduce((sum, i) => sum + outstandingOf(i), 0))}</span>
        </h2>
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Invoice No.</th>
                <th>Customer</th>
                <th>Due</th>
                <th className="num">Total</th>
                <th className="num">Received</th>
                <th className="num">Outstanding</th>
                <th><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {unpaid.length === 0 && <tr><td colSpan={7} className="empty">Nothing outstanding.</td></tr>}
              {unpaid.map((inv) => (
                <tr key={inv.id}>
                  <td className="font-medium tabular-nums whitespace-nowrap">{inv.invoiceNumber}</td>
                  <td className="max-w-xs"><div className="truncate">{inv.customer.businessName}</div></td>
                  <td className="whitespace-nowrap">
                    {formatDate(inv.dueDate)} {inv.dueDate < today && <span className="badge badge-danger">Overdue</span>}
                  </td>
                  <td className="num">{formatCurrencyINR(inv.total)}</td>
                  <td className="num">{formatCurrencyINR(inv.paid)}</td>
                  <td className="num font-medium">{formatCurrencyINR(outstandingOf(inv))}</td>
                  <td className="num">
                    <button onClick={() => setPaying(inv)} className="btn">Record Payment</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-2">
        <h2 className="text-base font-semibold tracking-tight">Payments Received</h2>
        <div className="card overflow-hidden">
          <table className="tbl">
            <thead>
              <tr>
                <th>Date</th>
                <th>Invoice No.</th>
                <th>Customer</th>
                <th>Method</th>
                <th>Reference</th>
                <th className="num">Amount</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 && <tr><td colSpan={6} className="empty">No payments recorded yet.</td></tr>}
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="whitespace-nowrap">{formatDate(p.paidOn)}</td>
                  <td className="tabular-nums whitespace-nowrap">{p.invoiceNumber}</td>
                  <td className="max-w-xs"><div className="truncate">{p.customerName}</div></td>
                  <td>{p.method}</td>
                  <td className="max-w-[12rem]"><div className="truncate">{p.reference}</div></td>
                  <td className="num font-medium">{formatCurrencyINR(p.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {paying && <PaymentModal invoice={paying} onClose={(saved) => { setPaying(null); if (saved) reload(); }} />}
    </div>
  );
};

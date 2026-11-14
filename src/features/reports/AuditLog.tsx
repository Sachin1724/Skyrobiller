import React, { useEffect, useState } from 'react';
import { listAudit, listInvoices, type AuditEntry } from '../../lib/db';

const ENTITY_LABEL: Record<string, string> = { product: 'Product', customer: 'Customer', invoice: 'Invoice', payment: 'Payment', credit_note: 'Credit note', debit_note: 'Debit note' };
const ACTION_BADGE = { create: 'badge-success', update: 'badge-accent', delete: 'badge-danger' } as const;

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
const nameOf = (e: AuditEntry) => {
  const row = e.after ?? e.before ?? {};
  return show(row.invoice_number ?? row.credit_number ?? row.debit_number ?? row.sku ?? row.business_name ?? row.amount ?? e.entityId);
};

// Fields that add nothing to a reader
const hidden = (k: string, v: unknown) => (k === 'is_active' && v === 1) || (v === null || v === '');

// Update: "total  ₹1,000 → ₹1,200" per changed field. Create and delete: the saved values.
const Changes: React.FC<{ e: AuditEntry; invoiceNumbers: Map<string, string> }> = ({ e, invoiceNumbers }) => {
  const label = (k: string) => <span className="text-ink-3">{k.replace(/_/g, ' ').replace(/^invoice id$/, 'invoice')}</span>;
  const val = (k: string, v: unknown) => (k === 'invoice_id' ? invoiceNumbers.get(String(v)) ?? String(v) : show(v));

  if (e.action === 'update' && e.before && e.after) {
    const changed = Object.keys(e.after).filter((k) => e.before![k] !== e.after![k]);
    return <>{changed.map((k) => (
      <span key={k} className="mr-3 inline-block">{label(k)}{' '}
        <s className="text-danger/80">{val(k, e.before![k])}</s>{' → '}<b className="text-success font-medium">{val(k, e.after![k])}</b>
      </span>
    ))}</>;
  }
  const row = e.after ?? e.before ?? {};
  return <>{Object.entries(row).filter(([k, v]) => !hidden(k, v)).map(([k, v]) => (
    <span key={k} className="mr-3 inline-block">{label(k)} {val(k, v)}</span>
  ))}</>;
};

// Every create, change and delete, newest first. Written by the database itself, so it cannot be skipped or edited.
export const AuditLog: React.FC<{ from: string; to: string }> = ({ from, to }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [invoiceNumbers, setInvoiceNumbers] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([listAudit({ from, to }), listInvoices()])
      .then(([list, invoices]) => { setEntries(list); setInvoiceNumbers(new Map(invoices.map((i) => [i.id, i.invoiceNumber]))); })
      .catch((e) => setError(e.message));
  }, [from, to]);

  return (
    <>
      {error && <p role="alert" className="error">{error}</p>}
      <div className="card overflow-auto max-h-[calc(100vh-17rem)]">
        <table className="grid-tbl">
          <thead><tr><th>When</th><th>What</th><th>Item</th><th>Action</th><th>Details</th></tr></thead>
          <tbody>
            {entries.length === 0 && <tr><td colSpan={5} className="empty">No changes recorded for this period.</td></tr>}
            {entries.map((e) => (
              <tr key={e.id}>
                <td>{new Date(e.at).toLocaleString()}</td>
                <td>{ENTITY_LABEL[e.entity] ?? e.entity}</td>
                <td>{nameOf(e)}</td>
                <td><span className={`badge ${ACTION_BADGE[e.action]}`}>{e.action}</span></td>
                <td className="!whitespace-normal min-w-[22rem]"><Changes e={e} invoiceNumbers={invoiceNumbers} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-2">Showing up to 1,000 most recent entries. Invoice contents are summarised by number, total, due date, notes and status.</p>
    </>
  );
};

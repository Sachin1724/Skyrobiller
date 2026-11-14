import React, { useEffect, useState } from 'react';
import { listAudit, type AuditEntry } from '../../lib/db';

const ENTITY_LABEL: Record<string, string> = { product: 'Product', customer: 'Customer', invoice: 'Invoice', payment: 'Payment', credit_note: 'Credit note', debit_note: 'Debit note' };
const ACTION_BADGE = { create: 'badge-success', update: 'badge-accent', delete: 'badge-danger' } as const;

const show = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : String(v));
const nameOf = (e: AuditEntry) => {
  const row = e.after ?? e.before ?? {};
  return show(row.invoice_number ?? row.credit_number ?? row.debit_number ?? row.sku ?? row.business_name ?? row.amount ?? e.entityId);
};

// "price 5800 → 6000" for each field that changed; creates and deletes list the saved values
const changes = (e: AuditEntry): string[] => {
  if (e.action === 'update' && e.before && e.after) {
    return Object.keys(e.after).filter((k) => e.before![k] !== e.after![k]).map((k) => `${k.replace(/_/g, ' ')}: ${show(e.before![k])} → ${show(e.after![k])}`);
  }
  return Object.entries(e.after ?? e.before ?? {}).map(([k, v]) => `${k.replace(/_/g, ' ')}: ${show(v)}`);
};

// Every create, change and delete, newest first. Written by the database itself, so it cannot be skipped or edited.
export const AuditLog: React.FC<{ from: string; to: string }> = ({ from, to }) => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    listAudit({ from, to }).then(setEntries).catch((e) => setError(e.message));
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
                <td className="!whitespace-normal min-w-[22rem]">{changes(e).join(' · ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-ink-2">Showing up to 1,000 most recent entries. Invoice contents are summarised by number, total, due date, notes and status.</p>
    </>
  );
};

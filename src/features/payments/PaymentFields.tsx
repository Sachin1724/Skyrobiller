import React from 'react';

export const METHODS = ['UPI', 'NEFT / RTGS', 'Cash', 'Cheque', 'Card'] as const;

// What each method asks for beyond the amount. `payer` is optional detail, `ref` is the number the bank gives.
const DETAIL: Record<string, { payer?: [label: string, hint: string]; ref?: [label: string, hint: string]; prefix: string }> = {
  'UPI': { payer: ['Payer UPI ID', 'name@bank'], ref: ['UPI Transaction ID', '12-digit transaction ID'], prefix: 'Txn' },
  'NEFT / RTGS': { ref: ['UTR Number', 'UTR from the bank'], prefix: 'UTR' },
  'Cheque': { payer: ['Bank', 'Bank name'], ref: ['Cheque Number', '6-digit cheque number'], prefix: 'Cheque' },
  'Card': { ref: ['Approval Code / Last 4', 'Approval code or last 4 digits'], prefix: 'Card' },
  'Cash': { prefix: '' },
};

export interface PaymentDetail { method: string; payer: string; ref: string }

// One line kept with the payment, so it prints on the receipt and is found by the invoice search
export const referenceOf = (d: PaymentDetail): string => {
  const { prefix } = DETAIL[d.method] ?? { prefix: '' };
  const payer = d.payer.trim();
  const ref = d.ref.trim();
  return [payer, ref && (prefix ? `${prefix} ${ref}` : ref)].filter(Boolean).join(' · ');
};

// A missing UPI/NEFT reference is only a warning: the money may well have arrived
export const missingRef = (d: PaymentDetail): boolean => Boolean(DETAIL[d.method]?.ref) && (d.method === 'UPI' || d.method === 'NEFT / RTGS') && !d.ref.trim();

export const PaymentFields: React.FC<{ value: PaymentDetail; onChange: (v: PaymentDetail) => void }> = ({ value, onChange }) => {
  const d = DETAIL[value.method];
  return (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-ink-2" id="pay-method">Method</div>
        <div className="segmented" role="group" aria-labelledby="pay-method">
          {METHODS.map((m) => (
            <button type="button" key={m} aria-pressed={value.method === m} onClick={() => onChange({ ...value, method: m })}>{m}</button>
          ))}
        </div>
      </div>
      {(d?.payer || d?.ref) && (
        <div className="grid grid-cols-2 gap-3">
          {d.payer && (
            <label className="label">{d.payer[0]}
              <input value={value.payer} onChange={(e) => onChange({ ...value, payer: e.target.value })} placeholder={d.payer[1]} spellCheck={false} autoComplete="off" className="field" />
            </label>
          )}
          {d.ref && (
            <label className={`label ${d.payer ? '' : 'col-span-2'}`}>{d.ref[0]}
              <input value={value.ref} onChange={(e) => onChange({ ...value, ref: e.target.value })} placeholder={d.ref[1]} spellCheck={false} autoComplete="off" className="field" />
            </label>
          )}
        </div>
      )}
    </div>
  );
};

import React from 'react';
import { RotateCcw, TrendingDown, TrendingUp } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { outstandingOf, type Invoice } from '../../lib/db';
import { formatCurrencyINR } from '../../lib/utils';

type Fix = 'restart' | 'reduce' | 'increase';

// "How do I edit this invoice?" An issued invoice is locked by law-friendly design, so this asks what went wrong
// in plain words and takes the right route: start again, reduce the amount, or charge extra.
export const CorrectInvoiceModal: React.FC<{ invoice: Invoice; onChoose: (fix: Fix) => void; onClose: () => void }> = ({ invoice, onChoose, onClose }) => {
  const untouched = invoice.paid === 0 && invoice.credited === 0 && invoice.debited === 0;
  const canReduce = invoice.credited < invoice.total + invoice.debited - 0.005;

  const options: { fix: Fix; icon: React.ComponentType<{ className?: string }>; title: string; text: string; disabled?: boolean; why?: string }[] = [
    {
      fix: 'restart', icon: RotateCcw, title: 'The customer or the items are wrong',
      text: 'Cancel this invoice and start a fresh copy that you can edit. The new bill gets a new number.',
      disabled: !untouched, why: 'Not possible once a payment, reduction or extra charge exists on this invoice.',
    },
    {
      fix: 'reduce', icon: TrendingDown, title: 'The amount is too high',
      text: `Goods came back, or you gave a discount. The customer will owe less than ${formatCurrencyINR(outstandingOf(invoice))}. (This is called a credit note.)`,
      disabled: !canReduce, why: 'The whole invoice has already been reduced.',
    },
    {
      fix: 'increase', icon: TrendingUp, title: 'The amount is too low',
      text: 'You forgot a charge such as freight, or the price was too low. The customer will owe more. (This is called a debit note.)',
    },
  ];

  return (
    <Modal title={`Correct invoice ${invoice.invoiceNumber}`} onClose={onClose}>
      <p className="mb-3 text-ink-2">An issued invoice cannot be edited, so its number and figures always match what the customer received. What needs fixing?</p>
      <div className="space-y-2">
        {options.map((o) => (
          <button
            key={o.fix}
            onClick={() => onChoose(o.fix)}
            disabled={o.disabled}
            title={o.disabled ? o.why : undefined}
            className="flex w-full items-start gap-3 rounded-md border border-line p-3 text-left hover:border-accent hover:bg-accent/5 disabled:opacity-50 disabled:hover:border-line disabled:hover:bg-transparent"
          >
            <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded bg-accent/10 text-accent"><o.icon className="h-4 w-4" aria-hidden /></span>
            <span className="min-w-0">
              <span className="block font-medium">{o.title}</span>
              <span className="block text-xs text-ink-2">{o.disabled ? o.why : o.text}</span>
            </span>
          </button>
        ))}
      </div>
      <div className="flex justify-end pt-4"><button onClick={onClose} className="btn">Close</button></div>
    </Modal>
  );
};

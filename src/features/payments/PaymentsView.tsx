import React, { useState } from 'react';
import { Plus, Search, CreditCard, CheckCircle2, ArrowDownRight, Wallet } from 'lucide-react';
import { formatCurrencyINR, formatDate } from '../../lib/utils';

export interface PaymentItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  paymentDate: string;
  amount: number;
  mode: 'UPI' | 'Bank Transfer' | 'Cash' | 'Cheque';
  referenceNo: string;
  recordedBy: string;
}

export const PaymentsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const [payments] = useState<PaymentItem[]>([
    {
      id: '1',
      invoiceNumber: 'SKY/2026-27/0042',
      customerName: 'SkyHigh Drones Pvt Ltd',
      paymentDate: '2026-11-14',
      amount: 45200.00,
      mode: 'Bank Transfer',
      referenceNo: 'HDFC9821873192',
      recordedBy: 'Employee A'
    },
    {
      id: '2',
      invoiceNumber: 'SKY/2026-27/0040',
      customerName: 'Rajesh Sharma (FPV Hobbyist)',
      paymentDate: '2026-11-14',
      amount: 8960.00,
      mode: 'UPI',
      referenceNo: 'UPI/432190821908/Paytm',
      recordedBy: 'Employee A'
    },
    {
      id: '3',
      invoiceNumber: 'SKY/2026-27/0039',
      customerName: 'Bharat Drone Defense Solutions',
      paymentDate: '2026-11-13',
      amount: 198000.00,
      mode: 'Bank Transfer',
      referenceNo: 'SBI77610091238',
      recordedBy: 'Admin'
    }
  ]);

  const filtered = payments.filter(p =>
    p.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.referenceNo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Top Action Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search invoice number, customer or reference..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Record Payment Receipt</span>
        </button>
      </div>

      {/* Payments Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase text-[10px]">
              <th className="py-3 px-4">Payment Date</th>
              <th className="py-3 px-4">Against Invoice</th>
              <th className="py-3 px-4">Customer Name</th>
              <th className="py-3 px-4">Payment Mode</th>
              <th className="py-3 px-4">Transaction Reference</th>
              <th className="py-3 px-4 text-right">Amount Received</th>
              <th className="py-3 px-4 text-center">Recorded By</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 text-slate-400 font-medium">
                  {formatDate(item.paymentDate)}
                </td>
                <td className="py-3 px-4 font-mono font-bold text-blue-400">
                  {item.invoiceNumber}
                </td>
                <td className="py-3 px-4 font-semibold text-slate-200">
                  {item.customerName}
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {item.mode}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono text-slate-400">
                  {item.referenceNo}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                  +{formatCurrencyINR(item.amount)}
                </td>
                <td className="py-3 px-4 text-center text-slate-400">
                  {item.recordedBy}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

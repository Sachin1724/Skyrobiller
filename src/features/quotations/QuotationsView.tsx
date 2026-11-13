import React, { useState } from 'react';
import { Plus, Search, FileCheck2, ArrowRight, Printer, Download, Clock } from 'lucide-react';
import { formatCurrencyINR, formatDate } from '../../lib/utils';
import { useNavStore } from '../../store/useNavStore';

export interface QuotationItem {
  id: string;
  quotationNumber: string;
  customerName: string;
  customerGstin: string;
  date: string;
  validUntil: string;
  totalAmount: number;
  status: 'draft' | 'sent' | 'accepted' | 'converted';
  itemsCount: number;
}

export const QuotationsView: React.FC = () => {
  const { setCurrentModule } = useNavStore();
  const [searchTerm, setSearchTerm] = useState('');

  const [quotations] = useState<QuotationItem[]>([
    {
      id: '1',
      quotationNumber: 'QT-2026-0012',
      customerName: 'Bharat Drone Defense Solutions',
      customerGstin: '07AAACB4421M1ZX',
      date: '2026-11-10',
      validUntil: '2026-11-25',
      totalAmount: 198000.00,
      status: 'accepted',
      itemsCount: 6
    },
    {
      id: '2',
      quotationNumber: 'QT-2026-0011',
      customerName: 'Garuda Tech Aerospace',
      customerGstin: '29AAACG8412F1Z8',
      date: '2026-11-08',
      validUntil: '2026-11-23',
      totalAmount: 48500.00,
      status: 'sent',
      itemsCount: 3
    },
    {
      id: '3',
      quotationNumber: 'QT-2026-0010',
      customerName: 'AeroDynamics India',
      customerGstin: '21AAACA9999P1Z2',
      date: '2026-11-05',
      validUntil: '2026-11-20',
      totalAmount: 112000.00,
      status: 'converted',
      itemsCount: 8
    }
  ]);

  const handleConvertToInvoice = (quote: QuotationItem) => {
    alert(`Quotation ${quote.quotationNumber} will be converted into a new Tax Invoice draft with prefilled items and customer data.`);
    setCurrentModule('invoices');
  };

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Action Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search quotation number or customer..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Prepare Price Quotation</span>
        </button>
      </div>

      {/* Quotations Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase text-[10px]">
              <th className="py-3 px-4">Quote No</th>
              <th className="py-3 px-4">Customer Name</th>
              <th className="py-3 px-4">Date Issued</th>
              <th className="py-3 px-4">Validity</th>
              <th className="py-3 px-4 text-right">Total Quoted</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {quotations.map((q) => (
              <tr key={q.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-purple-400">{q.quotationNumber}</td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-200">{q.customerName}</div>
                  <div className="text-[10px] text-slate-500">{q.itemsCount} Quoted Line Items</div>
                </td>
                <td className="py-3 px-4 text-slate-400">{formatDate(q.date)}</td>
                <td className="py-3 px-4 text-slate-300 flex items-center gap-1 mt-2">
                  <Clock className="h-3 w-3 text-slate-500" />
                  <span>Valid until {formatDate(q.validUntil)}</span>
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                  {formatCurrencyINR(q.totalAmount)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase border ${
                    q.status === 'accepted'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : q.status === 'converted'
                      ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                      : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                  }`}>
                    {q.status}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    {q.status !== 'converted' && (
                      <button
                        onClick={() => handleConvertToInvoice(q)}
                        className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 text-blue-400 border border-blue-500/30 font-semibold text-[11px] transition-colors"
                        title="1-Click Convert to Invoice"
                      >
                        <span>Convert to Invoice</span>
                        <ArrowRight className="h-3 w-3" />
                      </button>
                    )}
                    <button className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200">
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

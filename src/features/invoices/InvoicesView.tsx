import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  Filter, 
  FileText, 
  Printer, 
  Download, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Eye,
  PauseCircle,
  ArrowRight
} from 'lucide-react';
import { formatCurrencyINR, formatDate } from '../../lib/utils';
import { useNavStore } from '../../store/useNavStore';

interface InvoiceListItem {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerGstin: string;
  placeOfSupply: string;
  issueDate: string;
  taxableAmount: number;
  totalTax: number;
  totalAmount: number;
  paymentStatus: 'paid' | 'unpaid' | 'partially_paid';
  status: 'issued' | 'draft' | 'parked';
}

export const InvoicesView: React.FC = () => {
  const { toggleParkedDrawer } = useNavStore();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'issued' | 'drafts'>('all');
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  // Mock initial invoices dataset
  const [invoices] = useState<InvoiceListItem[]>([
    {
      id: '1',
      invoiceNumber: 'SKY/2026-27/0042',
      customerName: 'SkyHigh Drones Pvt Ltd',
      customerGstin: '21AABCS9821K1ZZ',
      placeOfSupply: 'Odisha (21)',
      issueDate: '2026-11-14',
      taxableAmount: 38305.08,
      totalTax: 6894.92,
      totalAmount: 45200.00,
      paymentStatus: 'paid',
      status: 'issued',
    },
    {
      id: '2',
      invoiceNumber: 'SKY/2026-27/0041',
      customerName: 'Garuda Tech Aerospace',
      customerGstin: '29AAACG8412F1Z8',
      placeOfSupply: 'Karnataka (29)',
      issueDate: '2026-11-14',
      taxableAmount: 75000.00,
      totalTax: 13500.00,
      totalAmount: 88500.00,
      paymentStatus: 'unpaid',
      status: 'issued',
    },
    {
      id: '3',
      invoiceNumber: 'SKY/2026-27/0040',
      customerName: 'Rajesh Sharma (FPV Hobbyist)',
      customerGstin: 'URP (Consumer)',
      placeOfSupply: 'Odisha (21)',
      issueDate: '2026-11-14',
      taxableAmount: 7593.22,
      totalTax: 1366.78,
      totalAmount: 8960.00,
      paymentStatus: 'paid',
      status: 'issued',
    },
    {
      id: '4',
      invoiceNumber: 'DRF-PC1-20261114-001',
      customerName: 'AeroDynamics India',
      customerGstin: '21AAACA9999P1Z2',
      placeOfSupply: 'Odisha (21)',
      issueDate: 'Draft (In prep)',
      taxableAmount: 20762.71,
      totalTax: 3737.29,
      totalAmount: 24500.00,
      paymentStatus: 'unpaid',
      status: 'parked',
    }
  ]);

  const filteredInvoices = invoices.filter((inv) => {
    const matchesSearch = 
      inv.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.customerGstin.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activeTab === 'issued') return matchesSearch && inv.status === 'issued';
    if (activeTab === 'drafts') return matchesSearch && (inv.status === 'draft' || inv.status === 'parked');
    return matchesSearch;
  });

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search invoice number, customer or GSTIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        {/* Tab Controls & New Invoice Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          <div className="flex items-center bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setActiveTab('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'all' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setActiveTab('issued')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'issued' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Issued
            </button>
            <button
              onClick={() => setActiveTab('drafts')}
              className={`px-3 py-1.5 rounded-md font-medium transition-all ${
                activeTab === 'drafts' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Drafts / Parked
            </button>
          </div>

          <button
            onClick={() => setIsEditorOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>New Tax Invoice</span>
          </button>
        </div>
      </div>

      {/* Invoices Data Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase text-[10px]">
              <th className="py-3 px-4">Invoice No</th>
              <th className="py-3 px-4">Date</th>
              <th className="py-3 px-4">Customer & GSTIN</th>
              <th className="py-3 px-4">Place of Supply</th>
              <th className="py-3 px-4 text-right">Taxable</th>
              <th className="py-3 px-4 text-right">Total Amount</th>
              <th className="py-3 px-4 text-center">Status</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filteredInvoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-mono font-bold text-blue-400">{inv.invoiceNumber}</div>
                  <span className="text-[10px] text-slate-500 uppercase">{inv.status}</span>
                </td>
                <td className="py-3 px-4 text-slate-400 font-medium">
                  {inv.issueDate}
                </td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-200">{inv.customerName}</div>
                  <div className="text-[10px] text-slate-500 font-mono">{inv.customerGstin}</div>
                </td>
                <td className="py-3 px-4 text-slate-300">
                  {inv.placeOfSupply}
                </td>
                <td className="py-3 px-4 text-right font-mono text-slate-400">
                  {formatCurrencyINR(inv.taxableAmount)}
                </td>
                <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                  {formatCurrencyINR(inv.totalAmount)}
                </td>
                <td className="py-3 px-4 text-center">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                    inv.paymentStatus === 'paid'
                      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                  }`}>
                    {inv.paymentStatus.toUpperCase()}
                  </span>
                </td>
                <td className="py-3 px-4 text-center">
                  <div className="flex items-center justify-center gap-1.5 text-slate-400">
                    <button
                      className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 transition-colors"
                      title="View & Print PDF"
                    >
                      <Printer className="h-3.5 w-3.5" />
                    </button>
                    <button
                      className="p-1 rounded hover:bg-slate-800 hover:text-slate-200 transition-colors"
                      title="Download Invoice"
                    >
                      <Download className="h-3.5 w-3.5" />
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

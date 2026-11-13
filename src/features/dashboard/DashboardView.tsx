import React from 'react';
import { 
  TrendingUp, 
  FileText, 
  AlertCircle, 
  FileCheck2, 
  ArrowUpRight, 
  Search, 
  Clock, 
  CheckCircle2, 
  Plus,
  Plane,
  Boxes,
  Users
} from 'lucide-react';
import { formatCurrencyINR, formatDate } from '../../lib/utils';
import { useNavStore } from '../../store/useNavStore';

export const DashboardView: React.FC = () => {
  const { setCurrentModule } = useNavStore();

  const metrics = [
    {
      title: "Today's Sales",
      value: formatCurrencyINR(142650),
      change: "+18.4% vs yesterday",
      icon: TrendingUp,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10 border-emerald-500/20"
    },
    {
      title: "Invoices Issued",
      value: "28",
      change: "All numbers consecutive",
      icon: FileText,
      color: "text-blue-400",
      bg: "bg-blue-500/10 border-blue-500/20"
    },
    {
      title: "Pending Payments",
      value: formatCurrencyINR(68400),
      change: "4 invoices awaiting payment",
      icon: AlertCircle,
      color: "text-amber-400",
      bg: "bg-amber-500/10 border-amber-500/20"
    },
    {
      title: "Active Quotations",
      value: "7",
      change: "3 expiring this week",
      icon: FileCheck2,
      color: "text-purple-400",
      bg: "bg-purple-500/10 border-purple-500/20"
    }
  ];

  const recentInvoices = [
    {
      id: 'INV-2026-0042',
      customer: 'SkyHigh Drones Pvt Ltd',
      gstin: '21AABCS9821K1ZZ',
      amount: 45200,
      status: 'Paid',
      date: 'Today, 02:40 PM',
      type: 'B2B · Odisha'
    },
    {
      id: 'INV-2026-0041',
      customer: 'Garuda Tech Aerospace',
      gstin: '29AAACG8412F1Z8',
      amount: 88500,
      status: 'Pending',
      date: 'Today, 11:15 AM',
      type: 'B2B · Karnataka (IGST)'
    },
    {
      id: 'INV-2026-0040',
      customer: 'Rajesh Sharma (Retail FPV)',
      gstin: 'URP',
      amount: 8960,
      status: 'Paid',
      date: 'Today, 09:30 AM',
      type: 'B2C Consumer'
    },
    {
      id: 'INV-2026-0039',
      customer: 'Bharat Drone Defense',
      gstin: '07AAACB4421M1ZX',
      amount: 198000,
      status: 'Paid',
      date: 'Yesterday',
      type: 'B2B · Delhi (IGST)'
    }
  ];

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              className="p-4 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur hover:border-slate-700 transition-all shadow-sm"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-medium text-slate-400">{item.title}</span>
                <div className={`p-2 rounded-lg border ${item.bg}`}>
                  <Icon className={`h-4 w-4 ${item.color}`} />
                </div>
              </div>
              <div className="text-xl font-bold text-slate-100 font-mono tracking-tight">{item.value}</div>
              <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-1">
                <span>{item.change}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick Launchpad & Workflows */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Invoices Table (2 cols) */}
        <div className="lg:col-span-2 rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-100">Recent Invoices Issued</h2>
              <p className="text-xs text-slate-400">Latest statutory invoices generated across billing counters</p>
            </div>
            <button
              onClick={() => setCurrentModule('invoices')}
              className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowUpRight className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-500 font-semibold uppercase text-[10px]">
                  <th className="pb-2.5">Invoice No</th>
                  <th className="pb-2.5">Customer & Type</th>
                  <th className="pb-2.5">Amount</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 font-mono font-bold text-blue-400">{inv.id}</td>
                    <td className="py-3">
                      <div className="font-semibold text-slate-200">{inv.customer}</div>
                      <div className="text-[10px] text-slate-500">{inv.type}</div>
                    </td>
                    <td className="py-3 font-mono font-bold text-slate-100">
                      {formatCurrencyINR(inv.amount)}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                        inv.status === 'Paid'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                      }`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="py-3 text-slate-400 text-[11px]">{inv.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions & Fast Memory Access (1 col) */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-100">Instant Billing Actions</h2>
            <p className="text-xs text-slate-400">Common workflows designed for zero friction</p>
            
            <div className="space-y-2 pt-1">
              <button
                onClick={() => setCurrentModule('invoices')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-blue-500/30 bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 transition-all text-left text-xs font-medium"
              >
                <div className="flex items-center gap-2.5">
                  <Plus className="h-4 w-4" />
                  <div>
                    <div className="font-bold text-slate-100">Create Tax Invoice</div>
                    <div className="text-[10px] text-slate-400">Auto-fill customer & UAV parts</div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-blue-400" />
              </button>

              <button
                onClick={() => setCurrentModule('quotations')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300 transition-all text-left text-xs font-medium"
              >
                <div className="flex items-center gap-2.5">
                  <FileCheck2 className="h-4 w-4 text-purple-400" />
                  <div>
                    <div className="font-bold text-slate-200">Prepare Quotation</div>
                    <div className="text-[10px] text-slate-400">Formal price quote with validity</div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-500" />
              </button>

              <button
                onClick={() => setCurrentModule('products')}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-slate-800 hover:border-slate-700 bg-slate-850 hover:bg-slate-800 text-slate-300 transition-all text-left text-xs font-medium"
              >
                <div className="flex items-center gap-2.5">
                  <Boxes className="h-4 w-4 text-emerald-400" />
                  <div>
                    <div className="font-bold text-slate-200">Product Memory Lookup</div>
                    <div className="text-[10px] text-slate-400">Search SKUs, HSN codes, default rates</div>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 text-slate-500" />
              </button>
            </div>
          </div>

          {/* Connected Teams Banner */}
          <div className="rounded-xl border border-slate-800 bg-gradient-to-br from-blue-950/40 to-slate-900 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-400 mb-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Multi-Computer Sync Active</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Changes to products or customers saved on this machine propagate to all authorized counters automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

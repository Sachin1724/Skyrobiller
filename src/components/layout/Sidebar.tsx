import React from 'react';
import {
  LayoutDashboard,
  FileText,
  FileCheck2,
  Boxes,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  Laptop,
  CheckCircle2,
  Clock,
  Radio
} from 'lucide-react';
import { useNavStore, AppModule } from '../../store/useNavStore';
import { useSystemStore } from '../../store/useSystemStore';

interface NavItem {
  id: AppModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'quotations', label: 'Quotations', icon: FileCheck2 },
  { id: 'products', label: 'Product Memory', icon: Boxes },
  { id: 'customers', label: 'Customer Memory', icon: Users },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'reports', label: 'Reports & Sync', icon: BarChart3 },
  { id: 'settings', label: 'Settings & Admin', icon: Settings },
];

export const Sidebar: React.FC = () => {
  const { currentModule, setCurrentModule } = useNavStore();
  const { deviceInfo, isOnline, syncStatus } = useSystemStore();

  return (
    <aside className="w-64 bg-slate-900/95 border-r border-slate-800/80 flex flex-col justify-between select-none h-full text-slate-300">
      {/* Top Navigation Links */}
      <div className="p-3">
        <div className="px-3 py-2 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
          Billing Modules
        </div>
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setCurrentModule(item.id)}
                className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-sm shadow-blue-500/10'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`h-4 w-4 ${isActive ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-blue-500/20 text-blue-300">
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Device & Sync Status Card */}
      <div className="p-3 border-t border-slate-800/80 bg-slate-950/40">
        <div className="p-2.5 rounded-lg border border-slate-800 bg-slate-900/60 text-[11px] space-y-2">
          {/* Device identity */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-300 font-medium">
              <Laptop className="h-3.5 w-3.5 text-blue-400" />
              <span className="truncate max-w-[120px]">{deviceInfo?.hostname || 'Billing PC-1'}</span>
            </div>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-medium">
              <CheckCircle2 className="h-2.5 w-2.5" />
              Authorized
            </span>
          </div>

          {/* Sync heartbeat */}
          <div className="flex items-center justify-between text-slate-500 text-[10px] pt-1 border-t border-slate-800/60">
            <div className="flex items-center gap-1.5">
              <Radio className={`h-3 w-3 ${isOnline ? 'text-emerald-400 animate-pulse' : 'text-amber-500'}`} />
              <span>{isOnline ? 'Cloud Synced' : 'Offline Cache'}</span>
            </div>
            <div className="flex items-center gap-1 text-slate-400">
              <Clock className="h-2.5 w-2.5" />
              <span>Just now</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};

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
  CircleHelp,
} from 'lucide-react';
import { useNavStore, AppModule } from '../../store/useNavStore';
import { useSystemStore } from '../../store/useSystemStore';

interface NavItem {
  id: AppModule;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'invoices', label: 'Invoices', icon: FileText },
  { id: 'quotations', label: 'Quotations', icon: FileCheck2 },
  { id: 'payments', label: 'Payments', icon: CreditCard },
  { id: 'products', label: 'Products', icon: Boxes },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
  { id: 'help', label: 'Help', icon: CircleHelp },
];

export const Sidebar: React.FC = () => {
  const { currentModule, setCurrentModule } = useNavStore();
  const hostname = useSystemStore((s) => s.deviceInfo?.hostname);
  const logo = useSystemStore((s) => s.company.logo);
  const tradeName = useSystemStore((s) => s.company.tradeName);

  return (
    <aside className="w-52 shrink-0 bg-sidebar border-r border-line/60 flex flex-col justify-between h-full">
      <div>
      {logo && (
        <div className="px-4 pt-4 pb-1">
          <img src={logo} alt={tradeName} width={160} height={48} className="h-12 w-full object-contain object-left" />
        </div>
      )}
      <nav aria-label="Modules" className="p-2.5 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentModule === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentModule(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] transition-colors ${
                isActive ? 'bg-ink/10 font-medium text-ink' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-accent' : ''}`} aria-hidden />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      </div>

      <div className="p-4 flex items-center gap-2 text-[11px] text-ink-2 min-w-0">
        <Laptop className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{hostname ?? 'This computer'} · Local data</span>
      </div>
    </aside>
  );
};

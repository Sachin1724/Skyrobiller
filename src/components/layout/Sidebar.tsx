import React, { useLayoutEffect, useRef } from 'react';
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
import { slideTo } from '../../lib/motion';
import appLogo from '../../assets/logo.png';

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
  const nav = useRef<HTMLElement>(null);
  const pill = useRef<HTMLDivElement>(null);
  const placed = useRef(false);

  // The highlight glides to the active item instead of jumping
  useLayoutEffect(() => {
    const active = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!active || !pill.current) return;
    slideTo(pill.current, active.offsetTop, !placed.current); // first placement is instant
    placed.current = true;
  }, [currentModule]);

  return (
    <aside className="w-52 shrink-0 bg-sidebar border-r border-line/60 flex flex-col justify-between h-full">
      <div>
        <div className="flex items-center gap-2.5 px-4 pt-4 pb-2">
          <img src={logo || appLogo} alt="" width={30} height={30} className="h-[30px] w-[30px] rounded-lg object-contain" />
          <div className="min-w-0">
            <div className="text-[13px] font-semibold tracking-tight leading-tight">Skyro Biller</div>
            <div className="text-[11px] text-ink-2 leading-tight truncate">{tradeName}</div>
          </div>
        </div>
        <nav ref={nav} aria-label="Modules" data-tour="sidebar-nav" className="relative m-2.5 space-y-0.5">
          <div ref={pill} aria-hidden className="absolute left-0 top-0 h-8 w-full rounded-lg bg-surface shadow-sm ring-1 ring-line/70" />
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                data-tour={`nav-${item.id}`}
                onClick={() => setCurrentModule(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`relative w-full flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[13px] transition-colors ${
                  isActive ? 'font-medium text-ink' : 'text-ink-2 hover:text-ink'
                }`}
              >
                <Icon className={`h-4 w-4 transition-colors ${isActive ? 'text-accent' : ''}`} aria-hidden />
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

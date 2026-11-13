import React, { useState } from 'react';
import { Plus, Search, Boxes, Tag, Edit3, ShieldAlert, Check } from 'lucide-react';
import { formatCurrencyINR } from '../../lib/utils';

export interface ProductItem {
  id: string;
  sku: string;
  name: string;
  brand: string;
  description: string;
  unit: string;
  hsnCode: string;
  gstRate: number;
  defaultPrice: number;
  searchAliases: string[];
}

export const ProductsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Initial catalogue memory items for UAV components
  const [products, setProducts] = useState<ProductItem[]>([
    {
      id: '1',
      sku: 'SB-F405-V4',
      name: 'SpeedyBee F405 V4 55A BLS Stack',
      brand: 'SpeedyBee',
      description: 'Flight Controller 30x30 with 55A 4-in-1 ESC',
      unit: 'PCS',
      hsnCode: '85269190',
      gstRate: 18.0,
      defaultPrice: 5800.00,
      searchAliases: ['speedybee', 'f405', 'fc stack', '55a']
    },
    {
      id: '2',
      sku: 'TM-F60-PRO-V',
      name: 'T-Motor F60 PRO V 1950KV Brushless Motor',
      brand: 'T-Motor',
      description: 'High-torque racing and freestyle brushless motor',
      unit: 'PCS',
      hsnCode: '85011019',
      gstRate: 18.0,
      defaultPrice: 2450.00,
      searchAliases: ['motor', 'tmotor', '1950kv', 'f60']
    },
    {
      id: '3',
      sku: 'CX-VISTA-NEBULA',
      name: 'Caddx Nebula Pro Digital HD Vista Kit',
      brand: 'Caddx',
      description: 'Digital FPV VTX system compatible with DJI Goggles',
      unit: 'PCS',
      hsnCode: '85258900',
      gstRate: 18.0,
      defaultPrice: 14200.00,
      searchAliases: ['vtx', 'caddx', 'nebula', 'vista']
    },
    {
      id: '4',
      sku: 'HQ-V1S-5043',
      name: 'HQProp DP 5X4.3X3 V1S Polycarbonate Propeller',
      brand: 'HQProp',
      description: 'Tri-blade 5-inch drone propeller set (2CW + 2CCW)',
      unit: 'SET',
      hsnCode: '88033000',
      gstRate: 18.0,
      defaultPrice: 280.00,
      searchAliases: ['prop', 'props', '5 inch', 'hqprop']
    },
    {
      id: '5',
      sku: 'TBS-XF-NANO',
      name: 'TBS Crossfire Nano RX Pro Receiver',
      brand: 'Team BlackSheep',
      description: 'Long-range ultra-light telemetry receiver',
      unit: 'PCS',
      hsnCode: '85269200',
      gstRate: 18.0,
      defaultPrice: 3200.00,
      searchAliases: ['crossfire', 'nano rx', 'tbs', 'receiver']
    }
  ]);

  const filtered = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.brand.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.searchAliases.some(alias => alias.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Top Banner Notice: Catalogue Protection */}
      <div className="p-4 rounded-xl border border-blue-500/20 bg-blue-950/20 flex items-start gap-3">
        <Boxes className="h-5 w-5 text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs space-y-0.5">
          <div className="font-bold text-slate-200">Product Memory Active</div>
          <p className="text-slate-400 leading-relaxed">
            These saved products automatically populate invoice line items, HSN codes, and GST rates. Overriding a price on an individual invoice does not alter these saved catalogue rates.
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search SKU, name, brand, or alias..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add Catalogue Product</span>
        </button>
      </div>

      {/* Products Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase text-[10px]">
              <th className="py-3 px-4">SKU Code</th>
              <th className="py-3 px-4">Product Name & Brand</th>
              <th className="py-3 px-4">Unit</th>
              <th className="py-3 px-4">HSN/SAC</th>
              <th className="py-3 px-4">GST Rate</th>
              <th className="py-3 px-4 text-right">Default Selling Price</th>
              <th className="py-3 px-4">Aliases</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4 font-mono font-bold text-blue-400">{item.sku}</td>
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-200">{item.name}</div>
                  <div className="text-[10px] text-slate-500">{item.brand} · {item.description}</div>
                </td>
                <td className="py-3 px-4 font-medium text-slate-300">{item.unit}</td>
                <td className="py-3 px-4 font-mono text-slate-400">{item.hsnCode}</td>
                <td className="py-3 px-4 font-mono text-slate-300">{item.gstRate}%</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-slate-100">
                  {formatCurrencyINR(item.defaultPrice)}
                </td>
                <td className="py-3 px-4">
                  <div className="flex flex-wrap gap-1">
                    {item.searchAliases.map((a, i) => (
                      <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 text-[10px] text-slate-400 font-mono">
                        {a}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="py-3 px-4 text-center">
                  <button className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors">
                    <Edit3 className="h-3.5 w-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

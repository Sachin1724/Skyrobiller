import React, { useState } from 'react';
import { Plus, Search, Users, MapPin, Phone, Mail, Building, Edit3 } from 'lucide-react';
import { getIndianStateName } from '../../lib/utils';

export interface CustomerItem {
  id: string;
  businessName: string;
  contactPerson: string;
  gstin: string; // Empty for B2C Consumer
  email: string;
  phone: string;
  stateCode: string;
  stateName: string;
  city: string;
  address: string;
  paymentTermsDays: number;
}

export const CustomersView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');

  const [customers] = useState<CustomerItem[]>([
    {
      id: '1',
      businessName: 'SkyHigh Drones Pvt Ltd',
      contactPerson: 'Anand Verma',
      gstin: '21AABCS9821K1ZZ',
      email: 'procurement@skyhighdrones.com',
      phone: '+91 94370 11223',
      stateCode: '21',
      stateName: 'Odisha',
      city: 'Bhubaneswar',
      address: 'Plot 102, Mancheswar Industrial Estate, Sector B',
      paymentTermsDays: 15
    },
    {
      id: '2',
      businessName: 'Garuda Tech Aerospace',
      contactPerson: 'Rohan Deshmukh',
      gstin: '29AAACG8412F1Z8',
      email: 'rohan@garudatech.io',
      phone: '+91 98801 55667',
      stateCode: '29',
      stateName: 'Karnataka',
      city: 'Bengaluru',
      address: 'Indiranagar 100ft Road, 4th Block',
      paymentTermsDays: 30
    },
    {
      id: '3',
      businessName: 'Bharat Drone Defense Solutions',
      contactPerson: 'Col. Sanjeev Kapoor',
      gstin: '07AAACB4421M1ZX',
      email: 'supply@bharatdefense.in',
      phone: '+91 98110 99887',
      stateCode: '07',
      stateName: 'Delhi',
      city: 'New Delhi',
      address: 'Barakhamba Road, Connaught Place',
      paymentTermsDays: 45
    },
    {
      id: '4',
      businessName: 'Rajesh Sharma (FPV Hobbyist)',
      contactPerson: 'Rajesh Sharma',
      gstin: 'URP (Unregistered Consumer)',
      email: 'rajesh.fpv@gmail.com',
      phone: '+91 99371 44332',
      stateCode: '21',
      stateName: 'Odisha',
      city: 'Cuttack',
      address: 'CDA Sector 9, Bidanasi',
      paymentTermsDays: 0
    }
  ]);

  const filtered = customers.filter(c => 
    c.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.gstin.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.phone.includes(searchTerm) ||
    c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in p-6">
      {/* Banner */}
      <div className="p-4 rounded-xl border border-purple-500/20 bg-purple-950/20 flex items-start gap-3">
        <Users className="h-5 w-5 text-purple-400 mt-0.5 shrink-0" />
        <div className="text-xs space-y-0.5">
          <div className="font-bold text-slate-200">Customer Memory Active</div>
          <p className="text-slate-400 leading-relaxed">
            Selecting a saved customer auto-populates billing details, payment terms, and Place of Supply (POS). Invoices billed to same-state customers apply CGST + SGST, while out-of-state customers apply IGST automatically.
          </p>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
          <input
            type="text"
            placeholder="Search customer, GSTIN, phone, or city..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
          />
        </div>

        <button
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-sm transition-colors"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Customer</span>
        </button>
      </div>

      {/* Customers Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/80 backdrop-blur overflow-hidden">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-slate-800 bg-slate-950/40 text-slate-400 font-semibold uppercase text-[10px]">
              <th className="py-3 px-4">Business / Client Name</th>
              <th className="py-3 px-4">GSTIN & Type</th>
              <th className="py-3 px-4">Place of Supply (POS)</th>
              <th className="py-3 px-4">Contact Person</th>
              <th className="py-3 px-4">Phone & Email</th>
              <th className="py-3 px-4 text-center">Terms</th>
              <th className="py-3 px-4 text-center">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {filtered.map((item) => (
              <tr key={item.id} className="hover:bg-slate-800/40 transition-colors">
                <td className="py-3 px-4">
                  <div className="font-semibold text-slate-200">{item.businessName}</div>
                  <div className="text-[10px] text-slate-500">{item.address}, {item.city}</div>
                </td>
                <td className="py-3 px-4">
                  <div className="font-mono text-blue-400 font-bold">{item.gstin}</div>
                  <div className="text-[10px] text-slate-500">
                    {item.gstin.startsWith('URP') ? 'B2C Retail' : 'B2B Registered'}
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono text-[11px]">
                    State {item.stateCode} · {item.stateName}
                  </span>
                </td>
                <td className="py-3 px-4 text-slate-300 font-medium">
                  {item.contactPerson}
                </td>
                <td className="py-3 px-4 text-slate-400">
                  <div>{item.phone}</div>
                  <div className="text-[10px] text-slate-500">{item.email}</div>
                </td>
                <td className="py-3 px-4 text-center font-mono text-slate-300">
                  {item.paymentTermsDays === 0 ? 'Immediate' : `${item.paymentTermsDays} Days`}
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

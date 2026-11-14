import React, { useEffect, useRef, useState } from 'react';
import { Plus, Search, Pencil, Upload, History, Users } from 'lucide-react';
import { GSTIN_PATTERN, INDIAN_STATES, formatCurrencyINR, formatDate } from '../../lib/utils';
import { searchCustomers, saveCustomer, importCustomers, listInvoices, outstandingOf, paymentStatusOf, type Customer, type Invoice } from '../../lib/db';
import { csvRecords, downloadCsv } from '../../lib/csv';
import { useSystemStore } from '../../store/useSystemStore';
import { Modal } from '../../components/Modal';
import { SkeletonRows, EmptyState } from '../../components/Skeleton';
import { useMenuAction } from '../../store/useNavStore';

export const CustomersView: React.FC = () => {
  const homeState = useSystemStore((s) => s.company.stateCode);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loaded, setLoaded] = useState(false);
  // undefined = closed, null = adding, Customer = editing
  const [editing, setEditing] = useState<Customer | null | undefined>(undefined);
  const [stateCode, setStateCode] = useState(homeState);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [history, setHistory] = useState<{ customer: Customer; invoices: Invoice[] } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = () => searchCustomers(searchTerm).then((rows) => { setCustomers(rows); setLoaded(true); }).catch((e) => setError(e.message));
  useEffect(() => { reload(); }, [searchTerm]);
  const defaultTermsDays = useSystemStore((s) => s.prefs.defaultTermsDays);
  useMenuAction({ 'new-customer': () => openForm(null), 'import-customers': () => fileInput.current?.click() });

  const openForm = (c: Customer | null) => {
    setError('');
    setStateCode(c?.stateCode ?? homeState);
    setEditing(c);
  };

  const openHistory = (customer: Customer) =>
    listInvoices()
      .then((all) => setHistory({ customer, invoices: all.filter((i) => i.customer.id === customer.id) }))
      .catch((e) => setError(e.message));

  // Whole file or nothing: every row is checked first, then imported in one transaction
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setNotice('');
    try {
      const records = csvRecords(await file.text(), ['name', 'address', 'pincode', 'state_code']);
      const problems: string[] = [];
      const rows = records.map((r, i) => {
        const gstin = (r.gstin ?? '').toUpperCase();
        const code = r.state_code.padStart(2, '0');
        const terms = Number(r.terms_days || 15);
        const bad = [
          !r.name && 'name is empty', !r.address && 'address is empty', !/^[0-9]{6}$/.test(r.pincode) && 'pincode must be 6 digits',
          !INDIAN_STATES[code] && 'state_code is not a GST state code',
          gstin && !new RegExp(`^${GSTIN_PATTERN}$`).test(gstin) && 'gstin is not valid',
          gstin && gstin.slice(0, 2) !== code && 'gstin does not match state_code', !(terms >= 0) && 'terms_days must be a number',
        ].filter(Boolean);
        if (bad.length) problems.push(`Row ${i + 2}: ${bad.join(', ')}`);
        return { businessName: r.name, contactPerson: r.contact ?? '', gstin, email: r.email ?? '', phone: r.phone ?? '', billingAddress: r.address, stateCode: code, stateName: INDIAN_STATES[code], pincode: r.pincode, paymentTermsDays: terms };
      });
      if (rows.length === 0) throw new Error('The file has no customer rows.');
      if (problems.length) throw new Error(`Nothing was imported. Fix these rows and import again. ${problems.slice(0, 5).join('. ')}${problems.length > 5 ? `. And ${problems.length - 5} more.` : '.'}`);
      await importCustomers(rows);
      setError('');
      setNotice(`Imported ${rows.length} rows. Customers whose GSTIN was already saved were skipped.`);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const downloadTemplate = () => downloadCsv('customers-template', [
    ['name', 'gstin', 'address', 'pincode', 'state_code', 'contact', 'phone', 'email', 'terms_days'],
    ['SkyHigh Drones Pvt Ltd', '21AABCS9821K1ZZ', 'Plot 102, Mancheswar Industrial Estate, Bhubaneswar', '751010', '21', 'Anand Verma', '9437011223', 'accounts@example.com', 15],
  ]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    if (f.gstin && f.gstin.slice(0, 2) !== stateCode) {
      setError(`This GSTIN belongs to state ${f.gstin.slice(0, 2)}, but state ${stateCode} is selected. Change one to match.`);
      return;
    }
    try {
      await saveCustomer({
        id: editing?.id,
        businessName: f.businessName.trim(),
        contactPerson: f.contactPerson.trim(),
        gstin: f.gstin,
        email: f.email.trim(),
        phone: f.phone.trim(),
        billingAddress: f.billingAddress.trim(),
        stateCode,
        stateName: INDIAN_STATES[stateCode],
        pincode: f.pincode,
        paymentTermsDays: Number(f.paymentTermsDays),
      });
      setEditing(undefined);
      reload();
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-80">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-3 pointer-events-none" aria-hidden />
          <input
            type="search"
            aria-label="Search customers"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search name, contact, GSTIN or phone…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadTemplate} className="btn btn-plain">CSV Template</button>
          <button onClick={() => fileInput.current?.click()} className="btn">
            <Upload className="h-4 w-4" aria-hidden />
            Import CSV
          </button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" aria-label="Import customers from CSV" />
          <button onClick={() => openForm(null)} className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            Add Customer
          </button>
        </div>
      </div>

      <p aria-live="polite" className="text-success font-medium empty:hidden">{notice}</p>
      {error && editing === undefined && <p role="alert" className="error">{error}</p>}

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>Customer</th>
              <th>GSTIN</th>
              <th>Place of Supply</th>
              <th>Contact</th>
              <th className="num">Terms</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {!loaded && <SkeletonRows columns={6} />}
            {loaded && customers.length === 0 && (
              <tr>
                <td colSpan={6}>
                  {searchTerm
                    ? <p className="empty">No customers match this search.</p>
                    : <EmptyState icon={Users} title="No customers yet" hint="Save a customer once and their address, GSTIN and place of supply fill in on every bill." action={{ label: 'Add Your First Customer', onClick: () => openForm(null) }} />}
                </td>
              </tr>
            )}
            {customers.map((item) => (
              <tr key={item.id}>
                <td className="max-w-xs">
                  <div className="font-medium truncate">{item.businessName}</div>
                  <div className="text-xs text-ink-2 truncate">{item.billingAddress} - {item.pincode}</div>
                </td>
                <td className="tabular-nums whitespace-nowrap">
                  {item.gstin || <span className="badge">Unregistered</span>}
                </td>
                <td className="whitespace-nowrap">{item.stateName} ({item.stateCode})</td>
                <td className="max-w-[14rem]">
                  <div className="truncate">{item.contactPerson}</div>
                  <div className="text-xs text-ink-2 truncate">{[item.phone, item.email].filter(Boolean).join(' · ')}</div>
                </td>
                <td className="num">{item.paymentTermsDays === 0 ? 'Immediate' : `${item.paymentTermsDays} days`}</td>
                <td className="num">
                  <button onClick={() => openHistory(item)} className="btn btn-icon" aria-label={`Billing history of ${item.businessName}`} title="Billing history">
                    <History className="h-3.5 w-3.5" aria-hidden />
                  </button>
                  <button onClick={() => openForm(item)} className="btn btn-icon" aria-label={`Edit ${item.businessName}`} title="Edit">
                    <Pencil className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {history && (
        <Modal wide title={`Billing History · ${history.customer.businessName}`} onClose={() => setHistory(null)}>
          <p className="text-ink-2 pb-3">
            {history.invoices.length} invoices · Billed{' '}
            <span className="font-medium text-ink tabular-nums">{formatCurrencyINR(history.invoices.filter((i) => i.status === 'issued').reduce((t, i) => t + i.total, 0))}</span>
            {' '}· Outstanding{' '}
            <span className="font-medium text-ink tabular-nums">{formatCurrencyINR(history.invoices.reduce((t, i) => t + outstandingOf(i), 0))}</span>
          </p>
          <div className="card overflow-hidden max-h-[60vh] overflow-y-auto overscroll-contain">
            <table className="tbl">
              <thead>
                <tr><th>Invoice No.</th><th>Date</th><th className="num">Total</th><th className="num">Outstanding</th><th>Status</th></tr>
              </thead>
              <tbody>
                {history.invoices.length === 0 && <tr><td colSpan={5} className="empty">No invoices issued to this customer yet.</td></tr>}
                {history.invoices.map((inv) => {
                  const status = paymentStatusOf(inv);
                  return (
                    <tr key={inv.id}>
                      <td className="font-medium tabular-nums whitespace-nowrap">{inv.invoiceNumber}</td>
                      <td className="whitespace-nowrap">{formatDate(inv.issueDate)}</td>
                      <td className="num">{formatCurrencyINR(inv.total)}</td>
                      <td className="num">{formatCurrencyINR(outstandingOf(inv))}</td>
                      <td><span className={status.badge}>{status.label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Modal>
      )}

      {editing !== undefined && (
        <Modal title={editing ? 'Edit Customer' : 'Add Customer'} onClose={() => setEditing(undefined)}>
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="label col-span-2">Business or Customer Name
                <input name="businessName" required autoFocus defaultValue={editing?.businessName} className="field" />
              </label>
              <label className="label">GSTIN (Blank if Unregistered)
                <input
                  name="gstin"
                  pattern={GSTIN_PATTERN}
                  title="15-character GSTIN, for example 21AAACS1234D1Z5"
                  spellCheck={false}
                  defaultValue={editing?.gstin}
                  placeholder="21AAACS1234D1Z5"
                  onChange={(e) => {
                    e.target.value = e.target.value.toUpperCase();
                    // First two digits of a GSTIN are the state code
                    const code = e.target.value.slice(0, 2);
                    if (INDIAN_STATES[code]) setStateCode(code);
                  }}
                  className="field"
                />
              </label>
              <label className="label">State (Place of Supply)
                <select value={stateCode} onChange={(e) => setStateCode(e.target.value)} className="field">
                  {Object.entries(INDIAN_STATES).sort().map(([code, name]) => (
                    <option key={code} value={code}>{code} · {name}</option>
                  ))}
                </select>
              </label>
              <label className="label col-span-2">Billing Address
                <input name="billingAddress" required defaultValue={editing?.billingAddress} className="field" />
              </label>
              <label className="label">Pincode
                <input name="pincode" required inputMode="numeric" pattern="[0-9]{6}" defaultValue={editing?.pincode} placeholder="751024" className="field" />
              </label>
              <label className="label">Payment Terms (Days, 0 = Immediate)
                <input name="paymentTermsDays" type="number" required min="0" step="1" defaultValue={editing?.paymentTermsDays ?? defaultTermsDays} className="field" />
              </label>
              <label className="label">Contact Person
                <input name="contactPerson" defaultValue={editing?.contactPerson} className="field" />
              </label>
              <label className="label">Phone
                <input name="phone" type="tel" defaultValue={editing?.phone} className="field" />
              </label>
              <label className="label col-span-2">Email
                <input name="email" type="email" spellCheck={false} defaultValue={editing?.email} className="field" />
              </label>
            </div>
            {error && <p role="alert" className="error">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(undefined)} className="btn">Cancel</button>
              <button type="submit" className="btn btn-primary">Save Customer</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

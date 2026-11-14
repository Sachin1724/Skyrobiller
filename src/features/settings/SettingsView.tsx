import React, { useRef, useState } from 'react';
import { toast } from '../../store/useToastStore';
import { friendlyError } from '../../lib/friendlyError';
import { AlertTriangle } from 'lucide-react';
import { GSTIN_PATTERN, INDIAN_STATES, todayISO, addDaysISO } from '../../lib/utils';
import { computeInvoice, type InvoiceLine } from '../../lib/gst';
import { documentHtml, TEMPLATES, ACCENT_PRESETS, DENSITIES, COPY_LABELS, type TemplateId, type Density, type PrintableDocument } from '../../lib/pdf';
import { useSystemStore, type Company, type Prefs } from '../../store/useSystemStore';
import { useMenuAction, type AppModule } from '../../store/useNavStore';
import { compressImage } from '../../lib/image';
import { confirmDialog } from '../../components/ConfirmDialog';
import type { BackupSettings } from '../../types/electron';

const START_SCREENS: [AppModule, string][] = [['dashboard', 'Dashboard'], ['invoices', 'Invoices'], ['quotations', 'Quotations'], ['payments', 'Payments'], ['reports', 'Reports']];
const DASHBOARD_CARDS: [string, string][] = [['month', 'Sales This Month'], ['year', 'Sales This Financial Year'], ['outstanding', 'Outstanding'], ['progress', 'In Progress']];
const THEMES: [Prefs['theme'], string][] = [['light', 'Light'], ['dark', 'Dark'], ['system', 'Follow Windows']];

const SAMPLE_ITEMS: InvoiceLine[] = [
  { sku: 'SB-F405-V4', description: 'SpeedyBee F405 V4 Flight Controller', hsnCode: '85269190', unit: 'PCS', qty: 2, rate: 4500, discountPct: 0, gstRate: 18 },
  { sku: 'HQ-5043', description: 'HQProp 5x4.3x3 Propeller Set', hsnCode: '88073000', unit: 'SET', qty: 10, rate: 280, discountPct: 5, gstRate: 18 },
];

// A made-up invoice so the template preview shows the real layout with the real company details
const sampleDocument = (company: Company): PrintableDocument => ({
  title: 'Tax Invoice',
  number: `${company.invoicePrefix}/2026-27/0001`,
  date: todayISO(),
  secondDateLabel: 'Due Date',
  secondDate: addDaysISO(todayISO(), 15),
  company,
  customer: {
    id: 'sample', businessName: 'Sample Customer Pvt Ltd', contactPerson: 'A. Kumar', gstin: `${company.stateCode}AAACS0000A1Z5`, email: '',
    phone: '98765 00000', billingAddress: '12 Industrial Estate, Sector B', stateCode: company.stateCode, stateName: company.stateName,
    pincode: '751010', paymentTermsDays: 15,
  },
  items: SAMPLE_ITEMS,
  totals: computeInvoice(SAMPLE_ITEMS, company.stateCode, company.stateCode),
  notes: '',
});

export const SettingsView: React.FC = () => {
  const { company, updateCompany, deviceInfo, prefs, updatePrefs, backup, setBackup } = useSystemStore();
  const designSection = useRef<HTMLElement>(null);
  const customizeSection = useRef<HTMLElement>(null);
  const [template, setTemplate] = useState<TemplateId>(company.template);
  const [accent, setAccent] = useState(company.accent);
  const [density, setDensity] = useState<Density>(company.density);
  const [logo, setLogo] = useState(company.logo);
  const [signature, setSignature] = useState(company.signature);
  const [copies, setCopies] = useState(company.copies);
  const [error, setError] = useState('');

  const say = (ok: string, err = '') => { if (ok) toast.success(ok); setError(err); };

  // Menu bar: File > Back Up / Restore, Tools > Invoice Design / Customize
  useMenuAction({
    'backup': () => { handleBackup(); },
    'restore': () => { handleRestore(); },
    'invoice-design': () => designSection.current?.scrollIntoView({ block: 'start' }),
    'customize': () => customizeSection.current?.scrollIntoView({ block: 'start' }),
  });

  const setPref = (change: Partial<Prefs>) => updatePrefs(change).catch((err) => say('', `Preference not saved: ${friendlyError(err)}`));

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as unknown as Company;
    const stateCode = f.gstin.slice(0, 2);
    try {
      await updateCompany({
        ...f, invoicePrefix: f.invoicePrefix.toUpperCase(), stateCode, stateName: INDIAN_STATES[stateCode] ?? '',
        template, accent, density, logo, signature, copies,
      });
      say('Settings saved. New invoices use them; issued invoices keep their original company details.');
    } catch (err: any) {
      say('', `Not saved: ${friendlyError(err)}`);
    }
  };

  // Reads a chosen image, automatically scales and compresses it for crisp invoice rendering
  const pickImage = (set: (dataUrl: string) => void, isSignature = false) => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const maxW = isSignature ? 300 : 400;
      const maxH = isSignature ? 100 : 160;
      const res = await compressImage(file, maxW, maxH);
      set(res.dataUrl);
      say(`Image optimized (${res.originalKb} KB → ${res.compressedKb} KB, ${res.width}×${res.height}px).`);
    } catch (err: any) {
      say('', `Could not process image: ${friendlyError(err)}`);
    }
  };

  const toggleCopy = (label: string, on: boolean) =>
    setCopies((prev) => COPY_LABELS.filter((l) => (l === label ? on : prev.includes(l)))); // keeps the statutory order

  const handleBackup = async () => {
    const res = await window.electronAPI.dbBackup();
    if (res.success) say(`Backup saved to ${res.filePath}`);
    else if (res.error !== 'Cancelled') say('', `Backup failed: ${friendlyError(res.error)}`);
  };

  // Pick a file, show what is in it, and only then replace the data
  const handleRestore = async () => {
    const pick = await window.electronAPI.dbRestorePick(backup?.effectiveFolder);
    if (!pick.success) return pick.error === 'Cancelled' ? undefined : say('', pick.error ?? 'Could not read that file');
    const p = pick.preview!;
    if (!(await confirmDialog({
      title: 'Restore this backup?',
      details: [['Invoices', `${p.invoices} (latest ${p.lastInvoiceDate ?? 'none'})`], ['Customers', String(p.customers)], ['Products', String(p.products)], ['File saved', new Date(p.fileModified).toLocaleString()]],
      message: 'Restoring replaces ALL current data on this computer. The current data is kept beside the database as “.before-restore”.',
      confirmLabel: 'Restore', danger: true,
    }))) return;
    const res = await window.electronAPI.dbRestoreApply(pick.filePath!); // on success the window reloads
    if (!res.success) say('', res.error ?? 'Restore failed');
  };

  const changeBackup = (change: Partial<BackupSettings>) => window.electronAPI.backupSet(change).then(setBackup).catch((err) => say('', `Backup setting not saved: ${friendlyError(err)}`));
  const backupNow = () => window.electronAPI.backupRunNow().then((s) => { setBackup(s); s.lastError ? say('', `Backup failed: ${friendlyError(s.lastError)}`) : say(`Backup written to ${s.lastFile}`); });
  const chooseFolder = () => window.electronAPI.backupChooseFolder().then(setBackup);
  const exportLogs = async () => {
    const res = await window.electronAPI.exportLogs();
    if (res.success) say(`Logs saved to ${res.filePath}`);
    else if (res.error !== 'Cancelled') say('', `Could not export logs: ${friendlyError(res.error)}`);
  };

  const text = (name: keyof Company, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}, span = '') => (
    <label className={`label ${span}`}>{label}
      <input name={name} defaultValue={company[name] as string} className="field" {...props} />
    </label>
  );

  const imagePicker = (label: string, value: string, set: (v: string) => void, isSignature = false) => (
    <div className="flex items-end gap-3">
      {value && <img src={value} alt={`Current ${label.toLowerCase()}`} width={96} height={48} className="h-12 w-24 object-contain rounded border border-line bg-white" />}
      <label className="label">{label} (PNG or JPEG, auto-resized)
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={pickImage(set, isSignature)} className="text-xs text-ink file:btn file:mr-2 file:border-0" />
      </label>
      {value && <button type="button" onClick={() => set('')} className="btn btn-danger">Remove</button>}
    </div>
  );

  // Preview shows unsaved choices (template, colour, density, images, first copy marking) with the saved company details
  const previewHtml = documentHtml(sampleDocument(company), { template, accent, density, logo, signature, copies: copies.slice(0, 1) });

  const backupStale = !!backup && (!!backup.lastError || !backup.lastAt || Date.now() - backup.lastAt > 48 * 60 * 60 * 1000);
  const jump = (id: string) => document.getElementById(id)?.scrollIntoView({ block: 'start', behavior: 'smooth' });

  return (
    <div className="page">
      {/* Sections: one click to jump, instead of scrolling a long page */}
      <nav aria-label="Settings sections" className="sticky top-14 z-[9] -mx-6 -mt-6 px-6 py-2 flex flex-wrap gap-2 bg-bg border-b border-line">
        {[['company', 'Company'], ['bank', 'Bank & Terms'], ['design', 'Invoice Design'], ['preferences', 'Preferences'], ['backup', 'Backup']].map(([id, name]) => (
          <button key={id} type="button" onClick={() => jump(id)} className={`chip ${id === 'backup' && backupStale ? 'chip-alert' : ''}`}>{name}</button>
        ))}
      </nav>
      {error && <p role="alert" className="error">{error}</p>}

      {/* key: remount with fresh defaults once the saved profile has loaded */}
      <form key={company.legalName + company.gstin} onSubmit={handleSubmit} autoComplete="off" className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-4 items-start">
        <div className="space-y-4 min-w-0">
          <section id="company" className="card p-4 space-y-4 scroll-mt-32">
            <h2 className="text-base font-semibold tracking-tight">Company Profile</h2>
            <div className="grid grid-cols-2 gap-3">
              {text('legalName', 'Legal Name', { required: true })}
              {text('tradeName', 'Trade Name', { required: true })}
              {text('gstin', 'GSTIN (Sets the Home State)', { required: true, pattern: GSTIN_PATTERN, spellCheck: false, title: '15-character GSTIN, for example 21AAACS1234D1Z5' })}
              {text('invoicePrefix', 'Invoice Number Prefix', { required: true, pattern: '[A-Za-z0-9]{1,3}', spellCheck: false, title: '1 to 3 letters or digits. GST allows at most 16 characters in the whole invoice number.' })}
              {text('address', 'Address', { required: true }, 'col-span-2')}
              {text('phone', 'Phone', { type: 'tel' })}
              {text('email', 'Email', { type: 'email', spellCheck: false })}
            </div>
            {imagePicker('Company Logo', logo, setLogo)}
            <p className="text-xs text-ink-2">The logo appears in the sidebar and on every invoice, quotation and credit note.</p>
          </section>

          <section id="bank" className="card p-4 space-y-4 scroll-mt-32">
            <h2 className="text-base font-semibold tracking-tight">Bank Details (Printed on Invoices)</h2>
            <div className="grid grid-cols-2 gap-3">
              {text('bankName', 'Bank Name')}
              {text('accountNumber', 'Account Number', { inputMode: 'numeric', spellCheck: false })}
              {text('ifscCode', 'IFSC Code', { spellCheck: false })}
              {text('upiId', 'UPI ID (Adds a Scan-to-Pay QR to Invoices)', { spellCheck: false })}
              <label className="label col-span-2">Terms &amp; Conditions (Printed on Invoices and Quotations)
                <textarea name="terms" rows={3} defaultValue={company.terms} className="field" />
              </label>
            </div>
          </section>

          <section ref={designSection} id="design" className="card p-4 space-y-4 scroll-mt-32">
            <h2 className="text-base font-semibold tracking-tight">Invoice Design</h2>
            <div className="grid grid-cols-2 gap-3">
              <label className="label">Template
                <select value={template} onChange={(e) => setTemplate(e.target.value as TemplateId)} className="field">
                  {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => <option key={id} value={id}>{TEMPLATES[id]}</option>)}
                </select>
              </label>
              <div className="label">Text Size &amp; Spacing
                <div className="segmented self-start" role="group" aria-label="Text size and spacing">
                  {(Object.keys(DENSITIES) as Density[]).map((id) => (
                    <button type="button" key={id} aria-pressed={density === id} onClick={() => setDensity(id)}>{DENSITIES[id]}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="label">Accent Colour
              <div className="flex flex-wrap items-center gap-2">
                {Object.entries(ACCENT_PRESETS).map(([name, value]) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setAccent(value)}
                    aria-label={name}
                    aria-pressed={accent === value}
                    title={name}
                    style={{ backgroundColor: value }}
                    className="h-6 w-6 rounded border border-line aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface"
                  />
                ))}
                <input type="color" aria-label="Custom accent colour" value={accent} onChange={(e) => setAccent(e.target.value)} className="h-7 w-10 rounded bg-transparent" />
              </div>
            </div>

            {imagePicker('Signature', signature, setSignature, true)}

            <fieldset className="space-y-1.5">
              <legend className="text-xs font-medium text-ink-2 mb-1">Copies in Each Invoice PDF (None Ticked = One Unmarked Copy)</legend>
              {COPY_LABELS.map((l) => (
                <label key={l} className="flex items-center gap-2">
                  <input type="checkbox" checked={copies.includes(l)} onChange={(e) => toggleCopy(l, e.target.checked)} className="accent-accent" />
                  {l}
                </label>
              ))}
            </fieldset>
          </section>

          <div className="flex justify-end">
            <button type="submit" className="btn btn-primary">Save Settings</button>
          </div>
        </div>

        {/* A4 page (794 x 1123 px) scaled to 55%. Sticky so it stays in view while scrolling to the design controls */}
        <div className="space-y-2 xl:sticky xl:top-20">
          <h2 className="text-xs font-medium text-ink-2">Preview (Sample Data)</h2>
          <div className="w-[437px] h-[618px] overflow-hidden rounded-md border border-line bg-white">
            <iframe
              title="Invoice template preview"
              sandbox=""
              srcDoc={previewHtml}
              className="w-[794px] h-[1123px] origin-top-left scale-[0.55] pointer-events-none"
            />
          </div>
        </div>
      </form>

      {/* App preferences: applied and saved the moment they change */}
      <section ref={customizeSection} id="preferences" className="card p-4 space-y-4 max-w-3xl scroll-mt-32">
        <h2 className="text-base font-semibold tracking-tight">Customize</h2>
        <div className="grid grid-cols-2 gap-4">
          <div className="label">Theme
            <div className="segmented self-start" role="group" aria-label="Theme">
              {THEMES.map(([id, name]) => (
                <button type="button" key={id} aria-pressed={prefs.theme === id} onClick={() => setPref({ theme: id })}>{name}</button>
              ))}
            </div>
          </div>
          <div className="label">Table Rows
            <div className="segmented self-start" role="group" aria-label="Table row height">
              <button type="button" aria-pressed={prefs.density === 'comfortable'} onClick={() => setPref({ density: 'comfortable' })}>Comfortable</button>
              <button type="button" aria-pressed={prefs.density === 'compact'} onClick={() => setPref({ density: 'compact' })}>Compact</button>
            </div>
          </div>
          <div className="label col-span-2">App Accent Colour
            <div className="flex flex-wrap items-center gap-2">
              {Object.entries(ACCENT_PRESETS).map(([name, value]) => {
                const selected = prefs.accent === value || (!prefs.accent && name === 'Blue');
                return (
                  <button
                    type="button"
                    key={value}
                    onClick={() => setPref({ accent: name === 'Blue' ? '' : value })}
                    aria-label={name}
                    aria-pressed={selected}
                    title={name}
                    style={{ backgroundColor: value }}
                    className="h-6 w-6 rounded border border-line aria-pressed:ring-2 aria-pressed:ring-accent aria-pressed:ring-offset-2 aria-pressed:ring-offset-surface"
                  />
                );
              })}
              <input type="color" aria-label="Custom app accent colour" value={prefs.accent || '#2a54e0'} onChange={(e) => setPref({ accent: e.target.value })} className="h-7 w-10 rounded bg-transparent" />
            </div>
          </div>
          <label className="label">Screen Shown at Start-Up
            <select value={prefs.startScreen} onChange={(e) => setPref({ startScreen: e.target.value as AppModule })} className="field">
              {START_SCREENS.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
            </select>
          </label>
          <label className="label">Default GST Rate for New Items
            <select value={prefs.defaultGstRate} onChange={(e) => setPref({ defaultGstRate: Number(e.target.value) })} className="field">
              {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
            </select>
          </label>
          <label className="label">Default Payment Terms for New Customers (Days)
            <input type="number" min="0" step="1" value={prefs.defaultTermsDays} onChange={(e) => setPref({ defaultTermsDays: Math.max(0, Number(e.target.value) || 0) })} className="field" />
          </label>
          <fieldset className="space-y-1.5">
            <legend className="text-xs font-medium text-ink-2 mb-1">Dashboard Cards</legend>
            {DASHBOARD_CARDS.map(([key, name]) => (
              <label key={key} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={!prefs.hiddenCards.includes(key)}
                  onChange={(e) => setPref({ hiddenCards: e.target.checked ? prefs.hiddenCards.filter((k) => k !== key) : [...prefs.hiddenCards, key] })}
                  className="accent-accent"
                />
                {name}
              </label>
            ))}
          </fieldset>
        </div>
        <p className="text-xs text-ink-2">Text size: use View &gt; Zoom In and Zoom Out (Ctrl + and Ctrl -).</p>
      </section>

      <section id="backup" className={`card p-4 space-y-3 max-w-3xl scroll-mt-32 ${backupStale ? 'border-warn/60' : ''}`}>
        <h2 className="text-base font-semibold tracking-tight">Backup</h2>
        {backupStale && (
          <p role="status" className="flex items-center gap-2 text-warn font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
            {backup?.lastError ? `The last backup failed: ${friendlyError(backup.lastError)}` : backup?.lastAt ? 'The last backup is more than 2 days old.' : 'No backup has been made yet.'}
          </p>
        )}
        <p className="text-ink-2">
          All data lives in one database file on this computer{deviceInfo ? ` (${deviceInfo.hostname})` : ''}. A copy is saved automatically once a day. Point it at a USB drive or a cloud-synced folder so it survives this computer.
        </p>
        {backup && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 items-center">
            <dt className="text-ink-2">Automatic backup</dt>
            <dd><label className="flex items-center gap-2"><input type="checkbox" checked={backup.enabled} onChange={(e) => changeBackup({ enabled: e.target.checked })} className="accent-accent" />Back up daily</label></dd>
            <dt className="text-ink-2">Folder</dt>
            <dd className="flex items-center gap-2 min-w-0"><span className="truncate" title={backup.effectiveFolder}>{backup.effectiveFolder}</span><button onClick={chooseFolder} className="btn shrink-0">Change…</button></dd>
            <dt className="text-ink-2">Keep last</dt>
            <dd><input type="number" min={1} max={365} defaultValue={backup.keep} onBlur={(e) => changeBackup({ keep: Number(e.target.value) })} aria-label="Number of automatic backups to keep" className="field w-20 num" /></dd>
            <dt className="text-ink-2">Last backup</dt>
            <dd>{backup.lastError ? <span className="error">Failed: {backup.lastError}</span> : backup.lastAt ? new Date(backup.lastAt).toLocaleString() : 'None yet'}</dd>
          </dl>
        )}
        <div className="flex flex-wrap gap-2">
          <button onClick={backupNow} className="btn btn-primary">Back Up Now</button>
          <button onClick={handleBackup} className="btn">Save a Copy…</button>
          <button onClick={handleRestore} className="btn btn-danger">Restore From Backup…</button>
          <button onClick={exportLogs} className="btn btn-plain ml-auto">Export Logs…</button>
        </div>
      </section>
    </div>
  );
};

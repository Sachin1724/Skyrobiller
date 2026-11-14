import React, { createContext, useContext, useRef, useState } from 'react';
import { toast } from '../../store/useToastStore';
import { friendlyError } from '../../lib/friendlyError';
import { AlertTriangle, Check, ImagePlus } from 'lucide-react';
import { INDIAN_STATES, todayISO, addDaysISO } from '../../lib/utils';
import { financialYearOf } from '../../lib/db';
import { isValidGstin } from '../../lib/checks';
import { computeInvoice, type InvoiceLine } from '../../lib/gst';
import { documentHtml, TEMPLATES, ACCENT_PRESETS, DENSITIES, COPY_LABELS, type TemplateId, type Density, type PrintableDocument } from '../../lib/pdf';
import { useSystemStore, type Company, type Prefs } from '../../store/useSystemStore';
import { useMenuAction, type AppModule } from '../../store/useNavStore';
import { compressImage } from '../../lib/image';
import { confirmDialog } from '../../components/ConfirmDialog';
import { NumInput } from '../../components/NumInput';
import type { BackupSettings } from '../../types/electron';

const START_SCREENS: [AppModule, string][] = [['dashboard', 'Dashboard'], ['invoices', 'Invoices'], ['quotations', 'Quotations'], ['payments', 'Payments'], ['reports', 'Reports']];
const DASHBOARD_CARDS: [string, string][] = [['month', 'Sales This Month'], ['year', 'Sales This Financial Year'], ['outstanding', 'Outstanding'], ['due', 'Due This Week']];
const THEMES: [Prefs['theme'], string][] = [['light', 'Light'], ['dark', 'Dark'], ['system', 'Follow Windows']];

type SectionId = 'company' | 'bank' | 'design' | 'numbering' | 'preferences' | 'backup';
const SECTIONS: [SectionId, string][] = [['company', 'Company'], ['bank', 'Bank & Payment'], ['design', 'Invoice Design'], ['numbering', 'Numbering'], ['backup', 'Backup'], ['preferences', 'Preferences']];
const FORM_SECTIONS: SectionId[] = ['company', 'bank', 'design', 'numbering']; // saved together with the Save bar; the others apply at once

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

// ---------- Field validation: each returns a message, or null when the value is fine ----------
const GSTIN_SHAPE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const VALIDATORS = {
  required: (v: string) => (v.trim() ? null : 'Required.'),
  gstin: (v: string) => !v ? 'Required.' : !GSTIN_SHAPE.test(v) ? 'GSTIN must be 15 characters, like 21AAACS1234D1Z8.' : isValidGstin(v) ? null : 'The check character does not match. Re-check the number.',
  ifsc: (v: string) => !v || /^[A-Z]{4}0[A-Z0-9]{6}$/.test(v) ? null : 'IFSC must be 11 characters: 4 letters, a 0, then 6 letters or digits.',
  upi: (v: string) => !v || /^[\w.\-]{2,256}@[a-zA-Z][\w.\-]{1,63}$/.test(v) ? null : 'UPI ID looks like name@bank.',
  account: (v: string) => !v || /^\d{9,18}$/.test(v) ? null : 'Account number is 9 to 18 digits.',
  email: (v: string) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email address.',
  phone: (v: string) => !v || /^[+\d][\d\s\-()]{6,17}$/.test(v) ? null : 'Enter a valid phone number.',
  prefix: (v: string) => /^[A-Za-z0-9]{1,3}$/.test(v) ? null : 'Use 1 to 3 letters or digits.',
};

// Whether the user has tried to save: from then on every invalid field shows its message
const FormContext = createContext({ attempted: false });

interface FieldProps {
  name: keyof Company;
  label: string;
  defaultValue: string;
  validate?: (v: string) => string | null;
  hint?: string | ((v: string) => string);
  upper?: boolean;
  span?: string;
  type?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  onValue?: (v: string) => void;
}

// A labelled input with a short label, grey hint underneath, and a green tick or red message
const Field: React.FC<FieldProps> = ({ name, label, defaultValue, validate, hint, upper, span = '', type, inputMode, onValue }) => {
  const { attempted } = useContext(FormContext);
  const [value, setValue] = useState(defaultValue);
  const [touched, setTouched] = useState(false);
  const message = validate ? validate(value) : null;
  const showError = !!message && (touched || attempted);
  const valid = !message && value !== '' && !!validate;
  const hintText = typeof hint === 'function' ? hint(value) : hint;

  return (
    <label className={`label ${span}`}>
      {label}
      <span className="relative block">
        <input
          name={name}
          value={value}
          type={type}
          inputMode={inputMode}
          spellCheck={false}
          autoComplete="off"
          aria-invalid={showError || undefined}
          onChange={(e) => { const v = upper ? e.target.value.toUpperCase() : e.target.value; setValue(v); onValue?.(v); }}
          onBlur={() => setTouched(true)}
          className={`field ${valid ? 'pr-8' : ''}`}
        />
        {valid && <Check className="pointer-events-none absolute right-2 top-2 h-4 w-4 text-success" aria-label="Valid" />}
      </span>
      {showError ? <span role="alert" className="text-xs font-normal text-danger">{message}</span> : hintText && <span className="text-xs font-normal text-ink-3">{hintText}</span>}
    </label>
  );
};

// Logo and signature: drop a file or click, with a preview and Replace / Remove
const ImageDrop: React.FC<{ label: string; hint: string; value: string; onFile: (file: File) => void; onRemove: () => void }> = ({ label, hint, value, onFile, onRemove }) => {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const take = (file?: File) => { if (file && file.type.startsWith('image/')) onFile(file); };
  return (
    <div className="label">
      {label}
      <div
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); take(e.dataTransfer.files[0]); }}
        className={`flex items-center gap-4 rounded border border-dashed p-3 ${over ? 'border-accent bg-accent/5' : 'border-line'}`}
      >
        {value
          ? <img src={value} alt={`Current ${label.toLowerCase()}`} className="h-14 w-28 rounded border border-line bg-white object-contain" />
          : <button type="button" onClick={() => input.current?.click()} className="grid h-14 w-28 place-items-center rounded border border-line text-ink-3 hover:text-ink" aria-label={`Choose ${label.toLowerCase()}`}><ImagePlus className="h-5 w-5" aria-hidden /></button>}
        <div className="min-w-0 flex-1 text-xs font-normal text-ink-3">{value ? 'Drop another image here to replace it.' : 'Drop an image here, or choose a file.'} {hint}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => input.current?.click()} className="btn">{value ? 'Replace' : 'Choose File'}</button>
          {value && <button type="button" onClick={onRemove} className="btn btn-danger">Remove</button>}
        </div>
        <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => { take(e.target.files?.[0]); e.target.value = ''; }} />
      </div>
    </div>
  );
};

export const SettingsView: React.FC = () => {
  const { company, updateCompany, deviceInfo, prefs, updatePrefs, backup, setBackup } = useSystemStore();
  const [section, setSection] = useState<SectionId>('company');
  const [template, setTemplate] = useState<TemplateId>(company.template);
  const [accent, setAccent] = useState(company.accent);
  const [density, setDensity] = useState<Density>(company.density);
  const [logo, setLogo] = useState(company.logo);
  const [signature, setSignature] = useState(company.signature);
  const [copies, setCopies] = useState(company.copies);
  const [prefix, setPrefix] = useState(company.invoicePrefix);
  const [formEdited, setFormEdited] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [formKey, setFormKey] = useState(0); // bumping it remounts the fields with the saved values (Discard)
  const [error, setError] = useState('');
  const form = useRef<HTMLFormElement>(null);

  const say = (ok: string, err = '') => { if (ok) toast.success(ok); setError(err); };

  // Menu bar: File > Back Up / Restore, Tools > Invoice Design / Customize
  useMenuAction({
    'backup': () => { setSection('backup'); handleBackup(); },
    'restore': () => { setSection('backup'); handleRestore(); },
    'invoice-design': () => setSection('design'),
    'customize': () => setSection('preferences'),
  });

  const setPref = (change: Partial<Prefs>) => updatePrefs(change).catch((err) => say('', `Preference not saved: ${friendlyError(err)}`));

  const designEdited = template !== company.template || accent !== company.accent || density !== company.density || logo !== company.logo
    || signature !== company.signature || copies.join('|') !== company.copies.join('|');
  const unsaved = formEdited || designEdited;

  const discard = () => {
    setTemplate(company.template); setAccent(company.accent); setDensity(company.density); setLogo(company.logo);
    setSignature(company.signature); setCopies(company.copies); setPrefix(company.invoicePrefix);
    setFormEdited(false); setAttempted(false); setError('');
    setFormKey((k) => k + 1);
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAttempted(true);
    // Every invalid field is marked aria-invalid; go to the first one
    window.setTimeout(() => {
      const first = form.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
      if (!first) return;
      setSection(first.closest<HTMLElement>('[data-section]')!.dataset.section as SectionId);
      window.setTimeout(() => first.focus(), 0);
      setError('Fix the marked fields, then save again.');
    }, 0);
    const f = Object.fromEntries(new FormData(e.currentTarget)) as unknown as Company;
    const problems = (Object.entries({ legalName: VALIDATORS.required, tradeName: VALIDATORS.required, gstin: VALIDATORS.gstin, address: VALIDATORS.required, phone: VALIDATORS.phone, email: VALIDATORS.email, accountNumber: VALIDATORS.account, ifscCode: VALIDATORS.ifsc, upiId: VALIDATORS.upi, invoicePrefix: VALIDATORS.prefix }) as [keyof Company, (v: string) => string | null][])
      .some(([name, check]) => check(String(f[name] ?? '')));
    if (problems) return;
    const stateCode = f.gstin.slice(0, 2);
    try {
      await updateCompany({
        ...f, invoicePrefix: f.invoicePrefix.toUpperCase(), stateCode, stateName: INDIAN_STATES[stateCode] ?? '',
        template, accent, density, logo, signature, copies,
      });
      setFormEdited(false); setAttempted(false); setError('');
      say('Settings saved. New invoices use them; issued invoices keep their original company details.');
    } catch (err: any) {
      say('', `Not saved: ${friendlyError(err)}`);
    }
  };

  // Scales and compresses a chosen image for crisp invoice rendering
  const loadImage = (set: (dataUrl: string) => void, isSignature = false) => async (file: File) => {
    try {
      const res = await compressImage(file, isSignature ? 300 : 400, isSignature ? 100 : 160);
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

  // Preview shows unsaved choices (template, colour, density, images, first copy marking) with the saved company details
  const previewHtml = documentHtml(sampleDocument({ ...company, invoicePrefix: prefix }), { template, accent, density, logo, signature, copies: copies.slice(0, 1) });

  const backupStale = !!backup && (!!backup.lastError || !backup.lastAt || Date.now() - backup.lastAt > 48 * 60 * 60 * 1000);

  // How much of the saved profile is filled in
  const profileChecks = [!!company.legalName, !!company.tradeName, isValidGstin(company.gstin) && company.gstin !== '21AAACS1234D1Z8' && company.gstin !== '21AAACS1234D1Z5', !!company.address, !!company.phone, !!company.email,
    !!company.bankName, /^\d{9,18}$/.test(company.accountNumber), !VALIDATORS.ifsc(company.ifscCode) && !!company.ifscCode, !!company.upiId, !!company.logo];
  const profilePct = Math.round((profileChecks.filter(Boolean).length / profileChecks.length) * 100);
  const isFormSection = FORM_SECTIONS.includes(section);
  const show = (id: SectionId) => section !== id;

  return (
    <div className="page">
      <div className="grid grid-cols-1 lg:grid-cols-[12rem_minmax(0,1fr)] gap-6 items-start">
        {/* Sections */}
        <nav aria-label="Settings sections" className="lg:sticky lg:top-20 space-y-4">
          <div className="space-y-px">
            {SECTIONS.map(([id, name]) => (
              <button
                key={id}
                onClick={() => setSection(id)}
                aria-current={section === id ? 'page' : undefined}
                className={`flex w-full items-center justify-between h-8 px-3 rounded text-sm ${section === id ? 'bg-ink/[0.06] font-semibold text-ink' : 'text-ink-2 hover:bg-ink/5 hover:text-ink'}`}
              >
                {name}
                {id === 'backup' && backupStale && <AlertTriangle className="h-3.5 w-3.5 text-warn" aria-label="Backup needs attention" />}
              </button>
            ))}
          </div>
          <div className="px-3" title="Share of the saved company profile that is filled in">
            <div className="flex justify-between text-xs text-ink-2"><span>Profile</span><span className="tabular-nums">{profilePct}% complete</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-ink/10" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profilePct}>
              <div className={`h-full rounded-full ${profilePct === 100 ? 'bg-success' : 'bg-accent'}`} style={{ width: `${profilePct}%` }} />
            </div>
          </div>
        </nav>

        <div className="min-w-0 space-y-4">
          {error && <p role="alert" className="error">{error}</p>}

          <FormContext.Provider value={{ attempted }}>
            {/* One form for the four saved sections: all stay mounted, so nothing typed is lost when you switch */}
            <form
              key={company.legalName + company.gstin + formKey}
              ref={form}
              onSubmit={handleSubmit}
              onChange={() => setFormEdited(true)}
              autoComplete="off"
              noValidate
              hidden={!isFormSection}
              className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_auto] gap-4 items-start"
            >
              <div className="min-w-0 space-y-4">
                <section data-section="company" hidden={show('company')} className="card p-4 space-y-4">
                  <h2 className="text-base font-semibold tracking-tight">Company Profile</h2>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field name="legalName" label="Legal Name" defaultValue={company.legalName} validate={VALIDATORS.required} />
                    <Field name="tradeName" label="Trade Name" defaultValue={company.tradeName} validate={VALIDATORS.required} />
                    <Field name="gstin" label="GSTIN" defaultValue={company.gstin} validate={VALIDATORS.gstin} upper
                      hint={(v) => INDIAN_STATES[v.slice(0, 2)] ? `Home state: ${INDIAN_STATES[v.slice(0, 2)]}. Decides CGST + SGST or IGST.` : 'Decides CGST + SGST or IGST.'} />
                    <Field name="address" label="Address" span="col-span-2" defaultValue={company.address} validate={VALIDATORS.required} />
                    <Field name="phone" label="Phone" type="tel" defaultValue={company.phone} validate={VALIDATORS.phone} />
                    <Field name="email" label="Email" type="email" defaultValue={company.email} validate={VALIDATORS.email} />
                  </div>
                  <ImageDrop label="Company Logo" hint="PNG or JPEG, resized for you. Shown in the sidebar and on every invoice, quotation and note." value={logo} onFile={loadImage(setLogo)} onRemove={() => setLogo('')} />
                </section>

                <section data-section="bank" hidden={show('bank')} className="card p-4 space-y-4">
                  <div>
                    <h2 className="text-base font-semibold tracking-tight">Bank &amp; Payment</h2>
                    <p className="text-xs text-ink-2">Printed on invoices so customers know where to pay.</p>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field name="bankName" label="Bank Name" defaultValue={company.bankName} />
                    <Field name="accountNumber" label="Account Number" inputMode="numeric" defaultValue={company.accountNumber} validate={VALIDATORS.account} />
                    <Field name="ifscCode" label="IFSC Code" defaultValue={company.ifscCode} validate={VALIDATORS.ifsc} upper />
                    <Field name="upiId" label="UPI ID" defaultValue={company.upiId} validate={VALIDATORS.upi} hint="Adds a scan-to-pay QR code to invoices." />
                    <label className="label col-span-2">Terms &amp; Conditions
                      <textarea name="terms" rows={3} defaultValue={company.terms} className="field" />
                      <span className="text-xs font-normal text-ink-3">Printed on invoices and quotations.</span>
                    </label>
                  </div>
                </section>

                <section data-section="design" hidden={show('design')} className="card p-4 space-y-4">
                  <h2 className="text-base font-semibold tracking-tight">Invoice Design</h2>
                  <p className="text-xs text-ink-2">Pick the template above the preview. The preview updates as you change these.</p>
                  <div className="label">Text Size &amp; Spacing
                    <div className="segmented self-start" role="group" aria-label="Text size and spacing">
                      {(Object.keys(DENSITIES) as Density[]).map((id) => (
                        <button type="button" key={id} aria-pressed={density === id} onClick={() => setDensity(id)}>{DENSITIES[id]}</button>
                      ))}
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

                  <ImageDrop label="Signature" hint="PNG or JPEG. Printed above “Authorised Signatory”." value={signature} onFile={loadImage(setSignature, true)} onRemove={() => setSignature('')} />

                  <fieldset className="space-y-2">
                    <legend className="text-xs font-medium text-ink-2 mb-1">Copies in Each Invoice PDF</legend>
                    {COPY_LABELS.map((l) => (
                      <label key={l} className="flex items-center gap-2">
                        <input type="checkbox" checked={copies.includes(l)} onChange={(e) => toggleCopy(l, e.target.checked)} className="accent-accent" />
                        {l}
                      </label>
                    ))}
                    <p className="text-xs text-ink-3">With none ticked, one unmarked copy is printed.</p>
                  </fieldset>
                </section>

                <section data-section="numbering" hidden={show('numbering')} className="card p-4 space-y-4">
                  <h2 className="text-base font-semibold tracking-tight">Numbering</h2>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    <Field name="invoicePrefix" label="Invoice Prefix" defaultValue={company.invoicePrefix} validate={VALIDATORS.prefix} upper onValue={setPrefix}
                      hint="1 to 3 letters or digits. GST allows at most 16 characters in a whole invoice number." />
                  </div>
                  <dl className="space-y-1.5">
                    <div className="flex justify-between"><dt className="text-ink-2">Next invoice looks like</dt><dd className="font-medium tabular-nums">{prefix.toUpperCase() || '…'}/{financialYearOf(todayISO())}/0001</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-2">Credit notes</dt><dd className="tabular-nums">CN/{financialYearOf(todayISO())}/0001</dd></div>
                    <div className="flex justify-between"><dt className="text-ink-2">Debit notes</dt><dd className="tabular-nums">DN/{financialYearOf(todayISO())}/0001</dd></div>
                  </dl>
                  <p className="text-xs text-ink-3">Numbers are consecutive and restart each financial year (April to March). Each document type has its own series. Issued invoices keep the number they were given.</p>
                </section>
              </div>

              {/* A4 page (794 x 1123 px) scaled to 55%. Sticky so it stays in view while you edit */}
              <div className="space-y-2 xl:sticky xl:top-20">
                <label className="label">Template
                  <select value={template} onChange={(e) => setTemplate(e.target.value as TemplateId)} className="field">
                    {(Object.keys(TEMPLATES) as TemplateId[]).map((id) => <option key={id} value={id}>{TEMPLATES[id]}</option>)}
                  </select>
                </label>
                <div className="w-[437px] h-[618px] overflow-hidden rounded border border-line bg-white" aria-label="Invoice preview with sample data">
                  <iframe title="Invoice template preview" sandbox="" srcDoc={previewHtml} className="w-[794px] h-[1123px] origin-top-left scale-[0.55] pointer-events-none" />
                </div>
              </div>

              {/* Save bar */}
              <div className="xl:col-span-2 sticky bottom-0 -mx-6 -mb-6 px-6 py-3 flex items-center justify-between gap-4 bg-bg border-t border-line">
                <span role="status" className={`flex items-center gap-2 text-sm ${unsaved ? 'text-warn font-medium' : 'text-ink-2'}`}>
                  {unsaved ? <><AlertTriangle className="h-4 w-4" aria-hidden />Unsaved changes</> : <><Check className="h-4 w-4 text-success" aria-hidden />All changes saved</>}
                </span>
                <div className="flex gap-2">
                  <button type="button" onClick={discard} disabled={!unsaved} className="btn">Discard</button>
                  <button type="submit" disabled={!unsaved} className="btn btn-primary">Save</button>
                </div>
              </div>
            </form>
          </FormContext.Provider>

          {/* App preferences: applied and saved the moment they change */}
          <section data-section="preferences" hidden={section !== 'preferences'} className="card p-4 space-y-4 max-w-3xl">
            <h2 className="text-base font-semibold tracking-tight">Preferences</h2>
            <p className="text-xs text-ink-2">These apply on this computer straight away.</p>
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
              <label className="label">Default GST Rate
                <select value={prefs.defaultGstRate} onChange={(e) => setPref({ defaultGstRate: Number(e.target.value) })} className="field">
                  {[0, 5, 12, 18, 28].map((r) => <option key={r} value={r}>{r}%</option>)}
                </select>
                <span className="text-xs font-normal text-ink-3">Pre-selected for new items.</span>
              </label>
              <label className="label">Default Payment Terms (Days)
                <NumInput step="1" value={prefs.defaultTermsDays} onChange={(n) => setPref({ defaultTermsDays: n })} className="field" />
                <span className="text-xs font-normal text-ink-3">Pre-filled for new customers.</span>
              </label>
              <fieldset className="space-y-2">
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
            <p className="text-xs text-ink-3">Text size: use View &gt; Zoom In and Zoom Out (Ctrl + and Ctrl -).</p>
          </section>

          <section data-section="backup" hidden={section !== 'backup'} className={`card p-4 space-y-3 max-w-3xl ${backupStale ? 'border-warn/60' : ''}`}>
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
                <dd className="flex items-center gap-2 min-w-0"><span className="truncate" title={backup.effectiveFolder}>{backup.effectiveFolder}{!backup.folder && <span className="ml-2 text-xs text-warn">(default, on this computer)</span>}</span><button onClick={chooseFolder} className="btn shrink-0">Change…</button></dd>
                <dt className="text-ink-2">Keep last</dt>
                <dd><input type="number" min={1} max={365} defaultValue={backup.keep} onBlur={(e) => changeBackup({ keep: Number(e.target.value) })} aria-label="Number of automatic backups to keep" className="field w-20 num" /></dd>
                <dt className="text-ink-2">Last backup</dt>
                <dd>{backup.lastError ? <span className="error">Failed: {friendlyError(backup.lastError)}</span> : backup.lastAt ? new Date(backup.lastAt).toLocaleString() : 'None yet'}</dd>
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
      </div>
    </div>
  );
};

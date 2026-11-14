import React, { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { useMenuAction, useNavStore } from '../../store/useNavStore';
import { SCREENS, MENUS } from '../../lib/guide';

const TOPICS: { title: string; steps: string[] }[] = [
  {
    title: 'First-Time Setup',
    steps: [
      'Open Settings and fill in the Company Profile with your real legal name, GSTIN, address and bank details. Issued invoices keep whatever is saved here at the time, so do this before the first invoice.',
      'Upload your company logo and, if you want one, a signature image.',
      'Pick an invoice template, accent colour and the copies to print (Original, Duplicate, Triplicate). The preview on the right shows the result.',
      'Add products in Products and customers in Customers, or import both from CSV files (File > Import). Download the CSV template first to see the columns.',
    ],
  },
  {
    title: 'Creating an Invoice',
    steps: [
      'Press Ctrl+N or choose New Invoice.',
      'Search and pick the customer. The place of supply decides the tax: same state as yours gives CGST + SGST, another state gives IGST.',
      'Search and pick products. Change quantity, rate or discount on any line. A changed rate applies to this invoice only, unless you choose Save to catalogue.',
      'For something not in the catalogue, use Custom Item, type its name, HSN code and GST rate. Save to Catalogue on that row adds it for next time.',
      'Everything is saved automatically as a draft. Park puts the draft aside; resume it from the Parked tab in Invoices (Ctrl+Shift+P opens it).',
      'Issue & Print (Ctrl+Enter) gives it the next invoice number and prints it. After that it cannot be edited or deleted. Press F9 to park a bill instead; Enter moves to the next field.',
    ],
  },
  {
    title: 'After an Invoice Is Issued',
    steps: [
      'In Invoices > Issued, the icons on each row are: View, Save PDF, Record Payment, Issue Credit Note, Issue Debit Note, Duplicate as New Draft, Cancel.',
      'View opens the document. From there you can print it or save it as a PDF.',
      'An issued invoice is never edited. To lower it (returned goods, a price cut) issue a credit note; to raise it (freight, a price correction) issue a debit note, using only the extra amount per unit. Each has its own number series. You can also cancel an invoice if nothing has been paid, credited or debited. A cancelled invoice keeps its number.',
    ],
  },
  {
    title: 'Payments',
    steps: [
      'Record a payment from the ₹ icon on an invoice, or from the Payments screen. Part payments are fine; the invoice shows Partly Paid until the balance is zero.',
      'A payment larger than the outstanding amount is refused.',
      'The Payments screen lists everything outstanding, oldest due date first, and marks overdue invoices.',
    ],
  },
  {
    title: 'Quotations',
    steps: [
      'Press Ctrl+Shift+N or choose New Quotation. It works like the invoice editor, with a Valid Until date.',
      'Save PDF produces the quotation to send. Set its status (Draft, Sent, Accepted, Declined) in the Quotations list.',
      'Convert to Invoice copies the quotation into a new invoice draft and marks the quotation Converted.',
    ],
  },
  {
    title: 'Reports and GST Filing',
    steps: [
      'Reports opens on the Invoice Register for the current month: one row per bill with tax split, amount received and status.',
      'Pick a month, a date range, or This Financial Year. Use the Payment filter for Paid or Unpaid only.',
      'The GST Filing group has sheets laid out like the GSTR-1 offline tool: B2B, B2C Large, B2C Small, HSN Summary and Credit and Debit Notes. GSTR-1 (JSON) builds one file for the offline tool Import for the month you picked. Ask your accountant to confirm them before filing. Reports > Audit Log lists every change made to your data.',
      'This Sheet (CSV) exports what you see. All Sheets (Excel) saves every report as a tab in one Excel file.',
    ],
  },
  {
    title: 'Backup and Restore',
    steps: [
      'All data is in one file on this computer. Use File > Back Up Data regularly and keep the copy on a USB drive or cloud folder.',
      'File > Restore From Backup replaces everything with the chosen backup. The data it replaces is kept next to the database with ".before-restore" at the end of its name.',
      'Help > Open Data Folder shows where the database file is.',
    ],
  },
  {
    title: 'Look and Feel',
    steps: [
      'View > Theme switches between Light, Dark and Follow Windows.',
      'View > Zoom In and Zoom Out (Ctrl + and Ctrl -) change the size of everything.',
      'Tools > Customize sets the app accent colour, table row height, the screen shown at start-up, default GST rate and payment terms, and which dashboard cards appear.',
    ],
  },
];

const SHORTCUTS: [string, string][] = [
  ['Ctrl+N', 'New invoice'],
  ['Ctrl+Shift+N', 'New quotation'],
  ['Ctrl+S', 'Save the open draft or quotation now'],
  ['Ctrl+Shift+S', 'Save the open document as PDF'],
  ['Ctrl+P', 'Print the open document'],
  ['Ctrl+F', 'Jump to the search box'],
  ['Ctrl+1 … Ctrl+8', 'Dashboard, Invoices, Quotations, Payments, Products, Customers, Reports, Settings'],
  ['Ctrl+Shift+P', 'Parked invoices'],
  ['Ctrl+,', 'Settings'],
  ['Ctrl + / Ctrl - / Ctrl 0', 'Zoom in, zoom out, reset zoom'],
  ['F11', 'Full screen'],
  ['F1', 'This help'],
  ['Alt', 'Open the menu bar from the keyboard'],
  ['↑ ↓ Enter', 'Move through and pick a search suggestion'],
  ['Esc', 'Close a dialog or suggestion list'],
];

export const HelpView: React.FC = () => {
  const [query, setQuery] = useState('');
  const shortcuts = useRef<HTMLElement>(null);
  const [showShortcuts, setShowShortcuts] = useState(false);

  useMenuAction({ shortcuts: () => setShowShortcuts(true) });
  useEffect(() => {
    if (showShortcuts) { shortcuts.current?.scrollIntoView({ block: 'start' }); setShowShortcuts(false); }
  }, [showShortcuts]);

  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const has = (text: string) => words.every((w) => text.toLowerCase().includes(w));
  const screens = SCREENS.filter((sc) => has(`${sc.name} ${sc.what} ${sc.points.join(' ')}`));
  const menus = MENUS.filter((m) => has(`${m.menu} ${m.items.flat().join(' ')}`));
  const topics = TOPICS.filter((t) => has(`${t.title} ${t.steps.join(' ')}`));
  const keys = SHORTCUTS.filter(([k, what]) => has(`${k} ${what}`));

  return (
    <div className="page max-w-3xl">
      <div className="flex items-center justify-between gap-3">
      <div className="relative w-80">
        <Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-3 pointer-events-none" aria-hidden />
        <input
          type="search"
          aria-label="Search help"
          autoComplete="off"
          placeholder="Search help…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="field pl-8"
        />
      </div>
        <button onClick={() => useNavStore.getState().setTourOpen(true)} className="btn btn-primary">Start Tutorial</button>
      </div>

      {screens.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 pb-2 text-base font-semibold tracking-tight">What Each Screen Does</h2>
          <table className="tbl">
            <tbody>
              {screens.map((sc) => (
                <tr key={sc.id}>
                  <td className="w-40 font-medium whitespace-nowrap align-top">{sc.name}</td>
                  <td className="text-ink-2">
                    {sc.what}
                    <ul className="list-disc pl-4 pt-1 space-y-0.5 marker:text-ink-3">
                      {sc.points.map((pt) => <li key={pt}>{pt}</li>)}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {menus.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="px-4 pt-4 pb-2 text-base font-semibold tracking-tight">What Each Menu Does</h2>
          <table className="tbl">
            <tbody>
              {menus.map((m) => (
                <tr key={m.menu}>
                  <td className="w-40 font-medium whitespace-nowrap align-top">{m.menu}</td>
                  <td className="text-ink-2">
                    <ul className="space-y-1">
                      {m.items.map(([label, does]) => <li key={label}><span className="text-ink">{label}.</span> {does}</li>)}
                    </ul>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {screens.length === 0 && menus.length === 0 && topics.length === 0 && keys.length === 0 && <p className="empty">Nothing in the help matches “{query}”. Try fewer or different words.</p>}

      {topics.map((t) => (
        <section key={t.title} className="card p-4 space-y-2">
          <h2 className="text-base font-semibold tracking-tight">{t.title}</h2>
          <ol className="list-decimal pl-5 space-y-1.5 text-ink-2 marker:text-ink-3">
            {t.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
        </section>
      ))}

      {keys.length > 0 && (
        <section ref={shortcuts} className="card overflow-hidden scroll-mt-20">
          <h2 className="px-4 pt-4 pb-2 text-base font-semibold tracking-tight">Keyboard Shortcuts</h2>
          <table className="tbl">
            <tbody>
              {keys.map(([k, what]) => (
                <tr key={k}>
                  <td className="w-56 font-medium whitespace-nowrap">{k}</td>
                  <td className="text-ink-2">{what}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
};

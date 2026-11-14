// What every screen and menu does. One source for the first-run tutorial and the Help screen.
// Type-only import: keeps this file free of the stores.
import type { AppModule } from '../store/useNavStore';

export interface ScreenGuide {
  id: AppModule;
  name: string;
  what: string; // one line, shown in the Help table
  points: string[]; // shown in the tutorial
}

export const SCREENS: ScreenGuide[] = [
  {
    id: 'dashboard',
    name: 'Dashboard',
    what: 'Your business at a glance.',
    points: [
      'Sales this month and this financial year, what is still owed to you, and how many drafts and quotations are in progress.',
      'The latest invoices with their payment status.',
    ],
  },
  {
    id: 'invoices',
    name: 'Invoices',
    what: 'Create bills, and look after the ones you have issued.',
    points: [
      'Issued: every invoice. The icons on a row are View, Save PDF, Record Payment, Credit Note, Duplicate and Cancel.',
      'Drafts: unfinished and parked bills. Everything is saved automatically as you type.',
      'Credit Notes: corrections against issued invoices.',
    ],
  },
  {
    id: 'quotations',
    name: 'Quotations',
    what: 'Price quotes you send before a sale.',
    points: [
      'Set a valid-until date and a status: Draft, Sent, Accepted or Declined.',
      'Convert to Invoice copies an accepted quotation into a new invoice draft.',
    ],
  },
  {
    id: 'payments',
    name: 'Payments',
    what: 'Money received, and money still owed.',
    points: [
      'Record full or part payments with date, method and reference.',
      'Overdue invoices are marked. Paying more than is owed is refused.',
    ],
  },
  {
    id: 'products',
    name: 'Products',
    what: 'Your catalogue of parts. Invoices fill themselves in from it.',
    points: [
      'Each product holds SKU, HSN code, GST rate, unit and price, plus search aliases.',
      'Import many at once from a CSV file; download the template to see the columns.',
    ],
  },
  {
    id: 'customers',
    name: 'Customers',
    what: 'Everyone you bill. Picking one fills the bill-to.',
    points: [
      'Registered (GSTIN) and unregistered customers. The state sets CGST + SGST or IGST.',
      'The history icon shows every invoice billed to that customer. CSV import works here too.',
    ],
  },
  {
    id: 'reports',
    name: 'Reports',
    what: 'Tables of your bills, payments and GST, ready for Excel.',
    points: [
      'Pick a month or date range, and filter Paid or Unpaid.',
      'GST Filing sheets follow the GSTR-1 layout. All Sheets (Excel) exports everything in one file.',
    ],
  },
  {
    id: 'settings',
    name: 'Settings',
    what: 'Company details, invoice design, preferences and backup.',
    points: [
      'Company profile, bank details and logo are printed on every invoice. Set them before your first invoice.',
      'Choose a template with a live preview, customise the app, and back up or restore your data.',
    ],
  },
  {
    id: 'help',
    name: 'Help',
    what: 'How-to guides, shortcuts, and this tutorial.',
    points: ['Search the guides, see every keyboard shortcut, or run this tutorial again.'],
  },
];

export interface MenuGuide {
  menu: string;
  items: [label: string, does: string][];
}

export const MENUS: MenuGuide[] = [
  {
    menu: 'File',
    items: [
      ['New Invoice, New Quotation, New Customer, New Product', 'Start something new from anywhere.'],
      ['Save, Save Copy', 'Save the open draft now, or keep a copy of it.'],
      ['Save As PDF, Print', 'Output the open quotation, or the invoice you are viewing.'],
      ['Import, Export', 'Bring products and customers in from CSV; send reports out as CSV or Excel.'],
      ['Back Up Data, Restore From Backup', 'Keep a safe copy of everything, or go back to one.'],
    ],
  },
  {
    menu: 'Edit',
    items: [
      ['Undo, Redo, Cut, Copy, Paste, Select All', 'The usual text editing.'],
      ['Find', 'Jump to the search box on the current screen.'],
    ],
  },
  {
    menu: 'View',
    items: [
      ['Screens, Parked Invoices', 'Switch screens with Ctrl+1 to Ctrl+8; open bills you put aside.'],
      ['Theme', 'Light, Dark, or follow Windows.'],
      ['Zoom, Full Screen', 'Make everything larger or smaller, or fill the screen.'],
    ],
  },
  {
    menu: 'Tools',
    items: [
      ['Settings', 'Company details and preferences.'],
      ['Invoice Design, Customize', 'Jump straight to the template picker or the app preferences.'],
    ],
  },
  {
    menu: 'Help',
    items: [
      ['Skyro Biller Help, Keyboard Shortcuts', 'Guides and the shortcut list.'],
      ['Start Tutorial', 'Run the guided tour again.'],
      ['Check for Updates, Open Data Folder, About', 'Your version, where your data file is, and program details.'],
    ],
  },
];

export interface TourStep {
  title: string;
  body: string[];
  module?: AppModule; // screen to show behind the tutorial
  target?: string; // data-tour attribute of the element to highlight
}

const screenStep = (s: ScreenGuide): TourStep => ({
  title: s.name,
  body: [s.what, ...s.points],
  module: s.id,
  target: `nav-${s.id}`,
});

export const TOUR_STEPS: TourStep[] = [
  {
    title: 'Welcome to Skyro Biller',
    body: [
      'This short tour shows where everything is and what it does. It takes about two minutes.',
      'Everything you enter stays on this computer. You can run the tour again any time from Help > Start Tutorial.',
    ],
    module: 'dashboard',
  },
  {
    title: 'The sidebar',
    body: [
      'Every screen is one click away here. You can also press Ctrl+1 to Ctrl+8.',
      'We will visit each one now.',
    ],
    target: 'sidebar-nav',
    module: 'dashboard',
  },
  ...SCREENS.map(screenStep),
  {
    title: 'Quick actions',
    body: [
      'New Invoice (Ctrl+N) starts a bill from any screen.',
      'Parked shows bills you put aside for a waiting customer, with a count. Ctrl+Shift+P opens it.',
    ],
    target: 'header-actions',
    module: 'dashboard',
  },
  {
    title: 'The menu bar',
    body: [
      'Along the top of the window, above everything else:',
      ...MENUS.map((m) => `${m.menu}: ${m.items.map((i) => i[0].split(',')[0]).join(', ')}.`),
      'Press Alt to reach the menus with the keyboard. Help > Skyro Biller Help explains every option.',
    ],
    module: 'dashboard',
  },
  {
    title: 'Your first steps',
    body: [
      '1. Open Settings and enter your real company details, bank details and logo.',
      '2. Add your products, or import them from a CSV file.',
      '3. Add your customers, or import them too.',
      '4. Press Ctrl+N to create your first invoice.',
      'Remember to back up from File > Back Up Data now and then.',
    ],
    module: 'dashboard',
  },
];

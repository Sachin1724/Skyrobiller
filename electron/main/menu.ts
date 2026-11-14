import { app, Menu, type MenuItemConstructorOptions } from 'electron';

// Screens in sidebar order; Ctrl+1 … Ctrl+8 jump to them
const SCREENS = ['Dashboard', 'Invoices', 'Quotations', 'Payments', 'Products', 'Customers', 'Reports', 'Settings'];

interface MenuHandlers {
  send: (action: string) => void; // action handled by the renderer (src/App.tsx)
  checkForUpdates: () => void;
  openDataFolder: () => void;
  about: () => void;
}

// The application menu bar. Accelerators here are the app's keyboard shortcuts.
export function buildMenu({ send, checkForUpdates, openDataFolder, about }: MenuHandlers): Menu {
  const item = (label: string, action: string, accelerator?: string): MenuItemConstructorOptions =>
    ({ label, accelerator, click: () => send(action) });
  const separator: MenuItemConstructorOptions = { type: 'separator' };
  const theme = (label: string, value: string): MenuItemConstructorOptions =>
    ({ label, id: `theme-${value}`, type: 'radio', checked: value === 'system', click: () => send(`theme:${value}`) });

  return Menu.buildFromTemplate([
    {
      label: '&File',
      submenu: [
        item('New Invoice', 'new-invoice', 'CmdOrCtrl+N'),
        item('New Quotation', 'new-quotation', 'CmdOrCtrl+Shift+N'),
        item('New Customer', 'new-customer'),
        item('New Product', 'new-product'),
        separator,
        item('Save', 'save', 'CmdOrCtrl+S'),
        item('Save Copy', 'save-copy'),
        item('Save As PDF…', 'save-pdf', 'CmdOrCtrl+Shift+S'),
        item('Print…', 'print', 'CmdOrCtrl+P'),
        separator,
        { label: 'Import', submenu: [item('Products From CSV…', 'import-products'), item('Customers From CSV…', 'import-customers')] },
        { label: 'Export', submenu: [item('This Report Sheet (CSV)', 'export-sheet'), item('All Report Sheets (Excel)', 'export-workbook')] },
        separator,
        item('Back Up Data…', 'backup'),
        item('Restore From Backup…', 'restore'),
        separator,
        { role: 'quit', label: 'Exit' },
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' }, { role: 'redo' }, separator,
        { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }, separator,
        item('Find', 'find', 'CmdOrCtrl+F'),
      ],
    },
    {
      label: '&View',
      submenu: [
        ...SCREENS.map((name, i) => item(name, `nav:${name.toLowerCase()}`, `CmdOrCtrl+${i + 1}`)),
        item('Parked Invoices', 'parked', 'CmdOrCtrl+Shift+P'),
        separator,
        { label: 'Theme', submenu: [theme('Light', 'light'), theme('Dark', 'dark'), theme('Follow Windows', 'system')] },
        separator,
        { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'resetZoom' }, separator,
        { role: 'togglefullscreen' },
        ...(app.isPackaged ? [] : [separator, { role: 'toggleDevTools' } as MenuItemConstructorOptions]),
      ],
    },
    {
      label: '&Tools',
      submenu: [
        item('Settings', 'nav:settings', 'CmdOrCtrl+,'),
        item('Invoice Design', 'invoice-design'),
        item('Customize…', 'customize'),
      ],
    },
    {
      label: '&Help',
      submenu: [
        item('Skyro Biller Help', 'nav:help', 'F1'),
        item('Command Palette (Ctrl+K)', 'palette'),
        item('Keyboard Shortcuts', 'shortcuts'),
        item('Start Tutorial…', 'tour'),
        separator,
        { label: 'Check for Updates…', click: checkForUpdates },
        { label: 'Open Data Folder', click: openDataFolder },
        separator,
        { label: 'About Skyro Biller', click: about },
      ],
    },
  ]);
}

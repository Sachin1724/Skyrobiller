// What a finished setup looks like, as one list: the dashboard ring, its popup and the Settings meter all read it.
import { isValidGstin } from './checks';
import type { Company } from '../store/useSystemStore';
import type { AppModule, SettingsSection } from '../store/useNavStore';

export interface ProfileItem {
  id: string;
  group: 'Company profile' | 'Getting started';
  label: string;
  hint: string;
  done: boolean;
  go: { module: AppModule; section?: SettingsSection };
}

export interface ProfileInput {
  company: Company;
  savedCompany: boolean; // the profile has been saved at least once, so it is no longer the shipped sample
  products: number;
  customers: number;
  invoices: number;
  backupFolder: boolean;
}

const SAMPLE_GSTINS = ['21AAACS1234D1Z5', '21AAACS1234D1Z8'];

export function profileItems({ company: c, savedCompany: saved, products, customers, invoices, backupFolder }: ProfileInput): ProfileItem[] {
  const filled = (v: string) => saved && v.trim() !== '';
  const item = (id: string, group: ProfileItem['group'], label: string, hint: string, done: boolean, module: AppModule, section?: SettingsSection): ProfileItem =>
    ({ id, group, label, hint, done, go: { module, section } });
  const P = 'Company profile';
  const G = 'Getting started';
  return [
    item('legalName', P, 'Legal name', 'Printed at the top of every invoice.', filled(c.legalName), 'settings', 'company'),
    item('tradeName', P, 'Trade name', 'The name you trade under.', filled(c.tradeName), 'settings', 'company'),
    item('gstin', P, 'Your GSTIN', 'A real, valid GSTIN sets your home state for tax.', saved && isValidGstin(c.gstin) && !SAMPLE_GSTINS.includes(c.gstin), 'settings', 'company'),
    item('address', P, 'Address', 'Printed on invoices.', filled(c.address), 'settings', 'company'),
    item('phone', P, 'Phone', 'So customers can reach you.', filled(c.phone), 'settings', 'company'),
    item('email', P, 'Email', 'Printed on invoices.', filled(c.email), 'settings', 'company'),
    item('logo', P, 'Logo', 'Appears on every invoice and in the sidebar.', !!c.logo, 'settings', 'company'),
    item('bank', P, 'Bank name', 'Tells customers where to pay.', filled(c.bankName), 'settings', 'bank'),
    item('account', P, 'Account number', 'Printed in the payment box.', saved && /^\d{9,18}$/.test(c.accountNumber), 'settings', 'bank'),
    item('ifsc', P, 'IFSC code', 'Needed with the account number.', saved && /^[A-Z]{4}0[A-Z0-9]{6}$/.test(c.ifscCode), 'settings', 'bank'),
    item('upi', P, 'UPI ID', 'Adds a scan-to-pay QR code to invoices.', filled(c.upiId), 'settings', 'bank'),
    item('product', G, 'Add your first product', 'Save the parts you sell once.', products > 0, 'products'),
    item('customer', G, 'Add your first customer', 'Their details then fill in on every bill.', customers > 0, 'customers'),
    item('invoice', G, 'Issue your first invoice', 'Pick a customer and parts, then issue.', invoices > 0, 'invoices'),
    item('backup', G, 'Pick a USB or cloud folder for backups', 'Daily backups already run on this PC; a second place keeps them safe if it fails.', backupFolder, 'settings', 'backup'),
  ];
}

export const profileScore = (items: ProfileItem[]) => Math.round((items.filter((i) => i.done).length / items.length) * 100);

// Skyrostore (Medusa 2) online orders, shown as GST invoices in the SKYW series.
// Prices are Medusa major units (rupees). Seller details come from the current Company profile.
import { computeInvoice, type InvoiceLine } from './gst';
import { getSetting, setSetting, type Customer } from './db';
import { INDIAN_STATES } from './utils';
import type { PrintableDocument } from './pdf';
import type { Company } from '../store/useSystemStore';

export interface StoreConfig { baseUrl: string; apiKey: string }
export const getStoreConfig = () => getSetting<StoreConfig>('skyrostore');
export const setStoreConfig = (c: StoreConfig) => setSetting('skyrostore', c);

export interface StoreOrder {
  id: string;
  display_id: number;
  created_at: string;
  status: string;
  email?: string;
  payment_status?: string;
  fulfillment_status?: string;
  total: number;
  items: { title: string; quantity: number; unit_price: number; is_tax_inclusive?: boolean; tax_lines?: { rate: number }[]; variant?: { sku?: string; product?: { metadata?: Record<string, any> } } }[];
  shipping_address?: { first_name?: string; last_name?: string; company?: string; phone?: string; address_1?: string; address_2?: string; city?: string; province?: string; postal_code?: string };
  payment_collections?: { payments?: { data?: Record<string, any> }[] }[];
  metadata?: Record<string, any>;
}

const FIELDS = 'id,display_id,created_at,status,email,payment_status,fulfillment_status,total,metadata,*items,*items.tax_lines,*items.variant,*items.variant.product,*shipping_address,*payment_collections,*payment_collections.payments';

export async function fetchStoreOrders(search: string): Promise<StoreOrder[]> {
  const cfg = await getStoreConfig();
  if (!cfg?.baseUrl || !cfg.apiKey) throw new Error('Set the store URL and API key in Settings > Online Store first.');
  const q = search.replace(/^#/, '').trim();
  const res = await window.electronAPI.storeFetch({ ...cfg, path: `/admin/orders?limit=100&order=-created_at&fields=${encodeURIComponent(FIELDS)}${q ? `&q=${encodeURIComponent(q)}` : ''}` });
  if (!res.success) throw new Error(res.error);
  return res.data.orders ?? [];
}

// Razorpay ids live in the payment's provider data; "pay_..." is what the bank statement shows
export const paymentIdOf = (o: StoreOrder): string | undefined =>
  o.payment_collections?.flatMap((c) => c.payments ?? []).map((p) => p.data?.id ?? p.data?.razorpay_payment_id).find((v) => typeof v === 'string' && v.startsWith('pay_'));

const financialYear = (iso: string) => {
  const d = new Date(iso);
  const y = d.getFullYear() - (d.getMonth() < 3 ? 1 : 0);
  return `${y}-${String((y + 1) % 100).padStart(2, '0')}`;
};
// The store's order number is already unique and consecutive, so it doubles as the invoice serial (CGST Rule 46(b): separate series per channel)
export const storeInvoiceNumber = (o: StoreOrder) => `SKYW/${financialYear(o.created_at)}/${String(o.display_id).padStart(4, '0')}`;

const stateCodeOf = (name = '') => Object.entries(INDIAN_STATES).find(([, n]) => n.toLowerCase() === name.trim().toLowerCase())?.[0];

export function orderDocument(o: StoreOrder, company: Company): PrintableDocument {
  const a = o.shipping_address ?? {};
  const stateCode = stateCodeOf(a.province) ?? company.stateCode;
  const person = [a.first_name, a.last_name].filter(Boolean).join(' ');
  const customer: Customer = {
    id: o.id,
    businessName: a.company || person || o.email || 'Online customer',
    contactPerson: person,
    gstin: String(o.metadata?.gstin ?? ''),
    email: o.email ?? '',
    phone: a.phone ?? '',
    billingAddress: [a.address_1, a.address_2, a.city, a.province, a.postal_code].filter(Boolean).join(', '),
    stateCode,
    stateName: INDIAN_STATES[stateCode] ?? '',
    pincode: a.postal_code ?? '',
    paymentTermsDays: 0,
  };
  const items: InvoiceLine[] = o.items.map((i) => {
    const gstRate = i.tax_lines?.[0]?.rate ?? 18;
    return {
      sku: i.variant?.sku ?? '',
      description: i.title,
      hsnCode: String(i.variant?.product?.metadata?.hsn ?? i.variant?.product?.metadata?.hsn_code ?? ''),
      unit: 'NOS',
      qty: i.quantity,
      rate: i.is_tax_inclusive ? Math.round((i.unit_price / (1 + gstRate / 100)) * 100) / 100 : i.unit_price,
      discountPct: 0,
      gstRate,
    };
  });
  const totals = computeInvoice(items, company.stateCode, stateCode);
  const payId = paymentIdOf(o);
  const paid = o.payment_status === 'captured' || o.payment_status === 'paid' ? totals.total : 0;
  const day = o.created_at.slice(0, 10);
  return {
    title: 'Tax Invoice',
    number: storeInvoiceNumber(o),
    date: day,
    secondDateLabel: 'Due Date',
    secondDate: day,
    reference: `Online order #${o.display_id}`,
    company,
    customer,
    items,
    totals,
    notes: payId ? `Paid online via Razorpay. Transaction ID: ${payId}` : '',
    paid,
    balanceDue: totals.total - paid,
    payments: payId && paid > 0 ? [{
      id: o.id,
      invoiceId: o.id,
      invoiceNumber: storeInvoiceNumber(o),
      customerName: customer.businessName,
      amount: paid,
      paidOn: day,
      method: 'Online (Razorpay)',
      reference: payId,
    }] : undefined,
  };
}

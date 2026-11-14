// Run: node scripts/db.check.ts  (exercises the renderer SQL in src/lib/db.ts against the real schema, in memory)
import assert from 'node:assert/strict';
import initSqlJs from 'sql.js';
import { applySchema } from '../electron/main/schema.ts';
import { computeInvoice } from '../src/lib/gst.ts';

const sqlite = new (await initSqlJs()).Database();
applySchema(sqlite);
applySchema(sqlite); // must be safe to run on every start

const attempt = (fn: () => object) => {
  try { return { success: true, ...fn() }; } catch (e: any) { return { success: false, error: e.message }; }
};
(globalThis as any).window = {
  electronAPI: {
    dbQuery: async (sql: string, params: any[]) => attempt(() => {
      const stmt = sqlite.prepare(sql);
      stmt.bind(params);
      const rows = [];
      while (stmt.step()) rows.push(stmt.getAsObject());
      stmt.free();
      return { rows };
    }),
    // Same transaction shape as batchDb in electron/main/db.ts
    dbBatch: async (statements: { sql: string; params?: any[] }[]) => {
      const FORBIDDEN_DDL_RE = /^\s*(DROP|ALTER|ATTACH|DETACH|VACUUM|REINDEX)\b/i;
      for (const s of statements) {
        if (FORBIDDEN_DDL_RE.test(s.sql.trim())) {
          return { success: false, error: 'Database structure modifications (DDL) are not permitted over IPC' };
        }
      }
      return attempt(() => {
        sqlite.run('BEGIN');
        try {
          for (const s of statements) sqlite.run(s.sql, s.params ?? []);
          sqlite.run('COMMIT');
        } catch (e) {
          sqlite.run('ROLLBACK');
          throw e;
        }
        return {};
      });
    },
  },
};

const db = await import('../src/lib/db.ts');

// --- Products
const product = { sku: 'SB-F405-V4', name: 'SpeedyBee F405 V4 Stack', brand: 'SpeedyBee', description: '', unit: 'PCS', hsnCode: '85269190', gstRate: 18, defaultPrice: 5800, searchAliases: 'fc stack, 55a' };
await db.saveProduct(product);
await db.saveProduct({ ...product, sku: 'TM-F60', name: 'T-Motor F60 PRO', brand: 'T-Motor', searchAliases: 'motor' });
assert.equal((await db.searchProducts('')).length, 2);
assert.equal((await db.searchProducts('f405 speedy'))[0].sku, 'SB-F405-V4'); // words in any order
assert.equal((await db.searchProducts('55a')).length, 1); // alias
assert.equal((await db.searchProducts('tm-'))[0].sku, 'TM-F60'); // SKU prefix
await assert.rejects(db.saveProduct(product), /UNIQUE/); // duplicate SKU blocked by the index

const [p] = await db.searchProducts('f405');
await db.saveProduct({ ...p, name: 'Renamed' }); // same id updates in place
await db.updateProductPrice(p.id, 6000);
const [p2] = await db.searchProducts('SB-F405');
assert.deepEqual([p2.name, p2.defaultPrice, (await db.searchProducts('')).length], ['Renamed', 6000, 2]);

// --- Customers
await db.saveCustomer({ businessName: 'SkyHigh Drones', contactPerson: 'Anand', gstin: '', email: '', phone: '9437011223', billingAddress: 'Plot 1', stateCode: '21', stateName: 'Odisha', pincode: '751024', paymentTermsDays: 15 });
const [c] = await db.searchCustomers('9437');
assert.deepEqual([c.businessName, c.gstin, c.paymentTermsDays], ['SkyHigh Drones', '', 15]);

// --- Drafts and quotations stay in separate lists
const blank = { customer: c, items: [], notes: 'n', validUntil: '', status: 'draft' as const };
await db.saveDraft({ ...blank, draftId: 'D-1', kind: 'invoice', isParked: false, total: 100 });
await db.saveDraft({ ...blank, draftId: 'D-1', kind: 'invoice', isParked: true, total: 250 });
await db.saveDraft({ ...blank, draftId: 'Q-1', kind: 'quotation', isParked: false, total: 900, validUntil: '2026-12-01' });
const parked = await db.listDrafts('invoice', true);
assert.deepEqual([parked.length, parked[0].total, parked[0].customer?.businessName], [1, 250, 'SkyHigh Drones']);
await db.setQuotationStatus('Q-1', 'sent');
const [q] = await db.listDrafts('quotation');
assert.deepEqual([q.draftId, q.status, q.validUntil], ['Q-1', 'sent', '2026-12-01']);

// --- Financial year
assert.deepEqual(['2026-11-14', '2027-03-31', '2027-04-01'].map(db.financialYearOf), ['2026-27', '2026-27', '2027-28']);

// --- Issuing: consecutive numbers per financial year, draft removed, retry cannot duplicate
const company = { invoicePrefix: 'SKY', stateCode: '21' } as any;
const items = [{ sku: 'SB-F405-V4', description: 'Stack', hsnCode: '85269190', unit: 'PCS', qty: 1, rate: 5800, discountPct: 0, gstRate: 18 }];
const totals = computeInvoice(items, '21', '21');
const issue = (draftId: string, issueDate: string) =>
  db.issueInvoice({ draftId, customer: c, company, items, totals, notes: '', issueDate, dueDate: issueDate });

const inv1 = await issue('D-1', '2026-11-14');
assert.deepEqual([inv1.invoiceNumber, inv1.total, inv1.paid], ['SKY/2026-27/0001', 6844, 0]);
assert.equal(await db.getDraft('D-1'), null);
await assert.rejects(issue('D-1', '2026-11-14'), /UNIQUE/); // same draft issued twice
assert.equal((await issue('D-2', '2026-11-15')).invoiceNumber, 'SKY/2026-27/0002'); // the failed retry used no number
assert.equal((await issue('D-3', '2027-04-02')).invoiceNumber, 'SKY/2027-28/0001'); // new year restarts
assert.ok(inv1.invoiceNumber.length <= 16); // GST rule 46 limit

// --- Issued invoice number and sequence are immutable, and deletes are forbidden
const raw = (sql: string) => (globalThis as any).window.electronAPI.dbBatch([{ sql }]);
assert.match((await raw(`UPDATE local_invoices SET invoice_number = 'SKY/2026-27/9999' WHERE id = 'D-1'`)).error, /cannot be altered/);
assert.match((await raw(`UPDATE local_invoices SET seq = 999 WHERE id = 'D-1'`)).error, /cannot be altered/);
assert.match((await raw(`DELETE FROM local_invoices WHERE id = 'D-1'`)).error, /cannot be deleted/);
assert.match((await raw(`DROP TRIGGER trg_invoice_immutable`)).error, /DDL.*not permitted/);
assert.match((await raw(`DROP TABLE local_invoices`)).error, /DDL.*not permitted/);

// --- Issued invoice content is locked: corrections go through credit and debit notes
for (const column of ['notes', 'total', 'items_json', 'customer_json', 'due_date']) {
  assert.match((await raw(`UPDATE local_invoices SET ${column} = ${column} WHERE id = 'D-1'`)).error, /cannot be edited/);
}

// --- Payments: partial, full, overpayment refused
const pay = (invoiceId: string, amount: number) => db.addPayment({ invoiceId, amount, paidOn: '2026-11-16', method: 'UPI', reference: 'utr' });
await pay('D-1', 4000);
await assert.rejects(pay('D-1', 3000), /more than the outstanding/);
await pay('D-1', 2844);
const [paid] = (await db.listInvoices()).filter((i) => i.id === 'D-1');
assert.deepEqual([paid.paid, db.outstandingOf(paid), db.paymentStatusOf(paid).label], [6844, 0, 'Paid']);
assert.equal((await db.listPayments()).length, 2);

// --- Cancelling keeps the record and number, and blocks payments
await db.cancelInvoice('D-2');
await assert.rejects(pay('D-2', 1), /more than the outstanding/);
assert.equal((await db.listInvoices({ from: '2026-11-15', to: '2026-11-15' }))[0].status, 'cancelled');
assert.match((await raw(`UPDATE local_invoices SET notes = 'X' WHERE id = 'D-2'`)).error, /cannot be edited/);

// --- Credit notes: own series, reduce outstanding, capped at the invoice value, immutable
const inv3 = (await db.listInvoices()).find((i) => i.id === 'D-3')!;
const credit = (invoiceId: string, t = totals) => db.issueCreditNote({ invoiceId, items, totals: t, reason: 'Returned', issueDate: '2027-04-03' });
const half = computeInvoice([{ ...items[0], rate: 2900 }], '21', '21'); // 3422
await credit('D-3', half);
const [cn] = await db.listCreditNotes();
assert.deepEqual([cn.creditNumber, cn.invoiceNumber, cn.total], ['CN/2027-28/0001', inv3.invoiceNumber, 3422]);
const after = (await db.listInvoices()).find((i) => i.id === 'D-3')!;
assert.deepEqual([after.credited, db.outstandingOf(after)], [3422, 3422]);
await assert.rejects(pay('D-3', 3500), /more than the outstanding/); // payments respect credit notes
await assert.rejects(credit('D-3'), /more than the invoice value/); // 3422 + 6844 > 6844
await credit('D-3', half);
const full = (await db.listInvoices()).find((i) => i.id === 'D-3')!;
assert.deepEqual([db.outstandingOf(full), db.paymentStatusOf(full).label], [0, 'Credited']);
assert.equal((await db.listCreditNotes())[0].creditNumber, 'CN/2027-28/0002');
await assert.rejects(credit('D-2'), /more than the invoice value/); // cancelled invoice
assert.match((await raw(`UPDATE local_credit_notes SET total = 1`)).error, /cannot be edited/);
assert.match((await raw(`DELETE FROM local_credit_notes`)).error, /cannot be deleted/);

// --- CSV import: products upsert by SKU, customers skip a GSTIN that is already saved
await db.importProducts([{ ...product, name: 'Imported Name', defaultPrice: 7000 }, { ...product, sku: 'NEW-1', name: 'New One' }]);
const imported = await db.searchProducts('');
assert.deepEqual([imported.length, imported.find((x) => x.sku === 'SB-F405-V4')!.name], [3, 'Imported Name']);
const reg = { businessName: 'Garuda', contactPerson: '', gstin: '29AAACG8412F1Z8', email: '', phone: '', billingAddress: 'B', stateCode: '29', stateName: 'Karnataka', pincode: '560038', paymentTermsDays: 30 };
await db.importCustomers([reg]);
await db.importCustomers([reg, { ...reg, gstin: '', businessName: 'Walk-in' }]);
assert.deepEqual((await db.searchCustomers('')).map((x) => x.businessName).sort(), ['Garuda', 'SkyHigh Drones', 'Walk-in']);

// --- Settings
await db.setSetting('company', { a: 1 });
await db.setSetting('company', { a: 2 });
assert.deepEqual(await db.getSetting('company'), { a: 2 });
assert.equal(await db.getSetting('missing'), null);

console.log('db ok');

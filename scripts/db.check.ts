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
    dbBatch: async (statements: { sql: string; params?: any[] }[]) => attempt(() => {
      sqlite.run('BEGIN');
      try {
        for (const s of statements) sqlite.run(s.sql, s.params ?? []);
        sqlite.run('COMMIT');
      } catch (e) {
        sqlite.run('ROLLBACK');
        throw e;
      }
      return {};
    }),
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

// --- Debit notes: own series, raise what is owed, payments and credits respect them
const debit = (invoiceId: string, rate = 1000) => {
  const lines = [{ ...items[0], rate }];
  return db.issueDebitNote({ invoiceId, items: lines, totals: computeInvoice(lines, '21', '21'), reason: 'Freight not billed', issueDate: '2026-11-20' });
};
await debit('D-1');
const [dn] = await db.listDebitNotes();
assert.deepEqual([dn.debitNumber, dn.invoiceNumber, dn.total, dn.invoiceTotal], ['DN/2026-27/0001', inv1.invoiceNumber, 1180, 6844]);
const raised = (await db.listInvoices()).find((i) => i.id === 'D-1')!;
assert.deepEqual([raised.debited, db.outstandingOf(raised), db.paymentStatusOf(raised).label], [1180, 1180, 'Partly Paid']);
await assert.rejects(pay('D-1', 1200), /more than the outstanding/);
await pay('D-1', 1180);
assert.equal(db.outstandingOf((await db.listInvoices()).find((i) => i.id === 'D-1')!), 0);
await assert.rejects(debit('D-2'), /only be issued against an issued invoice/); // cancelled
assert.equal((await db.listDebitNotes()).length, 1);
assert.match((await raw(`UPDATE local_debit_notes SET total = 1`)).error, /cannot be edited/);
assert.match((await raw(`DELETE FROM local_debit_notes`)).error, /cannot be deleted/);
await db.issueCreditNote({ invoiceId: 'D-1', items, totals, reason: 'Return', issueDate: '2026-11-21' }); // credit may now reach invoice + debit
await db.issueCreditNote({ invoiceId: 'D-1', items: [{ ...items[0], rate: 1000 }], totals: computeInvoice([{ ...items[0], rate: 1000 }], '21', '21'), reason: 'Return', issueDate: '2026-11-21' });
await assert.rejects(db.issueCreditNote({ invoiceId: 'D-1', items, totals, reason: 'Too much', issueDate: '2026-11-21' }), /more than the invoice value/);

// --- GSTR-1 JSON: B2B, B2C Large, B2C Small net of notes, notes, HSN, document summary
{
  const { buildGstr1, isB2cl } = await import('../src/lib/gstr1.ts');
  const reg = { businessName: 'Garuda', contactPerson: '', gstin: '29AAACG8412F1Z8', email: '', phone: '', billingAddress: 'B', stateCode: '29', stateName: 'Karnataka', pincode: '560038', paymentTermsDays: 30 };
  const regCustomer = { ...reg, id: 'cust-reg' };
  const bigBuyer = { ...reg, id: 'cust-big', gstin: '', businessName: 'Cash Buyer Bengaluru' };
  const bill = (draftId: string, customer: typeof reg, qty: number, rate = 5800) => {
    const lines = [{ ...items[0], qty, rate }];
    return db.issueInvoice({ draftId, customer: customer as any, company, items: lines, totals: computeInvoice(lines, '21', customer.stateCode), notes: '', issueDate: '2026-11-22', dueDate: '2026-11-22' });
  };
  const b2bInv = await bill('G-B2B', regCustomer, 2);
  const b2clInv = await bill('G-B2CL', bigBuyer, 20); // 20 x 5800 + 18% = 136,880
  const smallInter = await bill('G-SMALL', { ...bigBuyer, id: 'cust-small' }, 2); // 13,688: below the B2C Large limit
  assert.deepEqual([isB2cl(b2bInv, b2bInv.total), isB2cl(b2clInv, b2clInv.total), isB2cl(smallInter, smallInter.total), isB2cl(inv1, inv1.total)], [false, true, false, false]);

  const noteOn = (invoiceId: string, qty: number) => {
    const lines = [{ ...items[0], qty }];
    return db.issueCreditNote({ invoiceId, items: lines, totals: computeInvoice(lines, '21', '29'), reason: 'Returned', issueDate: '2026-11-23' });
  };
  await noteOn('G-B2B', 1);
  await noteOn('G-B2CL', 2);
  await noteOn('G-SMALL', 1);

  const range = { from: '2026-11-01', to: '2026-11-30' };
  const g = buildGstr1({ gstin: '21AAACS1234D1Z5', period: '2026-11', invoices: await db.listInvoices(range), credits: await db.listCreditNotes(range), debits: await db.listDebitNotes(range) });
  assert.equal(g.fp, '112026');
  assert.deepEqual([g.b2b.length, g.b2b[0].ctin, g.b2b[0].inv[0].inum, g.b2b[0].inv[0].pos, g.b2b[0].inv[0].itms[0].itm_det.iamt], [1, reg.gstin, b2bInv.invoiceNumber, '29', 2088]);
  assert.deepEqual([g.b2cl.length, g.b2cl[0].pos, g.b2cl[0].inv[0].val, g.b2cl[0].inv[0].itms[0].itm_det.txval], [1, '29', 136880, 116000]);
  assert.ok(!('camt' in g.b2cl[0].inv[0].itms[0].itm_det)); // inter-state only
  // B2C Small nets credit and debit notes: Odisha intra (D-1 5800 + debit 1000 - credits 5800 and 1000) is reversed to nothing and left out;
  // Karnataka inter keeps 2 x 5800 less one returned
  assert.equal(g.b2cs.length, 1);
  assert.deepEqual([g.b2cs[0].sply_ty, g.b2cs[0].pos, g.b2cs[0].rt, g.b2cs[0].txval, g.b2cs[0].iamt, g.b2cs[0].camt], ['INTER', '29', 18, 5800, 1044, 0]);
  assert.equal(g.cdnr[0].ctin, reg.gstin);
  assert.deepEqual([g.cdnr[0].nt[0].ntty, g.cdnr[0].nt[0].nt_num.startsWith('CN/'), g.cdnr[0].nt[0].itms[0].itm_det.iamt], ['C', true, 1044]);
  assert.deepEqual([g.cdnur.length, g.cdnur[0].typ, g.cdnur[0].ntty, g.cdnur[0].itms[0].itm_det.txval], [1, 'B2CL', 'C', 11600]);
  const hsn = g.hsn.data.find((h) => h.hsn_sc === '85269190')!;
  assert.deepEqual([hsn.uqc, hsn.rt], ['PCS', 18]);
  assert.equal(hsn.qty, 25 - 6); // issued 1 + 2 + 20 + 2, less 6 credited; the debit note adds value but no quantity
  const inv = g.doc_issue.doc_det.find((d) => d.doc_num === 1)!.docs[0];
  assert.deepEqual([inv.cancel, inv.totnum - inv.cancel === inv.net_issue], [1, true]); // D-2 was cancelled
  assert.deepEqual(g.doc_issue.doc_det.map((d) => d.doc_num), [1, 4, 5]);
}

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

// --- Audit log: written by triggers, append-only
const audit = (await (globalThis as any).window.electronAPI.dbQuery(`SELECT entity, action, before_json, after_json FROM local_audit WHERE entity = 'product' AND entity_id = ? ORDER BY id`, [p.id])).rows;
assert.deepEqual(audit.map((a: any) => a.action), ['create', 'update', 'update', 'update']); // saved, renamed, price change, CSV import
assert.equal(JSON.parse(audit[2].before_json).default_price, 5800);
assert.equal(JSON.parse(audit[2].after_json).default_price, 6000);
assert.ok((await (globalThis as any).window.electronAPI.dbQuery(`SELECT 1 FROM local_audit WHERE entity = 'invoice' AND action = 'update'`)).rows.length > 0); // edits and cancels
assert.match((await raw(`UPDATE local_audit SET entity = 'x'`)).error, /cannot be edited/);
assert.match((await raw(`DELETE FROM local_audit`)).error, /cannot be deleted/);

console.log('db ok');

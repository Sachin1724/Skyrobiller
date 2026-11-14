// Run: node scripts/gst.check.ts
import assert from 'node:assert/strict';
import { computeInvoice, type InvoiceLine } from '../src/lib/gst.ts';

const line = (rate: number, gstRate = 18, qty = 1, discountPct = 0): InvoiceLine =>
  ({ sku: 'X', description: 'x', hsnCode: '8526', unit: 'PCS', qty, rate, discountPct, gstRate });

// Intra-state: CGST + SGST
let t = computeInvoice([line(5800)], '21', '21');
assert.deepEqual([t.taxable, t.cgst, t.sgst, t.igst, t.total], [5800, 522, 522, 0, 6844]);

// Inter-state: IGST only
t = computeInvoice([line(5800)], '21', '29');
assert.deepEqual([t.cgst, t.sgst, t.igst, t.total], [0, 0, 1044, 6844]);

// Round-off to nearest rupee
t = computeInvoice([line(280)], '21', '29');
assert.deepEqual([t.igst, t.roundOff, t.total], [50.4, -0.4, 330]);

// Discount and quantity
t = computeInvoice([line(2450, 18, 2, 10)], '21', '21');
assert.deepEqual([t.taxable, t.cgst, t.total], [4410, 396.9, 5204]);

// Odd paise: each half rounded on its own, so CGST always equals SGST
t = computeInvoice([line(100.05, 5)], '21', '21');
assert.deepEqual([t.cgst, t.sgst], [2.5, 2.5]);


// GSTIN check character and the pre-issue checks
const { isValidGstin, gstinCheckChar, checkInvoice } = await import('../src/lib/checks.ts');
assert.ok(isValidGstin('27AAPFU0939F1ZV')); // a published sample GSTIN
assert.ok(!isValidGstin('27AAPFU0939F1ZX')); // wrong check character
assert.ok(!isValidGstin('27AAPFU0939F1AV')); // 14th character must be Z
assert.equal(gstinCheckChar('27AAPFU0939F1Z'), 'V');
const base = {
  kind: 'invoice' as const, total: 5000, dues: null, issuedToday: [],
  company: { legalName: 'Real Co', gstin: '27AAPFU0939F1ZV', accountNumber: '123' },
  customer: { id: 'c', businessName: 'X', gstin: '', stateCode: '21' } as any,
  items: [{ sku: 'A', description: 'Motor', hsnCode: '85011019', unit: 'PCS', qty: 1, rate: 1000, discountPct: 0, gstRate: 18 }],
};
assert.deepEqual(checkInvoice(base), []); // a clean bill
const bad = checkInvoice({ ...base, customer: null, items: [{ ...base.items[0], qty: 0, hsnCode: '12', description: '' }], total: 0 });
assert.deepEqual(bad.filter((i) => i.level === 'error').map((i) => i.field).sort(), ['customer', 'description', 'hsn', 'qty']); // every problem at once
assert.ok(bad.find((i) => i.field === 'customer')!.empty);
assert.equal(checkInvoice({ ...base, customer: { ...base.customer, gstin: '29AAPFU0939F1ZV' } }).filter((i) => i.level === 'error').length, 1); // bad check character
assert.match(checkInvoice({ ...base, customer: { ...base.customer, gstin: '27AAPFU0939F1ZV', stateCode: '29' } })[0].message, /state 27/); // state mismatch
const warns = checkInvoice({ ...base, items: [{ ...base.items[0], catalogRate: 1200, discountPct: 25, gstRate: 0 }], dues: { outstanding: 900, overdue: 2 }, issuedToday: [{ total: 5000, items: 1 }], company: { ...base.company, gstin: '21AAACS1234D1Z5' } });
assert.deepEqual(warns.map((i) => i.field).sort(), ['company', 'discount', 'dues', 'duplicate', 'gst', 'rate']);
assert.ok(warns.every((i) => i.level === 'warning')); // none of these block issuing
assert.deepEqual(checkInvoice({ ...base, kind: 'quotation', dues: { outstanding: 1, overdue: 1 } }), []); // quotations skip invoice-only warnings

// Empty invoice
assert.equal(computeInvoice([], '21', '21').total, 0);

// Amount in words (Indian numbering) for the PDF
const { rupeesInWords } = await import('../src/lib/pdf.ts');
assert.equal(rupeesInWords(0), 'Zero Rupees Only');
assert.equal(rupeesInWords(6844), 'Six Thousand Eight Hundred Forty Four Rupees Only');
assert.equal(rupeesInWords(100000), 'One Lakh Rupees Only');
assert.equal(rupeesInWords(12345678), 'One Crore Twenty Three Lakh Forty Five Thousand Six Hundred Seventy Eight Rupees Only');
assert.equal(rupeesInWords(1019), 'One Thousand Nineteen Rupees Only');

// CSV parsing for catalogue import
const { parseCsv, csvRecords, toCsv } = await import('../src/lib/csv.ts');
assert.deepEqual(parseCsv('a,b\r\n"x, y","he said ""hi"""\n\n"multi\nline",z'), [['a', 'b'], ['x, y', 'he said "hi"'], ['multi\nline', 'z']]);
assert.deepEqual(csvRecords('\uFEFFSKU, Name\nA1,Motor\n', ['sku', 'name']), [{ sku: 'A1', name: 'Motor' }]);
assert.throws(() => csvRecords('sku\nA1', ['sku', 'price']), /Missing column: price/);
assert.deepEqual(parseCsv(toCsv([['a,b', 'q"q'], [1, 2]])), [['a,b', 'q"q'], ['1', '2']]); // round trip
assert.equal(toCsv([['=1+1', '+SUM', '-5', '@cmd']]), `"'=1+1","'+SUM","'-5","'@cmd"`); // neutralises formula injection

console.log('gst ok');

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

console.log('gst ok');

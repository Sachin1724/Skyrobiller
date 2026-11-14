// Indian GST invoice maths (plan §5). All arithmetic in integer paise; results returned in rupees.

export interface InvoiceLine {
  productId?: string;
  catalogRate?: number; // catalogue price when the line was picked; differs from rate after an override
  sku: string;
  description: string;
  hsnCode: string;
  unit: string;
  qty: number;
  rate: number;
  discountPct: number;
  gstRate: number;
}

export interface InvoiceTotals {
  intraState: boolean;
  lineTaxable: number[]; // after discount, before tax
  lineTotals: number[]; // taxable + tax per line
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  roundOff: number;
  total: number;
}

export function computeInvoice(lines: InvoiceLine[], sellerStateCode: string, placeOfSupplyCode: string): InvoiceTotals {
  const intraState = sellerStateCode === placeOfSupplyCode;
  let taxable = 0, cgst = 0, sgst = 0, igst = 0;
  const lineTaxable: number[] = [];

  const lineTotals = lines.map((l) => {
    const t = Math.round(l.qty * l.rate * (100 - l.discountPct)); // rupees * 100 = paise
    const half = Math.round((t * l.gstRate) / 200);
    const full = Math.round((t * l.gstRate) / 100);
    taxable += t;
    lineTaxable.push(t / 100);
    if (intraState) { cgst += half; sgst += half; } else { igst += full; }
    return (t + (intraState ? half * 2 : full)) / 100;
  });

  const raw = taxable + cgst + sgst + igst;
  const total = Math.round(raw / 100) * 100;
  return {
    intraState,
    lineTaxable,
    lineTotals,
    taxable: taxable / 100,
    cgst: cgst / 100,
    sgst: sgst / 100,
    igst: igst / 100,
    roundOff: (total - raw) / 100,
    total: total / 100,
  };
}

import React, { useEffect, useRef, useState } from 'react';
import { toast } from '../../store/useToastStore';
import { friendlyError } from '../../lib/friendlyError';
import { Plus, Search, Pencil, Upload, Boxes } from 'lucide-react';
import { formatCurrencyINR } from '../../lib/utils';
import { searchProducts, saveProduct, importProducts, type Product } from '../../lib/db';
import { csvRecords, downloadCsv } from '../../lib/csv';
import { Modal } from '../../components/Modal';
import { RowMenu } from '../../components/RowMenu';
import { SkeletonRows, EmptyState } from '../../components/Skeleton';
import { useMenuAction } from '../../store/useNavStore';
import { useSystemStore } from '../../store/useSystemStore';

export const ProductsView: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loaded, setLoaded] = useState(false);
  // undefined = closed, null = adding, Product = editing
  const [editing, setEditing] = useState<Product | null | undefined>(undefined);
  const [error, setError] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = () => searchProducts(searchTerm).then((rows) => { setProducts(rows); setLoaded(true); }).catch((e) => setError(friendlyError(e)));
  useEffect(() => { reload(); }, [searchTerm]);
  const defaultGstRate = useSystemStore((s) => s.prefs.defaultGstRate);
  useMenuAction({ 'new-product': () => openForm(null), 'import-products': () => fileInput.current?.click() });

  const openForm = (p: Product | null) => { setError(''); setEditing(p); };

  // Whole file or nothing: every row is checked first, then imported in one transaction
  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const records = csvRecords(await file.text(), ['sku', 'name', 'hsn', 'gst_rate', 'price']);
      const problems: string[] = [];
      const rows = records.map((r, i) => {
        const gstRate = Number(r.gst_rate), defaultPrice = Number(r.price);
        const bad = [
          !r.sku && 'sku is empty', !r.name && 'name is empty', !/^[0-9]{4,8}$/.test(r.hsn) && 'hsn must be 4 to 8 digits',
          (r.gst_rate === '' || !(gstRate >= 0 && gstRate <= 28)) && 'gst_rate must be 0 to 28', (r.price === '' || !(defaultPrice >= 0)) && 'price must be a number',
        ].filter(Boolean);
        if (bad.length) problems.push(`Row ${i + 2}: ${bad.join(', ')}`);
        return { sku: r.sku.toUpperCase(), name: r.name, brand: r.brand ?? '', description: r.description ?? '', unit: (r.unit || 'PCS').toUpperCase(), hsnCode: r.hsn, gstRate, defaultPrice, searchAliases: r.aliases ?? '' };
      });
      if (rows.length === 0) throw new Error('The file has no product rows.');
      if (problems.length) throw new Error(`Nothing was imported. Fix these rows and import again. ${problems.slice(0, 5).join('. ')}${problems.length > 5 ? `. And ${problems.length - 5} more.` : '.'}`);
      await importProducts(rows);
      setError('');
      toast.success(`Imported ${rows.length} products. Existing SKUs were updated.`);
      reload();
    } catch (err: any) {
      setError(friendlyError(err));
    }
  };

  const downloadTemplate = () => downloadCsv('products-template', [
    ['sku', 'name', 'brand', 'description', 'unit', 'hsn', 'gst_rate', 'price', 'aliases'],
    ['SB-F405-V4', 'SpeedyBee F405 V4 Flight Controller', 'SpeedyBee', '30x30 stack', 'PCS', '85269190', 18, 4500, 'f405, fc stack'],
  ]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>;
    try {
      await saveProduct({
        id: editing?.id,
        sku: f.sku.trim().toUpperCase(),
        name: f.name.trim(),
        brand: f.brand.trim(),
        description: f.description.trim(),
        unit: f.unit,
        hsnCode: f.hsnCode,
        gstRate: Number(f.gstRate),
        defaultPrice: Number(f.defaultPrice),
        searchAliases: f.searchAliases.trim(),
      });
      setEditing(undefined);
      reload();
    } catch (err: any) {
      setError(friendlyError(err));
    }
  };

  return (
    <div className="page">
      <div className="flex items-center justify-between gap-4">
        <div className="relative w-80">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-ink-3 pointer-events-none" aria-hidden />
          <input
            type="search"
            aria-label="Search products"
            autoComplete="off"
            spellCheck={false}
            placeholder="Search SKU, name, brand or alias…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="field pl-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <button onClick={downloadTemplate} className="btn btn-plain">CSV Template</button>
          <button onClick={() => fileInput.current?.click()} className="btn">
            <Upload className="h-4 w-4" aria-hidden />
            Import CSV
          </button>
          <input ref={fileInput} type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" aria-label="Import products from CSV" />
          <button onClick={() => openForm(null)} className="btn btn-primary">
            <Plus className="h-4 w-4" aria-hidden />
            Add Product
          </button>
        </div>
      </div>
      {error && editing === undefined && <p role="alert" className="error">{error}</p>}

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Unit</th>
              <th>HSN/SAC</th>
              <th className="num">GST</th>
              <th className="num">Price</th>
              <th><span className="sr-only">Actions</span></th>
            </tr>
          </thead>
          <tbody>
            {!loaded && <SkeletonRows columns={7} />}
            {loaded && products.length === 0 && (
              <tr>
                <td colSpan={7}>
                  {searchTerm
                    ? <p className="empty">No products match this search.</p>
                    : <EmptyState icon={Boxes} title="Your catalogue is empty" hint="Add the parts you sell once. After that, billing is a search and a click, with HSN code and GST rate filled in." action={{ label: 'Add Your First Product', onClick: () => openForm(null) }} />}
                </td>
              </tr>
            )}
            {products.map((item) => (
              <tr key={item.id}>
                <td className="font-medium whitespace-nowrap">{item.sku}</td>
                <td className="max-w-md">
                  <div className="truncate">{item.name}</div>
                  <div className="text-xs text-ink-2 truncate">
                    {[item.brand, item.description, item.searchAliases].filter(Boolean).join(' · ')}
                  </div>
                </td>
                <td>{item.unit}</td>
                <td className="tabular-nums">{item.hsnCode}</td>
                <td className="num">{item.gstRate}%</td>
                <td className="num font-medium">{formatCurrencyINR(item.defaultPrice)}</td>
                <td className="num">
                  <RowMenu label={`Actions for ${item.sku}`} items={[{ label: 'Edit product', icon: Pencil, onClick: () => openForm(item) }]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-ink-2">
        Changing a price on an invoice never changes the catalogue. Catalogue prices change only here or through “Save to catalogue”.
      </p>

      {editing !== undefined && (
        <Modal title={editing ? 'Edit Product' : 'Add Product'} onClose={() => setEditing(undefined)}>
          <form onSubmit={handleSubmit} autoComplete="off" className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="label">SKU
                <input name="sku" required autoFocus spellCheck={false} defaultValue={editing?.sku} placeholder="SB-F405-V4" className="field" />
              </label>
              <label className="label">Brand
                <input name="brand" defaultValue={editing?.brand} placeholder="SpeedyBee" className="field" />
              </label>
              <label className="label col-span-2">Product Name
                <input name="name" required defaultValue={editing?.name} placeholder="SpeedyBee F405 V4 Flight Controller" className="field" />
              </label>
              <label className="label col-span-2">Description
                <input name="description" defaultValue={editing?.description} className="field" />
              </label>
              <label className="label">Unit
                <select name="unit" defaultValue={editing?.unit ?? 'PCS'} className="field">
                  {['PCS', 'SET', 'PAIR', 'BOX', 'MTR', 'KG'].map((u) => <option key={u}>{u}</option>)}
                </select>
              </label>
              <label className="label">HSN/SAC (4–8 Digits)
                <input name="hsnCode" required inputMode="numeric" pattern="[0-9]{4,8}" defaultValue={editing?.hsnCode} placeholder="85269190" className="field" />
              </label>
              <label className="label">GST Rate %
                <select name="gstRate" defaultValue={editing?.gstRate ?? defaultGstRate} className="field">
                  {[0, 5, 12, 18, 28].map((r) => <option key={r}>{r}</option>)}
                </select>
              </label>
              <label className="label">Price Before GST (₹)
                <input name="defaultPrice" type="number" required min="0" step="0.01" defaultValue={editing?.defaultPrice} className="field" />
              </label>
              <label className="label col-span-2">Search Aliases (Comma-Separated)
                <input name="searchAliases" spellCheck={false} defaultValue={editing?.searchAliases} placeholder="f405, fc stack, 55a" className="field" />
              </label>
            </div>
            {error && <p role="alert" className="error">{error}</p>}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setEditing(undefined)} className="btn">Cancel</button>
              <button type="submit" className="btn btn-primary">Save Product</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};

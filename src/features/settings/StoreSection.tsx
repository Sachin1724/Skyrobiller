import React, { useEffect, useState } from 'react';
import { getStoreConfig, setStoreConfig } from '../../lib/skyrostore';
import { toast } from '../../store/useToastStore';
import { friendlyError } from '../../lib/friendlyError';

export const StoreSection: React.FC<{ hidden: boolean }> = ({ hidden }) => {
  const [baseUrl, setBaseUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  useEffect(() => { getStoreConfig().then((c) => { if (c) { setBaseUrl(c.baseUrl); setApiKey(c.apiKey); } }).catch(() => undefined); }, []);

  const save = () => setStoreConfig({ baseUrl: baseUrl.trim(), apiKey: apiKey.trim() })
    .then(() => toast.success('Online store saved.')).catch((e) => toast.error(friendlyError(e)));

  return (
    <section data-section="store" hidden={hidden} className="card p-4 space-y-4 max-w-3xl">
      <h2 className="text-base font-semibold tracking-tight">Online Store</h2>
      <label className="label">Skyrostore backend URL
        <input className="field" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} placeholder="https://api.skyrostore.com" spellCheck={false} />
      </label>
      <label className="label">Admin API key
        <input className="field" type="password" value={apiKey} onChange={(e) => setApiKey(e.target.value)} autoComplete="off" />
      </label>
      <p className="text-xs text-ink-3">Online orders appear in Invoices &gt; Online Store as SKYW tax invoices, a separate series from counter bills. The key stays on this computer.</p>
      <button type="button" onClick={save} className="btn btn-primary">Save</button>
    </section>
  );
};

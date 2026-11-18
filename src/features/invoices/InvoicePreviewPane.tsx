import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Printer, FileDown } from 'lucide-react';
import { Modal } from '../../components/Modal';
import { documentHtml, buildLook, printDocument, savePdf, type PrintableDocument } from '../../lib/pdf';
import type { Company } from '../../store/useSystemStore';

const A4_W = 794;
const A4_H = 1123;
const REFRESH_MS = 250;

// The document as it would print, rebuilt shortly after the last keystroke. `doc` is null until there is enough to show.
export function useDocumentHtml(doc: PrintableDocument | null, company: Company): string {
  const [html, setHtml] = useState('');
  useEffect(() => {
    if (!doc) { setHtml(''); return; }
    let stale = false;
    const t = window.setTimeout(() => {
      buildLook(doc, company).then((look) => { if (!stale) setHtml(documentHtml(doc, look)); }).catch(() => {});
    }, REFRESH_MS);
    return () => { stale = true; window.clearTimeout(t); };
  }, [doc, company]);
  return html;
}

// Side-by-side live preview: the A4 page scaled to fit the pane width
export const InvoicePreviewPane: React.FC<{ html: string; emptyText: string; onExpand: () => void }> = ({ html, emptyText, onExpand }) => {
  const box = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => setScale(el.clientWidth / A4_W);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <aside aria-label="Live preview" className="card p-3 space-y-2 sticky top-4">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold tracking-tight">Live Preview</span>
        <button onClick={onExpand} disabled={!html} className="btn" title="Full screen preview">
          <Maximize2 className="h-4 w-4" aria-hidden />
          Full screen
        </button>
      </div>
      <div ref={box} className="w-full overflow-hidden rounded border border-line bg-white" style={{ height: A4_H * scale }}>
        {html ? (
          <iframe title="Live document preview" sandbox="" srcDoc={html} tabIndex={-1} className="origin-top-left pointer-events-none border-0" style={{ width: A4_W, height: A4_H, transform: `scale(${scale})` }} />
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-2">{emptyText}</div>
        )}
      </div>
    </aside>
  );
};

// Full-screen review of the same document, with print and PDF
export const PreviewModal: React.FC<{ doc: PrintableDocument; html: string; company: Company; onClose: () => void; onError: (e: unknown) => void }> = ({ doc, html, company, onClose, onError }) => (
  <Modal wide title={`${doc.title} · ${doc.number}`} onClose={onClose}>
    <iframe title={`${doc.title} ${doc.number}`} sandbox="" srcDoc={html} className="w-full h-[72vh] rounded border border-line bg-white" />
    <div className="mt-3 text-right">
      <button onClick={() => printDocument(doc, company).catch(onError)} className="btn mr-2">
        <Printer className="h-4 w-4" aria-hidden />
        Print
      </button>
      <button onClick={() => savePdf(doc, company).catch(onError)} className="btn btn-primary">
        <FileDown className="h-4 w-4" aria-hidden />
        Save PDF
      </button>
    </div>
  </Modal>
);

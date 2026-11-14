import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';

// Native <dialog>: focus trap, Esc to close and an inert background come from the platform.
export const Modal: React.FC<{ title: string; onClose: () => void; wide?: boolean; children: React.ReactNode }> = ({ title, onClose, wide, children }) => {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!ref.current?.open) ref.current?.showModal();
  }, []);

  return (
    <dialog ref={ref} className={`sheet relative ${wide ? 'max-w-4xl' : ''}`} onClose={onClose} aria-labelledby="modal-title">
      <h2 id="modal-title" className="px-5 pt-5 pb-3 pr-14 text-[15px] font-semibold tracking-tight">{title}</h2>
      <div className="px-5 pb-5">{children}</div>
      {/* Last in the DOM so the dialog's initial focus lands on the first field, not on Close */}
      <button type="button" className="btn btn-icon absolute top-3 right-3" onClick={onClose} aria-label="Close">
        <X className="h-4 w-4" aria-hidden />
      </button>
    </dialog>
  );
};

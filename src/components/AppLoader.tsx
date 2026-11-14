import React, { useEffect, useRef, useState } from 'react';
import logo from '../assets/logo.png';
import { leave } from '../lib/motion';

// Shown while the profile and preferences load, so the app never flashes unstyled or half-empty.
// Stays for at least a moment so it reads as a start-up rather than a flicker, then fades away.
export const AppLoader: React.FC<{ ready: boolean }> = ({ ready }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [minElapsed, setMinElapsed] = useState(false);
  const [gone, setGone] = useState(false);

  useEffect(() => { const t = setTimeout(() => setMinElapsed(true), 650); return () => clearTimeout(t); }, []);
  useEffect(() => { if (ready && minElapsed && ref.current) leave(ref.current, () => setGone(true)); }, [ready, minElapsed]);

  if (gone) return null;
  return (
    <div ref={ref} role="status" aria-label="Starting Skyro Biller" className="fixed inset-0 z-[100] grid place-items-center bg-bg">
      <div className="flex flex-col items-center gap-4">
        <img src={logo} alt="" width={72} height={72} className="loader-logo h-[72px] w-[72px] rounded-md" />
        <div className="text-center">
          <div className="text-base font-semibold tracking-tight">Skyro Biller</div>
          <div className="text-xs text-ink-2">Opening your books…</div>
        </div>
        <div className="loader-bar" aria-hidden />
      </div>
    </div>
  );
};

import React, { useLayoutEffect, useRef } from 'react';
import { enter } from '../lib/motion';

// Wrap a screen or panel: it animates in each time it mounts. Give it a key that changes with the content.
export const Reveal: React.FC<{ children: React.ReactNode; x?: number; y?: number; className?: string }> = ({ children, x, y, className }) => {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => { if (ref.current) enter(ref.current, { x, y }); }, []);
  return <div ref={ref} className={className}>{children}</div>;
};

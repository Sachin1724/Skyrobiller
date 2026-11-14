import React from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { useToastStore, type ToastKind } from '../store/useToastStore';
import { Reveal } from './Reveal';

const ICON: Record<ToastKind, { Icon: React.ComponentType<{ className?: string }>; tone: string }> = {
  success: { Icon: CheckCircle2, tone: 'text-success' },
  info: { Icon: Info, tone: 'text-accent' },
  error: { Icon: AlertCircle, tone: 'text-danger' },
};

// Bottom-right messages that clear themselves: success and info after 3 s, errors after 7 s
export const ToastHost: React.FC = () => {
  const { items, dismiss } = useToastStore();
  return (
    <div role="status" aria-live="polite" className="fixed bottom-10 right-4 z-[60] flex w-80 flex-col gap-2 pointer-events-none">
      {items.map((t) => {
        const { Icon, tone } = ICON[t.kind];
        return (
          <Reveal key={t.id} y={8}>
            <div className="card pointer-events-auto flex items-start gap-3 p-3 shadow-md">
              <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden />
              <p className="flex-1 text-sm">{t.message}</p>
              <button onClick={() => dismiss(t.id)} aria-label="Dismiss" className="text-ink-3 hover:text-ink"><X className="h-4 w-4" aria-hidden /></button>
            </div>
          </Reveal>
        );
      })}
    </div>
  );
};

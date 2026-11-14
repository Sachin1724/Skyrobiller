import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavStore } from '../store/useNavStore';
import { setSetting } from '../lib/db';
import { TOUR_STEPS } from '../lib/guide';

const CARD_WIDTH = 380;
const GAP = 16;

// Guided tour: dims the app, highlights the part being explained and describes it.
export const Tour: React.FC = () => {
  const { setTourOpen, setCurrentModule } = useNavStore();
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const card = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  const step = TOUR_STEPS[index];
  const last = index === TOUR_STEPS.length - 1;

  const finish = (openSettings = false) => {
    setSetting('tourDone', true).catch(() => {}); // do not show it again at start-up
    setTourOpen(false);
    if (openSettings) setCurrentModule('settings');
  };

  // Show the screen being described, then find the element to highlight (after it has rendered)
  useLayoutEffect(() => {
    if (step.module) setCurrentModule(step.module);
    const measure = () => {
      const el = step.target ? document.querySelector(`[data-tour="${step.target}"]`) : null;
      setRect(el ? el.getBoundingClientRect() : null);
    };
    const frame = requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => { cancelAnimationFrame(frame); window.removeEventListener('resize', measure); };
  }, [index]);

  // Put the card beside the highlight, or in the middle when there is nothing to highlight
  useLayoutEffect(() => {
    const height = card.current?.offsetHeight ?? 300;
    const vw = window.innerWidth, vh = window.innerHeight;
    const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(v, max));
    if (!rect) {
      setPos({ left: (vw - CARD_WIDTH) / 2, top: Math.max(GAP, (vh - height) / 2) });
    } else if (rect.left < vw / 3 && rect.height < vh / 2) {
      // beside a sidebar item
      setPos({ left: rect.right + GAP, top: clamp(rect.top - 8, GAP, vh - height - GAP) });
    } else if (rect.left < vw / 3) {
      // beside the whole sidebar
      setPos({ left: rect.right + GAP, top: GAP + 40 });
    } else {
      // under a button in the header
      setPos({ left: clamp(rect.right - CARD_WIDTH, GAP, vw - CARD_WIDTH - GAP), top: rect.bottom + 12 });
    }
  }, [rect, index]);

  useEffect(() => { next.current?.focus(); }, [index]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') finish();
    else if (e.key === 'ArrowRight' && !last) setIndex(index + 1);
    else if (e.key === 'ArrowLeft' && index > 0) setIndex(index - 1);
  };

  return (
    <div className="fixed inset-0 z-[60]" onKeyDown={onKeyDown}>
      {/* The dim layer. With a target, the highlight's huge shadow does the dimming so the target stays bright. */}
      {rect ? (
        <div
          className="absolute rounded pointer-events-none ring-2 ring-accent"
          style={{ left: rect.left - 4, top: rect.top - 4, width: rect.width + 8, height: rect.height + 8, boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.55)' }}
        />
      ) : (
        <div className="absolute inset-0 bg-black/55" />
      )}

      <div
        ref={card}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        className="card absolute shadow-2xl p-5 space-y-3"
        style={{ width: CARD_WIDTH, left: pos?.left ?? -9999, top: pos?.top ?? 0 }}
      >
        <div className="flex items-center justify-between text-xs text-ink-2">
          <span>Step {index + 1} of {TOUR_STEPS.length}</span>
          <button onClick={() => finish()} className="hover:text-ink underline">Skip Tutorial</button>
        </div>
        <div className="h-1 rounded bg-ink/10" aria-hidden>
          <div className="h-1 rounded bg-accent" style={{ width: `${((index + 1) / TOUR_STEPS.length) * 100}%` }} />
        </div>

        <h2 id="tour-title" className="text-[17px] font-semibold tracking-tight">{step.title}</h2>
        <div className="space-y-2 text-ink-2">
          {step.body.map((line, i) => <p key={i}>{line}</p>)}
        </div>

        <div className="flex items-center justify-between pt-1">
          <button onClick={() => setIndex(index - 1)} disabled={index === 0} className="btn">Back</button>
          <div className="flex gap-2">
            {last && <button onClick={() => finish(true)} className="btn">Open Settings</button>}
            <button ref={next} onClick={() => (last ? finish() : setIndex(index + 1))} className="btn btn-primary">
              {last ? 'Finish' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

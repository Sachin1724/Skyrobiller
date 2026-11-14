// Motion for the whole app, on anime.js. One curve and short durations: a billing tool is used all day,
// so movement is small and quick, and removed entirely for people who ask for reduced motion.
import { animate, stagger, cubicBezier } from 'animejs';

export const EASE_OUT = cubicBezier(0.23, 1, 0.32, 1); // strong ease-out: starts fast, settles gently
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// A screen or panel arriving: fades in while rising a few pixels (or sliding in from the side).
// Children marked data-reveal then follow one after another.
export function enter(el: HTMLElement, { x = 0, y = 6 }: { x?: number; y?: number } = {}) {
  const reduce = reducedMotion();
  animate(el, {
    opacity: [0, 1],
    ...(reduce ? {} : { translateX: [x, 0], translateY: [y, 0] }),
    duration: reduce ? 120 : 220,
    ease: EASE_OUT,
    // A leftover transform would become the containing block for position: fixed menus inside the screen
    onComplete: () => { el.style.removeProperty('transform'); el.style.removeProperty('opacity'); },
  });
  const parts = el.querySelectorAll<HTMLElement>('[data-reveal]');
  if (parts.length && !reduce) {
    animate(parts, {
      opacity: [0, 1],
      translateY: [10, 0],
      delay: stagger(45, { start: 60 }),
      duration: 320,
      ease: EASE_OUT,
      onComplete: () => parts.forEach((part) => { part.style.removeProperty('transform'); part.style.removeProperty('opacity'); }),
    });
  }
}

// Fades an element out, then calls done (used by the start-up loader)
export function leave(el: HTMLElement, done: () => void) {
  animate(el, { opacity: [1, 0], duration: reducedMotion() ? 80 : 260, ease: 'linear', onComplete: done });
}

// Slides an indicator (the active-screen pill) to a new vertical position
export function slideTo(el: HTMLElement, top: number, instant = false) {
  animate(el, { translateY: top, duration: instant || reducedMotion() ? 0 : 260, ease: EASE_OUT });
}

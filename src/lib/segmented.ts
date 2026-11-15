// Every .segmented tab bar gets one highlight pill that springs from the old tab to the new one.
// Done here, once, by watching aria-pressed, so no screen has to know about it.
import { animate, spring } from 'animejs';
import { reducedMotion } from './motion';

const pillOf = (bar: HTMLElement) => {
  let pill = bar.querySelector<HTMLElement>(':scope > .seg-pill');
  if (!pill) {
    pill = document.createElement('span');
    pill.className = 'seg-pill';
    pill.setAttribute('aria-hidden', 'true');
    bar.append(pill);
  }
  return pill;
};

function place(bar: HTMLElement, instant: boolean) {
  const on = bar.querySelector<HTMLElement>(':scope > button[aria-pressed="true"]');
  const pill = pillOf(bar);
  if (!on || !on.offsetWidth) { pill.style.opacity = '0'; return; }
  const first = pill.style.opacity !== '1';
  pill.style.opacity = '1';
  pill.style.top = `${on.offsetTop}px`;
  pill.style.height = `${on.offsetHeight}px`;
  if (instant || first || reducedMotion()) {
    pill.style.width = `${on.offsetWidth}px`;
    pill.style.transform = `translateX(${on.offsetLeft}px)`;
    return;
  }
  animate(pill, { width: on.offsetWidth, translateX: on.offsetLeft, ease: spring({ bounce: 0.35, duration: 500 }) });
}

export function initSegmented() {
  const sweep = (instant: boolean) => document.querySelectorAll<HTMLElement>('.segmented').forEach((bar) => place(bar, instant));
  new MutationObserver((records) => {
    const jumped = records.some((r) => r.type === 'childList'); // a bar appeared: no animation from nowhere
    requestAnimationFrame(() => sweep(jumped));
  }).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['aria-pressed'] });
  window.addEventListener('resize', () => sweep(true));
}

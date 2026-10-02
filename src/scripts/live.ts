/**
 * Keeps every time-sensitive line on the page honest: cut-off countdowns, the next batch,
 * and the 10pm–3am cookie emergency. Elements opt in with data-cutoff="short|long|banner|emergency".
 */
import { cutoffStatus, isEmergency } from '../lib/clock';
import { cutoffCopy, type CutoffVariant } from '../lib/cutoff-copy';

function paint() {
  const status = cutoffStatus();
  document.querySelectorAll<HTMLElement>('[data-cutoff]').forEach((el) => {
    const text = cutoffCopy(status, el.dataset.cutoff as CutoffVariant);
    if (el.textContent !== text) el.textContent = text;
  });
  const night = isEmergency();
  const root = document.documentElement;
  if (night !== (root.dataset.shift === 'night')) {
    if (night) root.dataset.shift = 'night';
    else delete root.dataset.shift;
    window.dispatchEvent(new CustomEvent('nb:shift', { detail: { night } }));
  }
}

paint();
setInterval(paint, 30_000);
document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && paint());

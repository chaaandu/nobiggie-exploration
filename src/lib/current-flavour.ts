/** The flavour you're looking at. The hero, the sticky bar and product pages all follow it. */
import { defaultFlavour, flavours, type FlavourId } from '../content/facts';

const KEY = 'nb:flavour';
const isFlavour = (id: unknown): id is FlavourId => flavours.some((f) => f.id === id);

let current: FlavourId = defaultFlavour;
try {
  const saved = localStorage.getItem(KEY);
  if (isFlavour(saved)) current = saved;
} catch {
  /* no storage: default flavour */
}

export function currentFlavour(): FlavourId {
  return current;
}

export function setCurrentFlavour(id: FlavourId, source = 'unknown') {
  if (!isFlavour(id) || id === current) return;
  const from = current;
  current = id;
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* fine */
  }
  window.dispatchEvent(new CustomEvent('nb:flavour', { detail: { id, from, source } }));
}

export function onFlavour(fn: (id: FlavourId, source: string) => void): () => void {
  const h = (e: Event) => {
    const d = (e as CustomEvent<{ id: FlavourId; source: string }>).detail;
    fn(d.id, d.source);
  };
  window.addEventListener('nb:flavour', h);
  return () => window.removeEventListener('nb:flavour', h);
}

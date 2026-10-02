/**
 * The bag: a tiny store shared by every script and island on the page.
 * Persists to localStorage and stays in sync across tabs. No framework needed.
 */
import { flavours, flavourById, type FlavourId } from '../content/facts';

export interface BagLine {
  id: FlavourId;
  qty: number;
}
export interface GiftNote {
  to: string;
  from: string;
  message: string;
}
export interface BagState {
  lines: BagLine[];
  note: GiftNote;
  pincode: string;
}

const KEY = 'nb:bag:v1';
const MAX_QTY = 99;
const empty = (): BagState => ({ lines: [], note: { to: '', from: '', message: '' }, pincode: '' });

function isFlavour(id: unknown): id is FlavourId {
  return flavours.some((f) => f.id === id);
}

function load(): BagState {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null;
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as Partial<BagState>;
    const lines = (parsed.lines ?? []).filter((l) => isFlavour(l.id) && l.qty > 0).map((l) => ({ id: l.id, qty: Math.min(MAX_QTY, Math.floor(l.qty)) }));
    return { ...empty(), ...parsed, lines, note: { ...empty().note, ...parsed.note } };
  } catch {
    return empty();
  }
}

let state: BagState = load();
const subs = new Set<(s: BagState) => void>();

function commit(next: BagState) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* private mode: the bag still works for this page */
  }
  subs.forEach((fn) => fn(state));
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      subs.forEach((fn) => fn(state));
    }
  });
}

export function getBag(): BagState {
  return state;
}

export function subscribe(fn: (s: BagState) => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

export function qtyOf(id: FlavourId, s: BagState = state): number {
  return s.lines.find((l) => l.id === id)?.qty ?? 0;
}

export function setQty(id: FlavourId, qty: number) {
  const q = Math.max(0, Math.min(MAX_QTY, Math.floor(qty)));
  const others = state.lines.filter((l) => l.id !== id);
  // Keep the shop's flavour order so the bag never reshuffles under your thumb.
  const lines = q ? [...others, { id, qty: q }] : others;
  lines.sort((a, b) => flavours.findIndex((f) => f.id === a.id) - flavours.findIndex((f) => f.id === b.id));
  commit({ ...state, lines });
}

export function add(id: FlavourId, qty = 1) {
  setQty(id, qtyOf(id) + qty);
}

/** Make sure at least `qty` of this flavour is in the bag (for "Order this cup"). */
export function ensure(id: FlavourId, qty = 1) {
  if (qtyOf(id) < qty) setQty(id, qty);
}

export function setNote(note: Partial<GiftNote>) {
  commit({ ...state, note: { ...state.note, ...note } });
}

export function setPincode(pincode: string) {
  commit({ ...state, pincode });
}

export function clearBag() {
  commit({ ...empty(), pincode: state.pincode });
}

export function count(s: BagState = state): number {
  return s.lines.reduce((n, l) => n + l.qty, 0);
}

export function subtotal(s: BagState = state): number {
  return s.lines.reduce((n, l) => n + l.qty * flavourById(l.id).price, 0);
}

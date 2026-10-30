/**
 * Where each cookie sits in the cup. Real cups are stuffed, not stacked, so cookies lie at
 * odd angles in loose layers: few at the narrow bottom, more near the brim. Deterministic
 * (seeded) so every visit, screenshot and recording packs the cup the same way.
 */
import { Euler, Matrix4, Quaternion, Vector3 } from 'three';
import { CUP, COOKIE } from './spec';

export interface Slot {
  index: number;
  layer: number;
  position: Vector3;
  quaternion: Quaternion;
  scale: number;
  seed: number;
}

export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

/** Inner radius of the cup at height y. */
export function cupRadiusAt(y: number): number {
  const t = Math.min(1, Math.max(0, y / CUP.height));
  return CUP.rBottom + (CUP.rTop - CUP.rBottom) * t - CUP.wall;
}

/** Layer sizes for a given count, bottom to top. 24 → 3,3,4,4,5,5. */
function layerSizes(total: number): number[] {
  const base = [3, 3, 4, 4, 5, 5];
  const scale = total / 24;
  const sizes = base.map((n) => Math.max(1, Math.round(n * scale)));
  let diff = total - sizes.reduce((a, b) => a + b, 0);
  for (let i = sizes.length - 1; diff !== 0; i = (i - 1 + sizes.length) % sizes.length) {
    sizes[i] += Math.sign(diff);
    diff -= Math.sign(diff);
  }
  return sizes;
}

export function packCup(total: number, seed = 7): Slot[] {
  const rand = rng(seed);
  const sizes = layerSizes(total);
  const slots: Slot[] = [];
  const layers = sizes.length;
  const top = CUP.height - COOKIE.h * 0.35; // the top layer peeks just over the rim
  const bottom = COOKIE.h * 0.62;
  let index = 0;
  for (let L = 0; L < layers; L++) {
    const n = sizes[L];
    const y = bottom + ((top - bottom) * L) / (layers - 1);
    const rIn = cupRadiusAt(y);
    const offset = rand() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const tilt = 0.25 + rand() * 0.5; // radians off flat
      const a = offset + (i / n) * Math.PI * 2 + (rand() - 0.5) * 0.5;
      // Keep the tilted cookie inside the wall.
      const reach = COOKIE.r * Math.cos(tilt) + 0.15;
      const ring = n === 1 ? 0 : Math.max(0.2, rIn - reach);
      const pos = new Vector3(Math.cos(a) * ring, y + (rand() - 0.5) * 0.45, Math.sin(a) * ring);
      // Tilt the face towards the middle a little (cookies slump inwards), plus some chaos.
      const q = new Quaternion().setFromEuler(new Euler((rand() - 0.5) * 0.4, rand() * Math.PI * 2, 0));
      const lean = new Quaternion().setFromAxisAngle(new Vector3(-Math.sin(a), 0, Math.cos(a)), tilt * (rand() < 0.75 ? 1 : -1));
      q.premultiply(lean);
      slots.push({ index: index++, layer: L, position: pos, quaternion: q, scale: 0.9 + rand() * 0.2, seed: rand() * 1000 });
    }
  }
  return slots;
}

export function slotMatrix(s: Slot, out = new Matrix4()): Matrix4 {
  return out.compose(s.position, s.quaternion, new Vector3(s.scale, s.scale, s.scale));
}

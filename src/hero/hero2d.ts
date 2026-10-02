// Phase 2 replaces this with the sprite-based 2D cup.
import type { CreateRenderer } from './types';

export const create: CreateRenderer = async (_stage, start, cb) => {
  let left = start.left;
  return {
    kind: '2d',
    pop: () => setTimeout(() => cb.popped(), 300),
    take: () => setTimeout(() => cb.bitten((left = Math.max(0, left - 1))), 600),
    refill: () => (left = start.total),
    setFlavour: () => (left = start.total),
    setReduced: () => {},
    tug: () => {},
    busy: () => false,
    dispose: () => {},
  };
};

// Written by `npm run render` (scripts/render-stills.mjs). Safe to edit by hand, but it gets overwritten.
import type { FlavourId } from './facts';

export interface RenderSet {
  avif: string;
  webp: string;
  fallback: string;
  width: number;
  height: number;
}

type PerFlavour = Record<FlavourId, RenderSet | null>;

export const renders: { card: PerFlavour; poster: PerFlavour } = {
  card: { 'choco-chunk': null, 'red-velvet': null, 'double-chocolate': null },
  poster: { 'choco-chunk': null, 'red-velvet': null, 'double-chocolate': null },
};

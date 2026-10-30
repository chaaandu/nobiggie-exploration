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
  "card": {
    "choco-chunk": {
      "webp": "/renders/card-choco-chunk-480.webp 480w, /renders/card-choco-chunk-900.webp 900w",
      "avif": "/renders/card-choco-chunk-480.avif 480w, /renders/card-choco-chunk-900.avif 900w",
      "fallback": "/renders/card-choco-chunk-900.webp",
      "width": 900,
      "height": 900
    },
    "red-velvet": {
      "webp": "/renders/card-red-velvet-480.webp 480w, /renders/card-red-velvet-900.webp 900w",
      "avif": "/renders/card-red-velvet-480.avif 480w, /renders/card-red-velvet-900.avif 900w",
      "fallback": "/renders/card-red-velvet-900.webp",
      "width": 900,
      "height": 900
    },
    "double-chocolate": {
      "webp": "/renders/card-double-chocolate-480.webp 480w, /renders/card-double-chocolate-900.webp 900w",
      "avif": "/renders/card-double-chocolate-480.avif 480w, /renders/card-double-chocolate-900.avif 900w",
      "fallback": "/renders/card-double-chocolate-900.webp",
      "width": 900,
      "height": 900
    }
  },
  "poster": {
    "choco-chunk": {
      "webp": "/renders/poster-choco-chunk-600.webp 600w, /renders/poster-choco-chunk-900.webp 900w",
      "avif": "/renders/poster-choco-chunk-600.avif 600w, /renders/poster-choco-chunk-900.avif 900w",
      "fallback": "/renders/poster-choco-chunk-900.webp",
      "width": 900,
      "height": 900
    },
    "red-velvet": {
      "webp": "/renders/poster-red-velvet-600.webp 600w, /renders/poster-red-velvet-900.webp 900w",
      "avif": "/renders/poster-red-velvet-600.avif 600w, /renders/poster-red-velvet-900.avif 900w",
      "fallback": "/renders/poster-red-velvet-900.webp",
      "width": 900,
      "height": 900
    },
    "double-chocolate": {
      "webp": "/renders/poster-double-chocolate-600.webp 600w, /renders/poster-double-chocolate-900.webp 900w",
      "avif": "/renders/poster-double-chocolate-600.avif 600w, /renders/poster-double-chocolate-900.avif 900w",
      "fallback": "/renders/poster-double-chocolate-900.webp",
      "width": 900,
      "height": 900
    }
  }
};

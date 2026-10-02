// Generates the small tiling textures in public/textures. Run: node scripts/make-textures.mjs
import sharp from 'sharp';

// Deterministic PRNG so the texture never changes between runs (no pointless diffs).
function rng(seed) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

// Paper grain: dark specks and soft blotches in the alpha channel only, so it tints any
// background colour it sits on. Tiles seamlessly because each pass wraps around the edges.
async function grain() {
  const W = 180, H = 180, r = rng(7);
  const a = new Float32Array(W * H);
  for (let i = 0; i < a.length; i++) a[i] = r() * 0.05;            // fine tooth
  for (let k = 0; k < 900; k++) {                                     // fibres / specks
    const x = (r() * W) | 0, y = (r() * H) | 0, len = 1 + ((r() * 4) | 0), dir = r() < 0.5;
    for (let j = 0; j < len; j++) {
      const xx = (x + (dir ? j : 0)) % W, yy = (y + (dir ? 0 : j)) % H;
      a[yy * W + xx] += 0.04 + r() * 0.07;
    }
  }
  const px = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    px[i * 4] = 59; px[i * 4 + 1] = 36; px[i * 4 + 2] = 22;          // cocoa
    px[i * 4 + 3] = Math.min(255, Math.round(a[i] * 255 * 0.55));
  }
  await sharp(px, { raw: { width: W, height: H, channels: 4 } }).webp({ quality: 55, alphaQuality: 40, effort: 6 }).toFile('public/textures/grain.webp');
}

await grain();
console.log('textures written');

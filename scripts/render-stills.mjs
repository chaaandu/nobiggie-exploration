// Renders every still the site needs from the 3D scene, with the dev server running:
//   npm run dev   (in another terminal)
//   npm run render
// Writes public/renders/*.webp (+ .avif for the posters) and src/content/renders.ts.
import { chromium } from 'playwright';
import sharp from 'sharp';
import { writeFile, mkdir } from 'node:fs/promises';

const base = process.env.BASE ?? 'http://localhost:4321';
const flavours = ['choco-chunk', 'red-velvet', 'double-chocolate'];
const fills = [24, 18, 12, 6, 0];
await mkdir('public/renders', { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));

const only = process.env.ONLY; // e.g. ONLY=bowl renders just the bowls
async function shot(name, query, { size = 1000, out = [900], avif = false, quality = 82 } = {}) {
  if (only && !name.startsWith(only)) return;
  await page.setViewportSize({ width: size, height: size });
  await page.goto(`${base}/render?size=${size}&${query}`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__renderDone === true, null, { timeout: 120000 });
  const png = await page.locator('#studio').screenshot({ omitBackground: true });
  for (const w of out) {
    const img = sharp(png).resize(w, w);
    await img.clone().webp({ quality, alphaQuality: 90, effort: 6 }).toFile(`public/renders/${name}-${w}.webp`);
    if (avif) await img.clone().avif({ quality: 55, effort: 6 }).toFile(`public/renders/${name}-${w}.avif`);
  }
  console.log('rendered', name);
}

for (const f of flavours) {
  // Hero poster: the sealed cup, exactly the 3D's first frame.
  await shot(`poster-${f}`, `flavour=${f}`, { out: [600, 900], avif: true });
  // 2D version layers (same camera, stacked in the hero frame)
  for (const n of fills) await shot(`open-${f}-${n}`, `flavour=${f}&lid=off&left=${n}&hide=lid`, { out: [600, 900] });
  await shot(`lid-${f}`, `flavour=${f}&hide=table,cup,cookies,crumbs,shadows`, { out: [600, 900] });
  await shot(`bowl-${f}`, `flavour=${f}&lid=off&left=24&hide=table,cup,cookies,crumbs`, { out: [600, 900] });
  for (const c of ['plain', 'dipped', 'bitten']) await shot(`cookie-${f}-${c}`, `flavour=${f}&camera=cookie&cookie=${c}&hide=table,cup,lid,crumbs,shadows`, { size: 600, out: [300] });
  // Shop card / product page
  await shot(`card-${f}`, `flavour=${f}&camera=card&hide=crumbs`, { out: [480, 900], avif: true });
}
// Exploded view (default flavour, card camera, one part each)
const ex = 'flavour=choco-chunk&camera=card';
await shot('exploded-lid', `${ex}&hide=table,cup,cookies,crumbs,shadows`, { out: [800] });
await shot('exploded-cookies', `${ex}&hide=table,cup,lid,crumbs,shadows`, { out: [800] });
await shot('exploded-cup', `${ex}&hide=table,cookies,lid,crumbs`, { out: [800] });

const set = (n, sizes, avif) => ({
  webp: sizes.map((w) => `/renders/${n}-${w}.webp ${w}w`).join(', '),
  avif: avif ? sizes.map((w) => `/renders/${n}-${w}.avif ${w}w`).join(', ') : '',
  fallback: `/renders/${n}-${sizes[sizes.length - 1]}.webp`,
  width: sizes[sizes.length - 1],
  height: sizes[sizes.length - 1],
});
const per = (prefix, sizes, avif) => Object.fromEntries(flavours.map((f) => [f, set(`${prefix}-${f}`, sizes, avif)]));
const manifest = `// Written by \`npm run render\` (scripts/render-stills.mjs). Safe to edit by hand, but it gets overwritten.
import type { FlavourId } from './facts';

export interface RenderSet {
  avif: string;
  webp: string;
  fallback: string;
  width: number;
  height: number;
}

type PerFlavour = Record<FlavourId, RenderSet | null>;

export const renders: { card: PerFlavour; poster: PerFlavour } = ${JSON.stringify({ card: per('card', [480, 900], true), poster: per('poster', [600, 900], true) }, null, 2)};
`;
await writeFile('src/content/renders.ts', manifest);
await browser.close();
console.log('manifest written');

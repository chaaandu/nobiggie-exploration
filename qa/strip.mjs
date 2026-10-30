// Frame strips of the hero, on a manual clock, so every frame is exactly 1/30s apart no
// matter how slowly the (software) renderer runs. Writes a contact sheet per sequence.
// Usage: node qa/strip.mjs [label] [--size 390] [--seq pop|dip|flavour|empty] [--every 2] [--query ...]
import { chromium } from 'playwright';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const label = args[0] && !args[0].startsWith('--') ? args[0] : 'strip';
const size = Number(opt('--size', '390'));
const seq = opt('--seq', 'dip');
const every = Number(opt('--every', '2'));
const out = `qa/out/strips/${label}`;
await mkdir(out, { recursive: true });

const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: size, height: Math.round(size * 2.1) }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto(`http://localhost:4321/?3d=1&clock=manual&at=14:00&${opt('--query', '')}`, { waitUntil: 'networkidle' });
await page.mouse.move(10, 10);
await page.waitForSelector('[data-stage-3d][data-ready]', { timeout: 90000 });
const frame = await page.$('[data-frame]');
const tick = async (ms) => {
  await page.evaluate((m) => window.__nbClock.advance(m), ms);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
};
const shots = [];
const grab = async (name) => {
  const p = `${out}/${String(shots.length).padStart(3, '0')}-${name}.png`;
  await frame.screenshot({ path: p });
  shots.push(p);
};
const run = async (frames, name) => {
  for (let i = 0; i < frames; i++) {
    await tick(1000 / 30);
    if (i % every === 0) await grab(`${name}${i}`);
  }
};

await tick(16);
await grab('start');
if (seq === 'pop' || seq === 'dip' || seq === 'empty') {
  await page.click('[data-act="pop"]');
  await run(seq === 'pop' ? 40 : 26, 'pop');
}
if (seq === 'dip') {
  await page.evaluate(() => document.querySelector('[data-cookie-hits] button')?.click());
  await run(48, 'dip');
  // a second cookie, tapped before the first would have finished
  await page.evaluate(() => document.querySelector('[data-cookie-hits] button')?.click());
  await run(30, 'dip2');
}
if (seq === 'flavour') {
  await page.click('[data-flavour-pick="red-velvet"]');
  await run(30, 'rv');
}
if (seq === 'empty') {
  for (let k = 0; k < 24; k++) {
    await page.evaluate(() => document.querySelector('[data-cookie-hits] button')?.click());
    await run(8, `e${k}-`);
  }
  await run(40, 'tail');
}

// contact sheet
const cols = 6;
const meta = await sharp(shots[0]).metadata();
const tw = 260;
const th = Math.round((meta.height / meta.width) * tw);
const rows = Math.ceil(shots.length / cols);
const tiles = await Promise.all(shots.map((p) => sharp(p).resize(tw, th).toBuffer()));
await sharp({ create: { width: cols * tw, height: rows * th, channels: 3, background: '#F6EFE3' } })
  .composite(tiles.map((input, i) => ({ input, left: (i % cols) * tw, top: Math.floor(i / cols) * th })))
  .png()
  .toFile(`qa/out/strips/${label}-sheet.png`);
console.log(`${shots.length} frames → qa/out/strips/${label}-sheet.png`, errors.length ? '\n' + errors.join('\n') : '');
await browser.close();

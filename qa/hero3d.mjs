// Loads the hero with the 3D forced on, waits for its first frame, screenshots the stage.
// Usage: node qa/hero3d.mjs [label] [width] [height] [--act pop,take,take] [--query "flavour=..."]
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const opt = (n, d) => (args.includes(n) ? args[args.indexOf(n) + 1] : d);
const label = args[0] && !args[0].startsWith('--') ? args[0] : 'hero3d';
const w = Number(args[1]) || 390;
const h = Number(args[2]) || 844;
const acts = (opt('--act', '') || '').split(',').filter(Boolean);
await mkdir('qa/out/3d', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 900 ? 2 : 1 });
const errors = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && errors.push(m.text()));
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(`http://localhost:4321/?3d=1&${opt('--query', '')}`, { waitUntil: 'networkidle' });
await page.mouse.move(w / 2, h / 2);
await page.waitForSelector('[data-stage-3d][data-ready]', { timeout: 60000 }).catch(() => errors.push('3D never became ready'));
await page.waitForTimeout(600);
const stage = await page.$('[data-frame]');
await stage.screenshot({ path: `qa/out/3d/${label}-0.png` });
let i = 0;
for (const a of acts) {
  i++;
  if (a === 'pop') await page.click('[data-act="pop"]');
  else if (a === 'take') await page.evaluate(() => document.querySelector('[data-cookie-hits] button')?.click());
  else if (a.startsWith('wait')) await page.waitForTimeout(Number(a.slice(4)));
  await page.waitForTimeout(Number(opt('--settle', '1600')));
  await stage.screenshot({ path: `qa/out/3d/${label}-${i}-${a}.png` });
}
console.log(errors.length ? errors.join('\n') : 'ok');
await browser.close();

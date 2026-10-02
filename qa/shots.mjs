// Screenshots at the four CLAUDE.md sizes: the first screen, plus every section on its own.
// Usage: node qa/shots.mjs [path=/] [label=phase] [--sections] [--query "3d=0"]
// Output: qa/out/<label>/<page>-<width>-*.png  (git-ignored)
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, d) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : d;
};
const positional = args.filter((a, i) => !a.startsWith('--') && !(args[i - 1] ?? '').startsWith('--'));
const path = positional[0] ?? '/';
const label = positional[1] ?? 'latest';
const base = opt('--base', 'http://localhost:4321');
const query = opt('--query', '');
const sizes = (opt('--sizes', '360x800,390x844,768x1024,1440x900')).split(',').map((s) => s.split('x').map(Number));
const out = `qa/out/${label}`;
await mkdir(out, { recursive: true });

const name = path === '/' ? 'home' : path.replace(/^\//, '').replace(/\//g, '_');
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const problems = [];

for (const [w, h] of sizes) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h },
    deviceScaleFactor: w < 900 ? 2 : 1,
    isMobile: w < 900,
    hasTouch: w < 900,
    reducedMotion: flag('--reduced') ? 'reduce' : 'no-preference',
  });
  const page = await ctx.newPage();
  page.on('console', (m) => m.type() === 'error' && problems.push(`[${w}] console: ${m.text()}`));
  page.on('pageerror', (e) => problems.push(`[${w}] pageerror: ${e.message}`));
  const url = `${base}${path}${query ? (path.includes('?') ? '&' : '?') + query : ''}`;
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(Number(opt('--wait', '600')));
  await page.screenshot({ path: `${out}/${name}-${w}-fold.png` });

  // Horizontal overflow is a classic mobile bug: flag it.
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  if (overflow > 0) problems.push(`[${w}] horizontal overflow: ${overflow}px`);

  if (flag('--sections')) {
    const handles = await page.$$('main > section, main > div > section, footer');
    let i = 0;
    for (const el of handles) {
      i++;
      const id = (await el.getAttribute('id')) ?? (await el.evaluate((n) => n.className.split(' ')[0])) ?? `s${i}`;
      await el.scrollIntoViewIfNeeded();
      await page.waitForTimeout(250);
      const box = await el.boundingBox();
      if (!box || box.height < 10) continue;
      // Very tall sections (scroll-driven ones) are clipped to 2.2 screens.
      await el.screenshot({ path: `${out}/${name}-${w}-${String(i).padStart(2, '0')}-${id}.png`, ...(box.height > h * 2.2 ? { clip: undefined } : {}) }).catch(async () => {
        await page.screenshot({ path: `${out}/${name}-${w}-${String(i).padStart(2, '0')}-${id}.png` });
      });
    }
  }
  await ctx.close();
}
await browser.close();
console.log(problems.length ? problems.join('\n') : 'no console errors, no overflow');

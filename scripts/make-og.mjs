// Share images (1200×630) for the home page and each flavour, from the 3D renders and the
// site's own fonts. Run after `npm run render`: node scripts/make-og.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('qa/out', { recursive: true });

const url = (p) => pathToFileURL(resolve(p)).href;
const pages = [
  { file: 'home', img: 'card-choco-chunk-900', title: 'Come for the cookies.', em: 'Stay for the dip.', note: 'Mini cookies, dip sealed in the lid · Bangalore' },
  { file: 'choco-chunk', img: 'card-choco-chunk-900', title: 'Choco Chunk', em: '+ Nutella dip', note: 'The crowd-pleaser' },
  { file: 'red-velvet', img: 'card-red-velvet-900', title: 'Red Velvet', em: '+ white chocolate dip', note: 'The pretty one' },
  { file: 'double-chocolate', img: 'card-double-chocolate-900', title: 'Double Chocolate', em: '+ Nutella dip', note: 'The serious one' },
];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
for (const p of pages) {
  // a real file:// page, so it can load the local fonts and renders
  await writeFile('qa/out/og.html', `<!doctype html><meta charset="utf-8"><style>
    @font-face{font-family:F;src:url(${url('public/fonts/fraunces.woff2')});font-weight:500 800}
    @font-face{font-family:F;font-style:italic;src:url(${url('public/fonts/fraunces-italic.woff2')});font-weight:500 800}
    @font-face{font-family:H;src:url(${url('public/fonts/gochi-hand.woff2')})}
    @font-face{font-family:S;src:url(${url('public/fonts/instrument-sans.woff2')});font-weight:400 700}
    body{margin:0;width:1200px;height:630px;background:#F6EFE3 url(${url('public/textures/grain.webp')});display:grid;grid-template-columns:1.1fr 1fr;align-items:center;color:#3B2416;overflow:hidden}
    .t{padding:0 0 0 80px}
    .k{font:30px H;color:#B3262E;transform:rotate(-2deg);margin:0 0 14px}
    h1{font:640 84px/0.95 F;margin:0;letter-spacing:-.01em}
    h1 em{display:block;font-style:italic;font-weight:600;color:#B3262E;font-size:.82em;margin-top:10px}
    .n{font:600 26px S;color:#6B4E3B;margin-top:28px}
    img{width:640px;height:640px;margin-left:-40px;margin-top:40px}
  </style><div class="t"><p class="k">no biggie · dip. dunk. repeat.</p><h1>${p.title}<em>${p.em}</em></h1><p class="n">${p.note}</p></div><img src="${url(`public/renders/${p.img}.webp`)}">`);
  await page.goto(url('qa/out/og.html'));
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  await page.screenshot({ path: `public/og/${p.file}.png` });
  console.log('og', p.file);
}
await browser.close();

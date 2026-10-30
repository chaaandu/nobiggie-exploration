// First-paint JS budget (CLAUDE.md: < 150KB gzip). For each built page, follows the module
// scripts in the HTML and their *static* imports (dynamic import() — the 3D, the recorder —
// loads later and doesn't count). Run after `npm run build`.
import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const LIMIT = 150 * 1024;
async function pages(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory() && e.name !== '_astro') out.push(...(await pages(p)));
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}
const cache = new Map();
async function graph(file, seen) {
  if (seen.has(file)) return;
  seen.add(file);
  const src = cache.get(file) ?? (await readFile(file, 'utf8'));
  cache.set(file, src);
  for (const m of src.matchAll(/(?:^|[;\n}])\s*import\s*(?:[\w*{},\s$]+from\s*)?["']([^"']+)["']/g)) {
    if (m[1].startsWith('.')) await graph(join(file, '..', m[1]), seen);
  }
}
let worst = 0;
for (const page of await pages('dist')) {
  if (page.endsWith('render.html')) continue; // internal render page, never visited
  const html = await readFile(page, 'utf8');
  const seen = new Set();
  for (const m of html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g)) await graph(join('dist', m[1]), seen);
  let gz = 0;
  for (const f of seen) gz += gzipSync(cache.get(f)).length;
  const inline = [...html.matchAll(/<script(?![^>]*src)[^>]*>([\s\S]*?)<\/script>/g)].reduce((n, m) => n + gzipSync(m[1]).length, 0);
  worst = Math.max(worst, gz + inline);
  console.log(`${String(((gz + inline) / 1024).toFixed(1)).padStart(6)} KB gz  ${page.replace('dist/', '/')}`);
}
console.log(`\nworst page: ${(worst / 1024).toFixed(1)} KB gz (limit 150)`);
process.exitCode = worst > LIMIT ? 1 : 0;

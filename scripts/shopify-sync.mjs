// Pulls variant IDs and prices from your Shopify store into src/content/shopify.json, so the
// site and the store can never disagree (the old site broke exactly that way).
// No app, no token, no paid plan: it reads the store's public /products.json.
//
//   1. In src/content/facts.ts set checkout.shopify.domain, e.g. '4mtm6f-xt.myshopify.com'
//      (and each flavour's shopify.handle if your product URLs differ)
//   2. npm run shopify:sync
//   3. set checkout.mode to 'shopify', rebuild, deploy
import { writeFile } from 'node:fs/promises';

const facts = await import('../src/content/facts.ts');
const domain = process.env.SHOPIFY_DOMAIN ?? facts.checkout.shopify.domain;
if (!domain) {
  console.error('No Shopify domain. Set checkout.shopify.domain in src/content/facts.ts (or SHOPIFY_DOMAIN=...).');
  process.exit(1);
}
const res = await fetch(`https://${domain}/products.json?limit=250`);
if (!res.ok) throw new Error(`${domain}/products.json → HTTP ${res.status}`);
const { products } = await res.json();
const out = {};
for (const f of facts.flavours) {
  const p = products.find((x) => x.handle === f.shopify.handle);
  if (!p) {
    console.warn(`! ${f.name}: no product with handle "${f.shopify.handle}" on ${domain}`);
    continue;
  }
  const v = p.variants[0];
  out[f.id] = { variantId: String(v.id), price: Math.round(Number(v.price)), compareAt: v.compare_at_price ? Math.round(Number(v.compare_at_price)) : null, available: v.available };
  console.log(`✓ ${f.name}: variant ${v.id}, ₹${out[f.id].price}${out[f.id].compareAt ? ` (was ₹${out[f.id].compareAt})` : ''}`);
}
await writeFile('src/content/shopify.json', JSON.stringify({ domain, syncedAt: new Date().toISOString(), products: out }, null, 2) + '\n');
console.log('Wrote src/content/shopify.json. Rebuild to use it.');

# No Biggie — nobiggie.shop

Mini New York-style cookies in a cup, with the dip sealed in the lid. Bangalore.
Static site: Astro + TypeScript, a procedural 3D hero (three.js via React Three Fiber),
everything else plain HTML/CSS/TS. No paid services, no API keys, no backend.

## Run it

```bash
npm install
npm run dev          # http://localhost:4321  (add ?3d=1 to force the 3D, ?3d=0 for the 2D cup)
npm run build        # → dist/  (plain static files)
npm run preview      # serve dist/ locally
```

Needs Node 22+. Nothing here costs money: Astro, three.js, React and the fonts are all free
and open source.

## Change the facts (prices, cut-off, pincodes…)

Every business fact lives in **`src/content/facts.ts`**, and nowhere else.

- `npm run facts` lists what's still missing or unconfirmed.
- Unknown facts are `todo(...)`: the site shows honest generic copy, never a made-up number.
- Before launch: `STRICT=1 npm run facts` fails if anything is left.

## Checkout

`checkout.mode` in facts.ts:

| mode | what happens | needs |
| --- | --- | --- |
| `whatsapp` (default) | opens WhatsApp with a tidy pre-filled order | nothing |
| `shopify` | Shopify cart permalink → Shopify checkout | `checkout.shopify.domain` + `npm run shopify:sync` |
| `razorpay` | each flavour's payment link | `razorpayLink` per flavour |

**Connecting Shopify** (works on any plan, no app): set `checkout.shopify.domain` to your
`xxxx.myshopify.com` domain (or a `shop.` subdomain once nobiggie.shop points here), check each
flavour's `shopify.handle`, run `npm run shopify:sync` (writes `src/content/shopify.json` with
variant IDs and live prices), set `mode: 'shopify'`, rebuild. Re-run the sync whenever you
change prices in Shopify.

## Deploy (free)

Cloudflare Pages (free, commercial use allowed): connect the GitHub repo, build command
`npm run build`, output directory `dist`. `public/_redirects` sends old Shopify URLs to the new
pages. Netlify works the same way. (Vercel's free plan is non-commercial only.)

## Images

- Until real photos exist, every product image is a render of the 3D cup:
  `npm run dev` in one terminal, `npm run render` in another (≈3 min), then `npm run og`.
- `docs/shotlist.md`: every photo the site needs, ratios, prompts, and which must be real.
- Logo: placeholder wordmark in `src/components/site/Logo.astro` and `src/three/sticker.ts`.
  Drop the real SVG into `public/brand/` and swap those two.
- A real 3D model: put it at `public/models/cup.glb` (see `docs/models.md`).

## Quality checks

```bash
npm test                         # unit tests (clock, cut-off, checkout messages)
npm run contrast                 # WCAG AA for every text colour pair
node qa/shots.mjs / label --sections   # screenshots at 360/390/768/1440
node qa/strip.mjs dip --seq dip   # frame strip of the hero (pop|dip|flavour|empty)
npm run budget                   # first-paint JS must stay under 150KB gzip
```

## Where things are

```
src/content/facts.ts     every business fact
src/content/renders.ts   generated list of 3D renders
src/hero/                hero controller (UI, state) + the 2D renderer
src/three/               3D: director (scene + choreography), materials, geometry, R3F host
src/record/              Record a dip (MediaRecorder)
src/lib/                 bag, checkout, Kolkata clock, cut-off copy, sound, analytics hooks
src/components/          sections, shop, bag, site chrome
scripts/                 render, og, icons, fonts, Shopify sync, facts
qa/                      screenshots, frame strips, contrast, budget
```

Analytics: `window.addEventListener('nb:track', e => …)` — events are fired, nothing is sent
until you choose a provider.

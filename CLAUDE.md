# No Biggie — project bible (read before every task)

## What we sell
Mini New York–style cookies in a cup, with a clear dome lid that has dip sealed inside
(Nutella or white chocolate). Pop the lid, dip, dunk, repeat. Made to order, sent out the
same day. Bangalore, India. Real chocolate, no compound. Best within 10 days. Lid reseals.
Flavours: Choco Chunk · Red Velvet (+ white chocolate dip) · Double Chocolate.
Instagram @nobiggie.crumbs · Call/WhatsApp +91 91116 34634

## Beliefs (every decision must trace back to one of these)
1. Our customer is 18–32, in Bangalore, on a phone, often late at night, often ordering
   for more than one person. Design for a thumb first.
2. They came for a snack, not a website. From any scroll position, ordering is never more
   than 3 taps away.
3. The lid is the product. Anything that doesn't help someone understand or crave the
   dip-in-the-lid is decoration and must earn its place.
4. We are funny, not loud: deadpan, specific, dry. No "OMG", no emoji soup, no shouting
   (except crime-scene tape, where shouting is the joke).
5. Mid-range Android, patchy 4G. Fast is a feature.

## Voice
- Short sentences. Specific over generic ("crumbs on your hoodie", not "delicious treats").
- Reuse the existing copy wherever it works: "Dip. Dunk. Repeat.", Case file #001,
  Cookie emergency, the host gift tag, the movie ticket, "Popcorn had a good run."
- Indian/British spelling (flavour, colour). Prices in ₹, no decimals.

## Visual direction
- If real packaging/brand photos exist in /public/brand, match their colours. Otherwise
  start from: cream #F6EFE3 (bg), cocoa #3B2416 (text), red velvet #B3262E,
  white choc #F3E6CF, nutella #5A3420, tape yellow #F2C230 (crime-scene only).
- Type: Fraunces for headlines (use its soft/wonky axes), Instrument Sans for UI,
  one handwritten face for notes, tags and counters.
- Tactile details: tape, index cards, crumbs, paper grain. Warm top light, real shadows.
- Photography: real cup, real fingers, real crumbs. Never the floating-stock-cookie look.

## Banned (zombie UI tells)
- Fade-up-on-scroll on every section
- Generic hero: headline left, image right, two buttons
- Gradient blobs, glassmorphism cards, "trusted by" logo rows
- Corner toasts — feedback appears where the user tapped
- Spinners where content could render instantly
- Confetti
- Invented reviews, ratings, prices, delivery promises or any business fact.
  All facts live in src/content/facts.ts; unknowns are TODO placeholders.

## Quality floor (applies to every change)
- Mobile-first; check 360×800, 390×844, 768×1024, 1440×900
- Tap targets ≥ 44px; sticky thumb-reach order bar on mobile
- prefers-reduced-motion respected; every animation still makes sense when static
- Full keyboard support, visible focus, WCAG AA contrast, real alt text
- Animate transform/opacity only; smooth on a mid-range Android
- LCP < 2.5s on simulated 4G; first-paint JS < 150KB gz; 3D lazy-loads after first
  paint and never blocks ordering
- Lighthouse mobile ≥ 90 on Performance, Accessibility, Best Practices, SEO

## How to work
- Plan before code. For any visual decision, offer 2–3 directions (one deliberately
  weird) and wait for my pick.
- After building anything visual: run the dev server, screenshot with Playwright at the
  four sizes above (and record frame strips of animations), look at them, critique
  against this file, fix, then show me.
- Commit after every working step.
- Ask me for business facts. Never guess them.

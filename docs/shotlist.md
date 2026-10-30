# Shot list

Every image the site needs. **REAL** = must be a real photo of the real product (never
generated: CLAUDE.md, "real cup, real fingers, real crumbs"). **RENDER OK** = the 3D renders
the site already uses are fine until a photo exists. Generated images are only for mood shots
that show no product detail, and should be swapped for real ones when possible.

Shared prompt style (for any generated/mood images): *warm natural top light, cream linen and
pale wood, real crumbs, shallow depth of field, shot on a phone at f/1.8, Bangalore apartment,
no text, no logos, no floating products, colours: cream #F6EFE3, cocoa #3B2416, red velvet
#B3262E.*

| # | Where | What | Mobile | Desktop | Status | Prompt / brief |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Shop cards, product pages | Each cup, lid on, three-quarter view, on cream | 1:1 | 1:1 | **REAL** (render meanwhile) | Real cup on the cream table, soft top light, a few crumbs, sticker facing camera. |
| 2 | Product page gallery | Lid off, flipped beside the cup as a bowl | 4:5 | 1:1 | **REAL** | The real lid, turned over, dip glossy; cup beside it. |
| 3 | Product page gallery | Cookie mid-dip, two fingers | 4:5 | 4:3 | **REAL** | Real fingers holding a mini cookie edge-down in the dip; drip forming. |
| 4 | Product page gallery | Cookie broken in half, crumb interior | 1:1 | 1:1 | **REAL** | Close-up, interior texture, chunks; crumbs on the table. |
| 5 | Product page | Scale shot: cookie next to a ruler or a ₹10 coin | 1:1 | 1:1 | **REAL** | Honest size; flat lay. |
| 6 | Ritual (Dip / Dunk / Repeat) | Three short loops | 1:0.86 | 1:0.92 | RENDER OK | Optional: real 3-second loops of the same three moments, filmed top-down. |
| 7 | Case file #001 | Crime-scene flat lay: half-eaten mini cookie, crumbs, tape | 1:1 | 4:3 | **REAL** preferred | Real crumbs and a bitten mini cookie on dark wood, yellow tape at the edge. |
| 8 | Cookie emergency | Phone on a dark desk at night, cup beside it | 4:5 | 4:3 | Mood (generated OK) | 11:47pm desk, one warm lamp, phone face-up, cup lid on. *(no readable phone text)* |
| 9 | Occasions: Desk | Cup on a laptop desk, afternoon light | 4:5 | 4:3 | **REAL** preferred | Real cup beside a laptop and a to-do list; one hand reaching in. |
| 10 | Occasions: Host gift | Cup handed over at a door, kraft tag on it | 4:5 | 4:3 | **REAL** | Real cup with the printed gift tag, being handed over. |
| 11 | Occasions: Sofa | Cup on a coffee table, TV glow, two hands reaching | 4:5 | 4:3 | **REAL** preferred | Movie night, warm lamp + TV light, crumbs on the table. |
| 12 | B2B | Many cups lined up, a dessert table | 4:3 | 16:9 | **REAL** | A real event table or café counter with 20+ cups. |
| 13 | Story | Hands piping dip into the dome lids | 4:5 | 4:3 | **REAL** | The actual kitchen; no stock-style staging. |
| 14 | OG share images | Cup + headline, 1200×630 | — | 1.91:1 | RENDER OK | Regenerate with `npm run og` after real photos (swap the image in scripts/make-og.mjs). |
| 15 | Logo | NO BIGGIE vector (SVG) | — | — | **REAL file needed** | From the designer: SVG of the bubble-letter logo and the sticker artwork. |

Notes
- The old site's images were AI-generated and are **not** used: they show two different cups, a
  kraft box, full-size cookies and a sticker reading "bip. dunk. repeat.".
- Shoot everything on the same cream surface, same time of day, so the set matches the 3D.

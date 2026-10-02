/**
 * Every business fact the site states lives in this file. Nothing else in the code may
 * hard-code a price, a time, a pincode or a claim. (CLAUDE.md: never invent business facts.)
 *
 * Three ways to write a fact:
 *   plain value          the owner has confirmed it (CLAUDE.md or a direct answer)
 *   unconfirmed(v, note) we have a value but nobody has confirmed it yet. It shows on the
 *                        site, and `npm run facts` lists it until it's confirmed.
 *   todo(note)           unknown. Returns null, and the site falls back to honest,
 *                        generic copy (never a made-up number). Dev builds show a TODO chip.
 *
 * To confirm something, replace `unconfirmed(249, '…')` with `249`.
 * To fill a todo, replace `todo<string>('…')` with the value, e.g. `'14:00'`.
 */

export type Pending = { kind: 'unconfirmed' | 'todo'; note: string; value?: unknown };
export const pending: Pending[] = [];

function unconfirmed<T>(value: T, note: string): T {
  pending.push({ kind: 'unconfirmed', note, value });
  return value;
}
function todo<T>(note: string): T | null {
  pending.push({ kind: 'todo', note });
  return null;
}

/* ------------------------------------------------------------------ brand */

export const brand = {
  name: 'No Biggie',
  tagline: 'Dip. Dunk. Repeat.',
  city: 'Bangalore',
  region: 'Karnataka',
  country: 'IN',
  siteUrl: 'https://nobiggie.shop',
  phone: { display: '+91 91116 34634', tel: '+919111634634', whatsapp: '919111634634' },
  instagram: { handle: '@nobiggie.crumbs', url: 'https://www.instagram.com/nobiggie.crumbs/' },
  email: unconfirmed('nobiggie09@gmail.com', 'Public email. The old site shows this one; the Shopify policy lists another.'),
  address: todo<string>('Public business address, if you want one shown (Google business data). Leave null to show none.'),
  legalName: todo<string>('Legal business name, for the footer and policies.'),
  fssai: todo<string>('FSSAI licence or registration number (footer).'),
  gstin: todo<string>('GSTIN, if registered (footer, invoices).'),
};

/* ---------------------------------------------------------------- product */

export const product = {
  // Confirmed in CLAUDE.md.
  madeToOrder: true,
  sameDayDispatch: true,
  realChocolate: true,
  bestWithinDays: 10,
  lidReseals: true,
  cookiesPerCup: unconfirmed(24, 'Cookies per cup. The brief says "~24"; it drives the "23 left" counter.'),
  cup: unconfirmed('clear' as 'clear' | 'paper', 'Cup: clear plastic with a round sticker (old photos, Story copy) or printed paper (brief).'),
  lid: unconfirmed(
    'flip' as 'flip',
    'Lid: assumed the dome pops off and flips over to become the dip bowl. Confirm, or describe the real one.',
  ),
  dipTexture: unconfirmed('soft' as 'soft' | 'firm', 'Dip at room temperature: soft (ripples, drips) or firm (holds a groove).'),
  ingredients: todo<string>('Ingredients, per flavour or shared (product pages).'),
  allergens: todo<string>('Allergens, e.g. "Contains wheat, milk, hazelnut, soy." (product pages).'),
  eggless: todo<boolean>('Eggless? Drives the veg mark.'),
};

/* ------------------------------------------------------------------- dips */

export type DipId = 'nutella' | 'white-chocolate';

export interface Dip {
  id: DipId;
  name: string;
  /** Short form for tight spaces, e.g. "+ Nutella dip". */
  short: string;
  desc: string;
  colour: string;
}

export const dips: Record<DipId, Dip> = {
  nutella: {
    id: 'nutella',
    name: 'Nutella',
    short: 'Nutella dip',
    desc: 'Hazelnut and cocoa, smooth and glossy, sealed into the lid. Rich enough to stand up to a dark cookie, smooth enough to coat a light one.',
    colour: '#4A2717',
  },
  'white-chocolate': {
    id: 'white-chocolate',
    name: 'White chocolate',
    short: 'White chocolate dip',
    desc: 'Silky, pale and sweet, set soft so it clings to every edge. Made for red velvet. The mild cocoa underneath wants exactly this much sweetness on top.',
    colour: '#F1E3C6',
  },
};

/* --------------------------------------------------------------- flavours */

export type FlavourId = 'choco-chunk' | 'red-velvet' | 'double-chocolate';

export interface Flavour {
  id: FlavourId;
  name: string;
  dip: DipId;
  /** Price per cup in ₹, dip included. */
  price: number;
  /** Struck-through price, or null for none. */
  compareAt: number | null;
  tag: string;
  /** One line, shown on cards. */
  tasteNote: string;
  blurb: string;
  notes: string[];
  specs: [string, string][];
  /** Colours for the 3D cup, the 2D art and the swatches. Not facts; art direction. */
  look: { cookie: string; cookieDark: string; chunk: string; chunkStyle: 'chunks' | 'chips' | 'cocoa'; swatch: string };
  shopify: { handle: string; variantId: string | null };
  razorpayLink: string | null;
}

const priceNote = (name: string, shopify: string) =>
  `${name}: price per cup in ₹. These are the Shopify listing prices on 2 Oct 2026 (${shopify}); the old site showed different ones.`;

export const flavours: Flavour[] = [
  {
    id: 'choco-chunk',
    name: 'Choco Chunk',
    dip: 'nutella',
    price: unconfirmed(249, priceNote('Choco Chunk', '₹249, struck-through ₹269')),
    compareAt: null,
    tag: 'The crowd-pleaser',
    tasteNote: unconfirmed('Brown-butter chunk cookies, Nutella on top.', 'Choco Chunk taste note (old site): confirm "brown-butter".'),
    blurb: unconfirmed(
      'The one nobody argues about. A brown-butter dough loaded with real chocolate chunks, baked small, with Nutella in the lid. If you are buying for a group and don’t know the room, buy this.',
      'Choco Chunk description (old site): confirm "brown-butter dough".',
    ),
    notes: ['New York style, thick soft centre', 'Dark chocolate chunks', 'Nutella dip, in the lid'],
    specs: [
      ['Cookies', 'Choco chunk minis'],
      ['Style', 'New York, baked mini'],
      ['Dip', 'Nutella'],
      ['Best with', 'Absolutely anything'],
    ],
    look: { cookie: '#C08A54', cookieDark: '#8E5A2C', chunk: '#2A170E', chunkStyle: 'chunks', swatch: '#B98250' },
    shopify: { handle: 'choco-chunk-cookies', variantId: null },
    razorpayLink: null,
  },
  {
    id: 'red-velvet',
    name: 'Red Velvet',
    dip: 'white-chocolate',
    price: unconfirmed(269, priceNote('Red Velvet', '₹269, struck-through ₹279')),
    compareAt: null,
    tag: 'The pretty one',
    tasteNote: 'Cocoa-soft red velvet minis with a white chocolate dip.',
    blurb:
      'Red velvet is a mild cookie, more cocoa scent than cocoa hit, so it needs a dip with some sweetness behind it. White chocolate does that without flattening the flavour.',
    notes: ['New York style, thick soft centre', 'White chocolate chips through the cookie', 'White chocolate dip, in the lid'],
    specs: [
      ['Cookies', 'Red velvet minis'],
      ['Style', 'New York, baked mini'],
      ['Dip', 'White chocolate'],
      ['Best with', 'Cold milk, or on its own'],
    ],
    look: { cookie: '#8F1E2B', cookieDark: '#5E1019', chunk: '#F4E9D3', chunkStyle: 'chips', swatch: '#9C2333' },
    shopify: { handle: 'red-velvet-cookies', variantId: null },
    razorpayLink: null,
  },
  {
    id: 'double-chocolate',
    name: 'Double Chocolate',
    dip: 'nutella',
    price: unconfirmed(269, priceNote('Double Chocolate', '₹269, struck-through ₹289')),
    compareAt: null,
    tag: 'The serious one',
    tasteNote: 'Dark double-chocolate minis with a Nutella dip.',
    blurb: unconfirmed(
      'A cookie this dark needs something with sweetness and salt behind it, and Nutella is exactly that. Dutch cocoa against hazelnut is the pairing people underestimate right up until the first dunk.',
      'Double Chocolate description (old site): confirm "Dutch cocoa".',
    ),
    notes: ['New York style, thick soft centre', 'Chocolate chunks, not chips', 'Nutella dip, in the lid'],
    specs: [
      ['Cookies', 'Double chocolate minis'],
      ['Style', 'New York, baked mini'],
      ['Dip', 'Nutella'],
      ['Best with', 'Coffee, black'],
    ],
    look: { cookie: '#3D2216', cookieDark: '#22120A', chunk: '#140A05', chunkStyle: 'cocoa', swatch: '#3D2216' },
    shopify: { handle: 'double-choco-chip-cookies', variantId: null },
    razorpayLink: null,
  },
];

export const defaultFlavour: FlavourId = 'choco-chunk';

export function flavourById(id: string): Flavour {
  return flavours.find((f) => f.id === id) ?? flavours[0];
}

/* --------------------------------------------------------------- ordering */

export const ordering = {
  timeZone: 'Asia/Kolkata',
  /** Last order time for today's batch, "HH:MM" 24h IST. */
  cutoff: todo<string>('Daily order cut-off for same-day dispatch, "HH:MM" 24h IST, e.g. "14:00".'),
  /** When the day's batch goes out, "HH:MM" 24h IST. */
  dispatch: todo<string>('When the day’s batch goes out, "HH:MM" 24h IST, e.g. "17:00".'),
  /** 0 = Sunday … 6 = Saturday. */
  bakingDays: todo<number[]>('Days you bake and send out, 0 = Sun … 6 = Sat, e.g. [1, 2, 3, 4, 5, 6]. Left empty, the site assumes every day.'),
  /** Holidays, "YYYY-MM-DD". */
  closedDates: [] as string[],
  maxCupsPerOrder: todo<number>('Most cups you can take in one regular order.'),
};

/* --------------------------------------------------------------- delivery */

export const delivery = {
  city: 'Bangalore',
  pincodes: todo<string[]>('Pincodes you deliver to, e.g. ["560034", "560095"].'),
  fee: todo<number>('Delivery fee in ₹ (0 if free).'),
  freeAbove: todo<number>('Free delivery above this bag total in ₹, if any.'),
  minOrder: todo<number>('Minimum order in ₹, if any.'),
};

/* --------------------------------------------------------------- checkout */

export type CheckoutMode = 'whatsapp' | 'shopify' | 'razorpay';

export const checkout = {
  /** whatsapp: opens wa.me with a tidy order message (works with no store at all).
   *  shopify:  Shopify cart permalink; needs shopify.domain and each flavour's variantId
   *            (run `npm run shopify:sync` to fill them from the store).
   *  razorpay: opens each flavour's razorpayLink. */
  mode: 'whatsapp' as CheckoutMode,
  shopify: {
    /** e.g. "4mtm6f-xt.myshopify.com" or "shop.nobiggie.shop". null = not connected. */
    domain: null as string | null,
  },
  paymentNote: todo<string>('How WhatsApp orders are paid, e.g. "We’ll send a UPI link."'),
};

/* ------------------------------------------------------------ group sizes */

export const groups = {
  cookiesPerPerson: unconfirmed(6, 'Group calculator assumption: minis per person. Shown on screen.'),
  b2bFromCups: unconfirmed(20, 'Cups at which the calculator suggests a B2B order.'),
  leadTimeDays: todo<number>('Bulk order lead time in days (B2B date picker minimum).'),
};

/* -------------------------------------------------------------- occasions */

export type OccasionId = 'desk' | 'host' | 'sofa';

export const occasions: Record<OccasionId, { flavour: FlavourId; qty: number }> = unconfirmed(
  {
    desk: { flavour: 'choco-chunk', qty: 1 },
    host: { flavour: 'red-velvet', qty: 2 },
    sofa: { flavour: 'double-chocolate', qty: 2 },
  },
  'Occasion picks (flavour + quantity) for Desk / Host gift / Sofa.',
);

/* --------------------------------------------------------------- b2b */

export const b2bSegments = [
  { id: 'cafes', name: 'Cafés & restaurants', line: 'A ready-to-sell dessert for your counter or menu.' },
  { id: 'corporate', name: 'Corporate gifting', line: 'Festive hampers, client gifts and thank-yous for your team.' },
  { id: 'offices', name: 'Offices', line: 'Pantry treats, team celebrations and meeting-day snacks.' },
  { id: 'events', name: 'Events & weddings', line: 'Return gifts, dessert tables and party favours.' },
] as const;

/* --------------------------------------------------------------- policies */

export const policies = {
  shipping: todo<string>('Shipping & delivery policy text.'),
  refunds: todo<string>('Refunds & cancellations policy text.'),
  privacy: todo<string>('Privacy policy text.'),
  terms: todo<string>('Terms of service text.'),
};

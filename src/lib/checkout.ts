/**
 * Turns a bag into somewhere to pay. Three modes, chosen in facts.ts → checkout.mode:
 *   whatsapp  a tidy, pre-filled order message on wa.me (default; needs no store)
 *   shopify   a Shopify cart permalink (needs checkout.shopify.domain + variant IDs)
 *   razorpay  each flavour's payment link
 * If the chosen mode can't serve this bag (say, a variant ID is missing), we fall back to
 * WhatsApp so an order is never lost.
 */
import { brand, checkout, delivery, dips, flavourById, type FlavourId } from '../content/facts';
import type { BagState } from './bag';
import { cutoffStatus, now as clockNow } from './clock';
import { rupees } from './format';

export type CheckoutTarget =
  | { kind: 'link'; mode: 'whatsapp' | 'shopify' | 'razorpay'; url: string; label: string }
  | { kind: 'links'; mode: 'razorpay'; links: { id: FlavourId; name: string; url: string }[]; label: string };

export function waUrl(text: string): string {
  return `https://wa.me/${brand.phone.whatsapp}?text=${encodeURIComponent(text)}`;
}

function lineText(id: FlavourId, qty: number): string {
  const f = flavourById(id);
  return `${qty} × ${f.name} (${dips[f.dip].short}) · ${rupees(qty * f.price)}`;
}

/** The WhatsApp order message. Plain text, one fact per line, easy to read on the other end. */
export function whatsappOrderText(bag: BagState, now: number | null = clockNow()): string {
  const lines = bag.lines.map((l) => lineText(l.id, l.qty));
  const subtotal = bag.lines.reduce((n, l) => n + l.qty * flavourById(l.id).price, 0);
  const out: string[] = [`Hi ${brand.name}, I'd like to order:`, '', ...lines, '', `Subtotal: ${rupees(subtotal)}`];

  if (delivery.fee === 0) out.push('Delivery: free');
  else if (typeof delivery.fee === 'number') {
    const free = typeof delivery.freeAbove === 'number' && subtotal >= delivery.freeAbove;
    out.push(`Delivery: ${free ? 'free' : rupees(delivery.fee)}`);
  }
  if (bag.pincode) out.push(`Pincode: ${bag.pincode}`);

  // Static hrefs are built at deploy time, so they leave out anything that depends on the clock.
  const status = now === null ? null : cutoffStatus(now);
  if (status?.kind === 'open') out.push(`For: today's batch`);
  else if (status?.kind === 'closed') out.push(`For: the next batch (${status.dayLabel})`);

  const { to, from, message } = bag.note;
  if (to || from || message) {
    out.push('');
    if (to || from) out.push(`Gift tag: ${[to && `to ${to}`, from && `from ${from}`].filter(Boolean).join(', ')}`);
    if (message) out.push(`Note: "${message}"`);
  }
  out.push('', 'Name:', 'Delivery address:');
  return out.join('\n');
}

/** Shopify cart permalink, or null if any line lacks a variant ID. */
export function shopifyCartUrl(bag: BagState): string | null {
  const domain = checkout.shopify.domain;
  if (!domain || !bag.lines.length) return null;
  const parts: string[] = [];
  for (const l of bag.lines) {
    const v = flavourById(l.id).shopify.variantId;
    if (!v) return null;
    parts.push(`${v}:${l.qty}`);
  }
  const q = new URLSearchParams();
  const { to, from, message } = bag.note;
  if (message) q.set('note', message);
  if (to) q.set('attributes[Gift to]', to);
  if (from) q.set('attributes[Gift from]', from);
  if (bag.pincode) {
    q.set('checkout[shipping_address][zip]', bag.pincode);
    q.set('checkout[shipping_address][city]', delivery.city);
    q.set('checkout[shipping_address][country]', 'India');
  }
  q.set('ref', 'nobiggie-site');
  return `https://${domain}/cart/${parts.join(',')}?${q.toString()}`;
}

export function checkoutTarget(bag: BagState, now: number | null = clockNow()): CheckoutTarget {
  if (checkout.mode === 'shopify') {
    const url = shopifyCartUrl(bag);
    if (url) return { kind: 'link', mode: 'shopify', url, label: 'Checkout' };
  }
  if (checkout.mode === 'razorpay') {
    const links = bag.lines.map((l) => ({ id: l.id, name: flavourById(l.id).name, url: flavourById(l.id).razorpayLink }));
    if (links.length && links.every((l) => l.url)) {
      const ok = links as { id: FlavourId; name: string; url: string }[];
      if (ok.length === 1) return { kind: 'link', mode: 'razorpay', url: ok[0].url, label: 'Pay now' };
      return { kind: 'links', mode: 'razorpay', links: ok, label: 'Pay for each flavour' };
    }
  }
  return { kind: 'link', mode: 'whatsapp', url: waUrl(whatsappOrderText(bag, now)), label: 'Order on WhatsApp' };
}

/**
 * The href every "Order" button carries in the HTML, so ordering works before (or without)
 * any JavaScript: one cup of this flavour straight to checkout. JS upgrades it to open the bag.
 */
export function quickOrderHref(id: FlavourId, qty = 1): string {
  const bag: BagState = { lines: [{ id, qty }], note: { to: '', from: '', message: '' }, pincode: '' };
  const target = checkoutTarget(bag, null);
  return target.kind === 'link' ? target.url : target.links[0].url;
}

/** B2B enquiry message for WhatsApp. */
export interface B2BEnquiry {
  name: string;
  company: string;
  segment: string;
  quantity: string;
  date: string;
  area: string;
}
export function b2bText(e: B2BEnquiry): string {
  const rows = [
    `Hi ${brand.name}, a B2B enquiry:`,
    '',
    `Name: ${e.name}`,
    `Company: ${e.company}`,
    `For: ${e.segment}`,
    `Quantity: ${e.quantity} cups`,
    `Date needed: ${e.date}`,
    `Area: ${e.area}`,
  ];
  return rows.join('\n');
}

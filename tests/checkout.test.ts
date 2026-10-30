import { describe, expect, it } from 'vitest';
import { b2bText, quickOrderHref, shopifyCartUrl, whatsappOrderText } from '../src/lib/checkout';
import type { BagState } from '../src/lib/bag';

const bag: BagState = {
  lines: [
    { id: 'choco-chunk', qty: 2 },
    { id: 'red-velvet', qty: 1 },
  ],
  note: { to: 'Priya', from: 'Arjun', message: 'open immediately' },
  pincode: '560034',
};

describe('WhatsApp order', () => {
  it('is tidy and complete', () => {
    const t = whatsappOrderText(bag, null);
    expect(t).toContain('2 × Choco Chunk (Nutella dip)');
    expect(t).toContain('Pincode: 560034');
    expect(t).toContain('Gift tag: to Priya, from Arjun');
    expect(t).toContain('Note: "open immediately"');
    expect(t.endsWith('Delivery address:')).toBe(true);
  });
  it('no-JS order links go to wa.me', () => {
    expect(quickOrderHref('red-velvet')).toMatch(/^https:\/\/wa\.me\/919111634634\?text=/);
  });
  it('Shopify needs a domain and variant IDs, else null (falls back to WhatsApp)', () => {
    expect(shopifyCartUrl(bag)).toBeNull();
  });
  it('B2B message', () => {
    expect(b2bText({ name: 'A', company: 'B', segment: 'Offices', quantity: '40', date: 'Fri 9 Oct 2026', area: 'HSR' })).toContain('Quantity: 40 cups');
  });
});

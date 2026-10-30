/** Pincode check against facts.ts. With no list on file it says so, and never guesses. */
import { delivery } from '../content/facts';

export type PinResult = { tone: 'ok' | 'no' | 'info' | 'error'; text: string };

export function checkPincode(raw: string): PinResult | null {
  const pin = raw.replace(/\D/g, '');
  if (!pin) return null;
  if (pin.length < 6) return { tone: 'info', text: 'Six digits, please.' };
  if (!/^56[0-2]\d{3}$/.test(pin)) return { tone: 'error', text: `That's not a ${delivery.city} pincode. We only deliver in ${delivery.city}, for now.` };
  if (!delivery.pincodes) return { tone: 'info', text: `We'll confirm ${pin} on WhatsApp before you pay.` };
  return delivery.pincodes.includes(pin)
    ? { tone: 'ok', text: `We deliver to ${pin}.` }
    : { tone: 'no', text: `${pin} isn't on our route yet. Message us anyway; we'll see what we can do.` };
}

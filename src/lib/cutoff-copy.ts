/**
 * What we say about timing, in the house voice. Every variant only states what facts.ts
 * knows: with no cut-off on file it says "made to order, sent out the same day" (confirmed)
 * and never invents a time.
 */
import type { CutoffStatus } from './clock';
import { duration } from './format';

export type CutoffVariant = 'short' | 'long' | 'banner' | 'emergency';

export function cutoffCopy(s: CutoffStatus, variant: CutoffVariant): string {
  if (s.kind === 'unknown') {
    switch (variant) {
      case 'short':
        return 'Made to order. Sent out the same day.';
      case 'long':
        return 'Every cup is baked to order and sent out the same day. Message us and we’ll confirm today’s timing.';
      case 'banner':
        return 'We bake to order. Message us and we’ll tell you when the next batch leaves.';
      case 'emergency':
        return 'We bake to order, so nothing leaves the oven at this hour. Message us now and we’ll tell you exactly when the next batch goes out.';
    }
  }
  if (s.kind === 'open') {
    const left = duration(s.minutesLeft);
    const out = s.dispatchLabel ? ` It goes out at ${s.dispatchLabel}.` : '';
    switch (variant) {
      case 'short':
        return `Order in the next ${left} for today’s batch.`;
      case 'long':
        return `Order by ${s.cutoffLabel} for today’s batch (${left} left).${out}`;
      case 'banner':
        return `Today’s batch closes at ${s.cutoffLabel}. That’s ${left} from now.`;
      case 'emergency':
        return `Good news, sort of. Today’s batch closes at ${s.cutoffLabel}.${out} Order now and you’re in it.`;
    }
  }
  const leaves = s.dispatchLabel ? ` leaves ${s.dayLabel} at ${s.dispatchLabel}` : ` is ${s.dayLabel}`;
  switch (variant) {
    case 'short':
      return `Today’s batch has gone. Next one: ${s.dayLabel}.`;
    case 'long':
      return `Today’s batch has gone out. The next one${leaves} (order by ${s.cutoffLabel}).`;
    case 'banner':
      return `Today’s batch has gone. The next one${leaves}.`;
    case 'emergency':
      return `Honest answer: today’s batch has gone. The next one${leaves}. Order now and it’s on the list.`;
  }
}

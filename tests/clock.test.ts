import { describe, expect, it } from 'vitest';
import { cutoffStatus, isEmergency, ist } from '../src/lib/clock';
import { cutoffCopy } from '../src/lib/cutoff-copy';

// 2026-10-05 is a Monday. IST = UTC+5:30.
const at = (date: string, hhmm: string) => Date.parse(`${date}T${hhmm}:00+05:30`);
const sched = { cutoff: '14:00', dispatch: '17:00', bakingDays: [1, 2, 3, 4, 5, 6], closedDates: ['2026-10-07'] };

describe('Kolkata clock', () => {
  it('reads IST whatever the machine zone', () => {
    expect(ist(at('2026-10-05', '23:47')).label).toBe('11:47pm');
  });
  it('cookie emergency is 10pm to 3am', () => {
    expect(isEmergency(at('2026-10-05', '21:59'))).toBe(false);
    expect(isEmergency(at('2026-10-05', '22:00'))).toBe(true);
    expect(isEmergency(at('2026-10-06', '02:59'))).toBe(true);
    expect(isEmergency(at('2026-10-06', '03:00'))).toBe(false);
  });
});

describe('cut-off', () => {
  it('is unknown (and honest) with no cut-off on file', () => {
    const s = cutoffStatus(at('2026-10-05', '10:00'), { ...sched, cutoff: null });
    expect(s.kind).toBe('unknown');
    expect(cutoffCopy(s, 'short')).toBe('Made to order. Sent out the same day.');
  });
  it('counts down before the cut-off', () => {
    const s = cutoffStatus(at('2026-10-05', '11:46'), sched);
    expect(s).toMatchObject({ kind: 'open', minutesLeft: 134 });
    expect(cutoffCopy(s, 'short')).toBe('Order in the next 2h 14m for today’s batch.');
  });
  it('after cut-off, the next batch is tomorrow', () => {
    expect(cutoffStatus(at('2026-10-05', '15:00'), sched)).toMatchObject({ kind: 'closed', dayLabel: 'tomorrow' });
  });
  it('after midnight, today is a new day', () => {
    expect(cutoffStatus(at('2026-10-06', '01:00'), sched)).toMatchObject({ kind: 'open' });
  });
  it('skips closed dates and non-baking days', () => {
    // Tue after cut-off → Wed is closed → Thursday
    expect(cutoffStatus(at('2026-10-06', '15:00'), sched)).toMatchObject({ kind: 'closed', dayLabel: 'Thursday' });
    // Sat after cut-off → Sun not baking → Monday
    expect(cutoffStatus(at('2026-10-10', '15:00'), sched)).toMatchObject({ kind: 'closed', dayLabel: 'Monday' });
  });
});

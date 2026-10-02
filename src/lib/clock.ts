/**
 * Asia/Kolkata time, today's cut-off and the next batch. Pure functions: pass `now` in tests.
 * India has no daylight saving, so IST is always UTC+05:30. Works whatever the phone's time zone.
 */
import { ordering } from '../content/facts';
import { DAY_NAMES, minutesOf, time12 } from './format';

const IST_OFFSET_MS = 330 * 60_000;

/** Date.now(), shifted by the QA clock (?at=23:47) when one is set. */
export function now(): number {
  const offset = typeof window !== 'undefined' ? ((window as { __nbClockOffset?: number }).__nbClockOffset ?? 0) : 0;
  return Date.now() + offset;
}

export interface IstNow {
  dow: number;
  hour: number;
  minutes: number; // minutes since midnight
  dateKey: string; // YYYY-MM-DD
  label: string; // "11:47pm"
}

export function ist(at: number = now()): IstNow {
  const t = new Date(at + IST_OFFSET_MS);
  const hour = t.getUTCHours();
  const min = t.getUTCMinutes();
  const dateKey = `${t.getUTCFullYear()}-${String(t.getUTCMonth() + 1).padStart(2, '0')}-${String(t.getUTCDate()).padStart(2, '0')}`;
  return {
    dow: t.getUTCDay(),
    hour,
    minutes: hour * 60 + min,
    dateKey,
    label: time12(`${hour}:${min}`),
  };
}

/** Cookie emergency: 10pm to 3am, Kolkata time. */
export function isEmergency(at: number = now()): boolean {
  const { hour } = ist(at);
  return hour >= 22 || hour < 3;
}

export type CutoffStatus =
  /** No cut-off in facts.ts yet: say only what we know. */
  | { kind: 'unknown' }
  /** Today's batch is still open. */
  | { kind: 'open'; minutesLeft: number; cutoffLabel: string; dispatchLabel: string | null }
  /** Missed it: when the next batch goes out. dayLabel is "tomorrow", "Monday", etc. */
  | { kind: 'closed'; dayLabel: string; cutoffLabel: string; dispatchLabel: string | null };

interface Schedule {
  cutoff: string | null;
  dispatch: string | null;
  bakingDays: number[] | null;
  closedDates: string[];
}

const factsSchedule: Schedule = {
  cutoff: ordering.cutoff,
  dispatch: ordering.dispatch,
  bakingDays: ordering.bakingDays,
  closedDates: ordering.closedDates,
};

function isBakingDay(dow: number, dateKey: string, s: Schedule): boolean {
  if (s.closedDates.includes(dateKey)) return false;
  return s.bakingDays ? s.bakingDays.includes(dow) : true;
}

export function cutoffStatus(at: number = now(), s: Schedule = factsSchedule): CutoffStatus {
  if (!s.cutoff) return { kind: 'unknown' };
  const t = ist(at);
  const cutoffMin = minutesOf(s.cutoff);
  const cutoffLabel = time12(s.cutoff);
  const dispatchLabel = s.dispatch ? time12(s.dispatch) : null;

  if (isBakingDay(t.dow, t.dateKey, s) && t.minutes < cutoffMin) {
    return { kind: 'open', minutesLeft: cutoffMin - t.minutes, cutoffLabel, dispatchLabel };
  }
  // Walk forward to the next baking day (max two weeks, in case of a long holiday list).
  for (let i = 1; i <= 14; i++) {
    const next = ist(at + i * 86_400_000);
    if (isBakingDay(next.dow, next.dateKey, s)) {
      const dayLabel = i === 1 ? 'tomorrow' : DAY_NAMES[next.dow];
      return { kind: 'closed', dayLabel, cutoffLabel, dispatchLabel };
    }
  }
  return { kind: 'unknown' };
}

/** ₹ with Indian digit grouping and no decimals: 1245 → "₹1,245", 124500 → "₹1,24,500". */
export function rupees(n: number): string {
  return '₹' + Math.round(n).toLocaleString('en-IN');
}

/** "14:00" → "2pm", "17:30" → "5:30pm", "00:15" → "12:15am". */
export function time12(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
}

/** "14:00" → 840 */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function plural(n: number, one: string, many = one + 's'): string {
  return `${n} ${n === 1 ? one : many}`;
}

/** "2h 14m", "45m", "under a minute" */
export function duration(minutes: number): string {
  if (minutes < 1) return 'under a minute';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (!h) return `${m}m`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Analytics hooks with no vendor attached. Every event lands in window.nbEvents and fires an
 * `nb:track` DOM event, so whichever provider you pick later can listen in one place:
 *   window.addEventListener('nb:track', (e) => provider.send(e.detail.name, e.detail.props))
 * Nothing leaves the browser until you add that line.
 */
export type TrackName =
  | 'hero_interaction'
  | 'flavour_switch'
  | 'add_to_bag'
  | 'checkout_click'
  | 'b2b_submit'
  | 'record_dip'
  | 'gift_tag';

export interface TrackEvent {
  name: TrackName;
  props: Record<string, string | number | boolean>;
  at: number;
}

declare global {
  interface Window {
    nbEvents?: TrackEvent[];
  }
}

export function track(name: TrackName, props: TrackEvent['props'] = {}) {
  const event: TrackEvent = { name, props, at: Date.now() };
  (window.nbEvents ??= []).push(event);
  window.dispatchEvent(new CustomEvent('nb:track', { detail: event }));
  if (import.meta.env.DEV) console.debug('[track]', name, props);
}

/**
 * The hero's brain. Owns the state (flavour, lid, cookies left) and all the HTML around the
 * scene: flavour radios, tools, the lid and cookie hit areas, notes, counter and crime tape.
 * Animation is delegated to a renderer: the light 2D one starts straight away, and on capable
 * devices the 3D one takes over when it's ready, from exactly the same state.
 */
import { dips, flavourById, product, type FlavourId } from '../content/facts';
import { currentFlavour, onFlavour, setCurrentFlavour } from '../lib/current-flavour';
import { quickOrderHref } from '../lib/checkout';
import { rupees } from '../lib/format';
import { track } from '../lib/track';
import type { HeroCallbacks, HeroRenderer, HeroSnapshot, StagePoint } from './types';

const root = document.documentElement;
const hero = document.querySelector<HTMLElement>('[data-hero]');

if (hero) init(hero);

function init(hero: HTMLElement) {
  const $ = <T extends Element = HTMLElement>(sel: string) => hero.querySelector<T>(sel)!;
  const $$ = <T extends Element = HTMLElement>(sel: string) => [...hero.querySelectorAll<T>(sel)];

  const stage = $('[data-stage]');
  const lidHit = $<HTMLButtonElement>('[data-act="pop"]');
  const hits = $('[data-cookie-hits]');
  const notePop = $('[data-note="pop"]');
  const noteTake = $('[data-note="take"]');
  const counter = $('[data-counter]');
  const leftEl = $('[data-left]');
  const crime = $('[data-crime]');
  const live = $('[data-hero-live]');
  const desc = $('[data-scene-desc]');
  const price = $('[data-hero-price]');
  const orderBtns = $$<HTMLAnchorElement>('[data-order]');
  const radios = $$<HTMLButtonElement>('[data-flavour-pick]');
  const soloExit = $<HTMLButtonElement>('[data-act="solo-exit"]');

  const total = product.cookiesPerCup;
  const state: HeroSnapshot = {
    flavour: (hero.dataset.flavour as FlavourId) ?? currentFlavour(),
    lidOff: false,
    left: total,
    total,
    reduced: root.dataset.motion === 'reduced',
  };
  let renderer: HeroRenderer | null = null;
  let inFlight = 0; // cookies taken but not yet bitten
  let taken = 0; // cookies taken since the last refill (for the first-take note)
  let popping = false;

  const say = (text: string) => {
    live.textContent = '';
    requestAnimationFrame(() => (live.textContent = text));
  };

  /* ------------------------------------------------------------ renderer */

  const callbacks: HeroCallbacks = {
    popped() {
      popping = false;
      notePop.hidden = true;
      noteTake.hidden = taken > 0;
      counter.hidden = false;
      hits.hidden = false;
    },
    bitten(left) {
      inFlight = Math.max(0, inFlight - 1);
      state.left = left;
      leftEl.textContent = String(left);
      say(left ? `Dipped. ${left} left.` : 'Dipped. That was the last one.');
      if (left === 0) empty();
    },
    targets(points: StagePoint[]) {
      renderTargets(points);
    },
    ready() {
      // 3D is drawing: the poster and any 2D layers fade out underneath it.
      stage.dataset.renderer = renderer?.kind === '3d' || !renderer ? '3d' : stage.dataset.renderer;
    },
  };

  async function use(next: HeroRenderer) {
    const prev = renderer;
    renderer = next;
    if (prev && prev !== next) prev.dispose();
  }

  async function boot() {
    const { create: create2d } = await import('./hero2d');
    await use(await create2d(stage, { ...state }, callbacks));
    if (root.dataset.tier !== '3d') return;
    await whenIdleOrIntent(stage);
    const forced = new URLSearchParams(location.search).get('3d') === '1';
    if (!hasWebGL2(forced)) {
      root.dataset.tier = '2d';
      return;
    }
    try {
      const { create: create3d } = await import('../three/mount');
      // Hand over only when the 2D scene is still, so nothing jumps mid-bite.
      await until(() => !renderer?.busy());
      const r3 = await create3d(stage, { ...state, left: state.left - inFlight }, callbacks);
      await use(r3);
      stage.dataset.renderer = '3d';
    } catch (err) {
      console.warn('[hero] 3D unavailable, staying 2D', err);
      root.dataset.tier = '2d';
    }
  }

  /* ------------------------------------------------------------ actions */

  function pop() {
    if (state.lidOff || popping) return;
    popping = true;
    state.lidOff = true;
    lidHit.hidden = true;
    notePop.hidden = true;
    renderer?.pop();
    track('hero_interaction', { action: 'pop', flavour: state.flavour });
    say(`Lid's off. ${state.left} cookies, one bowl of ${dips[flavourById(state.flavour).dip].name.toLowerCase()} dip.`);
    if (!renderer) callbacks.popped();
  }

  function take(target?: number) {
    if (!state.lidOff) return pop();
    if (popping) return;
    if (state.left - inFlight <= 0) return;
    inFlight++;
    taken++;
    noteTake.hidden = true;
    renderer?.take(target);
    track('hero_interaction', { action: 'dip', flavour: state.flavour });
    if (!renderer) callbacks.bitten(state.left - 1);
  }

  function empty() {
    hits.hidden = true;
    crime.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => crime.setAttribute('data-on', '')));
    track('hero_interaction', { action: 'empty', flavour: state.flavour });
    if (stage.contains(document.activeElement) || document.activeElement === document.body) {
      crime.querySelector<HTMLElement>('[data-act="refill-order"]')?.focus({ preventScroll: true });
    }
  }

  function resetUi() {
    state.lidOff = false;
    state.left = total;
    inFlight = 0;
    taken = 0;
    popping = false;
    crime.removeAttribute('data-on');
    crime.hidden = true;
    lidHit.hidden = false;
    notePop.hidden = false;
    noteTake.hidden = true;
    counter.hidden = true;
    hits.hidden = true;
    leftEl.textContent = String(total);
  }

  function refill() {
    resetUi();
    renderer?.refill();
    track('hero_interaction', { action: 'refill', flavour: state.flavour });
    say(`Refilled. ${total} cookies, lid on.`);
  }

  function selectFlavour(id: FlavourId, source: string) {
    if (id === state.flavour) return;
    const from = state.flavour;
    state.flavour = id;
    const f = flavourById(id);
    radios.forEach((r) => {
      const on = r.dataset.flavourPick === id;
      r.setAttribute('aria-checked', String(on));
      r.tabIndex = on ? 0 : -1;
    });
    hero.dataset.flavour = id;
    price.textContent = rupees(f.price);
    orderBtns.forEach((a) => {
      a.href = quickOrderHref(id);
      a.dataset.orderFlavour = id;
    });
    desc.textContent = `A clear cup holding ${total} mini ${f.name} cookies, with a dome lid on top filled with ${dips[f.dip].name.toLowerCase()} dip. Pop the lid, then pick a cookie to dip it and take a bite.`;
    resetUi();
    renderer?.setFlavour(id);
    if (source === 'hero') {
      setCurrentFlavour(id, 'hero');
      track('flavour_switch', { from, to: id, source: 'hero' });
      say(`${f.name}, with ${dips[f.dip].name.toLowerCase()} dip. Lid back on.`);
    }
  }

  /* ------------------------------------------------------------ wiring */

  // Flavour radios: arrow keys move and select (radio group semantics).
  radios.forEach((r, i) => {
    r.addEventListener('click', () => selectFlavour(r.dataset.flavourPick as FlavourId, 'hero'));
    r.addEventListener('keydown', (e) => {
      const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      if (!step) return;
      e.preventDefault();
      const next = radios[(i + step + radios.length) % radios.length];
      next.focus();
      selectFlavour(next.dataset.flavourPick as FlavourId, 'hero');
    });
  });
  onFlavour((id, source) => source !== 'hero' && selectFlavour(id, source));
  // The hero always opens on the flavour its poster shows; everything else follows it.
  setCurrentFlavour(state.flavour, 'hero');
  orderBtns.forEach((a) => (a.dataset.orderFlavour = state.flavour));

  // The lid: drag it up to pop it, or tap it, or focus it and press Space/Enter.
  let drag: { id: number; y: number; moved: boolean } | null = null;
  lidHit.addEventListener('pointerdown', (e) => {
    drag = { id: e.pointerId, y: e.clientY, moved: false };
    lidHit.setPointerCapture(e.pointerId);
  });
  lidHit.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const dy = drag.y - e.clientY;
    if (Math.abs(dy) > 6) drag.moved = true;
    const progress = Math.max(0, Math.min(1, dy / 44));
    renderer?.tug(progress);
    if (dy > 44) {
      drag = null;
      pop();
    }
  });
  const endDrag = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id) return;
    const tapped = !drag.moved;
    drag = null;
    if (tapped) pop();
    else renderer?.tug(0);
  };
  lidHit.addEventListener('pointerup', endDrag);
  lidHit.addEventListener('pointercancel', (e) => {
    drag = null;
    if (e.pointerId) renderer?.tug(0);
  });
  // Keyboard activation only (pointer taps are handled above).
  lidHit.addEventListener('click', (e) => {
    if (e.detail === 0) pop();
  });

  // Tapping anywhere on the open cup takes the nearest cookie.
  stage.addEventListener('click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('button, a') || !state.lidOff || popping) return;
    const rect = stage.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const near = nearest(x, y);
    if (near) take(near.id);
  });

  // Keyboard cookies: one tab stop, arrows to choose, Enter to dip.
  let points: StagePoint[] = [];
  /** The takeable cookie closest to a tap, if the tap was anywhere near the cup. */
  function nearest(x: number, y: number): StagePoint | null {
    let best: StagePoint | null = null;
    let bestD = 0.2; // further than this (in stage units) is a tap on the table, not the cup
    for (const p of points) {
      const d = Math.hypot(p.x - x, (p.y - y) * 0.8);
      if (d < bestD) {
        best = p;
        bestD = d;
      }
    }
    return best;
  }
  function renderTargets(next: StagePoint[]) {
    points = next;
    const focusedIdx = [...hits.children].indexOf(document.activeElement as Element);
    hits.replaceChildren(
      ...next.map((p, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.style.left = `${p.x * 100}%`;
        b.style.top = `${p.y * 100}%`;
        b.tabIndex = i === Math.max(0, Math.min(focusedIdx, next.length - 1)) ? 0 : -1;
        b.setAttribute('aria-label', `Dip a cookie (${state.left} left)`);
        b.dataset.target = String(p.id);
        return b;
      }),
    );
    if (focusedIdx >= 0 && hits.children.length) (hits.children[Math.min(focusedIdx, hits.children.length - 1)] as HTMLElement).focus({ preventScroll: true });
  }
  hits.addEventListener('click', (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-target]');
    if (!b) return;
    e.stopPropagation();
    take(Number(b.dataset.target));
  });
  hits.addEventListener('keydown', (e) => {
    const buttons = [...hits.querySelectorAll<HTMLButtonElement>('button')];
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!step || i < 0) return;
    e.preventDefault();
    const next = buttons[(i + step + buttons.length) % buttons.length];
    buttons.forEach((b) => (b.tabIndex = b === next ? 0 : -1));
    next.focus();
  });

  // Tools.
  hero.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!btn) return;
    switch (btn.dataset.act) {
      case 'refill':
      case 'refill-order':
        refill();
        break;
      case 'sound': {
        const on = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(on));
        const { sound } = await import('../lib/sound');
        sound.setEnabled(on);
        if (on) sound.play('pop');
        break;
      }
      case 'motion': {
        state.reduced = btn.getAttribute('aria-pressed') !== 'true';
        btn.setAttribute('aria-pressed', String(state.reduced));
        root.dataset.motion = state.reduced ? 'reduced' : 'full';
        try {
          localStorage.setItem('nb:motion', root.dataset.motion);
        } catch {
          /* fine */
        }
        renderer?.setReduced(state.reduced);
        break;
      }
      case 'solo':
        solo(true);
        break;
      case 'solo-exit':
        solo(false);
        break;
      case 'record': {
        const { openRecorder } = await import('../record/open');
        openRecorder(state.flavour);
        break;
      }
    }
  });
  $$('[data-act="motion"]').forEach((b) => b.setAttribute('aria-pressed', String(state.reduced)));

  function solo(on: boolean) {
    if (on) root.dataset.solo = '';
    else delete root.dataset.solo;
    soloExit.hidden = !on;
    $('[data-act="solo"]').setAttribute('aria-pressed', String(on));
    if (on) soloExit.focus();
    else $<HTMLElement>('[data-act="solo"]').focus();
    window.dispatchEvent(new Event('resize'));
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && 'solo' in root.dataset) solo(false);
  });

  boot();
}

/* ------------------------------------------------------------ helpers */

/** Real GPU WebGL2? (`forced` accepts software rendering too, for QA with ?3d=1.) */
function hasWebGL2(forced = false): boolean {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2', { failIfMajorPerformanceCaveat: !forced });
    const ok = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return ok;
  } catch {
    return false;
  }
}

/**
 * Resolves on the first sign of intent: a touch, a scroll, a key, the mouse moving. The 3D is
 * ~300KB of script; loading it on intent keeps it off the first paint entirely (and off a
 * phone that only came for the Order button).
 */
function whenIdleOrIntent(el: HTMLElement): Promise<void> {
  return new Promise((resolve) => {
    const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart', 'wheel'];
    const go = () => {
      events.forEach((ev) => window.removeEventListener(ev, go));
      resolve();
    };
    events.forEach((ev) => window.addEventListener(ev, go, { passive: true }));
    el.addEventListener('pointerenter', go, { once: true });
  });
}

function until(test: () => boolean): Promise<void> {
  return new Promise((resolve) => {
    const check = () => (test() ? resolve() : setTimeout(check, 120));
    check();
  });
}

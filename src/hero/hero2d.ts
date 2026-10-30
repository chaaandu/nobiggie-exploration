/**
 * The 2D cup: the same scene as the 3D one, as stacked stills rendered from the same camera.
 * Used on lighter phones, with reduced motion, without WebGL, and while the 3D loads.
 * Animation is transform/opacity only (Web Animations API).
 */
import type { FlavourId } from '../content/facts';
import { sound } from '../lib/sound';
import type { CreateRenderer, HeroRenderer, StagePoint } from './types';

// Where things are in the frame (fractions), matching the 3D camera.
const CUP_TOP = { x: 0.31, y: 0.27 };
const BOWL = { x: 0.69, y: 0.6 };
const MOUTH = { x: 0.42, y: 0.55 };
const FILLS = [24, 18, 12, 6, 0];
const T = { lift: 180, toBowl: 320, swipe: 260, toMouth: 300, bite: 120, exit: 220 };

const src = (name: string, w = 900) => `/renders/${name}-${w}.webp`;
const size = () => (window.innerWidth < 640 ? 600 : 900);

function img(cls: string, url: string): HTMLImageElement {
  const i = new Image();
  i.className = cls;
  i.alt = '';
  i.decoding = 'async';
  i.src = url;
  return i;
}

export const create: CreateRenderer = async (stage, start, cb) => {
  const frame = stage.querySelector<HTMLElement>('[data-frame]')!;
  const layers = document.createElement('div');
  layers.className = 'layers-2d';
  layers.setAttribute('aria-hidden', 'true');
  // Hidden until first used: the poster underneath is pixel-identical, and keeping it on
  // screen keeps it the page's one LCP image.
  Object.assign(layers.style, { position: 'absolute', inset: '0', pointerEvents: 'none', visibility: 'hidden' });
  frame.insertBefore(layers, frame.querySelector('[data-stage-3d]'));

  let flavour: FlavourId = start.flavour;
  let total = start.total;
  let left = start.left;
  let lidOff = start.lidOff;
  let reduced = start.reduced;
  let running = 0;

  const full = 'position:absolute;inset:0;width:100%;height:100%;';
  const open = img('l-open', '');
  const bowl = img('l-bowl', '');
  const lid = img('l-lid', '');
  [open, bowl, lid].forEach((i) => (i.style.cssText = full));
  layers.append(open, bowl, lid);

  const fillFor = (n: number) => FILLS.reduce((best, f) => (Math.abs(f - n) < Math.abs(best - n) ? f : best), 24);
  const paint = () => {
    const w = size();
    open.src = src(`open-${flavour}-${fillFor(left)}`, w);
    bowl.src = src(`bowl-${flavour}`, w);
    lid.src = src(`lid-${flavour}`, w);
    bowl.style.opacity = lidOff ? '1' : '0';
    lid.style.opacity = lidOff ? '0' : '1';
    lid.style.transform = '';
  };
  // Preload this flavour's set so the first tap is instant.
  const preload = () => {
    const w = size();
    [...FILLS.map((n) => `open-${flavour}-${n}`), `bowl-${flavour}`, `lid-${flavour}`].forEach((n) => (new Image().src = src(n, w)));
    ['dipped', 'bitten'].forEach((c) => (new Image().src = `/renders/cookie-${flavour}-${c}-300.webp`));
  };
  paint();
  const later = () => preload();
  if (document.readyState === 'complete') later();
  else addEventListener('load', later, { once: true });
  let live = false;
  /** First interaction: our layers take over from the poster. */
  const activate = async () => {
    if (live) return;
    live = true;
    await Promise.all([open, lid, bowl].map((i) => i.decode().catch(() => undefined)));
    layers.style.visibility = 'visible';
    stage.querySelector<HTMLElement>('[data-poster]')!.style.visibility = 'hidden';
  };

  const targets = (): StagePoint[] =>
    lidOff && left > 0
      ? [-0.08, -0.03, 0.02, 0.07].map((dx, i) => ({ id: i, x: CUP_TOP.x + dx * 1.4, y: CUP_TOP.y + (i % 2 ? 0.02 : 0) }))
      : [];

  const anim = (el: Element, frames: Keyframe[], ms: number, easing = 'cubic-bezier(.65,0,.35,1)') =>
    el.animate(frames, { duration: reduced ? 1 : ms, easing, fill: 'forwards' }).finished;

  const r: HeroRenderer = {
    kind: '2d',
    async pop() {
      if (lidOff) return;
      await activate();
      running++;
      sound.play('pop');
      bowl.style.opacity = '0';
      if (reduced) {
        lid.style.opacity = '0';
        bowl.style.opacity = '1';
      } else {
        await anim(lid, [{ transform: 'none', opacity: 1 }, { transform: 'translate(0,-6%) scaleY(1.04)', opacity: 1, offset: 0.2 }, { transform: 'translate(22%,-14%) rotate(70deg)', opacity: 0.4, offset: 0.65 }, { transform: 'translate(38%,20%) rotate(160deg)', opacity: 0 }], 560);
        await anim(bowl, [{ opacity: 0, transform: 'translateY(-3%)' }, { opacity: 1, transform: 'none' }], 200, 'ease-out');
      }
      lidOff = true;
      running--;
      cb.popped();
      cb.targets(targets());
    },
    async take() {
      if (!lidOff || left <= 0) return;
      await activate();
      running++;
      const c = img('l-cookie', `/renders/cookie-${flavour}-plain-300.webp`);
      c.style.cssText = `position:absolute;width:20%;left:${CUP_TOP.x * 100 - 10}%;top:${CUP_TOP.y * 100 - 10}%;`;
      layers.append(c);
      const at = (p: { x: number; y: number }, s = 1, rot = 0) => `translate(${(p.x - CUP_TOP.x) * 500}%, ${(p.y - CUP_TOP.y) * 500}%) scale(${s}) rotate(${rot}deg)`;
      await anim(c, [{ transform: at(CUP_TOP, 0.8) }, { transform: at({ x: CUP_TOP.x, y: CUP_TOP.y - 0.1 }, 0.85, -20) }], T.lift);
      await anim(c, [{ transform: at({ x: CUP_TOP.x, y: CUP_TOP.y - 0.1 }, 0.85, -20) }, { transform: at({ x: BOWL.x - 0.03, y: BOWL.y - 0.08 }, 0.85, 180) }], T.toBowl);
      sound.play('squelch');
      c.src = `/renders/cookie-${flavour}-dipped-300.webp`;
      await anim(c, [{ transform: at({ x: BOWL.x - 0.03, y: BOWL.y - 0.08 }, 0.85, 180) }, { transform: at({ x: BOWL.x + 0.03, y: BOWL.y - 0.06 }, 0.85, 175) }], T.swipe);
      await anim(c, [{ transform: at({ x: BOWL.x + 0.03, y: BOWL.y - 0.06 }, 0.85, 175) }, { transform: at(MOUTH, 1.7, 0) }], T.toMouth);
      sound.play('crunch');
      c.src = `/renders/cookie-${flavour}-bitten-300.webp`;
      left = Math.max(0, left - 1);
      crumbs();
      open.src = src(`open-${flavour}-${fillFor(left)}`, size());
      cb.bitten(left);
      await anim(c, [{ transform: at(MOUTH, 1.7, 0) }, { transform: at(MOUTH, 1.6, 0), offset: 0.3 }, { transform: at({ x: MOUTH.x, y: MOUTH.y + 0.3 }, 2.4, 0), opacity: 0 }], T.bite + T.exit);
      c.remove();
      running--;
      cb.targets(targets());
    },
    refill() {
      left = total;
      lidOff = false;
      layers.querySelectorAll('.l-crumb, .l-cookie').forEach((e) => e.remove());
      paint();
      cb.targets([]);
    },
    setFlavour(id) {
      void activate();
      flavour = id;
      r.refill();
      preload();
    },
    setReduced(v) {
      reduced = v;
    },
    tug(p) {
      if (p > 0) void activate();
      if (!lidOff) lid.style.transform = `translateY(${-p * 3}%) scaleY(${1 + p * 0.04})`;
    },
    busy: () => running > 0,
    dispose() {
      layers.remove();
    },
  };

  function crumbs() {
    const n = reduced ? 4 : 9;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      s.className = 'l-crumb';
      const x = MOUTH.x * 100 + (Math.random() - 0.5) * 18;
      const y = 74 + Math.random() * 18;
      const sz = 3 + Math.random() * 5;
      s.style.cssText = `position:absolute;left:${x}%;top:${MOUTH.y * 100}%;width:${sz}px;height:${sz * 0.75}px;border-radius:40% 60% 50% 45%;background:var(--crumb,#B98250);`;
      layers.append(s);
      if (reduced) s.style.top = `${y}%`;
      else s.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: `translateY(${(y - MOUTH.y * 100) * 4}%) rotate(${Math.random() * 300}deg)` }], { duration: 420 + Math.random() * 200, easing: 'cubic-bezier(.5,0,.9,.6)', fill: 'forwards' });
    }
  }

  if (lidOff) cb.targets(targets());
  return r;
};

/**
 * The 3D renderer, loaded only on capable devices after first paint. Mounts the R3F scene
 * into the hero frame and speaks the same HeroRenderer interface as the 2D version, so the
 * controller can hand over mid-session without anyone noticing.
 */
import { createRoot } from 'react-dom/client';
import { Director } from './director';
import { HeroScene } from './HeroScene';
import type { CreateRenderer, HeroRenderer } from '../hero/types';

export const create: CreateRenderer = (stage, start, cb) =>
  new Promise((resolve, reject) => {
    const host = stage.querySelector<HTMLElement>('[data-stage-3d]');
    if (!host) return reject(new Error('no 3D host'));
    const root = document.documentElement;
    // QA: ?clock=manual lets scripts step time exactly (frame strips, reel previews).
    let manualT = performance.now();
    const manual = new URLSearchParams(location.search).get('clock') === 'manual';
    const director = new Director({
      clock: manual ? () => manualT : undefined,
      flavour: start.flavour,
      total: start.total,
      lidOff: start.lidOff,
      left: start.left,
      reduced: start.reduced,
      night: root.dataset.shift === 'night',
      events: {
        popped: () => cb.popped(),
        bitten: (left) => cb.bitten(left),
        targets: (points) => cb.targets(points),
      },
    });

    const onShift = (e: Event) => director.setNight((e as CustomEvent<{ night: boolean }>).detail.night);
    window.addEventListener('nb:shift', onShift);

    if (manual) {
      (window as unknown as { __nbClock: unknown }).__nbClock = {
        advance(ms: number) {
          manualT += ms;
          director.wake();
        },
      };
    }

    const reactRoot = createRoot(host);
    const renderer: HeroRenderer = {
      kind: '3d',
      pop: () => director.pop(),
      take: (t) => director.take(t),
      refill: () => director.refill(),
      setFlavour: (id) => director.setFlavour(id),
      setReduced: (r) => director.setReduced(r),
      tug: (p) => director.tug(p),
      busy: () => director.busy(),
      dispose: () => {
        window.removeEventListener('nb:shift', onShift);
        reactRoot.unmount();
        director.dispose();
        host.removeAttribute('data-ready');
      },
    };

    const maxDpr = Math.min(window.devicePixelRatio || 1, root.dataset.weak !== undefined ? 1.5 : 2);
    reactRoot.render(
      <HeroScene
        director={director}
        maxDpr={maxDpr}
        onFirstFrame={() => {
          host.dataset.ready = '';
          cb.ready();
          resolve(renderer);
        }}
        onError={(e) => {
          renderer.dispose();
          reject(e);
        }}
      />,
    );
  });

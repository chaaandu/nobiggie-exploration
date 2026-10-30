/**
 * Still renders of the 3D cup for the poster, the 2D version, cards and the exploded view.
 * Driven by /render?…; scripts/render-stills.mjs screenshots it.
 */
import { createRoot } from 'react-dom/client';
import { Director } from './director';
import { HeroScene } from './HeroScene';
import type { FlavourId } from '../content/facts';

const q = new URLSearchParams(location.search);
const host = document.getElementById('studio')!;
const size = Number(q.get('size') || 1000);
host.style.width = host.style.height = `${size}px`;
const total = 24;
const director = new Director({
  flavour: (q.get('flavour') || 'choco-chunk') as FlavourId,
  total,
  lidOff: q.get('lid') === 'off',
  left: Number(q.get('left') ?? total),
  reduced: true,
  night: q.get('night') === '1',
  clock: () => 0,
  events: { popped() {}, bitten() {}, targets() {} },
});
const parts = (q.get('hide') || '').split(',').filter(Boolean);
const win = window as unknown as { __renderDone?: boolean };
createRoot(host).render(
  <HeroScene
    director={director}
    maxDpr={1}
    onError={(e) => console.error(e)}
    onFirstFrame={() => {
      director.studio({
        parts: Object.fromEntries(parts.map((p) => [p, false])),
        camera: (q.get('camera') as 'hero' | 'card' | 'cookie') || 'hero',
        cookie: (q.get('cookie') as 'plain' | 'dipped' | 'bitten') || undefined,
      });
      setTimeout(() => requestAnimationFrame(() => requestAnimationFrame(() => (win.__renderDone = true))), 400);
    }}
  />,
);

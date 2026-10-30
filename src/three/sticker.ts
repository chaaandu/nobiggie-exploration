/**
 * The round sticker on the cup, drawn on a canvas with the site's own fonts. Placeholder
 * artwork until the real logo file arrives (then draw that SVG here instead).
 */
import { CanvasTexture, SRGBColorSpace } from 'three';

export async function stickerTexture(): Promise<CanvasTexture> {
  await Promise.all([
    document.fonts.load('760 120px "Fraunces"'),
    document.fonts.load('60px "Gochi Hand"'),
  ]).catch(() => undefined);
  const S = 1024;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  const cx = S / 2;
  // paper
  g.fillStyle = '#F7EEDD';
  g.beginPath();
  g.arc(cx, cx, S * 0.48, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = 'rgba(59,36,22,0.08)';
  g.lineWidth = 6;
  g.stroke();
  // wordmark
  g.save();
  g.translate(cx, cx - 30);
  g.rotate(-0.06);
  g.fillStyle = '#B3262E';
  g.textAlign = 'center';
  g.font = '760 210px "Fraunces", Georgia, serif';
  g.fillText('NO', -60, -40);
  g.font = '760 190px "Fraunces", Georgia, serif';
  g.fillText('BIGGIE', 0, 150);
  g.restore();
  // a little cookie next to "NO"
  g.save();
  g.translate(cx + 190, cx - 190);
  g.fillStyle = '#E9A79A';
  g.beginPath();
  g.arc(0, 0, 70, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#7A1D24';
  for (const [x, y, r] of [[-22, -18, 11], [20, -6, 9], [-6, 26, 12], [30, 30, 7]]) {
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  // tagline
  g.fillStyle = '#3B2416';
  g.textAlign = 'center';
  g.font = '64px "Gochi Hand", cursive';
  g.fillText('Dip. Dunk. Repeat.', cx, cx + 255);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

// Favicons and app icons from public/favicon.svg. Run: node scripts/make-icons.mjs
import sharp from 'sharp';
const svg = 'public/favicon.svg';
for (const [name, size] of [['favicon-32.png', 32], ['apple-touch-icon.png', 180], ['icon-192.png', 192], ['icon-512.png', 512]]) {
  await sharp(svg, { density: 400 }).resize(size, size).png().toFile(`public/${name}`);
}
console.log('icons written');

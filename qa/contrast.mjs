// WCAG contrast check for every text/background pair the design uses.
// Run: node qa/contrast.mjs   (fails if any pair marked as text is under 4.5:1, or large text under 3:1)
const hex = (h) => h.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255);
const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const L = (h) => { const [r, g, b] = hex(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
export const ratio = (a, b) => { const [x, y] = [L(a), L(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const C = {
  cream: '#F6EFE3', paper: '#FBF7F0', cream2: '#EFE4D1', cocoa: '#3B2416', cocoa2: '#6B4E3B',
  velvet: '#B3262E', velvetDeep: '#8E1B22', whiteChoc: '#F3E6CF', nutella: '#5A3420', tape: '#F2C230',
  ink: '#1E120A', night: '#22150D', nightText: '#F3E6CF', nightSoft: '#C9B49C', kraft: '#D9C3A0',
};
const pairs = [
  ['cocoa on cream', C.cocoa, C.cream, 'text'],
  ['cocoa2 on cream', C.cocoa2, C.cream, 'text'],
  ['cocoa2 on paper', C.cocoa2, C.paper, 'text'],
  ['cocoa2 on cream2', C.cocoa2, C.cream2, 'text'],
  ['velvet on cream', C.velvet, C.cream, 'text'],
  ['velvet on paper', C.velvet, C.paper, 'text'],
  ['cream on velvet (button)', C.cream, C.velvet, 'text'],
  ['cream on velvetDeep', C.cream, C.velvetDeep, 'text'],
  ['cream on cocoa', C.cream, C.cocoa, 'text'],
  ['whiteChoc on cocoa', C.whiteChoc, C.cocoa, 'text'],
  ['ink on tape', C.ink, C.tape, 'text'],
  ['cocoa on tape', C.cocoa, C.tape, 'text'],
  ['nightText on night', C.nightText, C.night, 'text'],
  ['nightSoft on night', C.nightSoft, C.night, 'text'],
  ['cocoa on kraft', C.cocoa, C.kraft, 'text'],
  ['nutella on cream', C.nutella, C.cream, 'text'],
  ['cocoa2 (hairline) vs cream, UI', C.cocoa2, C.cream, 'ui'],
];
let bad = 0;
for (const [name, fg, bg, kind] of pairs) {
  const r = ratio(fg, bg);
  const need = kind === 'text' ? 4.5 : 3;
  const ok = r >= need;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.toFixed(2).padStart(5)}  ${name}`);
}
process.exitCode = bad ? 1 : 0;

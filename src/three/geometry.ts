/** Every shape in the scene, built from profiles so there's nothing to download. */
import {
  BufferAttribute,
  BufferGeometry,
  IcosahedronGeometry,
  LatheGeometry,
  Vector2,
} from 'three';
import { CUP, COOKIE, LID } from './spec';
import { rng } from './packing';

/** Smooth a polyline profile with a Catmull-Rom pass so lathe silhouettes don't look faceted. */
function smooth(points: [number, number][], steps = 4): Vector2[] {
  const out: Vector2[] = [];
  const P = points.map(([x, y]) => new Vector2(x, y));
  for (let i = 0; i < P.length - 1; i++) {
    const p0 = P[Math.max(0, i - 1)];
    const p1 = P[i];
    const p2 = P[i + 1];
    const p3 = P[Math.min(P.length - 1, i + 2)];
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push(new Vector2(Math.max(0, f(p0.x, p1.x, p2.x, p3.x)), f(p0.y, p1.y, p2.y, p3.y)));
    }
  }
  out.push(P[P.length - 1].clone());
  return out;
}

/** Thin clear cup: base dimple, tapered wall, rolled lip. One surface, drawn both sides. */
export function cupGeometry(): LatheGeometry {
  const { height: H, rTop, rBottom: rB, rim } = CUP;
  const profile = smooth(
    [
      [0, 0.2],
      [rB * 0.6, 0.16],
      [rB - 0.22, 0.05],
      [rB - 0.04, 0.0],
      [rB + 0.01, 0.16],
      [rB + 0.06, 0.6],
      [rTop - 0.06, H - 0.35],
      [rTop, H - 0.05],
      [rTop + rim * 0.9, H + rim * 0.6],
      [rTop + rim * 1.7, H - 0.02],
      [rTop + rim * 1.8, H - rim * 1.3],
    ],
    5,
  );
  return new LatheGeometry(profile, 96);
}

/** Dome lid: flat top (so it stands as a bowl), dome, flange, and the skirt that snaps over the rim. */
export function lidGeometry(): LatheGeometry {
  const { domeR, domeH, flatTop, flangeOuter, flangeInner, skirt } = LID;
  const pts: [number, number][] = [];
  pts.push([0, domeH], [flatTop * 0.6, domeH], [flatTop, domeH - 0.04]);
  // quarter super-ellipse from the flat top down to the dome's base
  for (let i = 1; i <= 9; i++) {
    const a = (i / 9) * (Math.PI / 2);
    const r = flatTop + (domeR - flatTop) * Math.pow(Math.sin(a), 0.9);
    const y = domeH * Math.pow(Math.cos(a), 1.15);
    pts.push([r, y]);
  }
  pts.push([flangeInner + 0.05, 0.03], [flangeOuter - 0.12, 0.06], [flangeOuter, -0.04], [flangeOuter + 0.02, -skirt * 0.6], [flangeOuter - 0.02, -skirt]);
  return new LatheGeometry(smooth(pts, 3), 96);
}

/** The dip inside the dome: same shape, a hair smaller. Open at the bottom (the surface disc closes it). */
export function dipMassGeometry(): LatheGeometry {
  const { domeR, domeH, flatTop } = LID;
  const inset = 0.94;
  const pts: [number, number][] = [[0, domeH * 0.955], [flatTop * inset, domeH * 0.94]];
  for (let i = 1; i <= 8; i++) {
    const a = (i / 8) * (Math.PI / 2);
    const r = (flatTop + (domeR - flatTop) * Math.pow(Math.sin(a), 0.9)) * inset;
    const y = domeH * 0.94 * Math.pow(Math.cos(a), 1.15);
    pts.push([r, Math.max(0.0, y)]);
  }
  // Bottom-up, like the cup and cookie, so the faces point outwards.
  return new LatheGeometry(smooth(pts.reverse(), 3), 72);
}

/** Polar grid for the dip's open surface: dense enough to ripple, in the XZ plane facing +Y. */
export function dipSurfaceGeometry(radius = LID.domeR * 0.94, rings = 22, segments = 64): BufferGeometry {
  const verts: number[] = [0, 0, 0];
  const uvs: number[] = [0.5, 0.5];
  for (let r = 1; r <= rings; r++) {
    const rr = (r / rings) * radius;
    for (let s = 0; s < segments; s++) {
      const a = (s / segments) * Math.PI * 2;
      const x = Math.cos(a) * rr;
      const z = Math.sin(a) * rr;
      verts.push(x, 0, z);
      uvs.push(0.5 + x / (2 * radius), 0.5 + z / (2 * radius));
    }
  }
  const idx: number[] = [];
  for (let s = 0; s < segments; s++) idx.push(0, 1 + ((s + 1) % segments), 1 + s);
  for (let r = 1; r < rings; r++) {
    const a0 = 1 + (r - 1) * segments;
    const a1 = 1 + r * segments;
    for (let s = 0; s < segments; s++) {
      const s1 = (s + 1) % segments;
      idx.push(a0 + s, a0 + s1, a1 + s, a0 + s1, a1 + s1, a1 + s);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array(verts), 3));
  g.setAttribute('uv', new BufferAttribute(new Float32Array(uvs), 2));
  const n = new Float32Array(verts.length);
  for (let i = 1; i < n.length; i += 3) n[i] = 1;
  g.setAttribute('normal', new BufferAttribute(n, 3));
  g.setIndex(idx);
  return g;
}

/** A thick New York cookie: domed top, rounded edge. Centred on its own middle. */
export function cookieGeometry(): LatheGeometry {
  const R = COOKIE.r;
  const h = COOKIE.h;
  const pts: [number, number][] = [
    [0, 0.02],
    [R * 0.55, 0],
    [R * 0.82, 0.03],
    [R * 0.95, 0.12],
    [R * 1.0, 0.3],
    [R * 1.0, 0.48],
    [R * 0.96, 0.68],
    [R * 0.85, 0.86],
    [R * 0.66, 0.97],
    [R * 0.36, 1.03],
    [0, 1.05],
  ];
  const g = new LatheGeometry(smooth(pts.map(([r, y]) => [r, (y / 1.05) * h]), 3), 40);
  g.translate(0, -h / 2, 0);
  return g;
}

/** Crumb: a chipped little rock. Flat-shaded so it catches the light like a crumb does. */
export function crumbGeometry(seed = 3): BufferGeometry {
  const g = new IcosahedronGeometry(1, 0); // already non-indexed: faces don't share corners
  const rand = rng(seed);
  const pos = g.getAttribute('position') as BufferAttribute;
  // Jitter shared corners consistently so faces stay closed.
  const moved = new Map<string, [number, number, number]>();
  for (let i = 0; i < pos.count; i++) {
    const key = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
    if (!moved.has(key)) moved.set(key, [pos.getX(i) * (0.7 + rand() * 0.6), pos.getY(i) * (0.5 + rand() * 0.5), pos.getZ(i) * (0.7 + rand() * 0.6)]);
    const [x, y, z] = moved.get(key)!;
    pos.setXYZ(i, x, y, z);
  }
  g.computeVertexNormals();
  return g;
}

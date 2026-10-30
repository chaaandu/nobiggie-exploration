/**
 * Crumbs: a few hundred instanced pieces with a tiny integrator (gravity, bounce, friction,
 * sleep). Once a crumb settles it stays put, like the real ones on your hoodie.
 */
import { Color, Euler, InstancedMesh, Matrix4, Quaternion, Vector3, type BufferGeometry, type Material } from 'three';
import { rng } from './packing';

const G = -520; // cm/s², a little slower than real so you can actually see them fall
const tmpM = new Matrix4();
const tmpQ = new Quaternion();
const tmpE = new Euler();
const tmpS = new Vector3();
const tmpP = new Vector3();

/** Round footprints crumbs can't come to rest inside (the cup, the bowl). */
export interface Footprint {
  x: number;
  z: number;
  r: number;
}

export class Crumbs {
  readonly mesh: InstancedMesh;
  private readonly n: number;
  private pos: Float32Array;
  private vel: Float32Array;
  private rot: Float32Array;
  private spin: Float32Array;
  private size: Float32Array;
  private awake: Uint8Array;
  private used: Uint8Array;
  private next = 0;
  private rand = rng(99);
  footprints: Footprint[] = [];

  constructor(geometry: BufferGeometry, material: Material, n = 360) {
    this.n = n;
    this.mesh = new InstancedMesh(geometry, material, n);
    this.mesh.frustumCulled = false;
    this.pos = new Float32Array(n * 3);
    this.vel = new Float32Array(n * 3);
    this.rot = new Float32Array(n * 3);
    this.spin = new Float32Array(n * 3);
    this.size = new Float32Array(n * 3);
    this.awake = new Uint8Array(n);
    this.used = new Uint8Array(n);
    const zero = new Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < n; i++) {
      this.mesh.setMatrixAt(i, zero);
      this.mesh.setColorAt(i, new Color('#B98250'));
    }
    this.mesh.count = n;
  }

  private alloc(): number {
    const i = this.next;
    this.next = (this.next + 1) % this.n; // ring buffer: the oldest crumb gets swept
    return i;
  }

  /** Burst from a bite. `palette` mixes cookie, dark and chunk colours. */
  burst(origin: Vector3, count: number, palette: Color[], push: Vector3, spread = 1) {
    const r = this.rand;
    for (let k = 0; k < count; k++) {
      const i = this.alloc();
      const s = (0.07 + r() * 0.13) * (r() < 0.12 ? 1.8 : 1);
      this.pos.set([origin.x + (r() - 0.5) * 0.8 * spread, origin.y + (r() - 0.5) * 0.5, origin.z + (r() - 0.5) * 0.6], i * 3);
      this.vel.set([push.x + (r() - 0.5) * 28 * spread, push.y + r() * 30, push.z + (r() - 0.5) * 24], i * 3);
      this.rot.set([r() * 6, r() * 6, r() * 6], i * 3);
      this.spin.set([(r() - 0.5) * 22, (r() - 0.5) * 22, (r() - 0.5) * 22], i * 3);
      this.size.set([s * (0.8 + r() * 0.5), s * (0.6 + r() * 0.5), s * (0.8 + r() * 0.5)], i * 3);
      this.awake[i] = 1;
      this.used[i] = 1;
      this.mesh.setColorAt(i, palette[Math.floor(r() * palette.length)].clone().multiplyScalar(0.85 + r() * 0.3));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  /** Crumbs already lying on the table (the "few stray crumbs" of the still life). */
  scatter(points: [number, number][], palette: Color[]) {
    const r = this.rand;
    for (const [x, z] of points) {
      const i = this.alloc();
      const s = 0.06 + r() * 0.12;
      this.size.set([s, s * 0.7, s], i * 3);
      this.pos.set([x, s * 0.5, z], i * 3);
      this.rot.set([r() * 6, r() * 6, r() * 6], i * 3);
      this.awake[i] = 0;
      this.used[i] = 1;
      this.mesh.setColorAt(i, palette[Math.floor(r() * palette.length)]);
      this.write(i);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  private write(i: number) {
    tmpQ.setFromEuler(tmpE.set(this.rot[i * 3], this.rot[i * 3 + 1], this.rot[i * 3 + 2]));
    tmpS.set(this.size[i * 3], this.size[i * 3 + 1], this.size[i * 3 + 2]);
    tmpP.set(this.pos[i * 3], this.pos[i * 3 + 1], this.pos[i * 3 + 2]);
    this.mesh.setMatrixAt(i, tmpM.compose(tmpP, tmpQ, tmpS));
  }

  /** Steps the simulation. Returns true while anything is still moving. */
  update(dt: number): boolean {
    let moving = false;
    const h = Math.min(dt, 1 / 30);
    for (let i = 0; i < this.n; i++) {
      if (!this.awake[i]) continue;
      moving = true;
      const o = i * 3;
      this.vel[o + 1] += G * h;
      this.pos[o] += this.vel[o] * h;
      this.pos[o + 1] += this.vel[o + 1] * h;
      this.pos[o + 2] += this.vel[o + 2] * h;
      this.rot[o] += this.spin[o] * h;
      this.rot[o + 1] += this.spin[o + 1] * h;
      this.rot[o + 2] += this.spin[o + 2] * h;
      const floor = this.size[o + 1] * 0.5;
      if (this.pos[o + 1] < floor) {
        this.pos[o + 1] = floor;
        this.vel[o + 1] *= -0.26;
        this.vel[o] *= 0.55;
        this.vel[o + 2] *= 0.55;
        this.spin[o] *= 0.4;
        this.spin[o + 1] *= 0.4;
        this.spin[o + 2] *= 0.4;
        // Never come to rest inside the cup or the bowl: nudge out to the edge.
        for (const f of this.footprints) {
          const dx = this.pos[o] - f.x;
          const dz = this.pos[o + 2] - f.z;
          const d = Math.hypot(dx, dz);
          if (d < f.r && d > 0.001) {
            this.pos[o] = f.x + (dx / d) * (f.r + 0.05);
            this.pos[o + 2] = f.z + (dz / d) * (f.r + 0.05);
          }
        }
        const speed = Math.abs(this.vel[o]) + Math.abs(this.vel[o + 1]) + Math.abs(this.vel[o + 2]);
        if (speed < 4) this.awake[i] = 0;
      }
      this.write(i);
    }
    if (moving) this.mesh.instanceMatrix.needsUpdate = true;
    return moving;
  }

  /** Sweep everything off the table (instant). */
  clear() {
    const zero = new Matrix4().makeScale(0, 0, 0);
    for (let i = 0; i < this.n; i++) {
      this.awake[i] = 0;
      this.used[i] = 0;
      this.mesh.setMatrixAt(i, zero);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }
}

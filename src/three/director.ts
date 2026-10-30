/**
 * The 3D cup, imperatively: builds the scene and runs every bit of choreography on absolute
 * time (so it's frame-rate independent, and recordings and frame strips are repeatable).
 * React Three Fiber hosts it; nothing in here knows about React.
 */
import {
  BackSide,
  Color,
  DirectionalLight,
  FrontSide,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  Quaternion,
  Scene,
  SphereGeometry,
  Vector3,
  BufferGeometry,
  BufferAttribute,
  type Texture,
  type WebGLRenderer,
} from 'three';
import { CAMERA, COOKIE, CUP, LAYOUT, LID, T } from './spec';
import { packCup, slotMatrix, type Slot } from './packing';
import { cookieGeometry, crumbGeometry, cupGeometry, dipMassGeometry, dipSurfaceGeometry, lidGeometry } from './geometry';
import {
  cookieMaterial,
  crumbMaterial,
  dipMassMaterial,
  dipSurfaceMaterial,
  GROOVE_SIZE,
  MAX_RIPPLES,
  plasticMaterial,
  shadowMaterial,
  shadowTexture,
  stickerMaterial,
  tableMaterial,
  type CookieUniforms,
  type DipSurfaceUniforms,
} from './materials';
import { Crumbs } from './crumbs';
import { stickerTexture } from './sticker';
import { studioEnvironment } from './env';
import { dips, flavourById, product, type FlavourId } from '../content/facts';
import { sound, type SoundName } from '../lib/sound';
import type { StagePoint } from '../hero/types';

/* ------------------------------------------------------------------ easing */
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);
const easeOut = (t: number) => 1 - Math.pow(1 - clamp01(t), 3);
const easeIn = (t: number) => Math.pow(clamp01(t), 2.2);
const easeInOut = (t: number) => {
  t = clamp01(t);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
const easeOutBack = (t: number, s = 1.9) => {
  t = clamp01(t) - 1;
  return 1 + (s + 1) * t * t * t + s * t * t;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
function bezier(out: Vector3, a: Vector3, c: Vector3, b: Vector3, t: number) {
  const u = 1 - t;
  return out.set(u * u * a.x + 2 * u * t * c.x + t * t * b.x, u * u * a.y + 2 * u * t * c.y + t * t * b.y, u * u * a.z + 2 * u * t * c.z + t * t * b.z);
}

/* ------------------------------------------------------------------ types */
export interface DirectorEvents {
  popped(): void;
  bitten(left: number): void;
  targets(points: StagePoint[]): void;
}

export interface DirectorOptions {
  flavour: FlavourId;
  total: number;
  lidOff: boolean;
  left: number;
  reduced: boolean;
  night: boolean;
  events: DirectorEvents;
  /** Clock in ms. Real time by default; the recorder and QA drive it by hand. */
  clock?: () => number;
  /** URL of a real model (public/models/cup.glb) to use instead of the procedural parts. */
  glb?: string;
}

type LidState = 'on' | 'popping' | 'bowl' | 'returning';

interface Actor {
  slot: Slot;
  start: number;
  hold: number;
  p1: Vector3;
  p3: Vector3;
  p4: Vector3;
  mouth: Vector3;
  exit: Vector3;
  q0: Quaternion;
  bitten: boolean;
  swiped: boolean;
  dripped: boolean;
  rippled: number;
  shadow: Mesh;
}

interface Settle {
  slot: Slot;
  start: number;
  fromP: Vector3;
  toP: Vector3;
  fromQ: Quaternion;
  toQ: Quaternion;
}

interface Drop {
  slot: Slot;
  start: number;
}

interface Drip {
  mesh: Mesh;
  actor: Actor | null;
  start: number;
  falling: boolean;
  vel: number;
  done: boolean;
}

const UP = new Vector3(0, 1, 0);
const tmpV = new Vector3();
const tmpV2 = new Vector3();
const tmpQ = new Quaternion();
const tmpM = new Matrix4();
const tmpS = new Vector3();
const tiltQ = new Quaternion();

export class Director {
  readonly root = new Group();
  readonly camera: PerspectiveCamera;
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private envDay: Texture | null = null;
  private envNight: Texture | null = null;
  private key = new DirectionalLight('#fff0dc', 1.05);
  /** Back light: puts the gloss on the dip and the chocolate, rims the cookies. */
  private back = new DirectionalLight('#fff6ea', 1.1);

  /** Set by the host: asks for frames (demand rendering). */
  wake: () => void = () => {};

  private opts: DirectorOptions;
  private flavour: FlavourId;
  private total: number;
  private left: number;
  private reduced: boolean;
  private night: boolean;
  private now: () => number;

  // scene parts
  /** The cup as packed; `slots` drift from it as cookies settle, and go back on refill. */
  private home: Slot[];
  private slots: Slot[];
  private cookies!: InstancedMesh;
  private cookieU!: CookieUniforms;
  private aDip!: InstancedBufferAttribute;
  private aBite!: InstancedBufferAttribute;
  private lid = new Group();
  private cupGroup = new Group();
  private lidShell: Mesh[] = [];
  private dipMass!: Mesh;
  private dipSurface!: Mesh;
  private dipMassMat!: ReturnType<typeof dipMassMaterial>;
  private dipU!: DipSurfaceUniforms;
  private dipSurfaceMat!: ReturnType<typeof dipSurfaceMaterial>['material'];
  private groove!: Uint8Array;
  private grooveLive = false;
  private crumbs!: Crumbs;
  private table!: Mesh;
  private cupShadow!: Mesh;
  private bowlShadow!: Mesh;
  private lidShadow!: Mesh;
  private shadowPool: Mesh[] = [];
  private drips: Drip[] = [];
  private splats: Mesh[] = [];
  private splatNext = 0;

  // state
  private lidState: LidState = 'on';
  private lidStart = 0;
  private tugP = 0;
  private gone = new Set<number>();
  private actors: Actor[] = [];
  private settles: Settle[] = [];
  private drops: Drop[] = [];
  private lastMouth = -1e9;
  private ripIndex = 0;
  private dipLevel = 0;
  private timed: { at: number; fn: () => void }[] = [];
  private colourTween: { start: number; from: Record<string, Color>; to: Record<string, Color> } | null = null;
  private lastFrame = 0;
  private needsTargets = false;
  private poppedFired = false;
  private disposed = false;

  constructor(opts: DirectorOptions) {
    this.opts = opts;
    this.flavour = opts.flavour;
    this.total = opts.total;
    this.left = opts.left;
    this.reduced = opts.reduced;
    this.night = opts.night;
    this.now = opts.clock ?? (() => performance.now());
    this.camera = new PerspectiveCamera(CAMERA.fov, 1, 1, 220);
    this.camera.position.set(...CAMERA.position);
    this.camera.lookAt(new Vector3(...CAMERA.target));
    this.camera.updateMatrixWorld();
    this.home = packCup(this.total);
    this.slots = this.home.map((h) => ({ ...h, position: h.position.clone(), quaternion: h.quaternion.clone() }));
  }

  /* ================================================================ build */

  async build(renderer: WebGLRenderer, scene: Scene) {
    this.renderer = renderer;
    this.scene = scene;
    this.envDay = studioEnvironment(renderer, false);
    scene.environment = this.envDay;

    this.key.position.set(-9, 24, 16);
    this.key.target.position.set(3, 3, 0);
    this.back.position.set(6, 34, -18); // high enough that its mirror image on the flat dip misses the camera
    this.back.target.position.set(6, 2, 2);
    this.root.add(this.key, this.key.target, this.back, this.back.target);

    // table + contact shadows
    this.table = new Mesh(new PlaneGeometry(90, 90), tableMaterial());
    this.table.rotation.x = -Math.PI / 2;
    this.table.renderOrder = -10;
    this.root.add(this.table);

    const shTex = shadowTexture(0.4);
    const sh = (size: number, opacity: number) => {
      const m = new Mesh(new PlaneGeometry(1, 1), shadowMaterial(shTex, opacity));
      m.rotation.x = -Math.PI / 2;
      m.scale.set(size, size, 1);
      m.position.y = 0.012;
      m.renderOrder = -5;
      this.root.add(m);
      return m;
    };
    this.cupShadow = sh(CUP.rBottom * 2 * 2.3, 0.85);
    this.cupShadow.position.set(LAYOUT.cup.x + 0.15, 0.012, LAYOUT.cup.z + 0.25);
    this.bowlShadow = sh(LID.flatTop * 2 * 3.4, 0.0);
    this.bowlShadow.position.set(LAYOUT.bowl.x, 0.013, LAYOUT.bowl.z);
    this.lidShadow = sh(LID.domeR * 2 * 1.6, 0.0);
    for (let i = 0; i < 4; i++) this.shadowPool.push(sh(COOKIE.r * 2 * 1.9, 0));

    // cup: back wall first, then whatever's inside, then the front wall
    const cupGeo = cupGeometry();
    const cupBack = new Mesh(cupGeo, plasticMaterial(BackSide, 0.9));
    cupBack.renderOrder = 1;
    const cupFront = new Mesh(cupGeo, plasticMaterial(FrontSide));
    cupFront.renderOrder = 3;
    const cup = this.cupGroup;
    cup.position.set(LAYOUT.cup.x, 0, LAYOUT.cup.z);
    cup.add(cupBack, cupFront);
    this.root.add(cup);

    // sticker, facing the camera
    const sticker = new Mesh(this.stickerGeometry(), stickerMaterial(await stickerTexture()));
    cup.add(sticker);

    // cookies
    const { material, uniforms } = cookieMaterial();
    this.cookieU = uniforms;
    const geo = cookieGeometry();
    const n = this.total;
    const seeds = new Float32Array(n);
    this.slots.forEach((s, i) => (seeds[i] = s.seed));
    geo.setAttribute('aSeed', new InstancedBufferAttribute(seeds, 1));
    this.aDip = new InstancedBufferAttribute(new Float32Array(n), 1);
    this.aBite = new InstancedBufferAttribute(new Float32Array(n * 4), 4);
    geo.setAttribute('aDip', this.aDip);
    geo.setAttribute('aBite', this.aBite);
    this.cookies = new InstancedMesh(geo, material, n);
    this.cookies.frustumCulled = false;
    this.root.add(this.cookies);

    // lid: shell (clear), the dip mass inside it, and the dip's open surface
    const lidGeo = lidGeometry();
    const shellBack = new Mesh(lidGeo, plasticMaterial(BackSide, 0.9));
    shellBack.renderOrder = 1;
    const shellFront = new Mesh(lidGeo, plasticMaterial(FrontSide));
    shellFront.renderOrder = 3;
    this.lidShell = [shellBack, shellFront];
    this.dipMassMat = dipMassMaterial();
    this.dipMass = new Mesh(dipMassGeometry(), this.dipMassMat);
    const surf = dipSurfaceMaterial(LID.domeR * 0.94);
    this.dipU = surf.uniforms;
    this.dipSurfaceMat = surf.material;
    this.groove = surf.groove;
    this.dipSurface = new Mesh(dipSurfaceGeometry(), surf.material);
    this.dipSurface.rotation.x = Math.PI;
    this.lid.add(this.dipMass, this.dipSurface, shellBack, shellFront);
    this.root.add(this.lid);

    // drips and splats
    const dropGeo = new SphereGeometry(0.2, 18, 14);
    for (let i = 0; i < 3; i++) {
      const m = new Mesh(dropGeo, this.dipMassMat);
      m.visible = false;
      this.root.add(m);
      this.drips.push({ mesh: m, actor: null, start: 0, falling: false, vel: 0, done: true });
    }
    for (let i = 0; i < 10; i++) {
      const m = new Mesh(dropGeo, this.dipMassMat);
      m.visible = false;
      this.root.add(m);
      this.splats.push(m);
    }

    // crumbs
    this.crumbs = new Crumbs(crumbGeometry(), crumbMaterial(), 360);
    this.crumbs.footprints = [
      { x: LAYOUT.cup.x, z: LAYOUT.cup.z, r: CUP.rBottom + 0.25 },
      { x: LAYOUT.bowl.x, z: LAYOUT.bowl.z, r: LID.domeR * 0.8 },
    ];
    this.root.add(this.crumbs.mesh);

    this.applyFlavour(this.flavour, true);
    this.crumbs.scatter(
      [
        [-3.9, 4.6], [-2.6, 5.3], [-4.6, 3.1], [1.9, 6.2], [3.2, 7.4], [4.4, 6.6], [12.6, 6.2], [13.4, 4.9], [-5.6, 6.8], [0.4, 7.9], [6.1, 8.6],
      ],
      this.palette(),
    );
    if (this.opts.glb) await this.useGlb(this.opts.glb).catch((e) => console.warn('[3d] cup.glb failed, using the procedural cup', e));
    if (this.night) this.applyNight(true);
    this.pose(this.opts.lidOff, this.opts.left);
  }

  /** Swap in the named parts of a real model. Units: centimetres, cup base at the origin. */
  private async useGlb(url: string) {
    const { loadCupGlb } = await import('./glb');
    const parts = await loadCupGlb(url);
    if (parts.cup) {
      this.cupGroup.clear();
      this.cupGroup.add(parts.cup);
    }
    if (parts.lid) {
      this.lidShell.forEach((m) => this.lid.remove(m));
      this.lid.add(parts.lid);
    }
    if (parts.dip) {
      this.lid.remove(this.dipMass);
      this.lid.add(parts.dip);
    }
    if (parts.cookie) {
      // keep our per-cookie attributes (seed, dip coat, bite) on the new shape
      const g = parts.cookie.geometry.clone();
      const old = this.cookies.geometry;
      ['aSeed', 'aDip', 'aBite'].forEach((k) => g.setAttribute(k, old.getAttribute(k)));
      this.cookies.geometry = g;
    }
  }

  /** A patch of the cup's cone, so the sticker hugs the plastic. */
  private stickerGeometry(): BufferGeometry {
    const cam = new Vector3(...CAMERA.position);
    const facing = Math.atan2(cam.z - LAYOUT.cup.z, cam.x - LAYOUT.cup.x) - 0.12;
    const yc = 5.3;
    const size = 5.4;
    const rAt = (y: number) => CUP.rBottom + (CUP.rTop - CUP.rBottom) * (y / CUP.height) + 0.045;
    const wAng = size / rAt(yc);
    const N = 28;
    const pos: number[] = [];
    const uv: number[] = [];
    const nrm: number[] = [];
    for (let j = 0; j <= N; j++) {
      for (let i = 0; i <= N; i++) {
        const u = i / N;
        const v = j / N;
        const y = yc + (v - 0.5) * size;
        const a = facing - (u - 0.5) * wAng;
        const r = rAt(y);
        pos.push(Math.cos(a) * r, y, Math.sin(a) * r);
        nrm.push(Math.cos(a), 0.15, Math.sin(a));
        uv.push(u, v);
      }
    }
    const idx: number[] = [];
    for (let j = 0; j < N; j++)
      for (let i = 0; i < N; i++) {
        const a = j * (N + 1) + i;
        idx.push(a, a + 1, a + N + 1, a + 1, a + N + 2, a + N + 1);
      }
    const g = new BufferGeometry();
    g.setAttribute('position', new BufferAttribute(new Float32Array(pos), 3));
    g.setAttribute('normal', new BufferAttribute(new Float32Array(nrm), 3));
    g.setAttribute('uv', new BufferAttribute(new Float32Array(uv), 2));
    g.setIndex(idx);
    return g;
  }

  /* ================================================================ poses */

  private lidOnCup() {
    this.lid.position.set(LAYOUT.cup.x, CUP.height + 0.03, LAYOUT.cup.z);
    this.lid.rotation.set(0, 0, 0);
    this.lid.scale.set(1, 1, 1);
  }

  private lidAsBowl() {
    this.lid.position.set(LAYOUT.bowl.x, LID.domeH, LAYOUT.bowl.z);
    this.lid.rotation.set(0, 0.35, -Math.PI);
    this.lid.scale.set(1, 1, 1);
  }

  /** Jump straight to a state (first frame, studio renders, reduced motion). */
  pose(lidOff: boolean, left: number) {
    this.left = left;
    this.lidState = lidOff ? 'bowl' : 'on';
    if (lidOff) this.lidAsBowl();
    else this.lidOnCup();
    (this.bowlShadow.material as MeshBasicMaterial).opacity = lidOff ? 0.7 : 0;
    this.gone.clear();
    // Eaten cookies come off the top first.
    const order = [...this.slots].sort((a, b) => b.position.y - a.position.y);
    order.slice(0, this.total - left).forEach((s) => this.gone.add(s.index));
    this.slots.forEach((s) => {
      this.cookies.setMatrixAt(s.index, this.gone.has(s.index) ? tmpM.makeScale(0, 0, 0) : slotMatrix(s, tmpM));
      this.aDip.setX(s.index, 0);
      this.aBite.setXYZW(s.index, 0, 0, 0, 0);
    });
    this.cookies.instanceMatrix.needsUpdate = true;
    this.aDip.needsUpdate = true;
    this.aBite.needsUpdate = true;
    this.needsTargets = true;
  }

  /* ================================================================ commands */

  tug(p: number) {
    if (this.lidState !== 'on') return;
    queueMicrotask(() => this.wake());
    this.tugP = p;
    this.lid.position.y = CUP.height + 0.03 + 0.35 * p;
    this.lid.scale.set(1 - 0.015 * p, 1 + 0.05 * p, 1 - 0.015 * p);
    this.lid.rotation.z = -0.03 * p;
  }

  pop() {
    if (this.lidState !== 'on') return;
    queueMicrotask(() => this.wake());
    if (this.reduced) {
      this.lidAsBowl();
      this.lidState = 'bowl';
      (this.bowlShadow.material as MeshBasicMaterial).opacity = 0.7;
      this.play('pop');
      this.opts.events.popped();
      this.needsTargets = true;
      return;
    }
    this.lidState = 'popping';
    this.lidStart = this.now();
    this.at(this.lidStart + T.popRelease * 0.55, () => this.play('pop'));
  }

  take(target?: number) {
    // Dipping can start as soon as the lid has landed, while it's still wobbling.
    if (!(this.lidState === 'bowl' || (this.lidState === 'popping' && this.poppedFired))) return;
    queueMicrotask(() => this.wake());
    const slot = this.pick(target);
    if (!slot) return;
    this.gone.add(slot.index);
    const left = this.total - this.gone.size;
    if (this.reduced) {
      this.cookies.setMatrixAt(slot.index, tmpM.makeScale(0, 0, 0));
      this.cookies.instanceMatrix.needsUpdate = true;
      this.play('crunch');
      this.crumbs.scatter(
        Array.from({ length: 5 }, () => [LAYOUT.bowl.x - 6 + Math.random() * 7, LAYOUT.bowl.z + 3 + Math.random() * 3] as [number, number]),
        this.palette(),
      );
      this.left = left;
      this.opts.events.bitten(left);
      this.needsTargets = true;
      return;
    }
    const now = this.now();
    const bowl = new Vector3(LAYOUT.bowl.x, this.surfaceY(), LAYOUT.bowl.z);
    const depth = 0.95;
    const p1 = new Vector3(slot.position.x * 0.45, CUP.height + 2.6, slot.position.z * 0.45 + 0.6);
    const p3 = bowl.clone().add(new Vector3(-1.0, COOKIE.r - depth, -0.2));
    const p4 = bowl.clone().add(new Vector3(1.0, COOKIE.r - depth, 0.3));
    const mouth = this.mouth();
    const exit = mouth.clone().add(new Vector3(0.2, -2.6, 13));
    const base = T.lift + T.toBowl + T.swipe + T.toMouth;
    const arrive = Math.max(now + base, this.lastMouth + T.bite + T.mouthGap);
    this.lastMouth = arrive;
    const actor: Actor = {
      slot,
      start: now,
      hold: arrive - (now + base),
      p1,
      p3,
      p4,
      mouth,
      exit,
      q0: slot.quaternion.clone(),
      bitten: false,
      swiped: false,
      dripped: false,
      rippled: 0,
      shadow: this.shadowPool.find((s) => !this.actors.some((a) => a.shadow === s)) ?? this.shadowPool[0],
    };
    this.actors.push(actor);
    this.settleAround(slot, now + 90);
    this.needsTargets = true;
  }

  refill() {
    queueMicrotask(() => this.wake());
    this.actors.forEach((a) => (this.shadowMat(a.shadow).opacity = 0));
    this.actors = [];
    this.settles = [];
    this.lastMouth = -1e9;
    this.drips.forEach((d) => {
      d.done = true;
      d.mesh.visible = false;
    });
    const missing = this.slots.filter((s) => this.gone.has(s.index)).sort((a, b) => a.position.y - b.position.y);
    this.gone.clear();
    this.left = this.total;
    this.dipLevel = 0;
    this.groove.fill(0);
    this.dipU.uGroove.value.needsUpdate = true;
    this.dipSurface.position.y = 0;
    // Every cookie goes back to where it was packed; the eaten ones drop back in.
    this.slots.forEach((s, i) => {
      s.position.copy(this.home[i].position);
      s.quaternion.copy(this.home[i].quaternion);
      this.aDip.setX(s.index, 0);
      this.aBite.setXYZW(s.index, 0, 0, 0, 0);
      if (!missing.includes(s)) this.cookies.setMatrixAt(s.index, slotMatrix(s, tmpM));
    });
    this.cookies.instanceMatrix.needsUpdate = true;
    this.aDip.needsUpdate = true;
    this.aBite.needsUpdate = true;
    if (this.reduced || this.lidState === 'on') {
      this.pose(false, this.total);
      return;
    }
    const now = this.now();
    missing.forEach((s, i) => this.drops.push({ slot: s, start: now + i * 22 }));
    // Lid goes back on once the last cookie has landed.
    const lidAt = now + missing.length * 22 + T.refillDrop * 0.6;
    this.at(lidAt, () => {
      this.lidState = 'returning';
      this.lidStart = this.now();
    });
    this.needsTargets = true;
  }

  setFlavour(id: FlavourId) {
    if (id === this.flavour) return;
    this.flavour = id;
    this.refill();
    this.applyFlavour(id, this.reduced);
  }

  setReduced(r: boolean) {
    this.reduced = r;
  }

  setNight(on: boolean) {
    if (on === this.night) return;
    queueMicrotask(() => this.wake());
    this.night = on;
    this.applyNight(on);
  }

  busy(): boolean {
    return this.actors.length > 0 || this.drops.length > 0 || this.lidState === 'popping' || this.lidState === 'returning' || this.settles.length > 0;
  }

  /* ================================================================ helpers */

  private at(t: number, fn: () => void) {
    this.timed.push({ at: t, fn });
  }

  private play(name: SoundName) {
    sound.play(name);
  }

  private surfaceY() {
    return LID.domeH - this.dipLevel;
  }

  private shadowMat(m: Mesh) {
    return m.material as MeshBasicMaterial;
  }

  /** In front of the camera, a little below centre: where a bite happens. */
  private mouth(): Vector3 {
    const cam = new Vector3(...CAMERA.position);
    const fwd = new Vector3(...CAMERA.target).sub(cam).normalize();
    return cam.clone().add(fwd.multiplyScalar(21)).add(new Vector3(-0.4, -1.3, 0));
  }

  private pick(target?: number): Slot | null {
    const free = this.slots.filter((s) => !this.gone.has(s.index));
    if (!free.length) return null;
    if (target !== undefined) {
      const t = free.find((s) => s.index === target);
      if (t) return t;
    }
    return free.sort((a, b) => b.position.y - a.position.y)[0];
  }

  private settleAround(slot: Slot, start: number) {
    for (const s of this.slots) {
      if (this.gone.has(s.index)) continue;
      const d = Math.hypot(s.position.x - slot.position.x, s.position.z - slot.position.z);
      if (d > 3.4 || s.position.y > slot.position.y + 0.6) continue;
      const k = 1 - d / 3.4;
      const toP = s.position.clone().add(new Vector3((slot.position.x - s.position.x) * 0.12 * k, -0.28 * k, (slot.position.z - s.position.z) * 0.12 * k));
      const axis = new Vector3(slot.position.z - s.position.z, 0, -(slot.position.x - s.position.x)).normalize();
      const toQ = new Quaternion().setFromAxisAngle(axis, 0.12 * k).multiply(s.quaternion);
      this.settles.push({ slot: s, start, fromP: s.position.clone(), toP, fromQ: s.quaternion.clone(), toQ });
    }
  }

  private palette(): Color[] {
    const f = flavourById(this.flavour);
    return [new Color(f.look.cookie), new Color(f.look.cookie), new Color(f.look.cookieDark), new Color(f.look.chunk)];
  }

  private applyFlavour(id: FlavourId, instant: boolean) {
    const f = flavourById(id);
    const dip = dips[f.dip];
    const to = {
      base: new Color(f.look.cookie),
      dark: new Color(f.look.cookieDark),
      chunk: new Color(f.look.chunk),
      dip: new Color(dip.colour),
    };
    this.cookieU.uChunkStyle.value = f.look.chunkStyle === 'chunks' ? 0 : f.look.chunkStyle === 'chips' ? 1 : 2;
    this.cookieU.uDipRough.value = f.dip === 'white-chocolate' ? 0.32 : 0.2;
    if (instant) {
      this.setColours(to);
      return;
    }
    const from = {
      base: this.cookieU.uBase.value.clone(),
      dark: this.cookieU.uDark.value.clone(),
      chunk: this.cookieU.uChunk.value.clone(),
      dip: this.dipMassMat.color.clone(),
    };
    this.colourTween = { start: this.now(), from, to };
  }

  private setColours(c: Record<string, Color>) {
    this.cookieU.uBase.value.copy(c.base);
    this.cookieU.uDark.value.copy(c.dark);
    this.cookieU.uChunk.value.copy(c.chunk);
    this.cookieU.uDipColor.value.copy(c.dip);
    this.dipMassMat.color.copy(c.dip);
    this.dipSurfaceMat.color.copy(c.dip);
    const white = this.flavour === 'red-velvet';
    this.dipMassMat.roughness = white ? 0.3 : 0.22;
    this.dipSurfaceMat.roughness = white ? 0.3 : 0.22;
  }

  private applyNight(on: boolean) {
    if (!this.renderer || !this.scene) return;
    if (on && !this.envNight) this.envNight = studioEnvironment(this.renderer, true);
    this.scene.environment = on ? this.envNight : this.envDay;
    this.key.color.set(on ? '#ffc48a' : '#fff0dc');
    this.key.intensity = on ? 1.6 : 1.05;
    this.key.position.set(on ? -14 : -9, on ? 20 : 24, on ? 8 : 16);
  }

  private ripple(world: Vector3, amp: number, t: number) {
    const local = this.dipSurface.worldToLocal(world.clone());
    this.dipU.uRip.value[this.ripIndex].set(local.x, local.z, t / 1000, amp);
    this.ripIndex = (this.ripIndex + 1) % MAX_RIPPLES;
  }

  private paintGroove(world: Vector3) {
    const local = this.dipSurface.worldToLocal(world.clone());
    const R = this.dipU.uRadius.value;
    const cx = ((local.x / (2 * R)) + 0.5) * GROOVE_SIZE;
    const cy = ((local.z / (2 * R)) + 0.5) * GROOVE_SIZE;
    const rad = 3.2;
    for (let y = Math.floor(cy - rad * 2); y <= cy + rad * 2; y++) {
      for (let x = Math.floor(cx - rad * 2); x <= cx + rad * 2; x++) {
        if (x < 0 || y < 0 || x >= GROOVE_SIZE || y >= GROOVE_SIZE) continue;
        const d2 = ((x - cx) ** 2 + (y - cy) ** 2) / (rad * rad);
        const v = Math.round(255 * Math.exp(-d2));
        const i = y * GROOVE_SIZE + x;
        if (v > this.groove[i]) this.groove[i] = v;
      }
    }
    this.dipU.uGroove.value.needsUpdate = true;
    this.grooveLive = true;
  }

  private dipEdge(actorMatrix: Matrix4, out: Vector3) {
    return out.set(COOKIE.r * 0.95, 0, 0).applyMatrix4(actorMatrix);
  }

  /* ================================================================ frame */

  /** Advances everything. Returns true while something still needs frames. */
  update(): boolean {
    if (this.disposed) return false;
    const now = this.now();
    const dt = this.lastFrame ? Math.min(0.05, (now - this.lastFrame) / 1000) : 1 / 60;
    this.lastFrame = now;
    let active = false;

    // timed one-offs (sounds, delayed transitions)
    if (this.timed.length) {
      const due = this.timed.filter((e) => e.at <= now);
      this.timed = this.timed.filter((e) => e.at > now);
      due.forEach((e) => e.fn());
      active = true;
    }
    if (this.timed.length) active = true;

    active = this.updateLid(now) || active;
    active = this.updateActors(now) || active;
    active = this.updateSettles(now) || active;
    active = this.updateDrops(now) || active;
    active = this.updateDrips(now, dt) || active;
    active = this.crumbs.update(dt) || active;

    // ripples run on shader time; keep rendering while any are alive
    this.dipU.uTime.value = now / 1000;
    if (this.dipU.uRip.value.some((r) => r.w > 0 && now / 1000 - r.z < 2.6)) active = true;

    // soft dip: the swipe groove slowly fills back in
    if (this.grooveLive && product.dipTexture === 'soft') {
      let any = false;
      const k = Math.max(1, Math.round(dt * 160));
      for (let i = 0; i < this.groove.length; i++) {
        if (this.groove[i]) {
          this.groove[i] = Math.max(0, this.groove[i] - k);
          any = true;
        }
      }
      this.dipU.uGroove.value.needsUpdate = true;
      this.grooveLive = any;
      active = active || any;
    }

    if (this.colourTween) {
      const t = easeInOut((now - this.colourTween.start) / T.recolour);
      const c: Record<string, Color> = {};
      for (const k of Object.keys(this.colourTween.to)) c[k] = this.colourTween.from[k].clone().lerp(this.colourTween.to[k], t);
      this.setColours(c);
      if (t >= 1) this.colourTween = null;
      active = true;
    }

    if (this.needsTargets && (this.lidState === 'bowl' || (this.lidState === 'popping' && this.poppedFired))) {
      this.needsTargets = false;
      this.opts.events.targets(this.targets());
    } else if (this.needsTargets && this.lidState === 'on') {
      this.needsTargets = false;
      this.opts.events.targets([]);
    }
    return active;
  }

  private updateLid(now: number): boolean {
    if (this.lidState === 'popping') {
      const t = now - this.lidStart;
      const cupRim = new Vector3(LAYOUT.cup.x, CUP.height + 0.03, LAYOUT.cup.z);
      const rest = new Vector3(LAYOUT.bowl.x, LID.domeH, LAYOUT.bowl.z);
      const r1 = T.popRelease;
      const r2 = r1 + T.popFlight;
      const r3 = r2 + T.popLand;
      const r4 = r3 + T.popWobble;
      const shadow = this.shadowMat(this.lidShadow);
      if (t < r1) {
        // suction: stretches, then lets go
        const p = t / r1;
        this.lid.position.copy(cupRim).add(tmpV.set(0, 0.35 * (0.6 + p), 0));
        const s = Math.sin(p * Math.PI);
        this.lid.scale.set(1 - 0.03 * s, 1 + 0.08 * s, 1 - 0.03 * s);
      } else if (t < r2) {
        const p = (t - r1) / T.popFlight;
        const e = easeInOut(p);
        const ctrl = cupRim.clone().lerp(rest, 0.5).add(tmpV2.set(0, 7.5, 0));
        bezier(this.lid.position, cupRim.clone().add(tmpV.set(0, 0.6, 0)), ctrl, rest.clone().add(tmpV.set(0, 0.7, 0)), e);
        this.lid.rotation.set(0, 0.35 * e, -Math.PI * easeInOut(clamp01(p * 1.1)));
        this.lid.scale.set(1, 1, 1);
        shadow.opacity = 0.25 * Math.sin(p * Math.PI);
        this.lidShadow.position.set(this.lid.position.x, 0.014, this.lid.position.z);
        this.lidShadow.scale.setScalar(LID.domeR * 2 * (1.4 + 0.6 * Math.sin(p * Math.PI)));
      } else if (t < r3) {
        const p = (t - r2) / T.popLand;
        this.lid.position.copy(rest).add(tmpV.set(0, 0.7 * (1 - easeOutBack(p, 2.4)), 0));
        this.lid.rotation.set(0, 0.35, -Math.PI);
        shadow.opacity = 0;
        this.shadowMat(this.bowlShadow).opacity = 0.7 * easeOut(p);
      } else if (t < r4) {
        const p = (t - r3) / T.popWobble;
        this.lidAsBowl();
        const wob = Math.exp(-5.5 * p) * Math.sin(p * 24);
        this.lid.rotation.x = 0.07 * wob;
        this.lid.rotation.z = -Math.PI + 0.05 * wob;
      } else {
        this.lidAsBowl();
        this.lidState = 'bowl';
        this.needsTargets = true;
      }
      // the controller can start dipping once it has landed, during the wobble
      if (t >= r3 && !this.poppedFired) {
        this.poppedFired = true;
        this.opts.events.popped();
        this.needsTargets = true;
      }
      return true;
    }
    if (this.lidState === 'returning') {
      const t = now - this.lidStart;
      const p = clamp01(t / T.reseal);
      const e = easeInOut(p);
      const from = new Vector3(LAYOUT.bowl.x, LID.domeH, LAYOUT.bowl.z);
      const to = new Vector3(LAYOUT.cup.x, CUP.height + 0.03, LAYOUT.cup.z);
      const ctrl = from.clone().lerp(to, 0.5).add(tmpV2.set(0, 7, 0));
      bezier(this.lid.position, from, ctrl, to, e);
      this.lid.rotation.set(0, 0.35 * (1 - e), -Math.PI * (1 - e));
      this.shadowMat(this.bowlShadow).opacity = 0.7 * (1 - easeOut(p * 2));
      if (p >= 1) {
        this.lidOnCup();
        this.lid.scale.set(1.02, 0.96, 1.02);
        this.at(now + 70, () => this.lid.scale.set(1, 1, 1));
        this.play('click');
        this.lidState = 'on';
        this.poppedFired = false;
        this.tugP = 0;
        this.needsTargets = true;
      }
      return true;
    }
    return false;
  }

  private updateActors(now: number): boolean {
    if (!this.actors.length) return false;
    const qDip = this.qDip();
    const qMouth = this.qMouth();
    const keep: Actor[] = [];
    for (const a of this.actors) {
      const t = now - a.start;
      const s = a.slot;
      const t1 = T.lift;
      const t2 = t1 + T.toBowl;
      const t3 = t2 + T.swipe + a.hold;
      const t4 = t3 + T.toMouth;
      const t5 = t4 + T.bite;
      const t6 = t5 + T.exit;
      let scale = s.scale;
      const pos = tmpV;
      const q = tmpQ;
      if (t < t1) {
        const p = easeOut(t / t1);
        pos.copy(s.position).lerp(a.p1, p);
        q.slerpQuaternions(a.q0, qDip, p * 0.45);
        scale = lerp(s.scale, 1, p);
      } else if (t < t2) {
        const p = easeInOut((t - t1) / T.toBowl);
        const ctrl = a.p1.clone().lerp(a.p3, 0.5).add(tmpV2.set(0, 3.2, 0));
        bezier(pos, a.p1, ctrl, a.p3, p);
        q.slerpQuaternions(a.q0, qDip, 0.45 + 0.55 * p);
        scale = 1;
      } else if (t < t3) {
        const swipeT = Math.min(1, (t - t2) / T.swipe);
        const p = easeInOut(swipeT);
        pos.copy(a.p3).lerp(a.p4, p);
        // a little stir while it waits for the mouth to be free
        if (t - t2 > T.swipe) pos.y += 0.25 * Math.sin((t - t2 - T.swipe) / 90);
        // drags slightly as it goes through: tilt within its own plane
        q.copy(qDip).multiply(tiltQ.setFromAxisAngle(UP, 0.22 * (p - 0.5)));
        this.aDip.setX(s.index, easeOut(swipeT));
        this.aDip.needsUpdate = true;
        if (!a.swiped) {
          a.swiped = true;
          this.play('squelch');
          this.ripple(tmpV2.copy(a.p3).setY(this.surfaceY()), 0.045, now);
          this.dipLevel = Math.min(1.3, this.dipLevel + 0.045);
          this.dipSurface.position.y = this.dipLevel;
        }
        if (a.rippled < 1 && swipeT > 0.6) {
          a.rippled = 1;
          this.ripple(tmpV2.copy(pos).setY(this.surfaceY()), 0.035, now);
        }
        this.paintGroove(tmpV2.copy(pos).setY(this.surfaceY()));
        scale = 1;
      } else if (t < t4) {
        const p = easeInOut((t - t3) / T.toMouth);
        const ctrl = a.p4.clone().lerp(a.mouth, 0.5).add(tmpV2.set(0, 4.2, 0));
        bezier(pos, a.p4, ctrl, a.mouth, p);
        q.slerpQuaternions(qDip, qMouth, p);
        scale = 1;
        if (!a.dripped) {
          a.dripped = true;
          this.ripple(tmpV2.copy(a.p4).setY(this.surfaceY()), 0.05, now);
          const d = this.drips.find((x) => x.done);
          if (d) Object.assign(d, { actor: a, start: now, falling: false, vel: 0, done: false });
        }
      } else if (t < t5) {
        const p = (t - t4) / T.bite;
        pos.copy(a.mouth);
        q.copy(qMouth);
        scale = 1 - 0.07 * Math.sin(p * Math.PI);
        if (!a.bitten) {
          a.bitten = true;
          this.aBite.setXYZW(s.index, 0, 0.86, 0, 1);
          this.aBite.needsUpdate = true;
          this.play('crunch');
          const edge = tmpV2.set(COOKIE.r, 0, 0).applyQuaternion(qMouth).add(a.mouth);
          const f = flavourById(this.flavour);
          this.crumbs.burst(edge, 16, [...this.palette(), new Color(dips[f.dip].colour)], new Vector3(0, 12, -50));
          this.left = Math.max(0, this.countLeftAfterBite());
          this.opts.events.bitten(this.left);
        }
      } else if (t < t6) {
        const p = easeIn((t - t5) / T.exit);
        pos.copy(a.mouth).lerp(a.exit, p);
        q.copy(qMouth);
        scale = 1 + 0.5 * p;
      } else {
        this.cookies.setMatrixAt(s.index, tmpM.makeScale(0, 0, 0));
        this.cookies.instanceMatrix.needsUpdate = true;
        this.shadowMat(a.shadow).opacity = 0;
        continue;
      }
      this.cookies.setMatrixAt(s.index, tmpM.compose(pos, q, tmpS.setScalar(scale)));
      this.cookies.instanceMatrix.needsUpdate = true;
      // a soft blob shadow follows it while it's over the table
      const sh = this.shadowMat(a.shadow);
      const h = Math.max(0, pos.y);
      sh.opacity = t < t1 * 0.5 || t > t4 ? 0 : 0.32 * Math.max(0, 1 - h / 16);
      a.shadow.position.set(pos.x, 0.015, pos.z);
      a.shadow.scale.setScalar(COOKIE.r * 2 * (1.4 + h * 0.12));
      keep.push(a);
    }
    this.actors = keep;
    return true;
  }

  /** Cookies left in the cup once every bite that has happened is counted. */
  private countLeftAfterBite(): number {
    const eaten = this.slots.filter((s) => this.gone.has(s.index)).length;
    const unbitten = this.actors.filter((x) => !x.bitten).length;
    return this.total - eaten + unbitten;
  }

  private qDip(): Quaternion {
    // +x edge straight down into the dip, face towards the camera
    const cam = new Vector3(...CAMERA.position);
    const y = new Vector3(cam.x - LAYOUT.bowl.x, 0, cam.z - LAYOUT.bowl.z).normalize();
    const x = new Vector3(0, -1, 0);
    const z = new Vector3().crossVectors(x, y);
    return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  }

  private qMouth(): Quaternion {
    // held up to your face: dipped (bitten) edge on top, face towards you
    const cam = new Vector3(...CAMERA.position);
    const m = this.mouth();
    const y = cam.clone().sub(m).normalize();
    const x = new Vector3(0.25, 1, 0).sub(y.clone().multiplyScalar(new Vector3(0.25, 1, 0).dot(y))).normalize();
    const z = new Vector3().crossVectors(x, y);
    return new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(x, y, z));
  }

  private updateSettles(now: number): boolean {
    if (!this.settles.length) return false;
    const keep: Settle[] = [];
    for (const st of this.settles) {
      if (this.gone.has(st.slot.index)) continue;
      const p = (now - st.start) / 300;
      if (p < 0) {
        keep.push(st);
        continue;
      }
      const e = easeOutBack(Math.min(1, p), 1.4);
      st.slot.position.copy(st.fromP).lerp(st.toP, e);
      st.slot.quaternion.slerpQuaternions(st.fromQ, st.toQ, Math.min(1, e));
      this.cookies.setMatrixAt(st.slot.index, slotMatrix(st.slot, tmpM));
      this.cookies.instanceMatrix.needsUpdate = true;
      if (p < 1) keep.push(st);
      else this.needsTargets = true;
    }
    this.settles = keep;
    return true;
  }

  private updateDrops(now: number): boolean {
    if (!this.drops.length) return false;
    const keep: Drop[] = [];
    for (const d of this.drops) {
      const p = (now - d.start) / T.refillDrop;
      if (p < 0) {
        this.cookies.setMatrixAt(d.slot.index, tmpM.makeScale(0, 0, 0));
        keep.push(d);
        continue;
      }
      const e = easeOutBack(Math.min(1, p), 1.2);
      const from = d.slot.position.clone().add(tmpV2.set(0, 7, 0));
      tmpV.copy(from).lerp(d.slot.position, e);
      this.cookies.setMatrixAt(d.slot.index, tmpM.compose(tmpV, d.slot.quaternion, tmpS.setScalar(d.slot.scale)));
      if (p < 1) keep.push(d);
    }
    this.cookies.instanceMatrix.needsUpdate = true;
    this.drops = keep;
    if (!keep.length) this.needsTargets = true;
    return true;
  }

  private updateDrips(now: number, dt: number): boolean {
    let active = false;
    for (const d of this.drips) {
      if (d.done) continue;
      active = true;
      const m = d.mesh;
      m.visible = true;
      const t = now - d.start;
      if (!d.falling && d.actor) {
        // hangs off the dipped edge, stretching, for a beat
        const a = d.actor;
        const mat = new Matrix4();
        this.cookies.getMatrixAt(a.slot.index, mat);
        const edge = this.dipEdge(mat, tmpV);
        const p = clamp01(t / 150);
        m.position.copy(edge).add(tmpV2.set(0, -0.15 - 0.35 * p, 0));
        m.scale.set(0.7 + 0.1 * p, 0.7 + 1.3 * p, 0.7 + 0.1 * p);
        if (t > 150) {
          d.falling = true;
          d.vel = -18;
        }
      } else {
        d.vel -= 520 * dt;
        m.position.y += d.vel * dt;
        m.scale.set(0.8, Math.max(1, 1.6 - t / 400), 0.8);
        const inBowl = Math.hypot(m.position.x - LAYOUT.bowl.x, m.position.z - LAYOUT.bowl.z) < LID.domeR * 0.9;
        const floor = inBowl ? this.surfaceY() : 0.05;
        if (m.position.y <= floor) {
          d.done = true;
          m.visible = false;
          this.play('drip');
          if (inBowl) this.ripple(m.position.clone().setY(floor), 0.035, now);
          else {
            const s = this.splats[this.splatNext];
            this.splatNext = (this.splatNext + 1) % this.splats.length;
            s.position.set(m.position.x, 0.04, m.position.z);
            s.scale.set(1.5, 0.16, 1.5);
            s.visible = true;
          }
        }
      }
    }
    return active;
  }

  /** Screen positions of the cookies you can take next (the top layer), for the a11y/tap layer. */
  private targets(): StagePoint[] {
    if (this.lidState === 'on' || this.lidState === 'returning') return [];
    const free = this.slots.filter((s) => !this.gone.has(s.index));
    if (!free.length) return [];
    const topY = Math.max(...free.map((s) => s.position.y));
    return free
      .filter((s) => s.position.y > topY - 1.3)
      .map((s) => {
        const v = s.position.clone().project(this.camera);
        return { id: s.index, x: (v.x + 1) / 2, y: (1 - v.y) / 2 };
      });
  }

  /**
   * Studio mode, for the still renders (poster, 2D layers, cards, exploded view): show only
   * some parts, choose a camera, or pose a single cookie for a sprite.
   */
  studio(o: {
    parts?: Partial<Record<'table' | 'cup' | 'cookies' | 'lid' | 'crumbs' | 'shadows', boolean>>;
    camera?: 'hero' | 'card' | 'cookie';
    cookie?: 'plain' | 'dipped' | 'bitten';
    lidOnCupHidden?: boolean;
  }) {
    const p = { table: true, cup: true, cookies: true, lid: true, crumbs: true, shadows: true, ...o.parts };
    this.table.visible = p.table;
    this.cupGroup.visible = p.cup;
    this.cookies.visible = p.cookies;
    this.lid.visible = p.lid;
    this.crumbs.mesh.visible = p.crumbs;
    [this.cupShadow, this.bowlShadow, this.lidShadow, ...this.shadowPool].forEach((m) => (m.visible = p.shadows));
    if (o.camera === 'card') {
      this.camera.position.set(0.4, 15.5, 40);
      this.camera.lookAt(0, 7.2, 0);
    } else if (o.camera === 'cookie') {
      this.camera.position.set(0, 5, 11);
      this.camera.lookAt(0, 5, 0);
    }
    this.camera.updateMatrixWorld();
    if (o.cookie) {
      // one cookie, face to camera, dipped edge up: the 2D version's sprite
      const q = new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(0.2, 1, 0).normalize(), new Vector3(0, 0, 1), new Vector3(0.2, 1, 0).normalize().cross(new Vector3(0, 0, 1))));
      for (let i = 0; i < this.total; i++) this.cookies.setMatrixAt(i, tmpM.makeScale(0, 0, 0));
      this.cookies.setMatrixAt(0, tmpM.compose(new Vector3(0, 5, 0), q, tmpS.setScalar(1)));
      this.aDip.setX(0, o.cookie === 'plain' ? 0 : 1);
      this.aBite.setXYZW(0, 0, 0.86, 0, o.cookie === 'bitten' ? 1 : 0);
      this.cookies.instanceMatrix.needsUpdate = true;
      this.aDip.needsUpdate = true;
      this.aBite.needsUpdate = true;
    }
    this.wake();
  }

  /** Stage aspect changes (solo mode, resize): keep the horizontal framing for tall canvases. */
  resize(w: number, h: number) {
    const aspect = w / h;
    this.camera.aspect = aspect;
    if (aspect < 1) {
      const hf = (CAMERA.fov * Math.PI) / 180;
      this.camera.fov = (2 * Math.atan(Math.tan(hf / 2) / aspect) * 180) / Math.PI;
    } else this.camera.fov = CAMERA.fov;
    this.camera.updateProjectionMatrix();
    this.needsTargets = true;
  }

  dispose() {
    this.disposed = true;
    this.root.traverse((o) => {
      const m = o as Mesh;
      m.geometry?.dispose();
      const mat = m.material as MeshBasicMaterial | MeshBasicMaterial[] | undefined;
      (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => {
        x.map?.dispose();
        x.alphaMap?.dispose();
        x.dispose();
      });
    });
    this.envDay?.dispose();
    this.envNight?.dispose();
  }
}


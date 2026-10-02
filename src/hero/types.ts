import type { FlavourId } from '../content/facts';

/** What a renderer needs to pick up exactly where the last one left off. */
export interface HeroSnapshot {
  flavour: FlavourId;
  lidOff: boolean;
  left: number;
  total: number;
  reduced: boolean;
}

/** A point in stage space: 0..1 across, 0..1 down. */
export interface StagePoint {
  id: number;
  x: number;
  y: number;
}

/** How a renderer reports back to the controller. */
export interface HeroCallbacks {
  /** The lid has landed beside the cup as the dip bowl. */
  popped(): void;
  /** A cookie was bitten; `left` remain in the cup. */
  bitten(left: number): void;
  /** Where the cookies you can take next are, for the keyboard/touch layer. */
  targets(points: StagePoint[]): void;
  /** First real frame is on screen. */
  ready(): void;
}

export interface HeroRenderer {
  readonly kind: '2d' | '3d';
  pop(): void;
  /** Dip and bite one cookie. `target` is a StagePoint id, or any cookie if omitted. */
  take(target?: number): void;
  refill(): void;
  setFlavour(id: FlavourId): void;
  setReduced(reduced: boolean): void;
  /** Drag progress on the lid before it lets go (0..1), for the suction stretch. */
  tug(progress: number): void;
  /** True while anything is still animating (used to hand over between renderers safely). */
  busy(): boolean;
  dispose(): void;
}

export type CreateRenderer = (stage: HTMLElement, start: HeroSnapshot, cb: HeroCallbacks) => Promise<HeroRenderer>;

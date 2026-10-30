/**
 * Sizes and composition. 1 unit = 1 cm. Cup dimensions are a best guess from the old photos
 * (a squat ~12oz clear cup); update them when real measurements arrive and everything follows.
 */
export const CUP = {
  height: 10.5,
  rTop: 4.7,
  rBottom: 3.15,
  rim: 0.16, // rolled lip radius
  wall: 0.05,
};

export const LID = {
  flangeOuter: 5.05,
  flangeInner: 4.55,
  skirt: 0.45, // snaps over the rim
  domeR: 4.45, // dome radius at its base
  domeH: 4.1, // dome height above the rim
  flatTop: 1.5, // flat circle on top, so it stands as a bowl when flipped
};

export const COOKIE = {
  r: 1.6,
  h: 1.05,
};

/** Where things stand on the table (x across, z towards camera). Cup stays put. */
export const LAYOUT = {
  cup: { x: 0, z: 0 },
  // Front-right of the cup, far enough that the bowl's rim clears the cup wall.
  bowl: { x: 8.2, z: 3.4 },
};

/**
 * Camera: fixed, product-photo framing for a square frame. The cup lands ~31% across, the
 * bowl ~69%, dome top ~12% down, the cup's foot ~80% down (leaving table for crumbs).
 */
export const CAMERA = {
  fov: 26,
  position: [4.2, 19.4, 45] as [number, number, number],
  target: [4.2, 6.5, 0] as [number, number, number],
};

/** Choreography, in ms. Dip-to-bite must stay under 1.8s (CLAUDE.md / brief). */
export const T = {
  popRelease: 110,
  popFlight: 420,
  popLand: 160,
  popWobble: 520,
  lift: 180,
  toBowl: 320,
  swipe: 260,
  toMouth: 300,
  bite: 120,
  exit: 220,
  mouthGap: 150,
  reseal: 340,
  refillDrop: 260,
  recolour: 320,
};

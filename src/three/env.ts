/**
 * Studio lighting, built in code: a big warm softbox overhead, two tall strip lights behind
 * (they draw the long highlights down the clear plastic) and a cream bounce from the table.
 * Rendered once into a PMREM environment map; nothing is downloaded.
 */
import { BackSide, BoxGeometry, Color, Mesh, MeshBasicMaterial, PlaneGeometry, PMREMGenerator, Scene, type Texture, type WebGLRenderer } from 'three';

function panel(w: number, h: number, color: Color, x: number, y: number, z: number, lookAt: [number, number, number]) {
  const m = new Mesh(new PlaneGeometry(w, h), new MeshBasicMaterial({ color, side: 2, toneMapped: false }));
  m.position.set(x, y, z);
  m.lookAt(...lookAt);
  return m;
}

export function studioEnvironment(renderer: WebGLRenderer, night = false): Texture {
  const env = new Scene();
  const room = new Mesh(new BoxGeometry(1, 1, 1), new MeshBasicMaterial({ color: night ? new Color(0.05, 0.03, 0.02) : new Color(0.32, 0.27, 0.22), side: BackSide, toneMapped: false }));
  room.scale.set(80, 50, 80);
  room.position.y = 18;
  env.add(room);
  const c = (r: number, g: number, b: number, k: number) => new Color(r, g, b).multiplyScalar(k);
  if (!night) {
    env.add(panel(34, 26, c(1, 0.95, 0.88, 5.2), 0, 30, 2, [0, 0, 0])); // overhead softbox
    env.add(panel(6, 34, c(1, 0.98, 0.95, 3.4), -22, 14, -14, [0, 8, 0])); // strip, back left
    env.add(panel(6, 34, c(1, 0.97, 0.92, 2.6), 22, 14, -16, [0, 8, 0])); // strip, back right
    env.add(panel(30, 14, c(1, 0.9, 0.78, 0.9), 0, 8, 36, [0, 6, 0])); // warm front fill
    env.add(panel(60, 60, c(0.96, 0.9, 0.8, 0.55), 0, -0.5, 0, [0, 10, 0])); // table bounce
    env.add(panel(22, 6, c(1, 0.97, 0.92, 1.1), 4, 12, -30, [4, 2, 4])); // back softbox: a gloss line on the flat dip
  } else {
    // Night shift: one warm lamp, low and to the left, the rest of the room asleep.
    env.add(panel(12, 10, c(1, 0.72, 0.42, 7), -16, 24, 10, [0, 0, 0]));
    env.add(panel(4, 26, c(1, 0.8, 0.6, 1.2), 22, 12, -14, [0, 8, 0]));
    env.add(panel(60, 60, c(0.5, 0.36, 0.24, 0.35), 0, -0.5, 0, [0, 10, 0]));
  }
  const pmrem = new PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  env.traverse((o) => {
    if (o instanceof Mesh) {
      o.geometry.dispose();
      (o.material as MeshBasicMaterial).dispose();
    }
  });
  return tex;
}

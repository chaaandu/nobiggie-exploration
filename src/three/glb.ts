/**
 * Optional: a real model. If public/models/cup.glb exists at build time, its named parts
 * replace the procedural ones. See docs/models.md for the contract (node names, units).
 * Meshopt compression is supported out of the box; Draco needs the decoder in public/draco/.
 */
import type { Group, Mesh, Object3D } from 'three';

export interface GlbParts {
  cup?: Object3D;
  lid?: Object3D;
  dip?: Object3D;
  cookie?: Mesh;
}

export async function loadCupGlb(url: string): Promise<GlbParts> {
  const [{ GLTFLoader }, { MeshoptDecoder }, { DRACOLoader }] = await Promise.all([
    import('three/examples/jsm/loaders/GLTFLoader.js'),
    import('three/examples/jsm/libs/meshopt_decoder.module.js'),
    import('three/examples/jsm/loaders/DRACOLoader.js'),
  ]);
  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  // drei's default fetches the Draco decoder from Google's CDN; we keep it local.
  loader.setDRACOLoader(new DRACOLoader().setDecoderPath('/draco/'));
  const gltf = await loader.loadAsync(url);
  const root: Group = gltf.scene;
  const find = (name: string) => root.getObjectByName(name) ?? undefined;
  let cookie: Mesh | undefined;
  find('Cookie')?.traverse((o) => {
    if (!cookie && (o as Mesh).isMesh) cookie = o as Mesh;
  });
  return { cup: find('Cup'), lid: find('Lid'), dip: find('Dip'), cookie };
}

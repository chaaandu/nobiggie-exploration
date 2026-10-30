# Using a real 3D model (`public/models/cup.glb`)

If `public/models/cup.glb` exists when the site is built, the hero uses its parts instead of
the procedural ones. Anything missing stays procedural.

| Node name | What it is | Notes |
| --- | --- | --- |
| `Cup` | the cup (with its label) | base at the origin, opening facing +Y |
| `Lid` | the dome lid shell | origin at the rim plane, dome pointing +Y |
| `Dip` | the dip inside the dome | same origin as `Lid` |
| `Cookie` | one cookie (first mesh is used) | centred on its own middle, flat faces ±Y, ~3.2 cm wide |

- Units: **centimetres** (cup ≈ 10.5 cm tall, 9.4 cm across the top).
- Keep it under ~1.5 MB. Meshopt compression works out of the box; for Draco, copy
  `node_modules/three/examples/jsm/libs/draco/` to `public/draco/`.
- Materials from the file are used as-is, except cookies keep the procedural shader (so the
  dip coat and bite still work) — only the shape is taken.
- After adding it, run `npm run render` so the poster and 2D version match.

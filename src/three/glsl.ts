/** Small GLSL helpers shared by the procedural materials. */

export const NOISE = /* glsl */ `
float nbHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float nbHash3(vec3 p) {
  p = fract(p * 0.3183099 + 0.1);
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}
float nbNoise(vec3 x) {
  vec3 i = floor(x);
  vec3 f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(nbHash3(i + vec3(0, 0, 0)), nbHash3(i + vec3(1, 0, 0)), f.x),
        mix(nbHash3(i + vec3(0, 1, 0)), nbHash3(i + vec3(1, 1, 0)), f.x), f.y),
    mix(mix(nbHash3(i + vec3(0, 0, 1)), nbHash3(i + vec3(1, 0, 1)), f.x),
        mix(nbHash3(i + vec3(0, 1, 1)), nbHash3(i + vec3(1, 1, 1)), f.x), f.y),
    f.z);
}
float nbFbm(vec3 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 4; i++) {
    v += a * nbNoise(p);
    p = p * 2.03 + 11.7;
    a *= 0.5;
  }
  return v;
}
// Cellular noise: distance to the nearest feature point (F1) and the cell id.
vec2 nbCell(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  float d = 8.0;
  float id = 0.0;
  for (int z = -1; z <= 1; z++)
  for (int y = -1; y <= 1; y++)
  for (int x = -1; x <= 1; x++) {
    vec3 g = vec3(float(x), float(y), float(z));
    vec3 o = vec3(nbHash3(i + g), nbHash3(i + g + 31.7), nbHash3(i + g + 71.3));
    vec3 r = g + o - f;
    float dd = dot(r, r);
    if (dd < d) { d = dd; id = nbHash3(i + g + 5.1); }
  }
  return vec2(sqrt(d), id);
}
`;

/**
 * Bump mapping from a procedural height, after Mikkelsen ("Bump mapping unparametrized
 * surfaces on the GPU"). Same maths as three's perturbNormalArb, without needing a texture.
 */
export const BUMP = /* glsl */ `
vec3 nbPerturb(vec3 surfPos, vec3 surfNorm, vec2 dHdxy, float faceDir) {
  vec3 sx = normalize(dFdx(surfPos));
  vec3 sy = normalize(dFdy(surfPos));
  vec3 r1 = cross(sy, surfNorm);
  vec3 r2 = cross(surfNorm, sx);
  float det = dot(sx, r1) * faceDir;
  vec3 grad = sign(det) * (dHdxy.x * r1 + dHdxy.y * r2);
  return normalize(abs(det) * surfNorm - grad);
}
`;

/**
 * Procedural materials. Everything is computed in the shader: no textures to download, and
 * switching flavour is just a few uniforms.
 */
import {
  AdditiveBlending,
  CanvasTexture,
  Color,
  CustomBlending,
  DataTexture,
  DoubleSide,
  FrontSide,
  BackSide,
  LinearFilter,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OneFactor,
  OneMinusSrcAlphaFactor,
  RedFormat,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
  Vector4,
  type Side,
} from 'three';
import { BUMP, NOISE } from './glsl';
import { COOKIE, CUP } from './spec';

/* ------------------------------------------------------------------ cookies */

export interface CookieUniforms {
  uBase: { value: Color };
  uDark: { value: Color };
  uChunk: { value: Color };
  uChunkStyle: { value: number };
  uDipColor: { value: Color };
  uDipRough: { value: number };
  uCup: { value: Vector2 };
}

/**
 * Per-instance attributes (on the geometry):
 *   aSeed  float  shape + texture variation
 *   aDip   float  0..1 how much of the +x edge is coated in dip
 *   aBite  vec4   x: bite angle, y: bite radius, w: 1 if bitten
 */
export function cookieMaterial(): { material: MeshStandardMaterial; uniforms: CookieUniforms } {
  const uniforms: CookieUniforms = {
    uBase: { value: new Color('#C08A54') },
    uDark: { value: new Color('#8E5A2C') },
    uChunk: { value: new Color('#2A170E') },
    uChunkStyle: { value: 0 },
    uDipColor: { value: new Color('#4A2717') },
    uDipRough: { value: 0.22 },
    uCup: { value: new Vector2(CUP.height, CUP.rTop) },
  };
  const material = new MeshStandardMaterial({ color: '#ffffff', roughness: 0.86, metalness: 0, side: DoubleSide });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        attribute float aSeed;
        attribute float aDip;
        attribute vec4 aBite;
        uniform vec2 uCup;
        varying vec3 vObj;
        varying float vSeed;
        varying float vDip;
        varying vec4 vBite;
        varying float vAO;
        ${NOISE}`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        // No two cookies alike: wobble the edge and the dome per instance.
        float ang = atan(transformed.z, transformed.x);
        float rr = length(transformed.xz);
        float edge = smoothstep(0.35, ${COOKIE.r.toFixed(2)}, rr);
        float wob = 0.075 * sin(3.0 * ang + aSeed) + 0.045 * sin(5.0 * ang + aSeed * 2.1) + 0.025 * sin(9.0 * ang + aSeed * 4.3);
        transformed.xz *= 1.0 + wob * edge;
        transformed.y += (transformed.y > 0.0 ? 1.0 : 0.25) * 0.08 * sin(2.0 * ang + aSeed * 1.7) * (1.0 - edge * 0.6);
        // craggy lumps, mostly on the crown (the fragment shader bumps with the same function)
        float crown = smoothstep(-0.2, 0.45, transformed.y);
        transformed += objectNormal * (nbFbm(transformed * 1.25 + aSeed) - 0.5) * mix(0.06, 0.16, crown);
        vObj = transformed;
        vSeed = aSeed;
        vDip = aDip;
        vBite = aBite;
        // Cookies deep in the cup get less light (a cheap stand-in for ambient occlusion).
        vec4 wp = modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        float inside = step(length(wp.xz), uCup.y + 0.4) * step(wp.y, uCup.x + 0.6);
        vAO = mix(1.0, mix(0.42, 1.0, smoothstep(0.0, uCup.x * 1.02, wp.y)), inside);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        /* glsl */ `#include <common>
        uniform vec3 uBase;
        uniform vec3 uDark;
        uniform vec3 uChunk;
        uniform float uChunkStyle;
        uniform vec3 uDipColor;
        uniform float uDipRough;
        varying vec3 vObj;
        varying float vSeed;
        varying float vDip;
        varying vec4 vBite;
        varying float vAO;
        ${NOISE}
        ${BUMP}`,
      )
      .replace(
        '#include <clipping_planes_fragment>',
        /* glsl */ `#include <clipping_planes_fragment>
        // The bite: three overlapping circles off the dipped edge, with tooth ridges.
        if (vBite.w > 0.5) {
          vec2 q = vObj.xz;
          for (int k = -1; k <= 1; k++) {
            float a = vBite.x + float(k) * 0.43;
            float kk = float(k * k);
            vec2 c = vec2(cos(a), sin(a)) * (${(COOKIE.r * 1.1).toFixed(2)} + 0.06 * kk);
            vec2 dq = q - c;
            float br = vBite.y * (1.0 - 0.14 * kk) + 0.035 * sin(atan(dq.y, dq.x) * 18.0);
            if (length(dq) < br) discard;
          }
        }
        vec3 cp = vObj * 1.6 + vSeed;
        float nb = nbFbm(cp * 1.3);
        float fine = nbNoise(vObj * 9.0 + vSeed);
        float rad = length(vObj.xz);
        float top = smoothstep(-0.1, 0.35, vObj.y);
        // broad cracks across the crown: wide, soft valleys rather than drawn lines
        float rid = 1.0 - abs(nbNoise(cp * 1.9 + 3.1) * 2.0 - 1.0);
        float crack = smoothstep(0.78, 0.97, rid) * top;
        // chunks: warped cells, so they're irregular lumps not dots
        vec3 wp3 = vObj * vec3(1.55, 1.3, 1.55) + vSeed * 0.37 + (nbNoise(vObj * 3.0 + vSeed) - 0.5) * 0.55;
        vec2 cell = nbCell(wp3);
        float chunk = 0.0;
        if (uChunkStyle < 0.5) chunk = smoothstep(0.42, 0.3, cell.x) * step(0.5, cell.y);
        else if (uChunkStyle < 1.5) chunk = smoothstep(0.36, 0.26, cell.x) * step(0.55, cell.y);
        else chunk = smoothstep(0.4, 0.29, cell.x) * step(0.52, cell.y);
        // The coat reaches as far as the cookie went in (~0.95cm of a 1.6cm radius).
        float coatLine = ${COOKIE.r.toFixed(2)} * (1.05 - 0.66 * vDip) + 0.14 * (nbNoise(vec3(vObj.z * 2.8, vObj.y * 2.8, vSeed)) - 0.5);
        float coat = vDip > 0.002 ? smoothstep(coatLine - 0.05, coatLine + 0.05, vObj.x) : 0.0;`,
      )
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        float bake = smoothstep(1.1, 1.7, rad) * 0.5 + (1.0 - top) * 0.25;
        vec3 col = mix(uBase, uDark, clamp(nb * 0.8 + bake - 0.2 + crack * 0.35, 0.0, 1.0));
        col *= 0.92 + 0.16 * fine;
        // sugary highlights on the crown's high points
        col = mix(col, uBase * 1.18, smoothstep(0.62, 0.8, nb) * top * 0.5);
        col = mix(col, uChunk * (0.8 + 0.4 * cell.y), chunk);
        if (!gl_FrontFacing) {
          // Inside the cookie, seen through the bite: softer, crumbier, a touch lighter.
          col = mix(uBase, vec3(1.0, 0.95, 0.88), 0.08) * (0.72 + 0.4 * nbNoise(vObj * 11.0));
          col = mix(col, uChunk, chunk * 0.8);
        }
        col = mix(col, uDipColor * (0.94 + 0.12 * nbNoise(vObj * 6.0)), coat);
        diffuseColor.rgb = col;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.34, chunk * 0.85);
        roughnessFactor = mix(roughnessFactor, uDipRough, coat);
        if (!gl_FrontFacing) roughnessFactor = 1.0;`,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `#include <normal_fragment_maps>
        float hgt = (nbFbm(vObj * 1.25 + vSeed) * 0.16 * mix(0.4, 1.0, top) + fine * 0.012 - crack * 0.05 + chunk * 0.03) * (1.0 - coat * 0.9);
        normal = nbPerturb(-vViewPosition, normal, vec2(dFdx(hgt), dFdy(hgt)), faceDirection);`,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `outgoingLight *= mix(vAO, 1.0, 0.15);
        #include <opaque_fragment>`,
      );
  };
  material.customProgramCacheKey = () => 'nb-cookie';
  return { material, uniforms };
}

/* ------------------------------------------------------------------ clear plastic */

/**
 * Thin clear PET. Real thin plastic barely refracts; what you see is reflections, brighter at
 * glancing angles, and a faint dimming of whatever is behind it. So: no diffuse at all,
 * reflections added on top (premultiplied blending), alpha only from the Fresnel term.
 */
export function plasticMaterial(side: Side, strength = 1): MeshPhysicalMaterial {
  const m = new MeshPhysicalMaterial({
    color: '#000000',
    roughness: 0.05,
    metalness: 0,
    ior: 1.5,
    specularIntensity: 1,
    envMapIntensity: 1.0,
    transparent: true,
    depthWrite: false,
    side,
  });
  m.blending = CustomBlending;
  m.blendSrc = OneFactor;
  m.blendDst = OneMinusSrcAlphaFactor;
  m.blendSrcAlpha = OneFactor;
  m.blendDstAlpha = OneMinusSrcAlphaFactor;
  m.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <opaque_fragment>',
      /* glsl */ `float nv = abs(dot(normalize(normal), normalize(vViewPosition)));
      float fres = pow(1.0 - nv, 3.5);
      float lum = dot(outgoingLight, vec3(0.299, 0.587, 0.114));
      // clear in the middle, a faint grey-white at the edges, highlights on top
      float a = clamp(0.01 + fres * 0.22 + lum * 0.05, 0.0, 0.5) * ${strength.toFixed(2)};
      gl_FragColor = vec4(outgoingLight * ${(0.85 * strength).toFixed(2)}, a);`,
    );
  };
  m.customProgramCacheKey = () => `nb-plastic-${side}-${strength}`;
  return m;
}

export const PLASTIC_SIDES = { back: BackSide, front: FrontSide };

/* ------------------------------------------------------------------ dip */

export function dipMassMaterial(): MeshPhysicalMaterial {
  return new MeshPhysicalMaterial({
    color: '#4A2717',
    roughness: 0.24,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.14,
    envMapIntensity: 0.7,
  });
}

export const MAX_RIPPLES = 6;
export const GROOVE_SIZE = 48;

export interface DipSurfaceUniforms {
  uTime: { value: number };
  uRip: { value: Vector4[] };
  uGroove: { value: DataTexture };
  uRadius: { value: number };
}

/** The open face of the dip: ripples (a ring buffer of impulses) and a swipe groove texture. */
export function dipSurfaceMaterial(radius: number): { material: MeshPhysicalMaterial; uniforms: DipSurfaceUniforms; groove: Uint8Array } {
  const groove = new Uint8Array(GROOVE_SIZE * GROOVE_SIZE);
  const tex = new DataTexture(groove, GROOVE_SIZE, GROOVE_SIZE, RedFormat);
  tex.magFilter = LinearFilter;
  tex.minFilter = LinearFilter;
  tex.needsUpdate = true;
  const uniforms: DipSurfaceUniforms = {
    uTime: { value: 0 },
    uRip: { value: Array.from({ length: MAX_RIPPLES }, () => new Vector4(0, 0, -99, 0)) },
    uGroove: { value: tex },
    uRadius: { value: radius },
  };
  // The open surface: glossy, but no clearcoat (that doubled the sky in it and washed it out).
  const material = new MeshPhysicalMaterial({ color: '#4A2717', roughness: 0.3, metalness: 0, envMapIntensity: 0.32, specularIntensity: 0.8 });
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    const fn = /* glsl */ `
      uniform float uTime;
      uniform vec4 uRip[${MAX_RIPPLES}];
      uniform sampler2D uGroove;
      uniform float uRadius;
      float dipH(vec2 p) {
        float h = 0.0;
        for (int i = 0; i < ${MAX_RIPPLES}; i++) {
          vec4 r = uRip[i];
          float t = uTime - r.z;
          if (t > 0.0 && t < 2.6 && r.w > 0.0) {
            float d = length(p - r.xy);
            float front = t * 7.0;
            float env = exp(-t * 3.4) * smoothstep(front + 0.4, front - 1.6, d);
            h += r.w * env * sin(d * 4.6 - t * 26.0);
          }
        }
        h -= texture2D(uGroove, p / (2.0 * uRadius) + 0.5).r * 0.32;
        return h * smoothstep(uRadius, uRadius * 0.78, length(p));
      }`;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>\n${fn}`)
      .replace(
        '#include <beginnormal_vertex>',
        /* glsl */ `float e = 0.09;
        float hx = dipH(position.xz + vec2(e, 0.0)) - dipH(position.xz - vec2(e, 0.0));
        float hz = dipH(position.xz + vec2(0.0, e)) - dipH(position.xz - vec2(0.0, e));
        vec3 objectNormal = normalize(vec3(-hx / (2.0 * e), 1.0, -hz / (2.0 * e)));
        #ifdef USE_TANGENT
          vec3 objectTangent = vec3(tangent.xyz);
        #endif`,
      )
      .replace(
        '#include <begin_vertex>',
        /* glsl */ `#include <begin_vertex>
        transformed.y += dipH(position.xz);`,
      );
  };
  material.customProgramCacheKey = () => 'nb-dip-surface';
  return { material, uniforms, groove };
}

/* ------------------------------------------------------------------ table */

/**
 * The table is the page: cream, with a soft pool of top light and a hint of grain, fading to
 * fully transparent so the 3D sits in the page with no edge.
 */
export function tableMaterial(): ShaderMaterial {
  return new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uCream: { value: new Color('#F6EFE3') },
      uWarm: { value: new Color('#E9D9BF') },
      uCenter: { value: new Vector2(3.5, 2) },
      uR: { value: 26 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCream;
      uniform vec3 uWarm;
      uniform vec2 uCenter;
      uniform float uR;
      varying vec3 vW;
      ${NOISE}
      void main() {
        vec2 d2 = (vW.xz - uCenter) * vec2(0.8, 1.15);
        float d = length(d2);
        float a = smoothstep(uR, uR * 0.35, d) * 0.9;
        float g = nbNoise(vW * 4.0) * 0.035 + nbNoise(vW * 0.35) * 0.05;
        vec3 c = mix(uCream * 1.015, uWarm, smoothstep(uR * 0.15, uR, d)) * (1.0 - g);
        gl_FragColor = vec4(c, a);
        #include <colorspace_fragment>
        // premultiply after the sRGB conversion, so the faded edge doesn't go grey
        gl_FragColor.rgb *= gl_FragColor.a;
      }`,
    blending: CustomBlending,
    blendSrc: OneFactor,
    blendDst: OneMinusSrcAlphaFactor,
    blendSrcAlpha: OneFactor,
    blendDstAlpha: OneMinusSrcAlphaFactor,
  });
}

/* ------------------------------------------------------------------ shadows */

/** Radial contact shadow: tight dark ring at the footprint, long soft falloff (top light). */
export function shadowTexture(inner = 0.42): CanvasTexture {
  const size = 256;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(0,0,0,0.55)');
  grad.addColorStop(inner * 0.8, 'rgba(0,0,0,0.6)');
  grad.addColorStop(inner, 'rgba(0,0,0,0.42)');
  grad.addColorStop(inner + 0.12, 'rgba(0,0,0,0.16)');
  grad.addColorStop(0.78, 'rgba(0,0,0,0.04)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export function shadowMaterial(tex: CanvasTexture, opacity = 1): MeshBasicMaterial {
  return new MeshBasicMaterial({
    color: '#3B2416',
    alphaMap: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  });
}

/* ------------------------------------------------------------------ crumbs, sticker */

export function crumbMaterial(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0, flatShading: true });
}

export function stickerMaterial(map: CanvasTexture): MeshStandardMaterial {
  return new MeshStandardMaterial({
    map,
    roughness: 0.5,
    metalness: 0,
    transparent: false,
    alphaTest: 0.5,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    side: DoubleSide,
  });
}

/** Little glints for the lid edge on dark nights, used sparingly. */
export const glowBlending = AdditiveBlending;

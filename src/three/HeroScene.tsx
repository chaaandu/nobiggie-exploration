/**
 * React Three Fiber hosts the scene: the canvas, the render loop (on demand: an idle cup
 * draws nothing), resizing and pixel ratio. The scene itself lives in Director.
 */
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef, useState } from 'react';
import { NeutralToneMapping, type Scene, type WebGLRenderer } from 'three';
import type { Director } from './director';

interface Props {
  director: Director;
  maxDpr: number;
  onFirstFrame: () => void;
  onError: (e: unknown) => void;
}

function Driver({ director, onFirstFrame, maxDpr }: Pick<Props, 'director' | 'onFirstFrame' | 'maxDpr'>) {
  const { size, invalidate, setDpr } = useThree();
  const first = useRef(true);
  const perf = useRef({ n: 0, sum: 0, last: 0, dpr: maxDpr });

  useEffect(() => {
    director.wake = invalidate;
    return () => {
      director.wake = () => {};
    };
  }, [director, invalidate]);

  useEffect(() => {
    director.resize(size.width, size.height);
    invalidate();
  }, [director, size.width, size.height, invalidate]);

  useFrame(() => {
    const active = director.update();
    if (first.current) {
      first.current = false;
      // the frame is drawn after this callback; report once it's actually on screen
      requestAnimationFrame(() => onFirstFrame());
    }
    // Adaptive pixel ratio: if animated frames run slow, step the resolution down a notch.
    const t = performance.now();
    const p = perf.current;
    if (active && p.last && t - p.last < 200) {
      p.sum += t - p.last;
      p.n++;
      if (p.n === 40) {
        const avg = p.sum / p.n;
        if (avg > 24 && p.dpr > 1) {
          p.dpr = Math.max(1, p.dpr - 0.5);
          setDpr(p.dpr);
        }
        p.n = 0;
        p.sum = 0;
      }
    }
    p.last = t;
    if (active) invalidate();
  });

  return <primitive object={director.root} />;
}

export function HeroScene({ director, maxDpr, onFirstFrame, onError }: Props) {
  const [built, setBuilt] = useState(false);
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, maxDpr]}
      camera={Object.assign(director.camera, { manual: true })}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', preserveDrawingBuffer: false }}
      style={{ width: '100%', height: '100%', display: 'block' }}
      onCreated={({ gl, scene, camera }) => {
        const renderer = gl as WebGLRenderer;
        renderer.toneMapping = NeutralToneMapping;
        renderer.toneMappingExposure = 1;
        renderer.setClearColor(0x000000, 0);
        director
          .build(renderer, scene as Scene)
          .then(async () => {
            // Compile every shader before the first frame, so the first tap doesn't stutter.
            scene.add(director.root);
            await renderer.compileAsync(scene, camera);
            scene.remove(director.root);
            setBuilt(true);
          })
          .catch(onError);
      }}
    >
      {built && <Driver director={director} onFirstFrame={onFirstFrame} maxDpr={maxDpr} />}
    </Canvas>
  );
}

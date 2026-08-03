"use client";

import { useEffect, useRef } from "react";
import { GRAIN_INTENSITY, GRAIN_SCALE, SPARKLE_NOISE_GLSL } from "@/components/ui/filmGrain";

// The landing page's atmosphere, mounted once behind the whole page.
//
// This is the hero's film grain, lifted out of WaveField's post-processing
// stack and given its own full-viewport pass so the same animated texture runs
// from the top of the page to the footer. WaveField no longer grains its own
// output — there is exactly one noise implementation and one canvas for it.
//
// The canvas is fixed to the viewport rather than sized to the document: the
// grain is uniform, so a viewport-sized pass looks identical to a page-sized
// one and costs a constant amount no matter how long the page gets.

const VERT = `
  attribute vec2 aPos;
  void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

// Same sampling and amplitude as the hero used: gl_FragCoord * 0.5 * scale,
// amplitude intensity * 0.1. The scene is composited underneath rather than
// sampled, so a positive sample lightens and a negative one darkens, which is
// what adding the noise to a near-black canvas did.
const FRAG = `
  precision mediump float;
  uniform float time;
  uniform float intensity;
  uniform float grainScale;

  ${SPARKLE_NOISE_GLSL}

  void main() {
    vec2 pos = gl_FragCoord.xy * 0.5 * grainScale;
    float noise = sparkleNoise(pos) * 2.0 - 1.0;
    float a = abs(noise) * intensity * 0.1;
    // The canvas composites with premultiplied alpha, so the colour has to be
    // scaled by it — emitting full white at a low alpha reads as blown out.
    gl_FragColor = vec4(vec3(step(0.0, noise)) * a, a);
  }
`;

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

export function GrainField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext("webgl", { alpha: true, antialias: false, depth: false });
    if (!gl) return;

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    const program = gl.createProgram();
    if (!vs || !fs || !program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;
    gl.useProgram(program);

    // One full-screen triangle.
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uTime = gl.getUniformLocation(program, "time");
    const uIntensity = gl.getUniformLocation(program, "intensity");
    const uScale = gl.getUniformLocation(program, "grainScale");
    gl.uniform1f(uScale, GRAIN_SCALE);

    // The hero's composer renders at a pixel ratio of 1, so matching that here
    // keeps the grain cells exactly the same size across the boundary.
    const resize = () => {
      const w = Math.max(1, Math.floor(window.innerWidth));
      const h = Math.max(1, Math.floor(window.innerHeight));
      if (canvas.width === w && canvas.height === h) return;
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    };
    resize();

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    // Deeper into the page the atmosphere quietens, but it never stops: the
    // floor keeps the lower landing alive rather than frozen.
    let depth = 0;
    const readDepth = () => {
      const span = window.innerHeight * 2;
      depth = span > 0 ? Math.min(1, window.scrollY / span) : 0;
    };
    readDepth();

    let raf = 0;
    let last = performance.now();
    let time = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      // Same rate WaveField advanced its grain uniform by.
      if (!reduceMotion.matches) time += dt * 0.2;

      gl.uniform1f(uTime, time);
      gl.uniform1f(uIntensity, GRAIN_INTENSITY * (1 - 0.55 * depth));
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    };

    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };

    const onVisibility = () => (document.hidden ? stop() : start());

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("scroll", readDepth, { passive: true });
    document.addEventListener("visibilitychange", onVisibility);
    start();

    return () => {
      stop();
      window.removeEventListener("resize", resize);
      window.removeEventListener("scroll", readDepth);
      document.removeEventListener("visibilitychange", onVisibility);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden />;
}

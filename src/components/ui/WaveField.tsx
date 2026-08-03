"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import gsap from "gsap";
import { WAVE_COLOR, WAVE_EMISSIVE } from "@/components/ui/waveLight";

export interface WaveFieldProps {
  className?: string;
  /** Extends the bar field this far past the left edge, in px. */
  extendLeftPx?: number;
  /** Bar glow color, e.g. "hsl(220,100%,50%)". */
  color?: string;
  emissive?: string;
}

// A pure WebGL background layer: a field of instanced bars animated by a
// GSAP keyframe timeline (two overlapping sine waves), with a mouse-reactive
// glow accumulator and bloom. The film grain that used to sit on top of this
// pass now lives in GrainField, one layer behind the entire landing. No
// content of its own — callers layer real UI over it. Adapted from a supplied
// component: the demo's own fake prompt form, typing-placeholder animation,
// and navbar have been removed, since the real composer and nav live outside
// this layer.
export function WaveField({ className, extendLeftPx = 320, color = WAVE_COLOR, emissive = WAVE_EMISSIVE }: WaveFieldProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const waveContainer = containerRef.current;
    if (!waveContainer) return;

    // Grain is no longer part of this pass. It lives in GrainField, one
    // full-viewport layer behind the whole landing, so the same animated
    // texture runs past the hero instead of stopping at its edge.

    // --- Wave State & Keyframes ---
    const wave1 = { gain: 10, frequency: 0, waveLength: 0.5, currentAngle: 0 };
    const wave2 = { gain: 0, frequency: 0, waveLength: 0.5, currentAngle: 0 };

    const waveKeyframes1 = [
      { time: 0, gain: 10, frequency: 0, waveLength: 0.5 },
      { time: 4, gain: 300, frequency: 1, waveLength: 0.5 },
      { time: 6, gain: 300, frequency: 4, waveLength: Math.PI * 1.5 },
      { time: 8, gain: 225, frequency: 4, waveLength: Math.PI * 1.5 },
      { time: 10, gain: 500, frequency: 1, waveLength: Math.PI * 1.5 },
      { time: 14, gain: 225, frequency: 3, waveLength: Math.PI * 1.5 },
      { time: 22, gain: 100, frequency: 6, waveLength: Math.PI * 1.5 },
      { time: 28, gain: 0, frequency: 0.9, waveLength: 0.5 },
      { time: 30, gain: 128, frequency: 0.9, waveLength: 0.5 },
      { time: 32, gain: 190, frequency: 1.42, waveLength: 0.5 },
      { time: 39, gain: 499, frequency: 4.0, waveLength: Math.PI * 1.5 },
      { time: 40, gain: 500, frequency: 4.0, waveLength: Math.PI * 1.5 },
      { time: 42, gain: 400, frequency: 2.82, waveLength: Math.PI * 1.5 },
      { time: 44, gain: 327, frequency: 2.56, waveLength: Math.PI * 1.5 },
      { time: 48, gain: 188, frequency: 5.4, waveLength: 0.5 },
      { time: 52, gain: 32, frequency: 0.1, waveLength: 0.5 },
      { time: 55, gain: 10, frequency: 0, waveLength: 0.5 },
    ];

    const waveKeyframes2 = [
      { time: 0, gain: 0, frequency: 0, waveLength: 0.5 },
      { time: 9, gain: 0, frequency: 0, waveLength: 0.5 },
      { time: 10, gain: 400, frequency: 1, waveLength: 0.5 },
      { time: 13, gain: 300, frequency: 4, waveLength: Math.PI * 1.5 },
      { time: 24, gain: 96, frequency: 2, waveLength: 0.5 },
      { time: 28, gain: 0, frequency: 0.9, waveLength: 0.5 },
      { time: 30, gain: 142, frequency: 0.9, waveLength: 0.5 },
      { time: 36, gain: 374, frequency: 4.0, waveLength: Math.PI * 1.5 },
      { time: 38, gain: 375, frequency: 4.0, waveLength: Math.PI * 1.5 },
      { time: 40, gain: 300, frequency: 2.26, waveLength: Math.PI * 1.5 },
      { time: 44, gain: 245, frequency: 2.05, waveLength: Math.PI * 1.5 },
      { time: 48, gain: 141, frequency: 5.12, waveLength: 0.5 },
      { time: 52, gain: 24, frequency: 0.08, waveLength: 0.5 },
      { time: 55, gain: 8, frequency: 0, waveLength: 0.5 },
    ];

    // --- Mouse & Glow Config ---
    const mouse = { x: 0, y: 0, active: false };
    let proxyMouseX = 0;
    let proxyMouseY = 0;
    let proxyInitialized = false;

    const glowConfig = {
      maxGlowDistance: 690,
      speedScale: 0.52,
      glowFalloff: 0.6,
      mouseSmoothing: 30.0,
    };

    const glowDynamics = {
      accumEase: 1.5,
      decay: 3.3,
      max: 40.0,
      speedEase: 8.5,
    };

    // --- THREE.js Setup ---
    let DPR_CAP = 2;
    const mm = gsap.matchMedia();
    mm.add("(max-resolution: 180dpi)", () => {
      DPR_CAP = 1.5;
    });
    const EFFECT_PR = Math.min(window.devicePixelRatio, DPR_CAP) * 0.5;

    while (waveContainer.firstChild) {
      waveContainer.removeChild(waveContainer.firstChild);
    }
    const waveRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: true });
    waveRenderer.setPixelRatio(EFFECT_PR);
    waveRenderer.toneMapping = THREE.ACESFilmicToneMapping;
    waveRenderer.toneMappingExposure = 1.0;
    waveRenderer.autoClear = false;
    waveContainer.appendChild(waveRenderer.domElement);

    const waveScene = new THREE.Scene();
    waveScene.add(new THREE.AmbientLight(0xffffff, 0.2));

    let waveCamera: THREE.OrthographicCamera;
    let waveComposer: EffectComposer;
    let waveBloomPass: UnrealBloomPass;
    let cameraWidth = 0;
    let cameraHeight = 0;
    let waveCameraInitialized = false;

    let setMouseNDC: (v: number) => void;
    let setSmoothSpeed: (v: number) => void;
    let setPhase1: (v: number) => void;
    let setPhase2: (v: number) => void;

    // --- Bar Instancing ---
    const MAX_BARS = 256;
    const FIXED_BAR_WIDTH = 14;
    const FIXED_BAR_GAP = 10;
    const EXTEND_LEFT_PX = extendLeftPx;

    let instancedBars: THREE.InstancedMesh | null = null;
    let currentBarCount = 0;
    let barMaterial: THREE.ShaderMaterial;
    let barCenters: Float32Array | null = null;

    function updateGlowDistance() {
      if (!barMaterial) return;
      const totalWidth = currentBarCount * (FIXED_BAR_WIDTH + FIXED_BAR_GAP) - FIXED_BAR_GAP;
      const spanPx = totalWidth * 0.3;
      glowConfig.maxGlowDistance = spanPx;
      barMaterial.uniforms.uMaxGlowDist.value = spanPx;
    }

    function createInstancedMaterial() {
      const baseCol = new THREE.Color(color);
      const emisCol = new THREE.Color(emissive);

      return new THREE.ShaderMaterial({
        defines: { USE_INSTANCING: "" },
        uniforms: {
          uMouseClipX: { value: 0 },
          uHalfW: { value: 0 },
          uMaxGlowDist: { value: glowConfig.maxGlowDistance },
          uGlowFalloff: { value: glowConfig.glowFalloff },
          uGainMul: { value: 1 },
          uBaseY: { value: 0 },
          w1Gain: { value: wave1.gain },
          w1Len: { value: wave1.waveLength },
          w1Phase: { value: 0 },
          w2Gain: { value: wave2.gain },
          w2Len: { value: wave2.waveLength },
          w2Phase: { value: 0 },
          uFixedTipPx: { value: 10 },
          uMinBottomWidthPx: { value: 0 },
          uColor: { value: baseCol },
          uEmissive: { value: emisCol },
          uBaseEmissive: { value: 0.05 },
          uRotationAngle: { value: THREE.MathUtils.degToRad(23.4) },
        },
        vertexShader: `
          attribute float aXPos, aPosNorm, aGroup, aGlow;
          uniform float uGainMul, uBaseY;
          uniform float w1Gain, w1Len, w1Phase;
          uniform float w2Gain, w2Len, w2Phase;
          uniform float uRotationAngle;
          varying float vGlow, vPulse, vHeight;
          varying vec2 vUv;

          float sineH(float g, float len, float ph, float t){
            return max(20.0, (sin(ph + t * len) * 0.5 + 0.6) * g * uGainMul);
          }

          void main(){
            vUv = uv;
            float h1 = sineH(w1Gain, w1Len, w1Phase, aPosNorm);
            float h2 = sineH(w2Gain, w2Len, w2Phase, aPosNorm);
            vHeight = mix(h1, h2, aGroup);

            vec3 pos = position;
            pos.x += aXPos;
            pos.y = 0.0;

            float height = vHeight * uv.y;
            pos.x += height * tan(uRotationAngle);
            pos.y += height;
            pos.y += uBaseY;

            vGlow  = aGlow;
            vPulse = 0.0;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `,
        fragmentShader: `
          #ifdef GL_ES
            precision highp int;
            precision mediump float;
          #else
            precision mediump float;
          #endif
          uniform vec3 uColor, uEmissive;
          uniform float uBaseEmissive;
          uniform float uFixedTipPx, uMinBottomWidthPx;
          varying float vGlow, vPulse, vHeight;
          varying vec2 vUv;

          void main(){
            float tipProp = clamp(uFixedTipPx / vHeight, 0.0, 0.95);
            float transitionY = 1.0 - tipProp;
            float xFromCenter = abs(vUv.x - 0.5) * 2.0;
            float px = fwidth(vUv.x);
            float allowedWidth;

            if (vUv.y >= transitionY){
              float topPos = (vUv.y - transitionY) / tipProp;
              allowedWidth = 1.0 - pow(topPos, 0.9);
            } else {
              float bottomPos = vUv.y / transitionY;
              allowedWidth = max(uMinBottomWidthPx * px * 10.0, pow(bottomPos, 0.5));
            }

            float alpha = smoothstep(-px, px, allowedWidth - xFromCenter);
            if (alpha < 0.01) discard;

            float emissiveStrength = uBaseEmissive + vGlow * 0.9 + vPulse * 0.15;
            vec3 finalColor = uColor + uEmissive * emissiveStrength;
            gl_FragColor = vec4(finalColor, 0.35 * alpha);
          }
        `,
        side: THREE.FrontSide,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      });
    }

    function setupQuickSetters() {
      const u = (instancedBars!.material as THREE.ShaderMaterial).uniforms;
      setMouseNDC = gsap.quickSetter(u.uMouseClipX, "value") as (v: number) => void;
      setSmoothSpeed = () => {};
      setPhase1 = gsap.quickSetter(u.w1Phase, "value") as (v: number) => void;
      setPhase2 = gsap.quickSetter(u.w2Phase, "value") as (v: number) => void;
    }

    const MAX_KEYFRAME_GAIN = 500;
    const SCREEN_COVERAGE = 0.6;
    function updateGainMultiplier() {
      if (!barMaterial) return;
      const targetPx = cameraHeight * SCREEN_COVERAGE;
      barMaterial.uniforms.uGainMul.value = targetPx / MAX_KEYFRAME_GAIN;
    }

    function setupPointerTracking() {
      const el = waveRenderer.domElement;
      const readCoords = (e: PointerEvent | TouchEvent): { x: number; y: number } => {
        if ("clientX" in e) return { x: e.clientX, y: e.clientY };
        const t = e.touches?.[0] || e.changedTouches?.[0];
        return t ? { x: t.clientX, y: t.clientY } : { x: mouse.x, y: mouse.y };
      };
      const updatePos = (e: PointerEvent | TouchEvent, active: boolean) => {
        const { x, y } = readCoords(e);
        const r = rect;
        mouse.x = x - r.left;
        mouse.y = y - r.top;
        mouse.active = active;
        if (!proxyInitialized) {
          proxyMouseX = mouse.x;
          proxyMouseY = mouse.y;
          proxyInitialized = true;
        }
      };
      const activate = (e: PointerEvent | TouchEvent) => updatePos(e, true);
      const move = (e: PointerEvent | TouchEvent) => updatePos(e, true);
      const deactivate = () => {
        mouse.active = false;
      };

      el.addEventListener("pointerdown", activate, { passive: true });
      el.addEventListener("pointermove", move, { passive: true });
      window.addEventListener("pointerup", deactivate, { passive: true });
      el.addEventListener("pointerleave", deactivate, { passive: true });
      el.addEventListener("touchstart", activate, { passive: true });
      el.addEventListener("touchmove", move, { passive: true });
      window.addEventListener("touchend", deactivate, { passive: true });
      window.addEventListener("touchcancel", deactivate, { passive: true });

      listeners.push(() => {
        el.removeEventListener("pointerdown", activate);
        el.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", deactivate);
        el.removeEventListener("pointerleave", deactivate);
        el.removeEventListener("touchstart", activate);
        el.removeEventListener("touchmove", move);
        window.removeEventListener("touchend", deactivate);
        window.removeEventListener("touchcancel", deactivate);
      });
    }

    function accumulateGlow(dt: number) {
      if (!instancedBars) return;
      const attr = instancedBars.geometry.getAttribute("aGlow") as THREE.InstancedBufferAttribute;
      const arr = attr.array as Float32Array;

      const mouseWorldX = proxyMouseX - cameraWidth * 0.5;
      const mDist = glowConfig.maxGlowDistance;
      const fall = glowConfig.glowFalloff;

      const decayLerp = 1.0 - Math.exp(-glowDynamics.decay * dt);
      const addEase = 1.0 - Math.exp(-glowDynamics.accumEase * dt);
      const vmax = glowDynamics.max;

      for (let i = 0; i < currentBarCount; i++) {
        const dx = Math.abs(mouseWorldX - (barCenters as Float32Array)[i]);
        const hit = dx < mDist ? 1.0 - (dx / mDist) ** fall : 0.0;
        const targetAdd = hit * smoothSpeed;
        const add = targetAdd * addEase;
        let g = arr[i] + add - arr[i] * decayLerp;
        if (g > vmax) g = vmax;
        arr[i] = arr[i + currentBarCount] = g;
      }
      attr.needsUpdate = true;
    }

    function createInstancedBars() {
      if (instancedBars) {
        waveScene.remove(instancedBars);
        instancedBars.geometry.dispose();
        (instancedBars.material as THREE.ShaderMaterial).dispose();
        instancedBars = null;
      }

      const waveWidth = cameraWidth;
      const span = waveWidth + EXTEND_LEFT_PX;
      const barCount = Math.min(MAX_BARS, Math.max(1, Math.floor((span + FIXED_BAR_GAP) / (FIXED_BAR_WIDTH + FIXED_BAR_GAP))));
      const gap = barCount > 1 ? (span - barCount * FIXED_BAR_WIDTH) / (barCount - 1) : 0;
      currentBarCount = barCount;

      const startX = -waveWidth / 2 - EXTEND_LEFT_PX;
      const instCnt = barCount * 2;
      barCenters = new Float32Array(barCount);

      const aXPos = new Float32Array(instCnt);
      const aPosNorm = new Float32Array(instCnt);
      const aGroup = new Float32Array(instCnt);
      const aGlow = new Float32Array(instCnt).fill(0);

      for (let i = 0; i < barCount; i++) {
        const x = startX + FIXED_BAR_WIDTH / 2 + i * (FIXED_BAR_WIDTH + gap);
        barCenters[i] = x;
        const t = barCount > 1 ? i / (barCount - 1) : 0;
        aXPos[i] = x;
        aXPos[i + barCount] = x;
        aPosNorm[i] = t;
        aPosNorm[i + barCount] = t;
        aGroup[i] = 0;
        aGroup[i + barCount] = 1;
      }

      const geo = new THREE.PlaneGeometry(FIXED_BAR_WIDTH, 1, 1, 1);
      geo.translate(0, 0.5, 0);
      geo.setAttribute("aXPos", new THREE.InstancedBufferAttribute(aXPos, 1));
      geo.setAttribute("aPosNorm", new THREE.InstancedBufferAttribute(aPosNorm, 1));
      geo.setAttribute("aGroup", new THREE.InstancedBufferAttribute(aGroup, 1));
      geo.setAttribute("aGlow", new THREE.InstancedBufferAttribute(aGlow, 1).setUsage(THREE.DynamicDrawUsage));

      barMaterial = createInstancedMaterial();
      instancedBars = new THREE.InstancedMesh(geo, barMaterial, instCnt);
      instancedBars.frustumCulled = false;
      waveScene.add(instancedBars);

      setupQuickSetters();
      updateGlowDistance();
    }

    function buildKeyframeTweens(target: typeof wave1, keyframes: typeof waveKeyframes1) {
      const tl = gsap.timeline();
      for (let i = 0; i < keyframes.length - 1; i++) {
        const cur = keyframes[i];
        const nxt = keyframes[i + 1];
        tl.to(
          target,
          { gain: nxt.gain, frequency: nxt.frequency, waveLength: nxt.waveLength, duration: nxt.time - cur.time, ease: "power2.inOut" },
          cur.time
        );
      }
      return tl;
    }

    function initWaveThree() {
      cameraWidth = waveContainer!.clientWidth;
      cameraHeight = waveContainer!.clientHeight;
      waveCamera = new THREE.OrthographicCamera(-cameraWidth / 2, cameraWidth / 2, cameraHeight / 2, -cameraHeight / 2, -1000, 1000);
      waveCamera.position.z = 10;
      waveCamera.lookAt(0, 0, 0);

      waveRenderer.setSize(cameraWidth, cameraHeight);
      waveComposer = new EffectComposer(waveRenderer);
      waveComposer.setPixelRatio(EFFECT_PR);
      waveComposer.addPass(new RenderPass(waveScene, waveCamera));

      waveBloomPass = new UnrealBloomPass(new THREE.Vector2(cameraWidth, cameraHeight), 1.0, 0.68, 0.0);
      waveBloomPass.resolution.set(cameraWidth * 0.5, cameraHeight * 0.5);
      waveComposer.addPass(waveBloomPass);

      createInstancedBars();
      setupPointerTracking();
      updateGainMultiplier();
      waveCameraInitialized = true;
    }

    function showScene() {
      if (!waveCameraInitialized) {
        initWaveThree();
        onResize(waveContainer!.clientWidth, waveContainer!.clientHeight);
      }
      const canvas = waveContainer!.querySelector("canvas");
      if (canvas) gsap.to(canvas, { opacity: 1, duration: 1, ease: "power2.out" });
    }

    let pendingW = 0;
    let pendingH = 0;
    let heavyResizeTimer: ReturnType<typeof setTimeout> | null = null;

    function onResize(newW: number, newH: number) {
      if (!waveCameraInitialized) return;
      pendingW = newW;
      pendingH = newH;
      cameraWidth = newW;
      cameraHeight = newH;
      waveCamera.left = -cameraWidth / 2;
      waveCamera.right = cameraWidth / 2;
      waveCamera.top = cameraHeight / 2;
      waveCamera.bottom = -cameraHeight / 2;
      waveCamera.updateProjectionMatrix();

      const span = cameraWidth + EXTEND_LEFT_PX;
      const barCount = Math.min(MAX_BARS, Math.max(1, Math.floor((span + FIXED_BAR_GAP) / (FIXED_BAR_WIDTH + FIXED_BAR_GAP))));

      if (barCount !== currentBarCount) {
        currentBarCount = barCount;
        createInstancedBars();
      } else {
        const gap = barCount > 1 ? (span - barCount * FIXED_BAR_WIDTH) / (barCount - 1) : 0;
        const startX = -cameraWidth / 2 - EXTEND_LEFT_PX;
        const aX = instancedBars!.geometry.getAttribute("aXPos") as THREE.InstancedBufferAttribute;
        const aT = instancedBars!.geometry.getAttribute("aPosNorm") as THREE.InstancedBufferAttribute;
        for (let i = 0; i < barCount; i++) {
          const x = startX + FIXED_BAR_WIDTH / 2 + i * (FIXED_BAR_WIDTH + gap);
          const t = barCount > 1 ? i / (barCount - 1) : 0;
          (aX.array as Float32Array)[i] = (aX.array as Float32Array)[i + barCount] = x;
          (aT.array as Float32Array)[i] = (aT.array as Float32Array)[i + barCount] = t;
        }
        aX.needsUpdate = true;
        aT.needsUpdate = true;
      }

      barMaterial.uniforms.uHalfW.value = cameraWidth * 0.5;
      updateGainMultiplier();
      updateGlowDistance();

      if (heavyResizeTimer) clearTimeout(heavyResizeTimer);
      heavyResizeTimer = setTimeout(applyHeavyResize, 10);
      rect = waveRenderer.domElement.getBoundingClientRect();
    }

    function applyHeavyResize() {
      heavyResizeTimer = null;
      waveRenderer.setPixelRatio(EFFECT_PR);
      waveRenderer.setSize(pendingW, pendingH);
      waveComposer.setSize(pendingW, pendingH);
      waveBloomPass?.setSize(pendingW, pendingH);
    }

    function disposeWaveScene() {
      gsap.globalTimeline.clear();
      waveScene.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        if (mesh.isMesh) {
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) mesh.material.forEach((m) => m.dispose());
          else (mesh.material as THREE.Material)?.dispose();
        }
      });
      waveBloomPass?.dispose?.();
      waveComposer?.dispose?.();
      waveRenderer?.dispose?.();
      instancedBars = null;
    }

    const listeners: Array<() => void> = [];
    let smoothSpeed = 0;
    let rect = waveRenderer.domElement.getBoundingClientRect();

    const ticker = () => {
      if (!waveCameraInitialized || !instancedBars) return;
      const dt = gsap.ticker.deltaRatio() * (1 / 60);

      wave1.currentAngle = (wave1.currentAngle + wave1.frequency * dt) % (Math.PI * 2);
      wave2.currentAngle = (wave2.currentAngle + wave2.frequency * dt) % (Math.PI * 2);
      setPhase1(wave1.currentAngle);
      setPhase2(wave2.currentAngle);

      const kMouse = 1.0 - Math.exp(-glowConfig.mouseSmoothing * dt);
      proxyMouseX += (mouse.x - proxyMouseX) * kMouse;
      proxyMouseY += (mouse.y - proxyMouseY) * kMouse;

      const dx = mouse.active ? mouse.x - proxyMouseX : 0;
      const dy = mouse.active ? mouse.y - proxyMouseY : 0;
      const rawSpeed = Math.hypot(dx, dy * 0.1) * glowConfig.speedScale;
      const kSpeed = 1.0 - Math.exp(-glowDynamics.speedEase * dt);
      smoothSpeed += (rawSpeed - smoothSpeed) * kSpeed;
      setSmoothSpeed(smoothSpeed);

      const u = (instancedBars.material as THREE.ShaderMaterial).uniforms;
      u.w1Gain.value = wave1.gain;
      u.w1Len.value = wave1.waveLength;
      u.w2Gain.value = wave2.gain;
      u.w2Len.value = wave2.waveLength;

      setMouseNDC((proxyMouseX / cameraWidth) * 2 - 1);
      const baseOffset = window.innerWidth < 768 ? 20 : 40;
      u.uBaseY.value = -cameraHeight * 0.5 + baseOffset;

      accumulateGlow(dt);
      waveComposer.render();
    };

    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        if (e.target === waveContainer) onResize(e.contentRect.width, e.contentRect.height);
      }
    });

    const mainTimeline = gsap.timeline({ repeat: -1, onStart: showScene });
    mainTimeline.add(buildKeyframeTweens(wave1, waveKeyframes1), 0);
    mainTimeline.add(buildKeyframeTweens(wave2, waveKeyframes2), 0);
    mainTimeline.play(0);

    gsap.ticker.add(ticker);
    ro.observe(waveContainer);
    listeners.push(() => gsap.ticker.remove(ticker));
    listeners.push(() => ro.disconnect());

    const onVisibility = () => {
      if (document.hidden) gsap.globalTimeline.pause();
      else gsap.globalTimeline.resume();
    };
    document.addEventListener("visibilitychange", onVisibility);
    listeners.push(() => document.removeEventListener("visibilitychange", onVisibility));

    return () => {
      listeners.forEach((fn) => fn());
      try {
        disposeWaveScene();
      } catch {
        // best-effort teardown
      }
      try {
        const canvas = waveRenderer.domElement;
        if (canvas && canvas.parentElement === waveContainer) waveContainer.removeChild(canvas);
      } catch {
        // best-effort teardown
      }
    };
  }, [color, emissive, extendLeftPx]);

  return <div ref={containerRef} className={className} aria-hidden />;
}

"use client";

import styles from "./ProductFlowMotion.module.css";

/**
 * The product-generation motion, as a pure function of time.
 *
 * Nothing here holds state or runs a clock, and no CSS transition drives any
 * value — every position, size and opacity is computed from `time` alone. That
 * is what makes the timeline deterministic: scrubbing to 7.312s and stepping
 * frame-by-frame for a 25fps export produce exactly the same picture as playing
 * to that moment, because there is no in-flight interpolation to be caught
 * halfway.
 *
 * Geometry is expressed in percentages of the frame, so the same component
 * renders identically at the landing's 652px and at a 1920px export.
 */

export const TOTAL_DURATION = 15;

/** Adjustable with the landing's STEP_BOUNDS — 30% / 70% is the shared seam. */
export const PHASES = [
  { label: "Start with an idea", start: 0, end: 4.5 },
  { label: "Watch it come to life", start: 4.5, end: 10.5 },
  { label: "Refine and evolve", start: 10.5, end: 15 },
] as const;

export function phaseAt(time: number) {
  const index = PHASES.findIndex((phase) => time >= phase.start && time < phase.end);
  return index === -1 ? PHASES.length - 1 : index;
}

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);
/** Normalized progress across a segment, flat outside it. */
const seg = (time: number, start: number, end: number) => clamp01((time - start) / (end - start));
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
const mix = (a: number, b: number, x: number) => a + (b - a) * x;
/** Rises and falls once over the segment — used for pulses, so nothing blinks. */
const swell = (x: number) => Math.sin(Math.PI * clamp01(x));

interface ProductFlowMotionProps {
  /** Seconds into the loop, 0 to TOTAL_DURATION. */
  time: number;
  className?: string;
}

export function ProductFlowMotion({ time, className }: ProductFlowMotionProps) {
  // ── Phase 1 — the composer ────────────────────────────────────────────────
  const composerIn = easeOut(seg(time, 0.6, 1.4));
  const composerOut = easeInOut(seg(time, 3.5, 4.5));
  const composerOpacity = composerIn * (1 - composerOut);
  const composerScale = mix(1, 0.92, composerOut);
  const composerLift = mix(0, -7, composerOut);
  const submitOn = easeOut(seg(time, 3.1, 3.5));
  const submitRing = swell(seg(time, 3.2, 3.9));

  // ── Phase 2 — the product assembles, top down ─────────────────────────────
  const canvasIn = easeOut(seg(time, 4.5, 5.2));
  const canvasOut = easeInOut(seg(time, 14.4, 15));
  const canvasOpacity = canvasIn * (1 - canvasOut);
  const borderLit = swell(seg(time, 4.6, 6.0));
  const navIn = easeOut(seg(time, 5.1, 5.6));
  const heroIn = easeOut(seg(time, 5.6, 6.8));
  const ctaIn = easeOut(seg(time, 7.5, 8.1));
  // One pass, then it is done — nothing shimmers after generation finishes.
  const shimmer = seg(time, 9.0, 9.8);
  const shimmerOn = shimmer > 0 && shimmer < 1;

  // ── Phase 3 — it becomes better ───────────────────────────────────────────
  const focusPulse = swell(seg(time, 10.5, 11.3));
  const relayout = easeInOut(seg(time, 11.1, 12.3));
  const supportIn = easeOut(seg(time, 12.2, 12.9));
  const ctaPulse = swell(seg(time, 12.9, 13.6));
  const ctaStrong = easeOut(seg(time, 12.9, 13.6));

  // Two content regions become three: the pair narrows and the third fades up
  // in the space that opens. A layout change, not a cross-fade of screenshots.
  const cardWidth = mix(45, 29.5, relayout);
  const card2Left = mix(52, 35.25, relayout);
  const card3Opacity = clamp01((relayout - 0.45) / 0.55);

  return (
    <div className={`${styles.frame} ${className ?? ""}`} data-testid="product-flow-frame">
      {/* Phase 1 — a compact composer, echoing the real one in shape only */}
      <div
        className={styles.composer}
        style={{
          opacity: composerOpacity,
          transform: `translate(-50%, calc(-50% + ${composerLift}%)) scale(${composerScale})`,
        }}
      >
        {[0, 1, 2].map((index) => {
          const line = easeOut(seg(time, 1.3 + index * 0.6, 1.8 + index * 0.6));
          const widths = [72, 58, 38];
          return (
            <span
              key={index}
              className={styles.promptLine}
              style={{ opacity: line, width: `${widths[index] * line}%` }}
            />
          );
        })}
        <span className={styles.submit} style={{ opacity: mix(0.35, 1, submitOn) }}>
          <span className={styles.submitRing} style={{ opacity: submitRing * 0.5, transform: `scale(${mix(1, 1.8, submitRing)})` }} />
        </span>
      </div>

      {/* Phases 2 & 3 — the generated product */}
      <div
        className={styles.canvas}
        style={{
          opacity: canvasOpacity,
          clipPath: `inset(0 0 ${(1 - canvasIn) * 100}% 0 round 0.6rem)`,
          boxShadow: `inset 0 0 0 1px rgba(255,255,255,${mix(0.06, 0.34, borderLit)})`,
        }}
      >
        <div className={styles.nav} style={{ opacity: navIn }}>
          {[0, 1, 2].map((index) => {
            const chip = easeOut(seg(time, 5.2 + index * 0.12, 5.7 + index * 0.12));
            return <span key={index} className={styles.navChip} style={{ opacity: chip }} />;
          })}
        </div>

        {/* The dominant object of phase 2 */}
        <div
          className={styles.hero}
          style={{
            opacity: heroIn,
            transform: `scaleY(${mix(0.18, 1, heroIn)})`,
          }}
        >
          {shimmerOn && (
            <span
              className={styles.shimmer}
              style={{ transform: `translateX(${mix(-140, 240, shimmer)}%)` }}
            />
          )}
        </div>

        {[0, 1].map((index) => {
          const line = easeOut(seg(time, 6.8 + index * 0.2, 7.3 + index * 0.2));
          const widths = [62, 44];
          return (
            <span
              key={index}
              className={styles.headline}
              style={{
                top: `${44 + index * 6.5}%`,
                width: `${widths[index] * line}%`,
                opacity: line,
              }}
            />
          );
        })}

        <span
          className={styles.cta}
          style={{
            opacity: ctaIn,
            transform: `translateY(${mix(6, 0, ctaIn)}px)`,
            background: `color-mix(in srgb, var(--flow-accent) ${mix(16, 100, ctaStrong)}%, var(--flow-skeleton))`,
            boxShadow: `0 0 0 ${ctaPulse * 5}px color-mix(in srgb, var(--flow-accent) ${ctaPulse * 22}%, transparent)`,
          }}
        />

        {/* Two supporting regions that become three compact cards */}
        {[0, 1, 2].map((index) => {
          const base = easeOut(seg(time, 8.1 + index * 0.2, 8.7 + index * 0.2));
          const lefts = [3, card2Left, 67.5];
          const opacity = index === 2 ? card3Opacity : base;
          return (
            <span
              key={index}
              className={styles.card}
              style={{
                left: `${lefts[index]}%`,
                width: `${cardWidth}%`,
                opacity,
                transform: `translateY(${mix(8, 0, index === 2 ? card3Opacity : base)}px)`,
              }}
            />
          );
        })}

        {/* The one block the second version adds */}
        <span
          className={styles.support}
          style={{ opacity: supportIn, transform: `translateY(${mix(8, 0, supportIn)}px)` }}
        />

        {/* Interaction trace — the region being improved, lit once */}
        <span
          className={styles.focusRing}
          style={{ opacity: focusPulse * 0.85, transform: `scale(${mix(0.985, 1, focusPulse)})` }}
        />
      </div>
    </div>
  );
}

/**
 * Timeline maths shared by the product motions.
 *
 * Every value in a motion is a pure function of elapsed seconds, so scrubbing
 * to a moment and playing to it produce the same frame — which is what makes a
 * 25fps export deterministic.
 */

export const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value);

/** Normalized progress across a segment, flat outside it. */
export const seg = (time: number, start: number, end: number) => clamp01((time - start) / (end - start));

export const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);

export const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export const mix = (a: number, b: number, x: number) => a + (b - a) * x;

/** Rises and falls once over a segment — pulses that never blink on or off. */
export const swell = (x: number) => Math.sin(Math.PI * clamp01(x));

export interface MotionPhase {
  label: string;
  start: number;
  end: number;
}

export function phaseAtTime(phases: readonly MotionPhase[], time: number) {
  const index = phases.findIndex((phase) => time >= phase.start && time < phase.end);
  return index === -1 ? phases.length - 1 : index;
}

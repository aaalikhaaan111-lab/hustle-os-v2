"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/landing/hooks";
import { phaseAtTime, type MotionPhase } from "@/components/motion/timing";
import styles from "./MotionStage.module.css";

export interface MotionStageProps {
  /** Length of one loop, in seconds. */
  duration: number;
  /** The motion's own beats — the steps beside it read from these. */
  phases: readonly MotionPhase[];
  /** Where the loop has settled: the frame shown when motion is not wanted. */
  settledTime: number;
  /** The motion, rendered for a moment in time. Stays a pure function. */
  render: (time: number) => ReactNode;
  label: string;
  playLabel: string;
  pauseLabel: string;
  onProgressChange?: (progress: number) => void;
  onPhaseChange?: (phase: number) => void;
}

// Emitting every frame would re-render the step list ~60x a second for a change
// no one can see. 250 stops is finer than the eye reads on a 15-second loop.
const PROGRESS_STEPS = 250;

/**
 * Runs an approved motion on the public page: it owns the clock and nothing
 * else. The motion itself stays a pure function of time, exactly as reviewed,
 * which is why the same component can be driven by this loop here and by a
 * scrubber on the preview route.
 *
 * The frame carries only a pause control. The preview's scrubber, timecode and
 * phase readout are development tools and stay on the preview route.
 */
export function MotionStage({
  duration,
  phases,
  settledTime,
  render,
  label,
  playLabel,
  pauseLabel,
  onProgressChange,
  onPhaseChange,
}: MotionStageProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  const [time, setTime] = useState(0);
  const [inView, setInView] = useState(false);
  // null follows the motion preference, which resolves to paused when reduced
  // motion is on. Pressing the control pins an explicit choice either way.
  const [playRequested, setPlayRequested] = useState<boolean | null>(null);
  const isPlaying = playRequested ?? !reducedMotion;

  const timeRef = useRef(0);
  const emittedRef = useRef(-1);
  const progressCb = useRef(onProgressChange);
  const phaseCb = useRef(onPhaseChange);
  useEffect(() => {
    progressCb.current = onProgressChange;
    phaseCb.current = onPhaseChange;
  });

  // Off-screen playback is wasted work. With no observer the stage counts as
  // visible — better a loop that runs unseen than copy that never advances.
  useEffect(() => {
    const el = frameRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const running = isPlaying && inView;

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      last = now - Math.min(now - last, 100); // a backgrounded tab must not jump
      const delta = (now - last) / 1000;
      last = now;
      timeRef.current = (timeRef.current + delta) % duration;
      setTime(timeRef.current);

      const progress = timeRef.current / duration;
      const quantized = Math.round(progress * PROGRESS_STEPS) / PROGRESS_STEPS;
      if (quantized !== emittedRef.current) {
        emittedRef.current = quantized;
        progressCb.current?.(quantized);
        phaseCb.current?.(phaseAtTime(phases, timeRef.current));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, duration, phases]);

  // Not playing means the settled frame, not a blank one — the last state of
  // the story reads correctly on its own.
  const shown = running || time > 0 ? time : settledTime;

  useEffect(() => {
    if (running) return;
    const progress = settledTime / duration;
    progressCb.current?.(progress);
    phaseCb.current?.(phaseAtTime(phases, settledTime));
    // Only while parked on the settled frame; the loop reports its own.
  }, [running, settledTime, duration, phases]);

  return (
    <div className={styles.frame} ref={frameRef}>
      <div className={styles.motion} role="img" aria-label={label}>
        {render(shown)}
      </div>

      <button
        type="button"
        className={styles.control}
        onClick={() => setPlayRequested(!isPlaying)}
        aria-label={isPlaying ? pauseLabel : playLabel}
      >
        {isPlaying ? (
          <svg viewBox="0 0 12 12" aria-hidden focusable="false">
            <rect x="3" y="2.5" width="2" height="7" rx="0.5" fill="currentColor" />
            <rect x="7" y="2.5" width="2" height="7" rx="0.5" fill="currentColor" />
          </svg>
        ) : (
          <svg viewBox="0 0 12 12" aria-hidden focusable="false">
            <path d="M4 2.5 L9.5 6 L4 9.5 Z" fill="currentColor" />
          </svg>
        )}
      </button>
    </div>
  );
}

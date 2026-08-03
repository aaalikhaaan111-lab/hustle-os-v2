"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { MotionStage } from "@/components/landing/MotionStage";
import { PHASES, ProductFlowMotion, TOTAL_DURATION } from "@/components/motion/ProductFlowMotion";
import {
  EVOLUTION_DURATION,
  EVOLUTION_PHASES,
  ProductEvolutionMotion,
} from "@/components/motion/ProductEvolutionMotion";
import styles from "./ProductExplainer.module.css";

/**
 * The two explainers on the landing: one project, two moments in its life.
 *
 * Each variant carries its own motion and that motion's own beats. The steps
 * are not on a generic three-way split — they read the boundaries the animation
 * was actually built to, which differ between the two (30/70 for the build,
 * 27/60 for the evolution). Retiming a motion moves its copy automatically.
 */
const VARIANTS = {
  build: {
    keys: ["explainerStep1", "explainerStep2", "explainerStep3"],
    labels: { region: "explainerRegion", play: "explainerPlay", pause: "explainerPause" },
    duration: TOTAL_DURATION,
    phases: PHASES,
    settledTime: 14.2,
    render: (time: number) => <ProductFlowMotion time={time} />,
  },
  evolve: {
    keys: ["evolveStep1", "evolveStep2", "evolveStep3"],
    labels: { region: "evolveRegion", play: "evolvePlay", pause: "evolvePause" },
    duration: EVOLUTION_DURATION,
    phases: EVOLUTION_PHASES,
    settledTime: 14.0,
    render: (time: number) => <ProductEvolutionMotion time={time} />,
  },
} as const;

export type ExplainerVariant = keyof typeof VARIANTS;

/**
 * One product explanation: the motion on the left, the three steps it moves
 * through on the right. The copy is not a caption for the video — it is the
 * canonical version, readable and complete whether or not the frame ever
 * plays, which is also why it survives a stalled loop or a blocked autoplay.
 */
interface ProductExplainerProps {
  variant?: ExplainerVariant;
  /** Steps on the left and the frame on the right, for rhythm between sections. */
  reversed?: boolean;
}

export function ProductExplainer({ variant = "build", reversed = false }: ProductExplainerProps) {
  const t = useTranslations("landing");
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);

  const handleProgress = useCallback((value: number) => setProgress(value), []);
  const handlePhase = useCallback((phase: number) => setActive(phase), []);

  const config = VARIANTS[variant];
  const steps = config.keys.map((key) => ({ title: t(`${key}Title`), body: t(`${key}Body`) }));

  return (
    <div className={`${styles.layout} ${reversed ? styles.reversed : ""}`}>
      <div className={styles.media}>
        <MotionStage
          duration={config.duration}
          phases={config.phases}
          settledTime={config.settledTime}
          render={config.render}
          label={t(config.labels.region)}
          playLabel={t(config.labels.play)}
          pauseLabel={t(config.labels.pause)}
          onProgressChange={handleProgress}
          onPhaseChange={handlePhase}
        />
      </div>

      <ol className={styles.steps}>
        {steps.map((step, index) => {
          const phase = config.phases[index];
          const start = phase.start / config.duration;
          const end = phase.end / config.duration;
          const fill = Math.min(1, Math.max(0, (progress - start) / (end - start)));
          const isActive = index === active;

          return (
            <li
              key={step.title}
              className={`${styles.step} ${isActive ? styles.stepActive : ""}`}
              aria-current={isActive ? "step" : undefined}
            >
              {/* The rail is the timeline: filled behind you, filling on the
                  step you are on, empty ahead. */}
              <span className={styles.rail} aria-hidden>
                <span className={styles.railFill} style={{ transform: `scaleY(${fill})` }} />
              </span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepBody}>{step.body}</p>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

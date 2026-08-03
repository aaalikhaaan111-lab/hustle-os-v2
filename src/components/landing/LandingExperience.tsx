"use client";

/*
  DIRECTION CONTRACT v5 — one register, not two. The approved hero is the
  only visual source; every section below it continues the hero's own dark
  indigo atmosphere. The light/cream register introduced in v4 is gone, and
  with it the workspace feature grid it carried.
  THESIS: the hero states the promise, then one short product explanation
  shows how it is kept — the motion carries it, the page around it stays quiet.
  OWN-WORLD: Helvetica Neue throughout; dark tokens carried verbatim from
  the hero (#0d0a1f canvas, #171233 surface, 10%-white hairlines, #6d7bff
  accent); grain and radial bloom for depth; no second palette.
  STORY: hero acts -> one looping explanation of what Ventrio does, its three
  steps lit in time with the motion -> closing scene back in the hero's own
  register. The project showcase and the four-card loop it used to sit above
  are both gone: one explanation replaces both.
  FIRST VIEWPORT: unchanged (hero only).
  FORM: hero -> product explainer -> closing CTA, all dark and continuous.
  FINISH: unreviewed and undocumented is unfinished; this build ends with
  the finish review, the verdict, and DESIGN.md.
*/

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LandingComposer } from "@/components/landing/LandingComposer";
import { ClosingSection } from "@/components/landing/ClosingSection";
import { ProductExplainer } from "@/components/landing/ProductExplainer";
import { WaveField } from "@/components/ui/WaveField";
import { GrainField } from "@/components/ui/GrainField";
import { WAVE_EMISSIVE } from "@/components/ui/waveLight";
import { FloatingNav } from "@/components/ui/FloatingNav";
import { usePrefersReducedMotion, useReveal } from "@/components/landing/hooks";
import styles from "./LandingExperience.module.css";

const HOME_COMPOSER_ID = "home-composer";

function Reveal({
  children,
  className,
  motion,
}: {
  children: ReactNode;
  className?: string;
  motion: boolean;
}) {
  const ref = useReveal<HTMLDivElement>(motion);
  const classes = [styles.reveal, className].filter(Boolean).join(" ");
  return (
    <div ref={ref} className={classes}>
      {children}
    </div>
  );
}

interface LandingExperienceProps {
  isAuthenticated: boolean;
  children: ReactNode;
}

export function LandingExperience({ isAuthenticated, children }: LandingExperienceProps) {
  const t = useTranslations("landing");
  const reducedMotion = usePrefersReducedMotion();
  const motion = !reducedMotion;

  return (
    <div
      className={`${styles.experience} landing-root`}
      style={{ "--wave-emissive": WAVE_EMISSIVE } as React.CSSProperties}
    >
      {/* One animated atmosphere for the whole landing, mounted once here so
          the same grain runs from the hero to the footer. */}
      <div className={styles.glow} aria-hidden />
      <GrainField className={styles.atmosphere} />

      <FloatingNav isAuthenticated={isAuthenticated} />

      {/* Hero — unchanged */}
      <section className={styles.stage} aria-labelledby="landing-title">
        <WaveField className={styles.stageField} />
        <div className={styles.stageContent}>
          <h1 id="landing-title" className={styles.stageTitle}>
            {t("title")}
          </h1>
          <p className={styles.stageSubtitle}>{t("subtitle")}</p>
          <div className={styles.stageComposer}>
            <LandingComposer isAuthenticated={isAuthenticated} variant="hero" textareaId={HOME_COMPOSER_ID} />
          </div>
        </div>
      </section>

      {/* Everything below the hero — one continuous dark arc in the hero's
          own register */}
      <div className={styles.dark}>
        {/* The wave's light, carried past the boundary */}
        <div className={styles.spill} aria-hidden />

        <section id="how-it-works" className={styles.section} aria-labelledby="explainer-title">
          <Reveal className={styles.sectionHeading} motion={motion}>
            <h2 id="explainer-title">{t("explainerTitle")}</h2>
            <p>{t("explainerSubtitle")}</p>
          </Reveal>
          <div className={styles.sectionBody}>
            <ProductExplainer />
          </div>
        </section>

        {/* The second half of the same story: what happens after publish. No
            anchor of its own — it reads as the continuation of the section
            above it, not as a separate destination. */}
        <section className={styles.section} aria-labelledby="evolve-title">
          <Reveal className={styles.sectionHeading} motion={motion}>
            <h2 id="evolve-title">{t("evolveTitle")}</h2>
            <p>{t("evolveSubtitle")}</p>
          </Reveal>
          <div className={styles.sectionBody}>
            <ProductExplainer variant="evolve" reversed />
          </div>
        </section>

        {/* The ending: who this is for, and one way in. It absorbs the closing
            CTA that used to sit here — two closing calls in a row would blunt
            each other. */}
        {/* The ending carries its own two headings, one per column, so the
            section takes no centred header of its own. */}
        <section className={styles.section} aria-labelledby="closing-title">
          <ClosingSection isAuthenticated={isAuthenticated} />
        </section>

        <div className={styles.footer}>{children}</div>
      </div>
    </div>
  );
}

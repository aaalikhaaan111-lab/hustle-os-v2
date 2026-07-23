"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Wordmark } from "@/components/layout/Wordmark";
import { LandingComposer } from "@/components/landing/LandingComposer";
import { usePrefersReducedMotion, useReveal } from "@/components/landing/hooks";
import styles from "./LandingExperience.module.css";

const HOME_COMPOSER_ID = "home-composer";

const EXAMPLES = [
  {
    id: "photography",
    labelKey: "examplePhotography",
    materialKey: "photographyMaterial",
    audienceKey: "photographyAudience",
    formatKey: "photographyFormat",
    eyebrowKey: "photographyEyebrow",
    projectNameKey: "photographyName",
    projectTitleKey: "photographyTitle",
    projectBodyKey: "photographyBody",
    projectCtaKey: "photographyCta",
    projectMetaKey: "photographyMeta",
  },
  {
    id: "math",
    labelKey: "exampleMath",
    materialKey: "mathMaterial",
    audienceKey: "mathAudience",
    formatKey: "mathFormat",
    eyebrowKey: "mathEyebrow",
    projectNameKey: "mathName",
    projectTitleKey: "mathTitle",
    projectBodyKey: "mathBody",
    projectCtaKey: "mathCta",
    projectMetaKey: "mathMeta",
  },
  {
    id: "problem",
    labelKey: "exampleProblem",
    materialKey: "problemMaterial",
    audienceKey: "problemAudience",
    formatKey: "problemFormat",
    eyebrowKey: "problemEyebrow",
    projectNameKey: "problemName",
    projectTitleKey: "problemTitle",
    projectBodyKey: "problemBody",
    projectCtaKey: "problemCta",
    projectMetaKey: "problemMeta",
  },
  {
    id: "idea",
    labelKey: "exampleIdea",
    materialKey: "ideaMaterial",
    audienceKey: "ideaAudience",
    formatKey: "ideaFormat",
    eyebrowKey: "ideaEyebrow",
    projectNameKey: "ideaName",
    projectTitleKey: "ideaTitle",
    projectBodyKey: "ideaBody",
    projectCtaKey: "ideaCta",
    projectMetaKey: "ideaMeta",
  },
] as const;

const CYCLE_STEPS = [
  { number: "01", titleKey: "cycleCreate", bodyKey: "cycleCreateBody" },
  { number: "02", titleKey: "cycleChange", bodyKey: "cycleChangeBody" },
  { number: "03", titleKey: "cyclePublish", bodyKey: "cyclePublishBody" },
  { number: "04", titleKey: "cycleListen", bodyKey: "cycleListenBody" },
  { number: "05", titleKey: "cycleImprove", bodyKey: "cycleImproveBody" },
] as const;

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
  const [activeExampleId, setActiveExampleId] = useState<(typeof EXAMPLES)[number]["id"]>(EXAMPLES[0].id);
  const activeExample = EXAMPLES.find((example) => example.id === activeExampleId) ?? EXAMPLES[0];
  const cycleRef = useReveal<HTMLOListElement>(motion);

  // The wordmark is the way back to the composer: return to the top and focus
  // the entry field, rather than navigating somewhere arbitrary.
  function backToComposer() {
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" });
    window.requestAnimationFrame(() => {
      document.getElementById(HOME_COMPOSER_ID)?.focus();
    });
  }

  return (
    <div className={styles.experience}>
      <header className={styles.header}>
        <button type="button" onClick={backToComposer} className={styles.wordmarkLink} aria-label={t("backToTop")}>
          <Wordmark className={styles.wordmark} />
        </button>
      </header>

      <div className={styles.journey}>
        <section className={styles.hero} aria-labelledby="landing-title">
          <span className={styles.heroGlow} aria-hidden />
          <p className={styles.eyebrow}>
            <span className={styles.signalDot} aria-hidden />
            {t("badge")}
          </p>
          <h1 id="landing-title" className={styles.heroTitle}>
            {t("title")}
          </h1>
          <p className={styles.heroSubtitle}>{t("subtitle")}</p>
          <div className={styles.heroComposer}>
            <LandingComposer isAuthenticated={isAuthenticated} variant="hero" textareaId={HOME_COMPOSER_ID} />
          </div>
          <p className={styles.heroNote}>{t("heroNote")}</p>
        </section>

        <section id="formation" className={styles.formationSection} aria-labelledby="formation-title">
          <Reveal className={styles.sectionHeading} motion={motion}>
            <p className={styles.eyebrow}>{t("formationEyebrow")}</p>
            <h2 id="formation-title">{t("formationTitle")}</h2>
            <p>{t("formationSubtitle")}</p>
          </Reveal>

          <div className={styles.examplePicker} role="group" aria-label={t("examplePickerLabel")}>
            {EXAMPLES.map((example) => {
              const selected = example.id === activeExample.id;
              return (
                <button
                  key={example.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setActiveExampleId(example.id)}
                  className={selected ? styles.exampleButtonActive : styles.exampleButton}
                >
                  <span aria-hidden>{selected ? "●" : "○"}</span>
                  {t(example.labelKey)}
                </button>
              );
            })}
          </div>

          <div className={styles.formationFrame}>
            <div className={styles.formationLabels} aria-hidden>
              <span>{t("formationInputLabel")}</span>
              <span>{t("formationUnderstandingLabel")}</span>
              <span>{t("formationProjectLabel")}</span>
            </div>

            <div className={styles.formationStage} key={activeExample.id}>
              <div className={styles.sourceThought}>
                <span className={styles.sourceMark} aria-hidden>
                  “
                </span>
                <p>{t(activeExample.labelKey)}</p>
                <span className={styles.sourceStatus}>{t("formationEnough")}</span>
              </div>

              <div className={styles.formationCore} aria-hidden>
                <span className={styles.coreLine} />
                <span className={styles.fragmentMaterial}>{t(activeExample.materialKey)}</span>
                <span className={styles.fragmentAudience}>{t(activeExample.audienceKey)}</span>
                <span className={styles.fragmentFormat}>{t(activeExample.formatKey)}</span>
                <span className={styles.coreNode}>
                  <i />
                </span>
              </div>

              <article className={styles.projectPreview} aria-live="polite">
                <div className={styles.previewChrome}>
                  <span />
                  <span />
                  <span />
                  <p>{t(activeExample.projectNameKey)}</p>
                  <i>{t("liveFirstVersion")}</i>
                </div>
                <div className={styles.previewBody}>
                  <p className={styles.previewEyebrow}>{t(activeExample.eyebrowKey)}</p>
                  <h3>{t(activeExample.projectTitleKey)}</h3>
                  <p className={styles.previewDescription}>{t(activeExample.projectBodyKey)}</p>
                  <div className={styles.previewAction}>
                    <span>{t(activeExample.projectCtaKey)}</span>
                    <i aria-hidden>↗</i>
                  </div>
                  <div className={styles.previewMeta}>
                    <span>{t(activeExample.projectMetaKey)}</span>
                    <span>{t("previewEditable")}</span>
                  </div>
                </div>
                <span className={styles.previewScan} aria-hidden />
              </article>
            </div>

            <div className={styles.formationCaption}>
              <span>{t("formationCaptionLead")}</span>
              <p>{t("formationCaption")}</p>
            </div>
          </div>
        </section>

        <section id="after" className={styles.cycleSection} aria-labelledby="cycle-title">
          <div className={styles.cycleIntro}>
            <Reveal className={styles.sectionHeading} motion={motion}>
              <p className={styles.eyebrow}>{t("cycleEyebrow")}</p>
              <h2 id="cycle-title">{t("cycleTitle")}</h2>
              <p>{t("cycleSubtitle")}</p>
            </Reveal>
            <div className={styles.responseSignal} aria-label={t("responseSignalLabel")}>
              <span className={styles.responseAvatar} aria-hidden>
                M
              </span>
              <div>
                <p>{t("responseQuote")}</p>
                <span>{t("responseMeta")}</span>
              </div>
              <i aria-hidden>↗</i>
            </div>
          </div>

          <ol className={styles.cycleTrack} ref={cycleRef}>
            {CYCLE_STEPS.map((step, index) => (
              <li key={step.number} style={{ transitionDelay: `${index * 90}ms` }}>
                <span className={styles.cycleNumber}>{step.number}</span>
                <span className={styles.cycleNode} aria-hidden />
                <h3>{t(step.titleKey)}</h3>
                <p>{t(step.bodyKey)}</p>
              </li>
            ))}
            <span className={styles.cycleRail} aria-hidden>
              <i />
            </span>
          </ol>
        </section>

        <section className={styles.finalSection} aria-labelledby="final-title">
          <Reveal className={styles.finalCopy} motion={motion}>
            <p className={styles.eyebrow}>{t("finalEyebrow")}</p>
            <h2 id="final-title">{t("finalTitle")}</h2>
            <p>{t("finalSubtitle")}</p>
            <div className={styles.finalComposer}>
              <LandingComposer isAuthenticated={isAuthenticated} variant="final" />
            </div>
          </Reveal>
        </section>
      </div>

      <div className={styles.footer}>{children}</div>
    </div>
  );
}

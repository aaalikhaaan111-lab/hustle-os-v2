"use client";

import { useTranslations } from "next-intl";
import { LandingComposer } from "@/components/landing/LandingComposer";
import { usePrefersReducedMotion, useReveal } from "@/components/landing/hooks";
import styles from "./ClosingSection.module.css";

/**
 * The loop, as five panels on the source component's six-column bento: three
 * narrow panels across the top and two wide ones beneath. Read in order they
 * state the whole argument — idea, first version, publish, real use, one
 * signal, a proposed improvement, and an approval that stays with the owner.
 *
 * Each panel's figure is built from the same abstract vocabulary as the two
 * motion sections above (paper surface, skeleton rows, accent action, traces),
 * so this reads as the same product seen at five moments rather than as five
 * unrelated illustrations. Nothing here animates on a loop: it reveals once and
 * rests, which keeps it calmer than the motion sections it follows.
 */
export function ClosingSection({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = useTranslations("landing");
  const reducedMotion = usePrefersReducedMotion();
  const ref = useReveal<HTMLDivElement>(!reducedMotion);

  return (
    <div className={styles.closing} ref={ref}>
      <header className={styles.head}>
        <h2 id="closing-title" className={styles.headTitle}>
          {t("improveTitle")}
        </h2>
        <p className={styles.headBody}>{t("improveSubtitle")}</p>
      </header>

      <div className={styles.bento}>
        {/* 1 — an idea becomes a first version */}
        <article className={`${styles.panel} ${styles.narrow}`} style={{ "--i": 0 } as React.CSSProperties}>
          <div className={styles.figure}>
            <div className={styles.composer} aria-hidden>
              <span className={styles.composerLine} />
              <span className={styles.composerLine} data-short />
              <span className={styles.composerSend} />
            </div>
            <span className={styles.drop} aria-hidden />
            <div className={styles.surface} aria-hidden>
              <span className={styles.hero} />
              <span className={styles.row} />
              <span className={styles.row} data-short />
            </div>
          </div>
          <h3 className={styles.panelTitle}>{t("improve1Title")}</h3>
          <p className={styles.panelBody}>{t("improve1Body")}</p>
        </article>

        {/* 2 — it goes live */}
        <article className={`${styles.panel} ${styles.narrow}`} style={{ "--i": 1 } as React.CSSProperties}>
          <div className={styles.figure}>
            <div className={`${styles.surface} ${styles.surfaceTall}`} aria-hidden>
              <span className={styles.liveChip}>Live</span>
              <span className={styles.hero} />
              <span className={styles.row} />
              <span className={styles.row} data-short />
              <span className={styles.publish}>Publish</span>
            </div>
          </div>
          <h3 className={styles.panelTitle}>{t("improve2Title")}</h3>
          <p className={styles.panelBody}>{t("improve2Body")}</p>
        </article>

        {/* 3 — real visitors use it */}
        <article className={`${styles.panel} ${styles.narrow}`} style={{ "--i": 2 } as React.CSSProperties}>
          <div className={styles.figure}>
            <div className={`${styles.surface} ${styles.surfaceTall}`} aria-hidden>
              <span className={styles.hero} />
              <span className={styles.row} />
              {/* All three land inside the same region — the repetition is the
                  whole point, so they sit on it rather than near it. */}
              <span className={styles.region}>
                <span className={styles.regionFill} />
                {[0, 1, 2].map((index) => (
                  <span key={index} className={styles.trace} data-trace={index} />
                ))}
              </span>
            </div>
          </div>
          <h3 className={styles.panelTitle}>{t("improve3Title")}</h3>
          <p className={styles.panelBody}>{t("improve3Body")}</p>
        </article>

        {/* 4 — repetition condenses into one signal */}
        <article className={`${styles.panel} ${styles.wide}`} style={{ "--i": 3 } as React.CSSProperties}>
          <div className={styles.wideBody}>
            <h3 className={styles.panelTitle}>{t("improve4Title")}</h3>
            <p className={styles.panelBody}>{t("improve4Body")}</p>
          </div>
          <div className={styles.wideFigure}>
            <div className={styles.converge} aria-hidden>
              {[0, 1, 2].map((index) => (
                <span key={index} className={styles.converger} data-c={index} />
              ))}
              <span className={styles.tie} />
              <span className={styles.signal}>
                <span className={styles.signalBar} />
              </span>
            </div>
          </div>
        </article>

        {/* 5 — the next version, waiting on the owner */}
        <article className={`${styles.panel} ${styles.wide}`} style={{ "--i": 4 } as React.CSSProperties}>
          <div className={styles.wideBody}>
            <h3 className={styles.panelTitle}>{t("improve5Title")}</h3>
            <p className={styles.panelBody}>{t("improve5Body")}</p>
          </div>
          <div className={styles.wideFigure}>
            <div className={styles.beforeAfter} aria-hidden>
              <div className={styles.surface} data-state="before">
                <span className={styles.row} />
                <span className={styles.row} data-short />
                <span className={styles.tile} />
                <span className={styles.tile} />
              </div>
              <span className={styles.arrow} />
              <div className={styles.surface} data-state="after">
                <span className={styles.rowWide} />
                <span className={styles.tileWide} />
                <span className={styles.approve}>Approve</span>
              </div>
            </div>
          </div>
        </article>
      </div>

      <div className={styles.cta}>
        <h3 className={styles.ctaTitle}>{t("closingCtaTitle")}</h3>
        {/* The product's real entry point, not a button pretending to be one:
            the same composer and the same routing as the hero. */}
        <div className={styles.ctaComposer}>
          <LandingComposer isAuthenticated={isAuthenticated} variant="final" />
        </div>
      </div>
    </div>
  );
}

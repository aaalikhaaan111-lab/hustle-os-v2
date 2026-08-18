"use client";

import { useState } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import { useTranslations } from "next-intl";

/**
 * The after-launch section: selectable topics on the left, one media stage on
 * the right.
 *
 * SELECTION IS BY CLICK ONLY. Hovering the list changes nothing, so moving a
 * pointer down the column does not play four things at a reader who asked for
 * none of them. The stage is a fixed 16:10 box that never changes size, so
 * switching topics cannot move the page.
 *
 * WHAT THE STAGE SHOWS NOW. It used to hold a drawn "poster" per topic — three
 * grey bars and a "media coming" label — which is a placeholder pretending to
 * be an illustration. Each topic now runs a small demonstration of the specific
 * thing it claims: a headline actually being rewritten, a form actually
 * appearing in a page, responses actually arriving, a conversation actually
 * resuming after a gap. They are CSS and Motion, so they cost nothing to load
 * and cannot go stale.
 *
 * THE MEDIA SLOT IS STILL THE POINT. Every section declares a `video` it will
 * play once one exists; while that is undefined the demonstration runs instead.
 * Dropping a clip in is a one-line change to `VIDEO` below and nothing else —
 * the stage, the crossfade and the aspect ratio are already built around it.
 * No clip is invented here: commissioning the messenger video was explicitly
 * out of scope, and inventing the other three would have been the same mistake.
 */
type SectionId = "words" | "device" | "feedback" | "anywhere";

/**
 * Where the motion clips will go. Empty on purpose — a filename here replaces
 * that section's demonstration with the real thing, and changes nothing else.
 */
const VIDEO: Partial<Record<SectionId, string>> = {};

/* One easing for everything in this file: panels move in the 220-320ms band,
   the small things inside them in 160-220ms. */
const EASE = [0.22, 1, 0.36, 1] as const;

export function AfterStage({
  items,
}: {
  items: { id: SectionId; title: string; body: string }[];
}) {
  const t = useTranslations("landing");
  const reduce = useReducedMotion();
  const [active, setActive] = useState<SectionId>("words");

  const current = items.find((s) => s.id === active) ?? items[0];
  const video = VIDEO[current.id];

  const enter: Transition = reduce ? { duration: 0 } : { duration: 0.28, ease: EASE };

  return (
    <>
      <div className="lp-split">
        <div className="lp-list" role="tablist" aria-orientation="vertical">
          {items.map((section) => {
            const isOpen = section.id === active;
            return (
              <button
                key={section.id}
                type="button"
                role="tab"
                aria-selected={isOpen}
                className="lp-list-item"
                data-open={isOpen ? "true" : undefined}
                /* CLICK ONLY. No `onMouseMove`, no `onMouseEnter`. */
                onClick={() => setActive(section.id)}
              >
                <h3>{section.title}</h3>
                <span className="lp-list-body">
                  <span>{section.body}</span>
                </span>
              </button>
            );
          })}
        </div>

        {/* Fixed aspect, fixed size. The contents crossfade; the box never moves. */}
        <div className="lp-stage" data-active={active}>
          <motion.div
            key={active}
            className="lp-stage-media"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.985, filter: reduce ? "none" : "blur(6px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            transition={enter}
          >
            {video ? (
              <video
                className="lp-stage-video"
                src={video}
                autoPlay
                muted
                loop
                playsInline
                aria-label={current.title}
              />
            ) : (
              <StageDemo id={current.id} reduce={Boolean(reduce)} t={t} />
            )}
          </motion.div>
        </div>
      </div>

      {/* These are drawings of the product, and they say so. */}
      <p className="lp-stage-note">{t("stageDemoNote")}</p>
    </>
  );
}

type T = ReturnType<typeof useTranslations<"landing">>;

function StageDemo({ id, reduce, t }: { id: SectionId; reduce: boolean; t: T }) {
  const d = (delay: number, duration = 0.26): Transition =>
    reduce ? { duration: 0 } : { duration, ease: EASE, delay };

  /* ── change the words ────────────────────────────────────────────────── */
  if (id === "words") {
    return (
      <div className="lp-demo">
        <div className="lp-demo-page">
          {/* Both headlines occupy the same fixed box, so the swap cannot
              resize the page under itself. */}
          <span className="lp-demo-headline">
            <motion.span
              className="lp-demo-h"
              initial={{ opacity: 1, filter: "blur(0px)" }}
              animate={{ opacity: 0, filter: reduce ? "blur(0px)" : "blur(4px)" }}
              transition={d(0.5, 0.22)}
            >
              {t("demoWordsBefore")}
            </motion.span>
            <motion.span
              className="lp-demo-h lp-demo-h--after"
              initial={{ opacity: 0, filter: reduce ? "blur(0px)" : "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={d(0.72, 0.26)}
            >
              {t("demoWordsAfter")}
            </motion.span>
          </span>
          <span className="lp-fig-bar" />
          <span className="lp-fig-bar lp-fig-bar--short" />
        </div>
        <motion.span
          className="lp-demo-say"
          initial={{ opacity: 0, y: reduce ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={d(0.12, 0.24)}
        >
          {t("demoWordsSay")}
        </motion.span>
      </div>
    );
  }

  /* ── change what it does ─────────────────────────────────────────────── */
  if (id === "device") {
    return (
      <div className="lp-demo">
        <div className="lp-demo-page">
          <span className="lp-fig-bar lp-fig-bar--title" />
          <span className="lp-fig-bar" />
          {/* The new section arrives inside space already reserved for it. */}
          <motion.span
            className="lp-demo-form"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={d(0.55, 0.3)}
          >
            <span className="lp-demo-field" />
            <span className="lp-demo-field" />
            <span className="lp-demo-submit">{t("demoDoesButton")}</span>
          </motion.span>
        </div>
        <motion.span
          className="lp-demo-say"
          initial={{ opacity: 0, y: reduce ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={d(0.12, 0.24)}
        >
          {t("demoDoesSay")}
        </motion.span>
      </div>
    );
  }

  /* ── see what came back ──────────────────────────────────────────────── */
  if (id === "feedback") {
    const replies = [t("demoReply1"), t("demoReply2"), t("demoReply3")];
    return (
      <div className="lp-demo lp-demo--replies">
        <motion.span
          className="lp-demo-count"
          initial={{ opacity: 0, y: reduce ? 0 : -4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={d(0.1, 0.22)}
        >
          {t("demoReplyCount", { count: replies.length })}
        </motion.span>
        <span className="lp-demo-replies">
          {replies.map((reply, i) => (
            <motion.span
              key={reply}
              className="lp-demo-reply"
              initial={{ opacity: 0, y: reduce ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={d(0.22 + i * 0.11, 0.26)}
            >
              {reply}
            </motion.span>
          ))}
        </span>
      </div>
    );
  }

  /* ── start again from anywhere ───────────────────────────────────────── */
  return (
    <div className="lp-demo lp-demo--thread">
      <span className="lp-demo-msg lp-demo-msg--me">{t("demoAgainOld")}</span>
      <span className="lp-demo-msg">{t("demoAgainReply")}</span>
      <motion.span
        className="lp-demo-gap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={d(0.4, 0.24)}
      >
        {t("demoAgainGap")}
      </motion.span>
      <motion.span
        className="lp-demo-msg lp-demo-msg--me"
        initial={{ opacity: 0, y: reduce ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={d(0.62, 0.28)}
      >
        {t("demoAgainNew")}
      </motion.span>
    </div>
  );
}

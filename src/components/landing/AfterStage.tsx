"use client";

import { useState } from "react";
import { motion, useReducedMotion, type Transition } from "motion/react";
import { useTranslations } from "next-intl";
import { VentrioMark } from "@/components/workspace-ui/parts";

/**
 * The after-launch section: selectable topics on the left, one media stage on
 * the right.
 *
 * SELECTION IS BY CLICK ONLY. Hovering the list changes nothing, so moving a
 * pointer down the column does not play four things at a reader who asked for
 * none of them. The stage is a fixed 16:10 box that never changes size, so
 * switching topics cannot move the page.
 *
 * WHAT THE STAGE SHOWS NOW, AND WHY IT LOOKS LIKE THE PRODUCT. The first
 * version of these scenes was drawn from scratch — generic bubbles and boxes
 * that happened to sit on the landing page's palette. They demonstrated the
 * right ideas in the wrong product's clothes.
 *
 * Each scene is now rendered inside `.studio`, the platform's own token scope,
 * and built from the platform's own classes: `s-turn-user` and
 * `s-turn-assistant` are the real conversation turns, `s-turn-mark` is the real
 * speaker mark, `s-composer` is the real input. Nothing here is a copy of those
 * shapes; they ARE those shapes, so the demo cannot drift away from the
 * workspace it is describing — restyling the product restyles the landing's
 * picture of it.
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

/**
 * The workspace's own project preview, at stage scale.
 *
 * A bordered card on the platform's card surface with a hairline head — the
 * same framing a project wears everywhere else in Ventrio.
 */
function Preview({ children }: { children: React.ReactNode }) {
  return (
    <div className="lp-scene-preview">
      <div className="lp-scene-preview-bar" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="lp-scene-preview-body">{children}</div>
    </div>
  );
}

/** Ventrio's reply, in the real assistant turn. */
function Reply({ children }: { children: React.ReactNode }) {
  return (
    <div className="s-turn-assistant">
      <span className="s-turn-mark" aria-hidden>
        <VentrioMark size={12} />
      </span>
      <div className="lp-scene-reply">{children}</div>
    </div>
  );
}

/** The person's turn, in the real user turn. */
function Said({ children }: { children: React.ReactNode }) {
  return (
    <div className="s-turn-user">
      <div>{children}</div>
    </div>
  );
}

function StageDemo({ id, reduce, t }: { id: SectionId; reduce: boolean; t: T }) {
  const d = (delay: number, duration = 0.26): Transition =>
    reduce ? { duration: 0 } : { duration, ease: EASE, delay };

  /* ── change the words ────────────────────────────────────────────────── */
  if (id === "words") {
    return (
      <div className="studio lp-scene">
        <Preview>
          {/* Both headlines share one box, so the rewrite cannot resize the
              page underneath itself. */}
          <span className="lp-scene-headline">
            <motion.span
              className="lp-scene-h"
              initial={{ opacity: 1, filter: "blur(0px)" }}
              animate={{ opacity: 0, filter: reduce ? "blur(0px)" : "blur(4px)" }}
              transition={d(0.55, 0.22)}
            >
              {t("demoWordsBefore")}
            </motion.span>
            <motion.span
              className="lp-scene-h lp-scene-h--after"
              initial={{ opacity: 0, filter: reduce ? "blur(0px)" : "blur(4px)" }}
              animate={{ opacity: 1, filter: "blur(0px)" }}
              transition={d(0.78, 0.26)}
            >
              {t("demoWordsAfter")}
            </motion.span>
          </span>
          <span className="lp-scene-rule" />
          <span className="lp-scene-rule lp-scene-rule--short" />
        </Preview>

        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={d(0.14, 0.24)}
        >
          <Said>{t("demoWordsSay")}</Said>
        </motion.div>
      </div>
    );
  }

  /* ── change what it does ─────────────────────────────────────────────── */
  if (id === "device") {
    return (
      <div className="studio lp-scene">
        <Preview>
          <span className="lp-scene-h lp-scene-h--after">{t("demoWordsAfter")}</span>
          <span className="lp-scene-rule" />
          {/* The section arrives into space already reserved for it. */}
          <motion.span
            className="lp-scene-form"
            initial={{ opacity: 0, scale: reduce ? 1 : 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={d(0.6, 0.3)}
          >
            <span className="lp-scene-field" />
            <span className="lp-scene-field" />
            <span className="lp-scene-submit">{t("demoDoesButton")}</span>
          </motion.span>
        </Preview>

        <motion.div
          initial={{ opacity: 0, y: reduce ? 0 : 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={d(0.14, 0.24)}
        >
          <Said>{t("demoDoesSay")}</Said>
        </motion.div>
      </div>
    );
  }

  /* ── see what came back ──────────────────────────────────────────────── */
  if (id === "feedback") {
    const replies = [t("demoReply1"), t("demoReply2"), t("demoReply3")];
    return (
      <div className="studio lp-scene lp-scene--panel">
        <div className="lp-scene-head">
          <span className="lp-scene-head-title">{t("after3")}</span>
          <motion.span
            className="lp-scene-count"
            initial={{ opacity: 0, y: reduce ? 0 : -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={d(0.1, 0.22)}
          >
            {t("demoReplyCount", { count: replies.length })}
          </motion.span>
        </div>
        <div className="lp-scene-rows">
          {replies.map((reply, i) => (
            <motion.span
              key={reply}
              className="lp-scene-row"
              initial={{ opacity: 0, y: reduce ? 0 : 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={d(0.24 + i * 0.11, 0.26)}
            >
              {reply}
            </motion.span>
          ))}
        </div>
      </div>
    );
  }

  /* ── start again from anywhere ───────────────────────────────────────── */
  return (
    <div className="studio lp-scene lp-scene--thread">
      <Said>{t("demoAgainOld")}</Said>
      <Reply>{t("demoAgainReply")}</Reply>
      <motion.span
        className="lp-scene-gap"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={d(0.42, 0.24)}
      >
        {t("demoAgainGap")}
      </motion.span>
      <motion.div
        initial={{ opacity: 0, y: reduce ? 0 : 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={d(0.64, 0.28)}
      >
        <Said>{t("demoAgainNew")}</Said>
      </motion.div>
      {/* The composer the conversation is picked back up in. */}
      <motion.div
        className="s-composer lp-scene-composer"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={d(0.86, 0.24)}
      >
        <span>{t("demoAgainPlaceholder")}</span>
      </motion.div>
    </div>
  );
}

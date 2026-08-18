"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

/**
 * The after-launch section: selectable sections on the left, one media stage
 * on the right.
 *
 * WHAT CHANGED AND WHY. This was four little working demos — a headline that
 * shortened, a frame that resized, bars that grew, a thread that sent. They
 * were honest, but they were also four small applications embedded in a
 * marketing page, and hovering the list swapped them: moving the pointer down
 * the column played four demos at you whether you asked or not.
 *
 * It is a media stage now. Selection is by CLICK ONLY — hover changes nothing,
 * so nothing plays because a cursor passed over it. The stage is a fixed 16:10
 * box that never changes size, so switching cannot move the page.
 *
 * THE SLOTS ARE EMPTY ON PURPOSE. Each section declares a `video` it will play
 * when one exists; none is commissioned yet, so every slot renders its fallback
 * — a drawn poster and a "media coming" note. When a clip is dropped in, the
 * only change is a filename. Inventing the messenger video was explicitly out
 * of scope, and inventing the other three would have been the same mistake.
 */
type SectionId = "words" | "device" | "feedback" | "anywhere";

interface StageSection {
  id: SectionId;
  title: string;
  body: string;
  /** Set when a clip exists. Until then the poster carries the slot. */
  video?: string;
}

export function AfterStage({
  items,
}: {
  items: { id: SectionId; title: string; body: string }[];
}) {
  const t = useTranslations("landing");
  const reduce = useReducedMotion();
  const [active, setActive] = useState<SectionId>("words");

  const sections: StageSection[] = items;
  const current = sections.find((s) => s.id === active) ?? sections[0];

  /* One easing, one duration, inside the 150–280ms the page works in. */
  const transition = reduce
    ? { duration: 0 }
    : { duration: 0.24, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="lp-split">
      <div className="lp-list" role="tablist" aria-orientation="vertical">
        {sections.map((section) => {
          const isOpen = section.id === active;
          return (
            <button
              key={section.id}
              type="button"
              role="tab"
              aria-selected={isOpen}
              className="lp-list-item"
              data-open={isOpen ? "true" : undefined}
              /* CLICK ONLY. No `onMouseMove`, no `onMouseEnter`: passing the
                 pointer down the list must not start playing things. */
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
          transition={transition}
        >
          {current.video ? (
            <video
              className="lp-stage-video"
              src={current.video}
              autoPlay
              muted
              loop
              playsInline
              aria-label={current.title}
            />
          ) : (
            <StagePoster id={current.id} label={current.title} note={t("stageSlotNote")} soon={t("stageSoon")} />
          )}
        </motion.div>
      </div>
    </div>
  );
}

/**
 * The fallback that holds a media slot.
 *
 * A drawn poster rather than a grey rectangle: it says which section it belongs
 * to and sketches the shape of what will play there, so an empty slot still
 * communicates something. It is CSS, so it costs nothing and cannot go stale.
 */
function StagePoster({
  id,
  label,
  note,
  soon,
}: {
  id: SectionId;
  label: string;
  note: string;
  soon: string;
}) {
  return (
    <div className={`lp-poster lp-poster--${id}`}>
      <div className="lp-poster-art" aria-hidden>
        <span />
        <span />
        <span />
      </div>
      <div className="lp-poster-foot">
        <span className="lp-poster-label">{label}</span>
        <span className="lp-poster-soon">{soon}</span>
      </div>
      <p className="lp-poster-note">{note}</p>
    </div>
  );
}

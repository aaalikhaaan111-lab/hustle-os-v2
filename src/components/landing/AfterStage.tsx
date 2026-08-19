"use client";

import { useState } from "react";
import Image from "next/image";
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
 * WHAT THE STAGE SHOWS NOW. Real product imagery, supplied as final assets.
 *
 * It has held two things before this: drawn "posters" of grey bars, and then
 * scenes rebuilt from the platform's own components. Both were the product
 * described rather than the product shown, which is the most a page can do
 * while it is waiting for artwork. The artwork exists now, so the stage shows
 * it and nothing is recreated in CSS.
 *
 * `object-fit: contain` because the four assets are not one aspect ratio —
 * 16:10 for the first, 4:3 for the rest — and the stage is a fixed 16:10 box.
 * Containing letterboxes the taller three against the stage surface, which is
 * the honest trade: nothing is stretched and nothing is cropped away.
 *
 * THE VIDEO SLOT SURVIVES. A filename in `VIDEO` still takes precedence over
 * the still, so the motion clips these images stand in for can arrive later
 * without the section being rebuilt around them.
 */
type SectionId = "words" | "device" | "feedback" | "anywhere";

/**
 * Where the motion clips will go. Empty on purpose — a filename here takes
 * precedence over the still below and changes nothing else.
 */
const VIDEO: Partial<Record<SectionId, string>> = {};

/**
 * The final artwork, matched to the topic each one actually shows.
 *
 *   words     landing-1  the workspace mid-conversation, the live preview
 *                        beside it — asking, and the version updating.
 *   device    landing-4  one request becoming a multi-page tool with its own
 *                        Dashboard, Requests, Budgets and Asset Library:
 *                        structure that was not there before.
 *   feedback  landing-3  the PUBLISHED project, its tables and the people in
 *                        them — what came back through the thing you shipped.
 *   anywhere  landing-2  a half-formed idea carried through proposed
 *                        directions into a built app: the thread continuing.
 *
 * Intrinsic sizes are declared so the optimiser can build a srcset and the box
 * never has to be measured at runtime.
 */
const STILL: Record<SectionId, { src: string; width: number; height: number }> = {
  words: { src: "/landing-images/landing-1.png", width: 1312, height: 816 },
  device: { src: "/landing-images/landing-4.png", width: 1200, height: 896 },
  feedback: { src: "/landing-images/landing-3.png", width: 1200, height: 896 },
  anywhere: { src: "/landing-images/landing-2.png", width: 1200, height: 896 },
};

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
              <Image
                src={STILL[current.id].src}
                alt={current.title}
                width={STILL[current.id].width}
                height={STILL[current.id].height}
                sizes="(max-width: 949px) calc(100vw - 2.5rem), 620px"
                className="lp-stage-img"
                /* Below the fold on every viewport this page is read at. */
                loading="lazy"
              />
            )}
          </motion.div>
        </div>
      </div>

      {/* These are drawings of the product, and they say so. */}
      <p className="lp-stage-note">{t("stageDemoNote")}</p>
    </>
  );
}

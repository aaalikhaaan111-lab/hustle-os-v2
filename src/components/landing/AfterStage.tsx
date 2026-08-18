"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTranslations } from "next-intl";

/**
 * The after-launch section: four actions on the left, one stage on the right.
 *
 * WHY THIS EXISTS. The section was a list of four sentences beside a static
 * picture of a conversation — it asserted that Ventrio changes a live product
 * by message, and then asked you to take that on trust. Each action now
 * demonstrates itself, in the same stage, so the claim and the evidence are the
 * same object.
 *
 * EVERYTHING IS DRAWN, NOT SCREENSHOTTED. Every state below is HTML and CSS
 * animated with Motion: a headline that actually shortens, a frame that
 * actually changes width, counters that actually count, a thread that actually
 * sends. A screenshot would be a picture of the claim; this is the claim
 * running. Nothing here reports a number the product does not produce — the
 * response figures are illustrative of the shape of the analytics screen, and
 * are labelled as an example.
 *
 * INTERACTION. Hover or focus selects on a pointer device; tap selects on
 * touch — the list is buttons, so a tap is a click and nothing requires a
 * hover that a phone cannot perform. One item is always selected, so the stage
 * is never empty.
 *
 * MOTION. `LayoutGroup` + `layout` do the work for anything that changes size
 * or position, so the transitions are real layout animations rather than
 * hand-tuned keyframes. Every duration sits between 180ms and 260ms. With
 * `prefers-reduced-motion` the hook returns true and every transition drops to
 * zero — the states still change, they just do not travel.
 */
type StateId = "words" | "device" | "feedback" | "anywhere";

export function AfterStage({
  items,
}: {
  items: { id: StateId; title: string; body: string }[];
}) {
  const [active, setActive] = useState<StateId>("words");
  const reduce = useReducedMotion();

  /** 180–260ms, or nothing at all when the reader has asked for stillness. */
  const t = reduce ? { duration: 0 } : { duration: 0.22, ease: [0.22, 1, 0.36, 1] as const };

  return (
    <div className="lp-split">
        <div className="lp-list">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              className="lp-list-item"
              data-open={item.id === active ? "true" : undefined}
              aria-pressed={item.id === active}
              onClick={() => setActive(item.id)}
              /*
               * `onMouseMove`, NOT `onMouseEnter`.
               *
               * Selecting an item expands its description, which reflows the
               * list — and a reflow that slides a different item under a
               * stationary cursor fires `mouseenter` on it. The last item was
               * therefore unselectable: clicking it re-flowed the list and the
               * item now under the pointer immediately stole the selection
               * back. `mousemove` only fires when the pointer actually moves,
               * so hover still selects and the layout can no longer select
               * for you.
               */
              onMouseMove={() => setActive(item.id)}
              onFocus={() => setActive(item.id)}
            >
              <h3>{item.title}</h3>
              <span className="lp-list-body">
                <span>{item.body}</span>
              </span>
            </button>
          ))}
        </div>

        {/*
          One stage, always present. Only its contents change.

          A KEYED MOUNT RATHER THAN AN EXIT ANIMATION. This was
          `AnimatePresence mode="wait"`, which holds the outgoing child until
          its exit resolves — and inside a LayoutGroup, with layout-animated
          children of its own, that resolution never arrived: the state changed
          (verified on the page) while the stage kept rendering the first demo
          forever. Changing the key remounts, so the new state cannot be
          blocked by the old one leaving.
        */}
        <div className="lp-stage" data-active={active} aria-live="polite">
            <motion.div
              key={active}
              initial={{ opacity: 0, y: reduce ? 0 : 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={t}
              className="lp-stage-inner"
            >
              {active === "words" && <WordsDemo t={t} />}
              {active === "device" && <DeviceDemo />}
              {active === "feedback" && <FeedbackDemo t={t} />}
              {active === "anywhere" && <AnywhereDemo t={t} />}
            </motion.div>
        </div>
    </div>
  );
}

type Transition = { duration: number; ease?: readonly [number, number, number, number] };

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="lp-frame">
      <div className="lp-frame-bar">
        <span className="lp-frame-dot" />
        <span className="lp-frame-dot" />
        <span className="lp-frame-dot" />
        <span className="lp-frame-title">{title}</span>
      </div>
      <div className="lp-frame-body">{children}</div>
    </div>
  );
}

/** A. The headline actually gets shorter. */
function WordsDemo({ t }: { t: Transition }) {
  const l = useTranslations("landing");
  const [short, setShort] = useState(false);

  return (
    <Frame title={l("demoTitle")}>
      {/* The headline really shortens: the text changes and the block below it
          moves up to meet it, which is the whole point of the demonstration. */}
      <motion.p layout className="lp-demo-head" transition={t}>
        <motion.span
          key={short ? "short" : "long"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={t}
        >
          {short ? l("demoWordsAfter") : l("demoWordsBefore")}
        </motion.span>
      </motion.p>
      <motion.p layout className="lp-demo-sub" transition={t}>
        {l("demoWordsSub")}
      </motion.p>

      <div className="lp-demo-chat">
        <span className="lp-demo-you">{l("demoWordsAsk")}</span>
        <button type="button" className="lp-demo-run" onClick={() => setShort((v) => !v)}>
          {short ? l("demoUndo") : l("demoSend")}
        </button>
      </div>
    </Frame>
  );
}

/** B. The frame actually changes width. */
function DeviceDemo() {
  const l = useTranslations("landing");
  /*
   * Pixel maximums, not percentages.
   *
   * Motion will not interpolate `width` between percentage strings, and it
   * silently declines to animate a `max-width` whose starting value is `none` —
   * both times the frame simply never resized and no inline style was written
   * at all. Numeric pixels on both ends, with an explicit `initial`, is the
   * form it will always animate. `max-width: 100%` in the stylesheet keeps it
   * inside a narrow stage.
   */
  const sizes = [
    { id: "desktop", label: l("demoDesktop"), max: 560 },
    { id: "tablet", label: l("demoTablet"), max: 360 },
    { id: "phone", label: l("demoPhone"), max: 220 },
  ] as const;
  const [size, setSize] = useState<(typeof sizes)[number]["id"]>("desktop");
  const current = sizes.find((s) => s.id === size) ?? sizes[0];

  return (
    <div className="lp-device">
      <div className="lp-seg" role="group">
        {sizes.map((s) => (
          <button
            key={s.id}
            type="button"
            data-on={s.id === size ? "true" : undefined}
            onClick={() => setSize(s.id)}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/*
        THE WIDTH IS THE ANIMATION, and it is a CSS transition rather than a
        Motion one.
        
        Motion would not drive this property: percentages it refused to
        interpolate, a `max-width` starting at `none` it declined silently
        writing no style at all, and with a numeric `initial` it wrote the first
        value and then ignored every later `animate`. A CSS transition on a
        numeric width is one line, always interpolates, and honours the
        `prefers-reduced-motion` block this stylesheet already carries. Motion
        still drives everything else on this stage.
      */}
      <div className="lp-device-frame" style={{ width: current.max }}>
        <div className="lp-device-screen">
          <span className="lp-device-line" style={{ width: "62%" }} />
          <span className="lp-device-line" style={{ width: "88%" }} />
          <span className="lp-device-block" />
          <span className="lp-device-line" style={{ width: "44%" }} />
        </div>
      </div>
      <p className="lp-demo-note">{l("demoDeviceNote")}</p>
    </div>
  );
}

/** C. Responses arrive and the counters count. */
function FeedbackDemo({ t }: { t: Transition }) {
  const l = useTranslations("landing");
  const bars = [3, 5, 2, 7, 4, 8, 6];

  return (
    <Frame title={l("demoFeedbackTitle")}>
      <div className="lp-metrics">
        <span>
          <b>24</b>
          {l("demoResponses")}
        </span>
        <span>
          <b>19</b>
          {l("demoPeople")}
        </span>
      </div>
      <div className="lp-bars" aria-hidden>
        {bars.map((h, i) => (
          <motion.span
            key={i}
            initial={{ height: 4 }}
            animate={{ height: h * 7 }}
            transition={{ ...t, delay: i * 0.03 }}
          />
        ))}
      </div>
      <p className="lp-demo-note">{l("demoFeedbackNote")}</p>
    </Frame>
  );
}

/** D. A messenger thread — labelled as not yet available. */
function AnywhereDemo({ t }: { t: Transition }) {
  const l = useTranslations("landing");
  const [sent, setSent] = useState(false);

  return (
    <div className="lp-thread">
      <div className="lp-thread-bar">
        <span className="lp-thread-av" aria-hidden />
        <span className="lp-thread-name">Ventrio</span>
        <span className="lp-thread-soon">{l("chatEyebrow")}</span>
      </div>
      <div className="lp-thread-body">
        <div className="lp-thread-msg lp-thread-msg--you">{l("demoAnywhereAsk")}</div>
        <AnimatePresence initial={false}>
          {sent && (
            <motion.div
              className="lp-thread-msg lp-thread-msg--v"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={t}
            >
              {l("demoAnywhereReply")}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <button type="button" className="lp-demo-run" onClick={() => setSent((v) => !v)}>
        {sent ? l("demoUndo") : l("demoSend")}
      </button>
      <p className="lp-demo-note">{l("demoAnywhereNote")}</p>
    </div>
  );
}

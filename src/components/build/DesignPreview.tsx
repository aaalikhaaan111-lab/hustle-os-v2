"use client";

import type { DesignPreviewId } from "@/lib/build/intake";

/**
 * Deterministic thumbnails for the visual-direction choices.
 *
 * Drawn in CSS from Ventrio-owned fixtures rather than fetched or generated.
 * Three reasons, in order of weight:
 *
 *   1. Choosing a direction must not cost an image generation. The whole point
 *      of the intake is to reach a build quickly and cheaply; paying a model to
 *      render three options the user will discard two of inverts that.
 *   2. They must be identical on every render, or the same project would look
 *      different after a refresh and the "you picked this one" affordance would
 *      quietly lie.
 *   3. They are abstractions, not samples. A photorealistic mock would promise
 *      a specific page; these promise a treatment — contrast, density, rhythm —
 *      which is what the choice actually controls.
 *
 * Each is a miniature of the direction's own logic: the cinematic one is a
 * dark frame with one dominant mass, mission-control is a dense grid of small
 * elements, editorial is a measure of text beside generous space, and so on.
 */
export function DesignPreview({ id }: { id: DesignPreviewId }) {
  return (
    <div
      aria-hidden
      className="relative h-full w-full overflow-hidden rounded-[10px]"
      style={{ background: PREVIEWS[id].bg }}
    >
      {PREVIEWS[id].render()}
    </div>
  );
}

const bar = (
  top: string,
  left: string,
  width: string,
  height: string,
  color: string,
  radius = "2px"
) => (
  <span
    key={`${top}-${left}-${width}`}
    style={{ position: "absolute", top, left, width, height, background: color, borderRadius: radius }}
  />
);

const PREVIEWS: Record<DesignPreviewId, { bg: string; render: () => React.ReactNode }> = {
  // One dominant mass, deep field, a single warm accent.
  cinematic: {
    bg: "linear-gradient(150deg,#12141c 0%,#1c1f2b 60%,#241a18 100%)",
    render: () => (
      <>
        {bar("58%", "10%", "62%", "12%", "rgba(255,255,255,0.92)", "1px")}
        {bar("74%", "10%", "38%", "5%", "rgba(255,255,255,0.34)")}
        {bar("84%", "10%", "22%", "5%", "rgba(232,120,74,0.9)")}
        <span
          style={{
            position: "absolute", inset: 0,
            background: "radial-gradient(120% 70% at 78% 22%, rgba(232,120,74,0.30), transparent 60%)",
          }}
        />
      </>
    ),
  },
  // Dense instrumentation: many small elements on a ruled field.
  missionControl: {
    bg: "linear-gradient(180deg,#0d1117 0%,#131a24 100%)",
    render: () => (
      <>
        <span
          style={{
            position: "absolute", inset: 0, opacity: 0.5,
            backgroundImage:
              "linear-gradient(rgba(120,200,255,0.14) 1px,transparent 1px),linear-gradient(90deg,rgba(120,200,255,0.14) 1px,transparent 1px)",
            backgroundSize: "14% 22%",
          }}
        />
        {bar("16%", "8%", "26%", "6%", "rgba(110,220,200,0.95)")}
        {bar("34%", "8%", "44%", "4%", "rgba(255,255,255,0.42)")}
        {bar("46%", "8%", "34%", "4%", "rgba(255,255,255,0.28)")}
        {bar("66%", "8%", "18%", "20%", "rgba(110,220,200,0.28)")}
        {bar("66%", "30%", "18%", "14%", "rgba(255,255,255,0.16)")}
        {bar("66%", "52%", "18%", "24%", "rgba(110,220,200,0.18)")}
        {bar("66%", "74%", "18%", "10%", "rgba(255,255,255,0.12)")}
      </>
    ),
  },
  // A narrow measure of text against deliberate emptiness.
  editorial: {
    bg: "linear-gradient(180deg,#fbfaf7 0%,#f2efe9 100%)",
    render: () => (
      <>
        {bar("14%", "10%", "16%", "4%", "rgba(30,32,40,0.45)")}
        {bar("26%", "10%", "54%", "9%", "rgba(24,26,34,0.88)", "1px")}
        {bar("42%", "10%", "44%", "4%", "rgba(24,26,34,0.30)")}
        {bar("52%", "10%", "48%", "4%", "rgba(24,26,34,0.30)")}
        {bar("62%", "10%", "36%", "4%", "rgba(24,26,34,0.30)")}
        {bar("80%", "10%", "22%", "6%", "rgba(24,26,34,0.80)")}
        <span style={{ position: "absolute", top: "12%", right: "8%", width: "1px", height: "76%", background: "rgba(24,26,34,0.16)" }} />
      </>
    ),
  },
  // Airy, rounded, low-contrast — light product surfaces.
  softLight: {
    bg: "linear-gradient(160deg,#f7f8fd 0%,#eef1fb 100%)",
    render: () => (
      <>
        {bar("18%", "12%", "46%", "8%", "rgba(40,44,64,0.80)", "3px")}
        {bar("34%", "12%", "62%", "4%", "rgba(40,44,64,0.24)", "3px")}
        {bar("54%", "12%", "24%", "26%", "rgba(93,107,255,0.16)", "8px")}
        {bar("54%", "40%", "24%", "26%", "rgba(93,107,255,0.10)", "8px")}
        {bar("54%", "68%", "20%", "26%", "rgba(93,107,255,0.20)", "8px")}
      </>
    ),
  },
  // Hard edges, heavy weight, no softness anywhere.
  brutalist: {
    bg: "#f3f1ec",
    render: () => (
      <>
        {bar("12%", "8%", "84%", "3%", "#16171b", "0")}
        {bar("24%", "8%", "58%", "16%", "#16171b", "0")}
        {bar("48%", "8%", "40%", "5%", "#16171b", "0")}
        {bar("60%", "8%", "26%", "5%", "rgba(22,23,27,0.42)", "0")}
        {bar("76%", "8%", "84%", "3%", "#16171b", "0")}
        {bar("84%", "62%", "30%", "8%", "#d84a2a", "0")}
      </>
    ),
  },
  // Warm paper, hand-made, generous margins.
  warmCraft: {
    bg: "linear-gradient(170deg,#fdf8f1 0%,#f6ece0 100%)",
    render: () => (
      <>
        <span style={{ position: "absolute", inset: "8%", border: "1px solid rgba(120,84,54,0.28)", borderRadius: "6px" }} />
        {bar("26%", "18%", "40%", "8%", "rgba(88,60,38,0.86)", "1px")}
        {bar("42%", "18%", "56%", "4%", "rgba(88,60,38,0.34)")}
        {bar("52%", "18%", "44%", "4%", "rgba(88,60,38,0.34)")}
        {bar("68%", "18%", "20%", "7%", "rgba(196,116,64,0.92)", "999px")}
      </>
    ),
  },
};

import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";

/**
 * A real generated artifact, kept as a fixture.
 *
 * This is the Chronoverse output from production — the one whose headings
 * shredded into one or two letters per line at 390px. Reproducing that needed
 * the actual copy: the defect only shows with the long unbroken words this
 * artifact happens to contain ("remembers", "chronologically", "Chronoverse"),
 * so a fixture written with short words would have hidden it.
 *
 * Used by the responsive regression test and the dev-only render harness.
 * Nothing generates it; it never reaches a model.
 */
export const CHRONOVERSE_OUTPUT: Stage3ProjectOutput = {
  version: 1,
  preset: "content_media",
  identity: {
    name: "Chronoverse",
    tagline: "The MCU, reordered",
    description:
      "Chronoverse strips away the year each MCU movie or show came out and rebuilds the universe by when its story actually takes place — 1943 to now — with every continuity link and easter egg marked at the point it first plants itself.",
  },
  targetUser:
    "MCU fans who've rewatched everything but still can't say for certain what happened before what, or who know they're missing easter eggs that only make sense once you see the full picture",
  primaryValue:
    "Turns years of scattered MCU knowledge into one scrollable, chronologically-ordered map where every continuity link and easter egg is marked exactly where it belongs",
  visual: {
    mood: "A mission-control star-chart feel — precise, dark, and quietly cinematic",
    palette: ["#050810", "#8ab4ff", "#e8edff"],
    styleNotes: "Dark field, thin rules, monospace labels against a heavy display face",
    theme: "atmospheric",
  },
  design: {
    archetype: "warm_archive",
    heroComposition: "editorial_lede",
    typeScale: "dramatic",
    density: "airy",
    grid: "asymmetric",
    cardTreatment: "flat",
    cornerStyle: "sharp",
    colorLogic: "duotone",
    imageryStrategy: "typographic",
    motionLevel: "subtle",
    ctaPattern: "section_end",
    navModel: "anchors",
    showIdentityBlock: true,
    showLaunchBlock: false,
  },
  hero: {
    eyebrow: "The MCU, reordered",
    headline: "Not release order. The order it actually happened.",
    subheadline:
      "Chronoverse strips away the year each MCU movie or show came out and rebuilds the universe by when its story actually takes place.",
    visualKind: "mockup",
    visualPrompt:
      "a vertical timeline spine on a dark screen, showing '1943 — Captain America: The First Avenger' at the top node connected by a glowing blue line down to '1995 — Captain Marvel'",
  },
  sections: [
    {
      kind: "story",
      title: "You already know the confusion",
      body:
        "You watched The Avengers before Captain Marvel existed. You watched Thor before you understood why Erik Selvig was already deep in Tesseract research. You caught the Ten Rings symbol in Iron Man years before it meant anything, and by the time it mattered again you'd forgotten it was ever there.",
    },
    {
      kind: "showcase",
      title: "Jump to an era and see what actually connects",
      body:
        "Pick a stretch of the timeline. Each one opens the real threads running underneath it — not a summary, the actual links.",
      items: [
        {
          title: "The War Years — 1943",
          body: "Where the Tesseract enters the story, and why everything after it is a consequence.",
          visualPrompt: "",
        },
        {
          title: "Origins Era — 2010–2011",
          body: "Three unconnected films that are quietly building the same shelf of objects.",
          visualPrompt: "",
        },
        {
          title: "Endgame Stretch — 2018–2019",
          body:
            "Infinity War and Endgame aren't a new story — they're every stone, every relationship, and every leftover object from the previous decade being called due simultaneously.",
          visualPrompt: "",
        },
      ],
    },
    {
      kind: "process",
      title: "How the reordering works",
      body: "Three passes, in order.",
      steps: [
        { title: "Anchor every title to a year", body: "Not the release year — the year the story takes place." },
        { title: "Mark the continuity links", body: "Every object, character and reference gets pinned where it first appears." },
        { title: "Rebuild the scroll", body: "The map reorders itself around what actually connects." },
      ],
    } as Stage3ProjectOutput["sections"][number],
    {
      kind: "stats",
      title: "The shape of it",
      body: "What the reordering covers.",
      stats: [
        { value: "1943", label: "Earliest anchored year" },
        { value: "36", label: "Titles placed chronologically" },
        { value: "400+", label: "Continuity links marked" },
      ],
    } as Stage3ProjectOutput["sections"][number],
  ],
  cta: {
    label: "Open the timeline",
    action: "follow",
    supportingText: "Start at 1943 and scroll forward, or jump straight to the era you're arguing about.",
  },
  form: {
    title: "Tell me what's missing",
    description: "If a link or an easter egg isn't marked where it should be, say so.",
    submitLabel: "Send it",
    fields: [
      { id: "title", label: "Which title", type: "text", required: true, options: [] },
      { id: "missing", label: "What's missing", type: "textarea", required: true, options: [] },
    ],
  },
  launchCopy: {
    headline: "The MCU, finally in the order it actually happened",
    body: "Chronoverse rebuilds the universe by story chronology and marks every continuity link where it first appears.",
    shortPost: "Rebuilt the MCU by when things actually happen, not when they came out.",
  },
};


/**
 * The same content under three different design strategies.
 *
 * Diversity has to be judged on composition, not colour, and judging it from
 * real generations costs a paid call each. These hold the copy constant and
 * vary only the decisions, so any visible difference is the design system
 * doing its job rather than the model writing different words.
 */
export const DESIGN_VARIANTS: Record<string, Stage3ProjectOutput["design"]> = {
  // A service for swapping plants: warm, communal, photographic.
  swap: {
    archetype: "playful_community",
    heroComposition: "stacked_center",
    typeScale: "balanced",
    density: "airy",
    grid: "single",
    cardTreatment: "raised",
    cornerStyle: "rounded",
    colorLogic: "warm_neutral",
    imageryStrategy: "photographic",
    motionLevel: "lively",
    ctaPattern: "sticky_footer",
    navModel: "anchors",
    showIdentityBlock: false,
    showLaunchBlock: true,
  },
  // A premium advisor: restrained, typographic, no decorative imagery.
  advisor: {
    archetype: "premium_minimal",
    heroComposition: "editorial_lede",
    typeScale: "dramatic",
    density: "airy",
    grid: "wide_gutter",
    cardTreatment: "flat",
    cornerStyle: "sharp",
    colorLogic: "high_contrast",
    imageryStrategy: "none",
    motionLevel: "still",
    ctaPattern: "section_end",
    navModel: "wordmark_only",
    showIdentityBlock: true,
    showLaunchBlock: false,
  },
  // Short finance lessons for teenagers: dense, utilitarian, stat-led.
  lessons: {
    archetype: "learning_product",
    heroComposition: "stat_led",
    typeScale: "compact",
    density: "tight",
    grid: "two_col",
    cardTreatment: "outlined",
    cornerStyle: "pill",
    colorLogic: "tinted_surface",
    imageryStrategy: "typographic",
    motionLevel: "subtle",
    ctaPattern: "inline",
    navModel: "anchors",
    showIdentityBlock: false,
    showLaunchBlock: false,
  },
};

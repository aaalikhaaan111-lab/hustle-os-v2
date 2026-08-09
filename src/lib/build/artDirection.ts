import type { Stage3DesignStrategy } from "@/lib/build/stage3Types";

/**
 * One art-directed system per project, chosen as a whole.
 *
 * The previous attempt gave the model fourteen independent decisions. It could
 * then pick luxury serif typography with a dashboard grid, or an image-led hero
 * with no image — and, worse, the combinations that were coherent still shared
 * the same two typefaces and the same dark canvas, so every output read as the
 * same template with the blocks moved around. Structural variation is not art
 * direction.
 *
 * A direction is a bundle: type system, surface, composition, graphic
 * treatment, motion and component language that were designed to go together.
 * The model chooses the direction, not the fourteen knobs, which is what makes
 * the outputs look like the work of different designers rather than one
 * template under different settings.
 *
 * Nothing here widens the security boundary. Every value is a key into a
 * stylesheet Ventrio owns; the model still cannot emit markup, CSS, URLs or
 * script, and nothing it chooses reaches the DOM as anything but a data
 * attribute from a closed set.
 */

export const ART_DIRECTIONS = [
  "cinematic",
  "editorial_magazine",
  "luxury_minimal",
  "technical_data",
  "playful_community",
  "utilitarian_tool",
  "warm_archive",
  "brutalist_poster",
] as const;
export type ArtDirection = (typeof ART_DIRECTIONS)[number];

/**
 * Type systems, by voice rather than by name.
 *
 * Each names a display face, a body face, and the weight/tracking/case
 * decisions that make it read as that voice. All six display faces ship the
 * Cyrillic subset — a Russian project gets the same art direction a Latin one
 * does, not a system-font fallback.
 */
export const TYPE_SYSTEMS = [
  "editorial_serif",    // Playfair Display — high contrast, magazine
  "expressive_display", // Unbounded — geometric, confident, modern
  "condensed_poster",   // Oswald — tall, tight, utilitarian
  "luxury_oldstyle",    // Cormorant Garamond — light, wide, quiet
  "technical_mono",     // JetBrains Mono — engineered, data
  "geometric_sans",     // Manrope — friendly, neutral, product
] as const;
export type TypeSystem = (typeof TYPE_SYSTEMS)[number];

/**
 * Whole-page surface treatments.
 *
 * These set the canvas, not a rectangle behind the content: background, ink,
 * borders and section separation all move together, which is what stops a
 * "different background" reading as the same page recoloured.
 */
export const SURFACES = [
  "editorial_paper",
  "deep_canvas",
  "atmospheric_gradient",
  "geometric_grid",
  "grain_field",
  "radial_glow",
  "colour_fields",
  "mono_contrast",
] as const;
export type Surface = (typeof SURFACES)[number];

/** Ventrio-owned graphic treatments, used instead of fake image placeholders. */
export const GRAPHIC_TREATMENTS = [
  "none",
  "type_composition",
  "diagram",
  "timeline",
  "data_marks",
  "shape_field",
  "rules_and_frames",
] as const;
export type GraphicTreatment = (typeof GRAPHIC_TREATMENTS)[number];

export const MOTION_VOCABULARIES = [
  "none",
  "staggered_reveal",
  "masked_heading",
  "section_fade",
  "drift_background",
  "hover_lift",
  "timeline_progress",
] as const;
export type MotionVocabulary = (typeof MOTION_VOCABULARIES)[number];

export interface ArtDirectionPreset {
  typeSystem: TypeSystem;
  surface: Surface;
  graphic: GraphicTreatment;
  motion: MotionVocabulary;
  /** The layout half, reusing the vocabulary the renderer already honours. */
  layout: Pick<
    Stage3DesignStrategy,
    | "heroComposition" | "typeScale" | "density" | "grid" | "cardTreatment"
    | "cornerStyle" | "colorLogic" | "imageryStrategy" | "motionLevel"
    | "ctaPattern" | "navModel" | "showIdentityBlock" | "showLaunchBlock"
  >;
}

export const ART_DIRECTION_PRESETS: Record<ArtDirection, ArtDirectionPreset> = {
  // Wide, dark, few words, one confident image-scale moment.
  cinematic: {
    typeSystem: "condensed_poster",
    surface: "deep_canvas",
    graphic: "shape_field",
    motion: "masked_heading",
    layout: {
      heroComposition: "full_bleed_type", typeScale: "dramatic", density: "airy",
      grid: "single", cardTreatment: "flat", cornerStyle: "sharp",
      colorLogic: "high_contrast", imageryStrategy: "none", motionLevel: "subtle",
      ctaPattern: "section_end", navModel: "wordmark_only",
      showIdentityBlock: false, showLaunchBlock: false,
    },
  },
  // Paper, asymmetry, a real lede, rules between things.
  editorial_magazine: {
    typeSystem: "editorial_serif",
    surface: "editorial_paper",
    graphic: "rules_and_frames",
    motion: "staggered_reveal",
    layout: {
      heroComposition: "editorial_lede", typeScale: "dramatic", density: "regular",
      grid: "asymmetric", cardTreatment: "flat", cornerStyle: "sharp",
      colorLogic: "duotone", imageryStrategy: "none", motionLevel: "subtle",
      ctaPattern: "inline", navModel: "anchors",
      showIdentityBlock: true, showLaunchBlock: false,
    },
  },
  // Space as the luxury. Light weights, wide gutters, almost nothing on screen.
  luxury_minimal: {
    typeSystem: "luxury_oldstyle",
    surface: "atmospheric_gradient",
    graphic: "none",
    motion: "section_fade",
    layout: {
      heroComposition: "stacked_center", typeScale: "dramatic", density: "airy",
      grid: "wide_gutter", cardTreatment: "flat", cornerStyle: "sharp",
      colorLogic: "warm_neutral", imageryStrategy: "none", motionLevel: "still",
      ctaPattern: "hero_only", navModel: "wordmark_only",
      showIdentityBlock: false, showLaunchBlock: false,
    },
  },
  // Engineered: monospace, ruled grid, dense rows, numbers doing the talking.
  technical_data: {
    typeSystem: "technical_mono",
    surface: "geometric_grid",
    graphic: "data_marks",
    motion: "none",
    layout: {
      heroComposition: "panel", typeScale: "compact", density: "tight",
      grid: "two_col", cardTreatment: "outlined", cornerStyle: "sharp",
      colorLogic: "mono_accent", imageryStrategy: "none", motionLevel: "still",
      ctaPattern: "inline", navModel: "anchors",
      showIdentityBlock: true, showLaunchBlock: false,
    },
  },
  // Colour blocks, round cards, movement on hover.
  playful_community: {
    typeSystem: "expressive_display",
    surface: "colour_fields",
    graphic: "shape_field",
    motion: "hover_lift",
    layout: {
      heroComposition: "stacked_center", typeScale: "balanced", density: "regular",
      grid: "single", cardTreatment: "raised", cornerStyle: "rounded",
      colorLogic: "tinted_surface", imageryStrategy: "none", motionLevel: "lively",
      ctaPattern: "sticky_footer", navModel: "anchors",
      showIdentityBlock: false, showLaunchBlock: true,
    },
  },
  // A tool, not a brochure: dense panel, plain sans, no ornament.
  utilitarian_tool: {
    typeSystem: "geometric_sans",
    surface: "mono_contrast",
    graphic: "diagram",
    motion: "none",
    layout: {
      heroComposition: "panel", typeScale: "compact", density: "tight",
      grid: "two_col", cardTreatment: "outlined", cornerStyle: "soft",
      colorLogic: "high_contrast", imageryStrategy: "none", motionLevel: "still",
      ctaPattern: "hero_only", navModel: "wordmark_only",
      showIdentityBlock: true, showLaunchBlock: false,
    },
  },
  // Grain, warmth, chronology.
  warm_archive: {
    typeSystem: "editorial_serif",
    surface: "grain_field",
    graphic: "timeline",
    motion: "timeline_progress",
    layout: {
      heroComposition: "stat_led", typeScale: "balanced", density: "airy",
      grid: "asymmetric", cardTreatment: "inset", cornerStyle: "soft",
      colorLogic: "warm_neutral", imageryStrategy: "none", motionLevel: "subtle",
      ctaPattern: "section_end", navModel: "wordmark_only",
      showIdentityBlock: true, showLaunchBlock: true,
    },
  },
  // Type as the entire graphic. Loud, flat, unapologetic.
  brutalist_poster: {
    typeSystem: "condensed_poster",
    surface: "mono_contrast",
    graphic: "type_composition",
    motion: "staggered_reveal",
    layout: {
      heroComposition: "full_bleed_type", typeScale: "dramatic", density: "tight",
      grid: "single", cardTreatment: "outlined", cornerStyle: "sharp",
      colorLogic: "mono_accent", imageryStrategy: "typographic", motionLevel: "subtle",
      ctaPattern: "inline", navModel: "none",
      showIdentityBlock: false, showLaunchBlock: false,
    },
  },
};

export function isArtDirection(value: unknown): value is ArtDirection {
  return (ART_DIRECTIONS as readonly unknown[]).includes(value);
}

/**
 * The full design strategy implied by a direction.
 *
 * Layout comes from the preset rather than from the model, which is what makes
 * the combination coherent by construction: there is no way to ask for luxury
 * serif typography on a dashboard grid, because neither is chosen separately.
 */
export function resolveArtDirection(direction: ArtDirection): Stage3DesignStrategy & {
  artDirection: ArtDirection;
  typeSystem: TypeSystem;
  surface: Surface;
  graphic: GraphicTreatment;
  motion: MotionVocabulary;
} {
  const preset = ART_DIRECTION_PRESETS[direction];
  return {
    ...preset.layout,
    // `archetype` stays for continuity with stored artifacts; the direction is
    // now what actually decides the look.
    archetype: "premium_minimal",
    artDirection: direction,
    typeSystem: preset.typeSystem,
    surface: preset.surface,
    graphic: preset.graphic,
    motion: preset.motion,
  };
}

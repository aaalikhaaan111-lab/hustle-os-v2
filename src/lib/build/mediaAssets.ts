/**
 * The media Ventrio owns, and the ways a page may use it.
 *
 * Type-only pages cannot match what people expect from a generated site, but
 * letting a model supply image URLs would hand it an arbitrary network fetch
 * and an arbitrary origin. So the model never names a source: it picks an id
 * from this registry and a treatment from a closed list, and the renderer
 * resolves both to a local file under /media. There is no path by which a
 * model-authored string becomes a URL.
 *
 * These six are test assets, generated locally and committed. They exist so the
 * offline fixtures can be judged with real imagery rather than grey rectangles.
 * See docs/generated-imagery.md for what production still needs.
 */

export const MEDIA_ASSETS = {
  "cinematic-dusk": {
    src: "/media/cinematic-dusk.jpg",
    alt: "A dusk horizon fading from deep blue to warm light",
    /** Whether text sits comfortably on it without a scrim. */
    tone: "dark",
  },
  "editorial-still": {
    src: "/media/editorial-still.jpg",
    alt: "A warm paper surface with soft ink washes",
    tone: "light",
  },
  "luxury-stone": {
    src: "/media/luxury-stone.jpg",
    alt: "A pale stone surface in high key",
    tone: "light",
  },
  "technical-grid": {
    src: "/media/technical-grid.jpg",
    alt: "A measured grid with a highlighted region",
    tone: "light",
  },
  "playful-blocks": {
    src: "/media/playful-blocks.jpg",
    alt: "Overlapping blocks of saturated colour",
    tone: "light",
  },
  "brutalist-forms": {
    src: "/media/brutalist-forms.jpg",
    alt: "Hard black geometric forms on white",
    tone: "light",
  },
} as const;

export type MediaAssetId = keyof typeof MEDIA_ASSETS;
export const MEDIA_ASSET_IDS = Object.keys(MEDIA_ASSETS) as MediaAssetId[];

/**
 * How a page uses its asset.
 *
 * "none" is first-class: a composition that works without an image is better
 * than one that reserves a column for an image it does not have. Nothing here
 * ever renders an empty frame waiting for media.
 */
export const MEDIA_TREATMENTS = [
  "none",
  "full_bleed",
  "split",
  "background",
  "editorial_crop",
  "collage",
  "framed",
] as const;
export type MediaTreatment = (typeof MEDIA_TREATMENTS)[number];

export function isMediaAssetId(value: unknown): value is MediaAssetId {
  return typeof value === "string" && value in MEDIA_ASSETS;
}

export function resolveMedia(id: unknown): (typeof MEDIA_ASSETS)[MediaAssetId] | null {
  return isMediaAssetId(id) ? MEDIA_ASSETS[id] : null;
}

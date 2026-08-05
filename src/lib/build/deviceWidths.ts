/**
 * The widths the preview offers, and what each one means to the document.
 *
 * These are viewport widths handed to a real frame, not max-widths on a div —
 * see ViewportFrame. 390 and 768 are the common phone and tablet portrait
 * widths; desktop uses 1280 so the generated site's own large breakpoints
 * actually engage rather than sitting just under them.
 *
 * `mobile` must stay at or under 639 and `tablet` at or above 640, because the
 * app's own stylesheet splits its layouts there.
 *
 * Kept out of BuildScreen so it can be imported without pulling that
 * component's CSS chain into a plain Node test.
 */
export const DEVICE_WIDTHS = { mobile: 390, tablet: 768, desktop: 1280 } as const;

export type DeviceMode = keyof typeof DEVICE_WIDTHS;

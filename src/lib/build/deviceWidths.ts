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

/**
 * Viewport heights, used only by the sandboxed codegen preview.
 *
 * The React preview does not need these: it is portalled into a same-origin
 * frame whose height can be measured from its content, so it grows and the
 * workspace scrolls. A codegen page cannot be measured that way — it renders in
 * an opaque-origin frame, and a parent cannot read the scroll height of a
 * document it is not allowed to touch. Reading it would need script inside the
 * generated page reporting its own size, and the inner policy is
 * `script-src 'none'` precisely so nothing in there runs.
 *
 * So that preview gets a real viewport of a real device and scrolls inside it,
 * which is what a device frame does anyway. The numbers are the usual portrait
 * heights; desktop is a common laptop viewport rather than a full screen.
 */
export const DEVICE_HEIGHTS = { mobile: 844, tablet: 1024, desktop: 800 } as const;

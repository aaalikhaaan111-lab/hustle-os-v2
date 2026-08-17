import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;
const QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

function subscribe(onChange: () => void): () => void {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", onChange);
  return () => mql.removeEventListener("change", onChange);
}

/**
 * Whether the viewport is phone-sized.
 *
 * Rewritten from the shipped shadcn version, which set state inside an effect —
 * the repo's lint forbids it, and for a good reason here: that version renders
 * `false` on the server AND on the first client paint, then flips. On this shell
 * `isMobile` decides whether the navigation is a rail or a drawer, so the flip
 * is a visible jump on every load on a phone.
 *
 * `useSyncExternalStore` reads the media query during render on the client and
 * takes the server snapshot on the server, which is the same pattern the rest of
 * this workspace already uses for viewport state.
 */
export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    // The server cannot know the viewport. Desktop is the safer guess: a rail
    // rendered into HTML and replaced by a drawer is a smaller correction than
    // a drawer trigger rendered where a rail belongs.
    () => false,
  );
}

"use client";

import { useEffect } from "react";

/**
 * Makes the workspace behave like an app window rather than a web page.
 *
 * TWO PROBLEMS, and they are different problems that look the same.
 *
 * THE JUMP. The shell was sized with `100dvh`. `dvh` *tracks* the viewport as
 * mobile Safari collapses and expands its URL bar, so the shell resized on
 * every scroll gesture and the whole layout shifted under the person's thumb.
 * `100svh` — the small viewport, measured with the bar showing — is constant,
 * which is what a fixed shell wants. The stylesheet uses it as the fallback.
 *
 * THE KEYBOARD. Neither `svh` nor `dvh` reacts to a keyboard: both describe the
 * LAYOUT viewport, and iOS opens the keyboard over the page without changing
 * it. So the shell stayed full height, iOS scrolled the focused composer into
 * view, and the conversation went off the top — leaving a screen that was
 * mostly composer, which is exactly what was reported.
 *
 * `visualViewport` is the only thing that knows. Publishing its height as a
 * custom property lets the shell size itself to what is actually visible, so
 * the composer sits above the keyboard and the conversation keeps the rest of
 * the space instead of being pushed out of it.
 *
 * `offsetTop` matters too: iOS scrolls the *visual* viewport within the layout
 * viewport, so without accounting for it a fixed shell drifts up behind the
 * keyboard by exactly that amount.
 *
 * Set on the document element rather than passed through React so the value can
 * change at animation frequency while the keyboard slides, without re-rendering
 * the conversation on every frame.
 */
export function useAppViewport(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    const root = document.documentElement;
    let frame = 0;

    const apply = () => {
      frame = 0;
      // Rounded down: a fractional height leaves a sub-pixel gap that iOS
      // renders as a hairline of page showing under the shell.
      root.style.setProperty("--ventrio-app-height", `${Math.floor(viewport.height)}px`);
      root.style.setProperty("--ventrio-app-offset", `${Math.round(viewport.offsetTop)}px`);
    };

    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(apply);
    };

    apply();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);

    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
      // Handed back to the stylesheet's `100svh` fallback rather than left
      // pinned to whatever the last measurement happened to be.
      root.style.removeProperty("--ventrio-app-height");
      root.style.removeProperty("--ventrio-app-offset");
    };
  }, []);
}

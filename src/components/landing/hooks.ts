"use client";

import { useEffect, useRef, useState } from "react";

// Shared landing motion primitives. Kept in one place so the hero composer and
// the explanatory sections use the exact same, tested behaviour.

// Single read of the user's motion preference. Defaults to "motion on" so the
// server render and first client paint match; the effect corrects it on mount.
export function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return reduced;
}

// Types a phrase, holds, deletes, then advances. When disabled it simply
// returns the first phrase, fully typed and still. All updates happen inside
// timer callbacks — never synchronously in the effect body.
export function useTypewriter(phrases: string[], enabled: boolean) {
  const [typed, setTyped] = useState(phrases[0] ?? "");

  useEffect(() => {
    if (!enabled || phrases.length === 0) return;

    let timer: ReturnType<typeof setTimeout>;
    let phraseIndex = 0;
    let charCount = phrases[0].length;
    let phase: "holding" | "deleting" | "typing" = "holding";

    const tick = () => {
      const current = phrases[phraseIndex] ?? "";

      if (phase === "holding") {
        phase = "deleting";
        timer = setTimeout(tick, 1900);
        return;
      }

      if (phase === "deleting") {
        charCount -= 1;
        setTyped(current.slice(0, Math.max(0, charCount)));
        if (charCount <= 0) {
          phraseIndex = (phraseIndex + 1) % phrases.length;
          phase = "typing";
          timer = setTimeout(tick, 280);
          return;
        }
        timer = setTimeout(tick, 24);
        return;
      }

      const next = phrases[phraseIndex] ?? "";
      charCount += 1;
      setTyped(next.slice(0, charCount));
      if (charCount >= next.length) {
        phase = "holding";
        timer = setTimeout(tick, 20);
        return;
      }
      timer = setTimeout(tick, 50 + Math.random() * 46);
    };

    timer = setTimeout(tick, 1900);
    return () => clearTimeout(timer);
  }, [enabled, phrases]);

  return enabled ? typed : phrases[0] ?? "";
}

// Reveals the element the first time it scrolls into view. Fully imperative:
// the hidden→shown styling is gated on data-armed, which JS only sets after
// mount when motion is allowed — so server render and reduced-motion output are
// always fully visible and nothing can get stuck hidden. IntersectionObserver
// fires an initial callback for elements already in view, so above-the-fold
// content reveals immediately.
export function useReveal<T extends HTMLElement>(motion: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!motion || typeof IntersectionObserver === "undefined") {
      el.setAttribute("data-inview", "true");
      return;
    }
    el.setAttribute("data-armed", "true");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            el.setAttribute("data-inview", "true");
            io.disconnect();
          }
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [motion]);

  return ref;
}

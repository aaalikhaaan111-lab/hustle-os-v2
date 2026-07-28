"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { usePrefersReducedMotion } from "@/components/landing/hooks";

// A dynamic-length website (3-7 AI-chosen sections) needs its entrance
// animation triggered by actual scroll position, not by page mount — a
// mount-time animation finishes seconds before a visitor scrolls to section
// 5. This wraps each section in a plain div (semantics of the section tag
// inside are untouched) and reveals it once it enters the viewport.
export function ScrollReveal({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [reducedMotion]);

  return (
    <div ref={ref} style={style} className={`scroll-reveal${visible || reducedMotion ? " is-visible" : ""}`}>
      {children}
    </div>
  );
}

// A restrained parallax on the hero's decorative grid layer — capped
// magnitude, passive scroll listener, inert under reduced motion (renders
// the same static layer as before).
export function ParallaxAmbient() {
  const ref = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const node = ref.current;
    if (!node) return;
    function onScroll() {
      if (!node) return;
      const offset = Math.max(-40, Math.min(40, window.scrollY * -0.06));
      node.style.transform = `translateY(${offset}px)`;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [reducedMotion]);

  return <div ref={ref} className="project-output-ambient" aria-hidden />;
}

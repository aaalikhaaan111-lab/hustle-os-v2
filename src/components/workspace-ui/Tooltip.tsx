"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A tooltip that cannot be clipped.
 *
 * The collapsed rail needs `overflow: hidden` so labels never show through
 * mid-collapse, which means a CSS tooltip drawn inside it is invisible by
 * construction — that is why these were native `title` attributes, slow and
 * unstyled. This renders into a portal on <body> instead, positions itself from
 * the trigger's rect, and clamps to the viewport so it can never sit off-screen.
 *
 * It opens after a short delay so sweeping the pointer down the rail does not
 * flash six labels, and it closes immediately on leave, blur, scroll or Escape.
 */
export function Tooltip({
  label,
  side = "right",
  delay = 320,
  children,
}: {
  label: string;
  side?: "right" | "left";
  delay?: number;
  children: ReactNode;
}) {
  const wrap = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | null>(null);
  const [box, setBox] = useState<{ top: number; left: number } | null>(null);

  const clear = useCallback(() => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clear();
    setBox(null);
  }, [clear]);

  const open = useCallback(
    (immediate = false) => {
      clear();
      const show = () => {
        const trigger = wrap.current?.firstElementChild ?? wrap.current;
        if (!trigger) return;
        const r = trigger.getBoundingClientRect();
        const gap = 10;
        // Clamped so a long label near the top or bottom stays on screen.
        const top = Math.min(Math.max(r.top + r.height / 2, 24), window.innerHeight - 24);
        const left = side === "right" ? r.right + gap : r.left - gap;
        setBox({ top, left });
      };
      if (immediate) show();
      else timer.current = window.setTimeout(show, delay);
    },
    [clear, delay, side]
  );

  // Any movement of the page invalidates the position, so the tooltip goes.
  useEffect(() => {
    if (!box) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, [box, close]);

  useEffect(() => clear, [clear]);

  return (
    <>
      <span
        ref={wrap}
        className="contents"
        onPointerEnter={() => open()}
        onPointerLeave={close}
        onPointerDown={close}
        onFocusCapture={() => open(true)}
        onBlurCapture={close}
      >
        {children}
      </span>

      {box &&
        typeof document !== "undefined" &&
        createPortal(
          <span
            role="tooltip"
            className="ws-tip-pop"
            style={{
              top: box.top,
              left: box.left,
              transform: `translateY(-50%) ${side === "left" ? "translateX(-100%)" : ""}`,
            }}
          >
            {label}
          </span>,
          document.body
        )}
    </>
  );
}

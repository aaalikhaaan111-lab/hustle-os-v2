"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { NAV_ITEMS } from "@/lib/constants";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { readTourState, writeTourState, type TourState } from "@/lib/tour/tourStorage";

const TOUR_MESSAGES: Record<string, string> = {
  "/dashboard": "Здесь находится твой план на сегодня, прогресс и серия дней.",
  "/challenges": "Короткие практические задания, которые развивают предпринимательское мышление.",
  "/courses": "Видео, интерактивные уроки и глоссарий предпринимательских терминов.",
  "/workshops": "Живые квизы, где можно соревноваться и учиться вместе.",
  "/profile": "Здесь хранится твой прогресс, XP и личные результаты.",
};

const TOUR_STEPS = NAV_ITEMS.filter((item) => item.href in TOUR_MESSAGES);

// The tooltip card has a fixed width (see className below); its height is
// content-dependent, so positioning below always anchors from a top edge and
// positioning above always anchors from a bottom edge — neither ever needs
// to know the rendered height in advance, which avoids a measure-after-render
// race entirely.
const TOOLTIP_WIDTH = 280;

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function getVisibleTargetRect(href: string): Rect | null {
  const candidates = document.querySelectorAll<HTMLElement>(`[data-tour-nav="${href}"]`);
  for (const el of candidates) {
    const rect = el.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      return { top: rect.top, left: rect.left, width: rect.width, height: rect.height };
    }
  }
  return null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function ProductTour() {
  const { userId, isReady } = useGameProgress();
  const pathname = usePathname();
  const [state, setState] = useState<TourState | null>(null);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);

  // Pick up a tour that FirstSessionFlow just started, or resume one that was
  // mid-way when the page got refreshed. A completed tour never re-triggers.
  // ProductTour is mounted once in the root layout and persists across
  // client-side navigations, so isReady/userId alone don't change when
  // FirstSessionFlow writes a fresh "start the tour" record from a sibling
  // component right before its own router.push("/dashboard") — re-checking
  // on every pathname change is what actually picks that handoff up.
  useEffect(() => {
    if (!isReady || !userId) return;
    const stored = readTourState(userId);
    if (stored.active && !stored.completed) {
      // Reads localStorage (an external system) — not derived from
      // props/state available during render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState(stored);
    }
  }, [isReady, userId, pathname]);

  const step = state && state.active ? TOUR_STEPS[state.step] : null;

  const updateTargetRect = useCallback(() => {
    if (!step) return;
    setTargetRect(getVisibleTargetRect(step.href));
  }, [step]);

  useLayoutEffect(() => {
    // Measures the live position of a DOM node (nav link) rendered by a
    // sibling component — not something derivable during render itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    updateTargetRect();
  }, [updateTargetRect]);

  useEffect(() => {
    if (!step) return;
    window.addEventListener("resize", updateTargetRect);
    return () => window.removeEventListener("resize", updateTargetRect);
  }, [step, updateTargetRect]);

  const persist = useCallback(
    (next: TourState) => {
      if (!userId) return;
      setState(next);
      writeTourState(userId, next);
    },
    [userId]
  );

  const closeTour = useCallback(() => {
    if (!userId) return;
    persist({ active: false, completed: true, step: 0 });
  }, [userId, persist]);

  useEffect(() => {
    if (!step) return;
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") closeTour();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [step, closeTour]);

  if (!state || !state.active || !step || !targetRect || !userId) return null;

  const isFirst = state.step === 0;
  const isLast = state.step === TOUR_STEPS.length - 1;
  const margin = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const spotlightPadding = 6;
  const tooltipWidth = Math.min(TOOLTIP_WIDTH, viewportWidth - 24);

  let tooltipStyle: { top?: number; bottom?: number; left: number };

  if (targetRect.top > viewportHeight - 160) {
    // Mobile bottom nav: anchor the tooltip's bottom edge above the tab.
    tooltipStyle = {
      bottom: viewportHeight - targetRect.top + margin,
      left: clamp(
        targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        margin,
        viewportWidth - tooltipWidth - margin
      ),
    };
  } else if (targetRect.left < 220) {
    // Desktop sidebar: align the tooltip's top edge with the highlighted item.
    tooltipStyle = {
      top: clamp(targetRect.top, margin, viewportHeight - margin),
      left: targetRect.left + targetRect.width + margin,
    };
  } else {
    tooltipStyle = {
      top: targetRect.top + targetRect.height + margin,
      left: clamp(targetRect.left, margin, viewportWidth - tooltipWidth - margin),
    };
  }

  return (
    <div className="fixed inset-0 z-[100]" role="presentation">
      <div
        className="fixed rounded-2xl transition-all duration-300 ease-out"
        style={{
          top: targetRect.top - spotlightPadding,
          left: targetRect.left - spotlightPadding,
          width: targetRect.width + spotlightPadding * 2,
          height: targetRect.height + spotlightPadding * 2,
          boxShadow: "0 0 0 9999px rgba(15,15,23,0.6)",
          pointerEvents: "none",
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Тур: ${step.label}`}
        className="fixed w-[280px] max-w-[calc(100vw-24px)] rounded-2xl border border-white/70 bg-white p-5 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.35)] transition-all duration-300 ease-out"
        style={tooltipStyle}
      >
        <div className="mb-3 flex justify-center gap-1.5">
          {TOUR_STEPS.map((tourStep, index) => (
            <span
              key={tourStep.href}
              className={`h-1.5 w-6 rounded-full transition-colors duration-200 ${
                index === state.step ? "bg-accent" : "bg-zinc-200"
              }`}
            />
          ))}
        </div>
        <h3 className="text-base font-extrabold tracking-[-0.02em] text-ink">{step.label}</h3>
        <p className="mt-1.5 text-sm leading-relaxed tracking-tight text-ink-secondary">
          {TOUR_MESSAGES[step.href]}
        </p>
        <div className="mt-4 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={closeTour}
            className="text-xs font-semibold text-ink-muted transition-colors hover:text-ink"
          >
            Пропустить тур
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => persist({ ...state, step: state.step - 1 })}
              >
                Назад
              </Button>
            )}
            <Button
              type="button"
              size="sm"
              onClick={() => {
                if (isLast) {
                  closeTour();
                } else {
                  persist({ ...state, step: state.step + 1 });
                }
              }}
            >
              {isLast ? "Готово" : "Далее"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

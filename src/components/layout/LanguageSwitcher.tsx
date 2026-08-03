"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocaleAction } from "@/lib/actions/locale";
import { cn } from "@/lib/utils";
import { VentrioButton } from "@/components/ui/VentrioButton";
import { LOCALES, type Locale } from "@/i18n/locale";

const LOCALE_STORAGE_KEY = "hustle:locale";

/** Display order only. LOCALES stays the source of which locales exist — a
 *  language cannot be listed here before its translations ship — but that
 *  array is ordered for resolution, not for reading. */
const ORDER: readonly Locale[] = ["en", "ru"];
const OPTIONS = ORDER.filter((value) => LOCALES.includes(value));

/**
 * The interface language, as a selector rather than a pair of buttons: the
 * chosen language is stated in the trigger, and the alternatives only appear
 * when asked for. It opens upward because it lives at the bottom of the page.
 *
 * Only the locales the app actually ships are listed — LOCALES is the source,
 * so a language cannot appear here before its translations exist.
 */
export function LanguageSwitcher({
  className,
  variant = "menu",
}: {
  className?: string;
  /**
   * "menu" is the dark popover the landing footer and the public drawer use.
   * "list" is the same control, and the same switching behaviour, presented as
   * a settings section on a light surface — one implementation, two surfaces.
   */
  variant?: "menu" | "list";
}) {
  const locale = useLocale() as Locale;
  const t = useTranslations("profile");
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const listId = useId();

  const label = (value: Locale) => (value === "ru" ? t("languageRussian") : t("languageEnglish"));

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [open]);

  // Focus the current language when the list opens, so keyboard users land on
  // where they are rather than at the top of a list.
  useEffect(() => {
    if (!open) return;
    optionRefs.current[OPTIONS.indexOf(locale)]?.focus();
  }, [open, locale]);

  function close(focusTrigger = true) {
    setOpen(false);
    if (focusTrigger) triggerRef.current?.focus();
  }

  function select(next: Locale) {
    if (next === locale || isPending) {
      close();
      return;
    }
    // localStorage is the client-only fallback signal (profile > cookie >
    // localStorage > device language); the cookie is what drives rendering.
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    setOpen(false);
    startTransition(async () => {
      await setLocaleAction(next);
      window.location.reload();
    });
  }

  function onListKeyDown(event: React.KeyboardEvent, index: number) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const delta = event.key === "ArrowDown" ? 1 : -1;
      const next = (index + delta + OPTIONS.length) % OPTIONS.length;
      optionRefs.current[next]?.focus();
    }
  }

  if (variant === "list") {
    return (
      <div className={cn("flex flex-col gap-1.5", className)} role="radiogroup" aria-label={t("languageLabel")}>
        {OPTIONS.map((option) => {
          const isActive = option === locale;
          return (
            <VentrioButton
              key={option}
              variant="secondary"
              size="lg"
              on={isActive}
              role="radio"
              aria-checked={isActive}
              disabled={isPending}
              onClick={() => select(option)}
              align="start" weight="medium" className="w-full px-3.5"
            >
              <span
                className="grid h-5 w-5 shrink-0 place-items-center rounded-full"
                style={{
                  background: isActive ? "var(--accent)" : "transparent",
                  boxShadow: isActive ? "none" : "inset 0 0 0 1.5px var(--line-2)",
                  color: "#fff",
                }}
                aria-hidden
              >
                {isActive && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3">
                    <path
                      d="M2.5 6.2 4.8 8.5 9.5 3.8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                )}
              </span>
              {label(option)}
              {isActive && (
                <span className="ml-auto text-[13px] font-normal" style={{ color: "var(--ink-3)" }}>
                  {t("languageInUse")}
                </span>
              )}
            </VentrioButton>
          );
        })}
      </div>
    );
  }

  return (
    <div ref={rootRef} className={cn("relative inline-block", className)}>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={t("languageLabel")}
          /* One border, one radius, a uniform 4px inset. Rows are rounded to
             radius-minus-inset (14 − 4 = 10px) so their corners run exactly
             parallel to the container's rather than floating inside them.
             Pinned in pixels: the theme's radius scale is customised here, so
             rounded-xl/rounded-lg did not land on a parallel pair. */
          className="absolute bottom-full right-0 z-50 mb-2 min-w-[10rem] rounded-[14px] border border-white/12 bg-[#14102c]/90 p-1 shadow-[0_18px_40px_-16px_rgba(4,2,16,0.9)] backdrop-blur-md"
        >
          {OPTIONS.map((option, index) => {
            const isActive = option === locale;
            return (
              <button
                key={option}
                ref={(node) => {
                  optionRefs.current[index] = node;
                }}
                type="button"
                role="option"
                aria-selected={isActive}
                disabled={isPending}
                onClick={() => select(option)}
                onKeyDown={(event) => onListKeyDown(event, index)}
                className={cn(
                  // A true menu row: full inner width, one consistent height,
                  // equal padding on both sides, no nested pill.
                  "flex h-9 w-full items-center gap-2 rounded-[10px] px-3 text-left text-[13px] transition-colors",
                  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent",
                  // The selection carries a background of its own, so hovering a
                  // different row cannot end up looking more selected than it.
                  isActive
                    ? "bg-white/[0.10] font-medium text-white"
                    : "text-white/65 hover:bg-white/[0.06] hover:text-white"
                )}
              >
                <svg
                  viewBox="0 0 12 12"
                  aria-hidden
                  className={cn("h-3 w-3 shrink-0", isActive ? "opacity-100" : "opacity-0")}
                >
                  <path
                    d="M2.5 6.2 L4.8 8.5 L9.5 3.8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                {label(option)}
              </button>
            );
          })}
        </div>
      )}

      <button
        ref={triggerRef}
        type="button"
        disabled={isPending}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === "ArrowUp" && !open) {
            event.preventDefault();
            setOpen(true);
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={t("languageLabel")}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1.5",
          "text-[13px] font-medium text-white/80 transition-colors",
          "hover:border-white/25 hover:text-white disabled:opacity-60",
          "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
          open && "border-white/25 text-white"
        )}
      >
        <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5 shrink-0 opacity-80">
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.3" />
          <path
            d="M1.9 6.2h12.2M1.9 9.8h12.2M8 1.75c1.9 2 1.9 10.5 0 12.5M8 1.75c-1.9 2-1.9 10.5 0 12.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.3"
          />
        </svg>
        {label(locale)}
        <svg
          viewBox="0 0 12 12"
          aria-hidden
          className={cn("h-3 w-3 shrink-0 opacity-70 transition-transform", open && "rotate-180")}
        >
          <path
            d="M3 4.75 L6 7.75 L9 4.75"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
    </div>
  );
}

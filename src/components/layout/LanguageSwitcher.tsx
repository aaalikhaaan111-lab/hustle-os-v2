"use client";

import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { setLocaleAction } from "@/lib/actions/locale";
import { cn } from "@/lib/utils";
import type { Locale } from "@/i18n/locale";

const LOCALE_STORAGE_KEY = "hustle:locale";

export function LanguageSwitcher({ className }: { className?: string }) {
  const locale = useLocale();
  const t = useTranslations("profile");
  const [isPending, startTransition] = useTransition();

  function handleSelect(next: Locale) {
    if (next === locale || isPending) return;
    // localStorage is a client-only fallback signal (per the persistence
    // priority: profile > cookie > localStorage > device language) — the
    // cookie set by setLocaleAction is what actually drives rendering.
    window.localStorage.setItem(LOCALE_STORAGE_KEY, next);
    startTransition(async () => {
      await setLocaleAction(next);
      window.location.reload();
    });
  }

  return (
    <div className={cn("inline-flex items-center gap-1 rounded-full bg-surface-hover p-1", className)}>
      {(["ru", "en"] as const).map((option) => (
        <button
          key={option}
          type="button"
          disabled={isPending}
          onClick={() => handleSelect(option)}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-semibold tracking-tight transition-colors duration-150 disabled:opacity-60",
            locale === option
              ? "bg-white text-ink shadow-sm"
              : "text-ink-secondary hover:text-ink"
          )}
        >
          {option === "ru" ? t("languageRussian") : t("languageEnglish")}
        </button>
      ))}
    </div>
  );
}

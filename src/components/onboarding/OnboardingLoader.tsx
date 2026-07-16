"use client";

import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";

const PHRASE_KEYS = ["loadingPhrase1", "loadingPhrase2", "loadingPhrase3", "loadingPhrase4"] as const;

interface OnboardingLoaderProps {
  phraseIndex: number;
}

export function OnboardingLoader({ phraseIndex }: OnboardingLoaderProps) {
  const t = useTranslations("onboarding");

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-white/60 backdrop-blur-2xl">
      <div className="relative flex h-20 w-20 items-center justify-center">
        <div className="absolute inset-0 animate-spin rounded-full bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-25 blur-xl" />
        <div
          className="h-14 w-14 animate-spin rounded-full border-4 border-indigo-100 border-t-indigo-600"
          style={{ animationDuration: "0.9s" }}
        />
      </div>

      <p
        key={phraseIndex}
        role="status"
        aria-live="polite"
        className="animate-phrase-in max-w-sm px-6 text-center text-xl font-extrabold tracking-tight text-ink sm:text-2xl"
      >
        {t(PHRASE_KEYS[phraseIndex])}
      </p>

      <div className="flex gap-2">
        {PHRASE_KEYS.map((key, i) => (
          <span
            key={key}
            className={cn(
              "h-1.5 w-6 rounded-full transition-all duration-500 ease-in-out",
              i <= phraseIndex
                ? "bg-gradient-to-r from-indigo-600 to-pink-500"
                : "bg-zinc-200"
            )}
          />
        ))}
      </div>
    </div>
  );
}

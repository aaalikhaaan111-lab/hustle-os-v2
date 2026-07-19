"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { CheckIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { completeOnboardingAction } from "@/lib/actions/onboarding";
import { INTEREST_OPTIONS, TOPIC_OPTIONS } from "@/lib/constants";
import { OnboardingLoader } from "@/components/onboarding/OnboardingLoader";

const TIME_OPTIONS = [
  { minutes: 5, labelKey: "minutes5" },
  { minutes: 10, labelKey: "minutes10" },
  { minutes: 15, labelKey: "minutes15" },
] as const;

const PHRASE_INTERVAL_MS = 1200;
const PHRASE_COUNT = 4;

export function OnboardingForm() {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [interests, setInterests] = useState<string[]>([]);
  const [topics, setTopics] = useState<string[]>([]);
  const [dailyMinutes, setDailyMinutes] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isGenerating, setIsGenerating] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);

  useEffect(() => {
    if (!isGenerating) return;

    if (phraseIndex >= PHRASE_COUNT - 1) {
      const timeout = setTimeout(() => {
        router.push("/first-session");
      }, PHRASE_INTERVAL_MS);
      return () => clearTimeout(timeout);
    }

    const timeout = setTimeout(() => {
      setPhraseIndex((index) => index + 1);
    }, PHRASE_INTERVAL_MS);
    return () => clearTimeout(timeout);
  }, [isGenerating, phraseIndex, router]);

  function toggleInterest(id: string) {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
    setError(null);
  }

  function toggleTopic(id: string) {
    setTopics((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  function handleSubmit() {
    if (interests.length === 0) {
      setError(t("selectInterest"));
      return;
    }
    if (dailyMinutes === null) {
      setError(t("selectTime"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await completeOnboardingAction(interests, dailyMinutes, topics);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setPhraseIndex(0);
      setIsGenerating(true);
    });
  }

  if (isGenerating) {
    return <OnboardingLoader phraseIndex={phraseIndex} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-10 py-10 sm:py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-[2rem] font-black leading-[1.08] tracking-[-0.02em] text-ink sm:text-4xl md:text-5xl">
          {t("title")}
        </h1>
        <p className="max-w-sm text-sm text-ink-secondary">{t("subtitle")}</p>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-ink">{t("interestsQuestion")}</h2>
        <div className="grid grid-cols-2 gap-3">
          {INTEREST_OPTIONS.map((option) => {
            const selected = interests.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={isPending}
                onClick={() => toggleInterest(option.id)}
                className={cn(
                  "relative flex flex-col items-start gap-1.5 rounded-2xl border px-4 py-4 text-left text-sm font-semibold transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100",
                  selected
                    ? "border-accent bg-accent-soft text-accent shadow-[0_8px_20px_rgba(99,102,241,0.15)]"
                    : "border-zinc-100/60 bg-white/70 text-ink-secondary shadow-sm backdrop-blur-md hover:border-zinc-200 hover:text-ink"
                )}
              >
                {selected && (
                  <CheckIcon className="absolute right-3 top-3 h-4 w-4 text-accent" />
                )}
                <span className="text-xl" role="img" aria-hidden>
                  {option.emoji}
                </span>
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-ink">{t("topicsQuestion")}</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TOPIC_OPTIONS.map((option) => {
            const selected = topics.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                disabled={isPending}
                onClick={() => toggleTopic(option.id)}
                className={cn(
                  "relative flex items-center gap-2 rounded-2xl border px-3.5 py-3 text-left text-sm font-semibold transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100",
                  selected
                    ? "border-accent bg-accent-soft text-accent shadow-[0_8px_20px_rgba(99,102,241,0.15)]"
                    : "border-zinc-100/60 bg-white/70 text-ink-secondary shadow-sm backdrop-blur-md hover:border-zinc-200 hover:text-ink"
                )}
              >
                <span className="text-lg" role="img" aria-hidden>
                  {option.emoji}
                </span>
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-base font-bold text-ink">{t("timeQuestion")}</h2>
        <div className="grid grid-cols-3 gap-3">
          {TIME_OPTIONS.map((option) => {
            const selected = dailyMinutes === option.minutes;
            return (
              <button
                key={option.minutes}
                type="button"
                disabled={isPending}
                onClick={() => {
                  setDailyMinutes(option.minutes);
                  setError(null);
                }}
                className={cn(
                  "rounded-2xl border px-4 py-4 text-center text-sm font-semibold transition-all duration-300 ease-out hover:scale-[1.02] active:scale-[0.97] disabled:opacity-60 disabled:hover:scale-100",
                  selected
                    ? "border-accent bg-accent-soft text-accent shadow-[0_8px_20px_rgba(99,102,241,0.15)]"
                    : "border-zinc-100/60 bg-white/70 text-ink-secondary shadow-sm backdrop-blur-md hover:border-zinc-200 hover:text-ink"
                )}
              >
                {t(option.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="text-center text-sm text-danger">{error}</p>}

      <Button onClick={handleSubmit} disabled={isPending} size="lg">
        {isPending ? t("saving") : t("finish")}
      </Button>
    </div>
  );
}

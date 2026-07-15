"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { VideoCard } from "@/components/VideoCard";
import { ChallengeConsole } from "@/components/challenges/ChallengeConsole";
import { LevelProgressCard } from "@/components/dashboard/LevelProgressCard";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import type { ChallengeDef } from "@/lib/challenges";
import type { VideoCourse } from "@/constants/data";

type FlowStep = "challenge1" | "lesson" | "challenge2" | "summary" | "tomorrow";

const STEP_ORDER: FlowStep[] = ["challenge1", "lesson", "challenge2", "summary", "tomorrow"];

interface FirstSessionFlowProps {
  firstChallenge: ChallengeDef;
  secondChallenge: ChallengeDef;
  lessonVideo: VideoCourse;
}

function hoursUntilMidnight(): { hours: number; minutes: number } {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const diffMs = midnight.getTime() - now.getTime();
  return {
    hours: Math.floor(diffMs / 3_600_000),
    minutes: Math.floor((diffMs % 3_600_000) / 60_000),
  };
}

function pluralizeDays(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if ([2, 3, 4].includes(mod10) && ![12, 13, 14].includes(mod100)) return "дня";
  return "дней";
}

function SummaryStat({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/70 px-4 py-3 shadow-sm ring-1 ring-inset ring-indigo-100/60">
      <span className="text-2xl" role="img" aria-hidden>
        {icon}
      </span>
      <div className="flex flex-col">
        <span className="text-lg font-black leading-tight text-ink">{value}</span>
        <span className="text-xs font-medium text-ink-muted">{label}</span>
      </div>
    </div>
  );
}

function StepDots({ current }: { current: FlowStep }) {
  const currentIndex = STEP_ORDER.indexOf(current);
  return (
    <div className="mb-2 flex justify-center gap-2">
      {STEP_ORDER.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 w-8 rounded-full transition-all duration-500 ease-in-out ${
            i <= currentIndex ? "bg-gradient-to-r from-indigo-600 to-pink-500" : "bg-zinc-200"
          }`}
        />
      ))}
    </div>
  );
}

export function FirstSessionFlow({
  firstChallenge,
  secondChallenge,
  lessonVideo,
}: FirstSessionFlowProps) {
  const router = useRouter();
  const { isReady, isChallengeCompleted, streakDays } = useGameProgress();
  const [step, setStep] = useState<FlowStep>("challenge1");
  const [countdown] = useState(hoursUntilMidnight);

  // If this user already did both seed challenges (e.g. they navigated back
  // here after finishing, or refreshed past it), don't replay the tutorial —
  // just send them to their real dashboard. This must only run once, against
  // the state as it was when the page mounted: completing challenge 2 during
  // this very flow also makes the condition true, and a reactive check would
  // yank the user to /dashboard mid-flow, skipping the summary/tomorrow steps.
  const hasCheckedReplayRef = useRef(false);
  useEffect(() => {
    if (!isReady || hasCheckedReplayRef.current) return;
    hasCheckedReplayRef.current = true;
    if (isChallengeCompleted(firstChallenge.id) && isChallengeCompleted(secondChallenge.id)) {
      router.replace("/dashboard");
    }
  }, [isReady, isChallengeCompleted, firstChallenge.id, secondChallenge.id, router]);

  if (!isReady) return null;

  if (step === "challenge1") {
    return (
      <ChallengeConsole
        challenge={firstChallenge}
        skipValidation
        onClose={() => {
          if (isChallengeCompleted(firstChallenge.id)) {
            setStep("lesson");
          } else {
            router.push("/dashboard");
          }
        }}
      />
    );
  }

  if (step === "challenge2") {
    return (
      <ChallengeConsole
        challenge={secondChallenge}
        onClose={() => {
          if (isChallengeCompleted(secondChallenge.id)) {
            setStep("summary");
          } else {
            router.push("/dashboard");
          }
        }}
      />
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-6 py-4">
      <StepDots current={step} />

      {step === "lesson" && (
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <span className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-600">
              Короткий урок
            </span>
            <h1 className="mt-2 text-2xl font-black tracking-[-0.02em] text-ink">
              Одна мысль перед следующим квестом
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              5 минут видео — и продолжим прокачку.
            </p>
          </div>
          <VideoCard video={lessonVideo} />
          <Button size="lg" onClick={() => setStep("challenge2")} className="mx-auto w-full">
            Дальше →
          </Button>
        </div>
      )}

      {step === "summary" && (
        <div className="flex flex-col gap-6">
          <div className="text-center">
            <span className="text-5xl" role="img" aria-hidden>
              🎉
            </span>
            <h1 className="mt-3 text-3xl font-black tracking-[-0.02em] text-ink">
              Отличный старт!
            </h1>
            <p className="mt-1 text-sm text-ink-secondary">
              Вот что ты сделал(а) за первые минуты в Ventrio:
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SummaryStat icon="✅" label="Квестов пройдено" value="2" />
            <SummaryStat icon="📖" label="Уроков пройдено" value="1" />
            <SummaryStat
              icon="✨"
              label="Получено XP"
              value={`+${firstChallenge.xp + secondChallenge.xp}`}
            />
            <SummaryStat
              icon="🔥"
              label="Текущий стрик"
              value={`${streakDays} ${pluralizeDays(streakDays)}`}
            />
          </div>

          <LevelProgressCard />

          <Button size="lg" onClick={() => setStep("tomorrow")} className="mx-auto w-full">
            Дальше →
          </Button>
        </div>
      )}

      {step === "tomorrow" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-5 py-10 text-center">
            <span className="text-5xl" role="img" aria-hidden>
              🌙
            </span>
            <h1 className="text-2xl font-black tracking-[-0.02em] text-ink">На сегодня всё!</h1>
            <p className="max-w-sm text-sm leading-relaxed tracking-tight text-ink-secondary">
              Ты уже прокачался(ась) сегодня — этого достаточно. Возвращайся завтра: новый квест
              откроется через{" "}
              <span className="font-bold text-ink">
                {countdown.hours} ч {countdown.minutes} мин
              </span>
              .
            </p>
            <Button size="lg" href="/dashboard" className="w-full max-w-xs">
              Перейти в личный кабинет
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

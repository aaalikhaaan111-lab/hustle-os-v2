"use client";

import { useEffect, useState } from "react";
import confetti from "canvas-confetti";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";
import { InteractiveSimulation } from "@/components/courses/InteractiveSimulation";
import { pick } from "@/i18n/content";
import type { CourseLesson } from "@/constants/courses";

type ConsoleStep = "theory" | "quiz" | "simulation" | "victory";

const QUIZ_OPTION_LABELS: Record<string, string[]> = {
  ru: ["А", "Б", "В", "Г"],
  en: ["A", "B", "C", "D"],
};

function fireConfetti() {
  const colors = ["#4f46e5", "#9333ea", "#ec4899"];
  const end = Date.now() + 1000;

  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 65, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 65, origin: { x: 1 }, colors });
    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  })();

  confetti({ particleCount: 130, spread: 100, origin: { y: 0.6 }, colors });
}

interface LessonConsoleProps {
  lesson: CourseLesson;
  onClose: () => void;
}

export function LessonConsole({ lesson, onClose }: LessonConsoleProps) {
  const t = useTranslations("courses");
  const locale = useLocale();
  const optionLabels = QUIZ_OPTION_LABELS[locale] ?? QUIZ_OPTION_LABELS.en;
  const { completeChallenge } = useGameProgress();
  const [step, setStep] = useState<ConsoleStep>("theory");
  const [slideIndex, setSlideIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selection, setSelection] = useState<number | null>(null);

  const lessonTitle = pick(lesson.title, locale);
  const slide = lesson.slides[slideIndex];
  const isLastSlide = slideIndex === lesson.slides.length - 1;
  const question = lesson.type === "quiz" ? lesson.quiz[questionIndex] : null;
  const selectedOption = question && selection !== null ? question.options[selection] : null;
  const isLastQuestion = lesson.type === "quiz" && questionIndex === lesson.quiz.length - 1;

  useEffect(() => {
    if (step !== "victory") return;
    completeChallenge({
      challengeId: lesson.id,
      title: lessonTitle,
      emoji: lesson.emoji,
      categoryLabel: t("categoryLabel"),
      xp: lesson.xpReward,
      answer: "",
    });
    fireConfetti();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  function handleNextSlide() {
    if (!isLastSlide) {
      setSlideIndex((i) => i + 1);
      return;
    }
    setStep(lesson.type === "simulation" ? "simulation" : "quiz");
  }

  function handleNextQuestion() {
    if (lesson.type !== "quiz") return;
    if (isLastQuestion) {
      setStep("victory");
      return;
    }
    setQuestionIndex((i) => i + 1);
    setSelection(null);
  }

  const interactiveStepCount = lesson.type === "quiz" ? lesson.quiz.length : 1;
  const totalSteps = lesson.slides.length + interactiveStepCount;
  const currentStepDot =
    step === "theory"
      ? slideIndex
      : step === "quiz"
        ? lesson.slides.length + questionIndex
        : step === "simulation"
          ? lesson.slides.length
          : totalSteps;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-white/70 p-4 backdrop-blur-2xl"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        className={cn(
          "relative w-full max-w-lg rounded-[32px] border p-8 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)]",
          step === "victory"
            ? "border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-indigo-50"
            : "border-t-white/70 border-x-zinc-200/40 border-b-zinc-200/40 bg-white/90"
        )}
      >
        {step !== "victory" && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t("closeAria")}
            className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-ink-muted transition-colors hover:bg-zinc-100 hover:text-ink"
          >
            ✕
          </button>
        )}

        <div className="mb-6 flex justify-center gap-2">
          {Array.from({ length: totalSteps }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "h-1.5 w-8 rounded-full transition-all duration-500 ease-in-out",
                i <= currentStepDot ? "bg-gradient-to-r from-indigo-600 to-pink-500" : "bg-zinc-200"
              )}
            />
          ))}
        </div>

        {step === "theory" && (
          <div key={slideIndex} className="animate-pop-in flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span className="text-4xl" role="img" aria-hidden>
                {slide.emoji}
              </span>
              <div className="flex flex-col gap-1.5">
                <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600 ring-1 ring-inset ring-indigo-100">
                  {t("microTheory", { current: slideIndex + 1, total: lesson.slides.length })}
                </span>
                <h2 className="text-xl font-black leading-tight tracking-[-0.02em] text-ink">
                  {pick(slide.title, locale)}
                </h2>
              </div>
            </div>
            <p className="rounded-2xl bg-accent-soft px-4 py-3 text-sm leading-relaxed tracking-tight text-ink-secondary">
              {pick(slide.body, locale)}
            </p>
            <Button size="lg" onClick={handleNextSlide} className="w-full">
              {!isLastSlide
                ? t("next")
                : lesson.type === "simulation"
                  ? t("toSimulation")
                  : t("toQuiz")}
            </Button>
          </div>
        )}

        {step === "quiz" && lesson.type === "quiz" && question && (
          <div key={questionIndex} className="animate-pop-in flex flex-col gap-5">
            <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600 ring-1 ring-inset ring-indigo-100">
              {t("knowledgeCheck", { current: questionIndex + 1, total: lesson.quiz.length })}
            </span>
            <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink">
              {pick(question.question, locale)}
            </h2>
            <div className="flex flex-col gap-3">
              {question.options.map((option, index) => {
                const isSelected = selection === index;
                const showRight = isSelected && option.isCorrect;
                const showWrong = isSelected && !option.isCorrect;
                return (
                  <button
                    key={`${questionIndex}-${index}`}
                    type="button"
                    onClick={() => setSelection(index)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left text-sm font-semibold transition-all duration-300 ease-out",
                      showRight && "border-success bg-success-soft text-success",
                      showWrong && "border-danger bg-danger-soft text-danger",
                      !isSelected &&
                        "border-zinc-100/60 bg-white/70 text-ink-secondary hover:border-zinc-200 hover:text-ink"
                    )}
                  >
                    {optionLabels[index]}) {pick(option.text, locale)}
                  </button>
                );
              })}
            </div>
            {selectedOption && !selectedOption.isCorrect && (
              <p className="text-xs font-medium text-danger">{t("wrongAnswer")}</p>
            )}
            <Button
              size="lg"
              disabled={!selectedOption?.isCorrect}
              onClick={handleNextQuestion}
              className="w-full"
            >
              {isLastQuestion ? t("finishLesson") : t("next")}
            </Button>
          </div>
        )}

        {step === "simulation" && lesson.type === "simulation" && (
          <div className="animate-pop-in flex flex-col gap-5">
            <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600 ring-1 ring-inset ring-indigo-100">
              {t("simulationBadge")}
            </span>
            <h2 className="text-xl font-extrabold tracking-[-0.02em] text-ink">{lessonTitle}</h2>
            {lesson.videoUrl && (
              <iframe
                src={lesson.videoUrl}
                title={lessonTitle}
                className="aspect-video w-full rounded-2xl"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            )}
            <InteractiveSimulation config={lesson.simulation} onComplete={() => setStep("victory")} />
          </div>
        )}

        {step === "victory" && (
          <div className="animate-pop-in flex flex-col items-center gap-4 py-4 text-center">
            <span className="text-6xl" role="img" aria-hidden>
              🎉
            </span>
            <h2 className="text-3xl font-black tracking-[-0.02em] text-ink">{t("lessonComplete")}</h2>
            <span className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 px-5 py-2.5 text-base font-bold text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]">
              {t("xpEarned", { xp: lesson.xpReward })}
            </span>
            <p className="text-sm leading-relaxed tracking-tight text-ink-secondary">
              {t("lessonClosedNote", { title: lessonTitle })}
            </p>
            <Button size="lg" variant="secondary" onClick={onClose} className="mt-2 w-full">
              {t("close")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

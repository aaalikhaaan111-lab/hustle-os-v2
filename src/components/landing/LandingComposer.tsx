"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { writeSeed } from "@/lib/create/seed";
import type { CreationStartingPoint } from "@/lib/build/creationTypes";
import { usePrefersReducedMotion, useTypewriter } from "@/components/landing/hooks";
import { cn } from "@/lib/utils";

// Lightweight starting points. Labels and canned first messages are reused
// verbatim from the /create namespace so the homepage entry and the in-product
// flow speak with one voice.
const STARTING_POINTS: {
  id: CreationStartingPoint;
  labelKey: "spHobby" | "spSkill" | "spIdea" | "spProblem" | "spUnsure";
  msgKey: "spHobbyMsg" | "spSkillMsg" | "spIdeaMsg" | "spProblemMsg" | "spUnsureMsg";
}[] = [
  { id: "hobby", labelKey: "spHobby", msgKey: "spHobbyMsg" },
  { id: "skill", labelKey: "spSkill", msgKey: "spSkillMsg" },
  { id: "idea", labelKey: "spIdea", msgKey: "spIdeaMsg" },
  { id: "problem", labelKey: "spProblem", msgKey: "spProblemMsg" },
  { id: "unsure", labelKey: "spUnsure", msgKey: "spUnsureMsg" },
];

const PLACEHOLDER_KEYS = [
  "composerExampleHobby",
  "composerExampleSkill",
  "composerExampleProblem",
  "composerExampleIdea",
] as const;

interface LandingComposerProps {
  isAuthenticated: boolean;
  variant: "hero" | "final";
  textareaId?: string;
}

// The public entry into creation. It never talks to the AI: it captures the
// visitor's first message as a seed and routes into the existing Create flow
// (or to signup first when logged out), which consumes the seed and continues
// the conversation. Top and bottom instances are identical by construction.
export function LandingComposer({ isAuthenticated, variant, textareaId }: LandingComposerProps) {
  const t = useTranslations("landing");
  const tCreate = useTranslations("create");
  const router = useRouter();
  const reducedMotion = usePrefersReducedMotion();

  const [value, setValue] = useState("");
  const [focused, setFocused] = useState(false);
  const [routing, setRouting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const examples = useMemo(() => PLACEHOLDER_KEYS.map((key) => t(key)), [t]);
  const animatePlaceholder = !reducedMotion && !focused && value.length === 0;
  const typedPlaceholder = useTypewriter(examples, animatePlaceholder);
  const placeholder = animatePlaceholder ? typedPlaceholder : t("composerPlaceholder");

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 144)}px`;
  }, [value]);

  function go(message: string, startingPoint: CreationStartingPoint | null) {
    const trimmed = message.trim();
    if (!trimmed || routing) return;
    writeSeed(trimmed, startingPoint);
    setRouting(true);
    router.push(isAuthenticated ? "/create" : "/signup");
  }

  return (
    <div className={cn("flex w-full flex-col gap-4", variant === "hero" ? "max-w-[640px]" : "max-w-[560px]")}>
      <form
        className="ventrio-composer"
        onSubmit={(event) => {
          event.preventDefault();
          go(value, null);
        }}
      >
        <textarea
          id={textareaId}
          ref={textareaRef}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          disabled={routing}
          rows={1}
          maxLength={2000}
          placeholder={placeholder}
          aria-label={t("composerLabel")}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              go(value, null);
            }
          }}
          className="max-h-36 min-h-[38px] min-w-0 flex-1 resize-none bg-transparent px-2.5 py-2 text-[15px] leading-6 text-ink placeholder:text-ink-muted focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          aria-label={t("composerSend")}
          disabled={routing || value.trim().length === 0}
          className="composer-send press-scale focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-25"
        >
          <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
            <path d="M10 15.5v-11m0 0L5.5 9M10 4.5 14.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </form>

      {variant === "hero" && (
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("composerStartLabel")}>
          {STARTING_POINTS.map((point) => (
            <button
              key={point.id}
              type="button"
              disabled={routing}
              onClick={() => go(tCreate(point.msgKey), point.id)}
              className="rounded-full px-3.5 py-2 text-[13px] font-medium text-ink-secondary ring-1 ring-inset ring-white/[0.09] transition-colors hover:bg-white/[0.05] hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:opacity-40"
            >
              {tCreate(point.labelKey)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

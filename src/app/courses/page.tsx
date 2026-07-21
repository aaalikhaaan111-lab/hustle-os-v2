"use client";

import { Suspense, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { VideoCard } from "@/components/VideoCard";
import { VIDEOS, GLOSSARY } from "@/constants/data";
import { pick } from "@/i18n/content";
import { cn } from "@/lib/utils";

// Deferred to their own chunks: each is only needed once the user opens that
// specific tab, so they shouldn't be part of the initial /courses bundle.
const SkillTreePath = dynamic(
  () => import("@/components/courses/SkillTreePath").then((mod) => mod.SkillTreePath),
  { loading: () => <SkeletonCard /> }
);

const ChallengesSection = dynamic(
  () => import("@/components/courses/ChallengesSection").then((mod) => mod.ChallengesSection),
  { loading: () => <SkeletonCard /> }
);

type AcademyTab = "videos" | "quizzes" | "challenges" | "play" | "glossary";
type SourceFilter = "all" | "en" | "ru";

const TABS: {
  id: AcademyTab;
  labelKey: "tabVideos" | "tabQuizzes" | "tabChallenges" | "tabPlay" | "tabGlossary";
  emoji: string;
}[] = [
  { id: "videos", labelKey: "tabVideos", emoji: "🎥" },
  { id: "quizzes", labelKey: "tabQuizzes", emoji: "✍️" },
  { id: "challenges", labelKey: "tabChallenges", emoji: "🎯" },
  { id: "play", labelKey: "tabPlay", emoji: "🎮" },
  { id: "glossary", labelKey: "tabGlossary", emoji: "📖" },
];

const SOURCE_FILTERS: { id: SourceFilter; labelKey: "filterAll" | "filterEn" | "filterRu" }[] = [
  { id: "all", labelKey: "filterAll" },
  { id: "en", labelKey: "filterEn" },
  { id: "ru", labelKey: "filterRu" },
];

const VALID_TABS: AcademyTab[] = ["videos", "quizzes", "challenges", "play", "glossary"];

export default function CoursesPage() {
  return (
    <Suspense fallback={<SkeletonCard />}>
      <CoursesPageContent />
    </Suspense>
  );
}

function CoursesPageContent() {
  const t = useTranslations("learn");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab");
  const initialTab = (VALID_TABS as string[]).includes(requestedTab ?? "")
    ? (requestedTab as AcademyTab)
    : "videos";
  const [tab, setTab] = useState<AcademyTab>(initialTab);
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [glossaryQuery, setGlossaryQuery] = useState("");

  const filteredVideos = useMemo(
    () => (sourceFilter === "all" ? VIDEOS : VIDEOS.filter((video) => video.source === sourceFilter)),
    [sourceFilter]
  );

  const filteredGlossary = useMemo(() => {
    const query = glossaryQuery.trim().toLowerCase();
    const sorted = [...GLOSSARY].sort((a, b) =>
      pick(a.name, locale).localeCompare(pick(b.name, locale), locale)
    );
    if (!query) return sorted;
    return sorted.filter(
      (term) =>
        pick(term.name, locale).toLowerCase().includes(query) ||
        pick(term.definition, locale).toLowerCase().includes(query)
    );
  }, [glossaryQuery, locale]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("description")} />

      <div className="grid grid-cols-2 gap-1.5 rounded-2xl bg-surface/50 p-1.5 ring-1 ring-inset ring-white/[0.06] backdrop-blur-md sm:inline-flex sm:w-fit sm:gap-2 sm:rounded-full">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "press-scale flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-center text-[11px] font-bold leading-tight tracking-tight transition-all duration-200 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:text-sm",
                active
                  ? "bg-accent text-accent-foreground shadow-[0_8px_24px_-8px_rgba(93,107,255,0.5)]"
                  : "text-ink-secondary hover:bg-surface/60 hover:text-ink"
              )}
            >
              <span className="text-base sm:text-base" role="img" aria-hidden>
                {item.emoji}
              </span>
              <span>{t(item.labelKey)}</span>
            </button>
          );
        })}
      </div>

      {tab === "videos" && (
        <div key="videos" className="animate-page-in flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            {SOURCE_FILTERS.map((filter) => {
              const active = sourceFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSourceFilter(filter.id)}
                  className={cn(
                    "press-scale rounded-full border px-4 py-2 text-sm font-semibold tracking-tight transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas",
                    active
                      ? "border-transparent bg-accent text-accent-foreground shadow-[0_6px_20px_-8px_rgba(93,107,255,0.6)]"
                      : "border-border bg-surface/40 text-ink-secondary hover:border-border-strong hover:text-ink"
                  )}
                >
                  {t(filter.labelKey)}
                </button>
              );
            })}
          </div>

          <p className="-mt-2 text-xs leading-relaxed tracking-tight text-ink-muted">
            {t("videosNote")}
          </p>

          <div className="grid gap-6 sm:grid-cols-2">
            {filteredVideos.map((video) => (
              <VideoCard key={video.id} video={video} />
            ))}
          </div>
        </div>
      )}

      {tab === "quizzes" && (
        <div key="quizzes" className="animate-page-in">
          <SkillTreePath />
        </div>
      )}

      {tab === "challenges" && (
        <div key="challenges" className="animate-page-in">
          <ChallengesSection />
        </div>
      )}

      {tab === "play" && (
        <div key="play" className="animate-page-in">
          <Card>
            <CardContent className="flex flex-col gap-5 py-8">
              <div className="flex items-center gap-4">
                <span className="text-4xl" role="img" aria-hidden>
                  🎮
                </span>
                <div className="flex flex-col gap-1">
                  <h3 className="text-xl font-extrabold leading-tight tracking-[-0.02em] text-ink">
                    {t("playTabTitle")}
                  </h3>
                  <p className="text-sm tracking-tight text-ink-secondary">{t("playTabBody")}</p>
                </div>
              </div>
              <Button href="/workshops" variant="secondary" className="w-fit">
                {t("playTabCta")}
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {tab === "glossary" && (
        <div key="glossary" className="animate-page-in flex flex-col gap-5">
          <input
            type="text"
            value={glossaryQuery}
            onChange={(event) => setGlossaryQuery(event.target.value)}
            placeholder={t("glossarySearchPlaceholder")}
            className="w-full max-w-sm rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />

          {filteredGlossary.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/60 px-8 py-16 text-center">
              <span className="text-4xl" role="img" aria-hidden>
                🔍
              </span>
              <p className="max-w-md text-sm tracking-tight text-ink-secondary">
                {t("glossaryNoResults", { query: glossaryQuery })}
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGlossary.map((term) => (
                <div
                  key={term.id}
                  className="flex flex-col gap-2 rounded-2xl border border-white/[0.07] bg-surface/70 px-5 py-4 shadow-sm backdrop-blur-md"
                >
                  <h3 className="text-base font-extrabold tracking-[-0.01em] text-ink">{pick(term.name, locale)}</h3>
                  <p className="text-sm tracking-tight text-ink-secondary">{pick(term.definition, locale)}</p>
                  <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs italic leading-relaxed text-ink-secondary">
                    {locale === "ru" ? `«${pick(term.example, locale)}»` : `"${pick(term.example, locale)}"`}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

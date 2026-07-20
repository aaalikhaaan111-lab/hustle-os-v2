"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useLocale, useTranslations } from "next-intl";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkeletonCard } from "@/components/ui/Skeleton";
import { VideoCard } from "@/components/VideoCard";
import { VIDEOS, GLOSSARY } from "@/constants/data";
import { pick } from "@/i18n/content";
import { cn } from "@/lib/utils";

// Deferred to its own chunk: only needed once the user opens this specific
// tab, so it shouldn't be part of the initial /courses bundle (videos tab).
const SkillTreePath = dynamic(
  () => import("@/components/courses/SkillTreePath").then((mod) => mod.SkillTreePath),
  { loading: () => <SkeletonCard /> }
);

type AcademyTab = "videos" | "quizzes" | "glossary";
type SourceFilter = "all" | "en" | "ru";

const TABS: { id: AcademyTab; labelKey: "tabVideos" | "tabQuizzes" | "tabGlossary"; emoji: string }[] = [
  { id: "videos", labelKey: "tabVideos", emoji: "🎥" },
  { id: "quizzes", labelKey: "tabQuizzes", emoji: "✍️" },
  { id: "glossary", labelKey: "tabGlossary", emoji: "📖" },
];

const SOURCE_FILTERS: { id: SourceFilter; labelKey: "filterAll" | "filterEn" | "filterRu" }[] = [
  { id: "all", labelKey: "filterAll" },
  { id: "en", labelKey: "filterEn" },
  { id: "ru", labelKey: "filterRu" },
];

export default function CoursesPage() {
  const t = useTranslations("learn");
  const locale = useLocale();
  const [tab, setTab] = useState<AcademyTab>("videos");
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

      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-white/60 p-1.5 ring-1 ring-inset ring-zinc-200/60 backdrop-blur-md sm:inline-flex sm:w-fit sm:gap-2 sm:rounded-full">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex flex-col items-center justify-center gap-1 rounded-xl px-2 py-2.5 text-center text-[11px] font-bold leading-tight tracking-tight transition-all duration-200 ease-out sm:flex-row sm:gap-2 sm:rounded-full sm:px-4 sm:text-sm",
                active
                  ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]"
                  : "text-ink-secondary hover:bg-white/70 hover:text-ink"
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
        <div className="flex flex-col gap-6">
          <div className="flex flex-wrap gap-2">
            {SOURCE_FILTERS.map((filter) => {
              const active = sourceFilter === filter.id;
              return (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setSourceFilter(filter.id)}
                  className={cn(
                    "rounded-full border px-4 py-2 text-sm font-semibold tracking-tight transition-colors duration-150",
                    active
                      ? "border-transparent bg-ink text-white"
                      : "border-border text-ink-secondary hover:border-border-strong hover:text-ink"
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

      {tab === "quizzes" && <SkillTreePath />}

      {tab === "glossary" && (
        <div className="flex flex-col gap-5">
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
                  className="flex flex-col gap-2 rounded-2xl border border-t-white/70 border-x-zinc-200/40 border-b-zinc-200/40 bg-white/80 px-5 py-4 shadow-sm backdrop-blur-md"
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

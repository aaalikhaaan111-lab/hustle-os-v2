"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/ui/PageHeader";
import { SkillTreePath } from "@/components/courses/SkillTreePath";
import { VideoCard } from "@/components/VideoCard";
import { VIDEOS, GLOSSARY } from "@/constants/data";
import { cn } from "@/lib/utils";

type AcademyTab = "videos" | "quizzes" | "glossary";
type SourceFilter = "all" | "en" | "ru";

const TABS: { id: AcademyTab; label: string; emoji: string }[] = [
  { id: "videos", label: "Видео-лекции", emoji: "🎥" },
  { id: "quizzes", label: "Интерактивные курсы", emoji: "✍️" },
  { id: "glossary", label: "Глоссарий терминов", emoji: "📖" },
];

const SOURCE_FILTERS: { id: SourceFilter; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "en", label: "EN (Y Combinator)" },
  { id: "ru", label: "RU (Эксперты)" },
];

export default function CoursesPage() {
  const [tab, setTab] = useState<AcademyTab>("videos");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [glossaryQuery, setGlossaryQuery] = useState("");

  const filteredVideos = useMemo(
    () => (sourceFilter === "all" ? VIDEOS : VIDEOS.filter((video) => video.source === sourceFilter)),
    [sourceFilter]
  );

  const filteredGlossary = useMemo(() => {
    const query = glossaryQuery.trim().toLowerCase();
    const sorted = [...GLOSSARY].sort((a, b) => a.name.localeCompare(b.name, "ru"));
    if (!query) return sorted;
    return sorted.filter(
      (term) =>
        term.name.toLowerCase().includes(query) || term.definition.toLowerCase().includes(query)
    );
  }, [glossaryQuery]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Learn"
        description="Видео-лекции, интерактивные курсы и глоссарий терминов — всё в одном месте."
      />

      <div className="flex flex-wrap gap-2 rounded-full bg-white/60 p-1.5 ring-1 ring-inset ring-zinc-200/60 backdrop-blur-md sm:inline-flex sm:w-fit">
        {TABS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={cn(
                "flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-bold tracking-tight transition-all duration-200 ease-out",
                active
                  ? "bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 text-white shadow-[0_8px_24px_rgba(99,102,241,0.35)]"
                  : "text-ink-secondary hover:bg-white/70 hover:text-ink"
              )}
            >
              <span role="img" aria-hidden>
                {item.emoji}
              </span>
              {item.label}
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
                  {filter.label}
                </button>
              );
            })}
          </div>

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
            placeholder="Поиск термина..."
            className="w-full max-w-sm rounded-xl border border-border bg-surface px-4 py-2.5 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
          />

          {filteredGlossary.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-surface/60 px-8 py-16 text-center">
              <span className="text-4xl" role="img" aria-hidden>
                🔍
              </span>
              <p className="max-w-md text-sm tracking-tight text-ink-secondary">
                Ничего не нашлось по запросу «{glossaryQuery}». Попробуй другой термин.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredGlossary.map((term) => (
                <div
                  key={term.id}
                  className="flex flex-col gap-2 rounded-2xl border border-t-white/70 border-x-zinc-200/40 border-b-zinc-200/40 bg-white/80 px-5 py-4 shadow-sm backdrop-blur-md"
                >
                  <h3 className="text-base font-extrabold tracking-[-0.01em] text-ink">{term.name}</h3>
                  <p className="text-sm tracking-tight text-ink-secondary">{term.definition}</p>
                  <p className="rounded-lg bg-accent-soft px-3 py-2 text-xs italic leading-relaxed text-ink-secondary">
                    «{term.example}»
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

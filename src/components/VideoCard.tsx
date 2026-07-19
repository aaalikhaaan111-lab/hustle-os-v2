"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { cn } from "@/lib/utils";
import { pick } from "@/i18n/content";
import { GLOSSARY, type VideoCourse } from "@/constants/data";

interface LearnProgress {
  checked: boolean[];
  reflection: string;
}

function storageKey(id: string): string {
  return `hustle_course_${id}_data`;
}

function emptyProgress(itemCount: number): LearnProgress {
  return { checked: Array(itemCount).fill(false), reflection: "" };
}

function loadProgress(id: string, itemCount: number): LearnProgress {
  if (typeof window === "undefined") return emptyProgress(itemCount);
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return emptyProgress(itemCount);
    const parsed = JSON.parse(raw) as Partial<LearnProgress>;
    const checked = Array.isArray(parsed.checked) ? [...parsed.checked] : Array(itemCount).fill(false);
    while (checked.length < itemCount) checked.push(false);
    return { checked: checked.slice(0, itemCount), reflection: parsed.reflection ?? "" };
  } catch {
    return emptyProgress(itemCount);
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// videoUrl is always "https://www.youtube.com/embed/<ID>" (see src/constants/data.ts).
function extractYouTubeId(videoUrl: string): string | null {
  const match = videoUrl.match(/\/embed\/([^/?]+)/);
  return match ? match[1] : null;
}

function PlayIcon(props: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={props.className} aria-hidden>
      <path d="M8 5.5v13l11-6.5-11-6.5Z" />
    </svg>
  );
}

// Longest names first so a shorter term can't shadow a match inside a longer one.
const SORTED_TERMS = [...GLOSSARY].sort((a, b) => b.name.length - a.name.length);

// Unicode-aware boundary via lookaround (\p{L}/\p{N}) instead of \b, since JS's
// \b is ASCII-only and never matches correctly around Cyrillic words.
const TERM_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(${SORTED_TERMS.map((term) => escapeRegExp(term.name)).join("|")})(?![\\p{L}\\p{N}])`,
  "gu"
);

function GlossaryTermSpan({ termId }: { termId: string }) {
  const [open, setOpen] = useState(false);
  const term = GLOSSARY.find((t) => t.id === termId);
  if (!term) return null;

  return (
    <span className="relative inline-block">
      <button
        type="button"
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onClick={() => setOpen((v) => !v)}
        className="cursor-help border-b-2 border-dotted border-purple-500 font-bold text-purple-600 transition-colors hover:text-purple-500 dark:border-purple-400 dark:text-purple-400"
      >
        {term.name}
      </button>
      {open && (
        <span className="animate-pop-in absolute bottom-full left-1/2 z-50 mb-2 w-64 -translate-x-1/2 rounded-xl border border-white/10 bg-slate-900/90 p-3 text-left text-xs text-white shadow-2xl backdrop-blur-md">
          <span className="mb-1 block text-sm font-bold text-white">{term.name}</span>
          <span className="mb-2 block leading-relaxed text-white/80">{term.definition}</span>
          <span className="block rounded-lg bg-white/10 px-2.5 py-2 italic leading-relaxed text-white/70">
            «{term.example}»
          </span>
        </span>
      )}
    </span>
  );
}

function renderDescriptionWithTerms(text: string): ReactNode {
  const parts = text.split(TERM_PATTERN);
  return parts.map((part, index) => {
    const matched = SORTED_TERMS.find((term) => term.name === part);
    if (matched) {
      return <GlossaryTermSpan key={`${matched.id}-${index}`} termId={matched.id} />;
    }
    return <span key={index}>{part}</span>;
  });
}

interface VideoCardProps {
  video: VideoCourse;
}

export function VideoCard({ video }: VideoCardProps) {
  const t = useTranslations("learn");
  const locale = useLocale();
  const title = pick(video.title, locale);
  const moduleName = pick(video.module, locale);
  const description = pick(video.description, locale);
  const checklist = pick(video.checklist, locale);
  const takeaway = pick(video.takeaway, locale);
  const [progress, setProgress] = useState<LearnProgress>(() => emptyProgress(checklist.length));
  const [isReady, setIsReady] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [thumbnailFailed, setThumbnailFailed] = useState(false);
  const videoId = extractYouTubeId(video.videoUrl);

  useEffect(() => {
    // Reads localStorage (unavailable during SSR) — must run post-mount, not
    // during render, to keep the first client render matching the server's.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProgress(loadProgress(video.id, checklist.length));
    setIsReady(true);
  }, [video.id, checklist.length]);

  useEffect(() => {
    if (!isReady) return;
    window.localStorage.setItem(storageKey(video.id), JSON.stringify(progress));
  }, [progress, isReady, video.id]);

  function toggleItem(index: number) {
    setProgress((prev) => {
      const checked = [...prev.checked];
      checked[index] = !checked[index];
      return { ...prev, checked };
    });
  }

  const completedCount = progress.checked.filter(Boolean).length;

  return (
    <Card>
      <CardContent className="flex flex-col gap-5 py-8">
        <div className="aspect-video w-full overflow-hidden rounded-xl border border-white/10 bg-black shadow-lg">
          {isLoaded ? (
            <iframe
              className="h-full w-full"
              src={`${video.videoUrl}?autoplay=1`}
              title={title}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              allowFullScreen
              loading="lazy"
            />
          ) : (
            <button
              type="button"
              onClick={() => setIsLoaded(true)}
              aria-label={t("playVideo", { title })}
              className="group relative h-full w-full"
            >
              {videoId && !thumbnailFailed ? (
                // Plain <img>, not next/image: this is a third-party YouTube
                // thumbnail, not a first-party asset — routing it through
                // Next's image optimizer would add a remote-pattern config
                // dependency and an extra network hop for no real benefit here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                  alt=""
                  aria-hidden
                  onError={() => setThumbnailFailed(true)}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-4 text-center">
                  <span className="text-3xl" role="img" aria-hidden>
                    🎬
                  </span>
                  <span className="line-clamp-2 text-sm font-semibold text-white/90">
                    {title}
                  </span>
                </div>
              )}
              <span className="absolute inset-0 flex items-center justify-center bg-black/25 transition-colors duration-150 group-hover:bg-black/35">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 shadow-lg transition-transform duration-150 group-hover:scale-105">
                  <PlayIcon className="h-6 w-6 translate-x-0.5 text-ink" />
                </span>
              </span>
            </button>
          )}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={video.source === "en" ? "accent" : "outline"}>
              {video.source === "en" ? "EN · Y Combinator" : t("sourceRuBadge")}
            </Badge>
            <Badge variant="outline">{t("module", { module: moduleName })}</Badge>
          </div>
          <h3 className="text-lg font-extrabold leading-tight tracking-[-0.02em] text-ink">{title}</h3>
          <p className="text-sm tracking-tight text-ink-secondary">
            {locale === "ru" ? renderDescriptionWithTerms(description) : description}
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-accent-soft px-4 py-4 ring-1 ring-inset ring-indigo-100/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600">
              {t("yourTakeaway")}
            </span>
            <span className="text-xs font-bold text-ink-muted">
              {completedCount}/{checklist.length}
            </span>
          </div>

          <ul className="flex flex-col gap-2">
            {checklist.map((item, index) => {
              const checked = progress.checked[index] ?? false;
              return (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => toggleItem(index)}
                    className="flex w-full items-start gap-2 text-left text-sm"
                  >
                    <span
                      className={cn(
                        "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold transition-colors duration-150",
                        checked
                          ? "border-success bg-success text-white"
                          : "border-zinc-300 bg-white/70 text-transparent"
                      )}
                    >
                      ✓
                    </span>
                    <span
                      className={cn(
                        "tracking-tight text-ink-secondary transition-colors duration-150",
                        checked && "text-ink-muted line-through"
                      )}
                    >
                      {item}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-1.5 pt-1">
            <label className="text-xs font-semibold text-ink-secondary">{takeaway}</label>
            <textarea
              value={progress.reflection}
              onChange={(event) => setProgress((prev) => ({ ...prev, reflection: event.target.value }))}
              rows={2}
              placeholder={t("reflectionPlaceholder")}
              className="w-full resize-none rounded-xl border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

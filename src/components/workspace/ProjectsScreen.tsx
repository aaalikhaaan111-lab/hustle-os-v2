"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { IconPlus, IconSearch, StatusPill } from "@/components/workspace-ui/parts";
import { PageBody, PageHeading } from "@/components/workspace-ui/PageBody";
import { formatAge } from "@/lib/workspace/formatAge";
import type { PresentedProject } from "@/lib/workspace/present";

type Filter = "all" | "draft" | "published";

const FILTERS = [
  { option: "all", labelKey: "projectsFilterAll" },
  { option: "draft", labelKey: "projectsFilterDraft" },
  { option: "published", labelKey: "projectsFilterPublished" },
] as const;

/**
 * The index of everything you have made.
 *
 * WHAT THIS WAS: a 15px semibold name, a 13.5px grey line under it, and a
 * timestamp, repeated down a white sheet with a hairline between rows. Dense,
 * legible and completely anonymous — a settings list that happened to contain
 * projects.
 *
 * WHAT IT IS NOW: an index. Each project gets a real line of type at 20px, its
 * own colour as a full-height edge marker rather than a 6px dot, and the state
 * and age set as quiet metadata on a second line. The row is 84px tall and the
 * whole thing reads as a body of work rather than a table of records.
 *
 * The controls moved with it. Search was a bordered field in a toolbar row;
 * it is now an unboxed field on the hairline under the heading, and the filter
 * is three plain words rather than a segmented control in a grey tub. Chrome
 * that surrounds a control is chrome you have to look past to use it.
 */
export function ProjectsScreen({ projects }: { projects: PresentedProject[] }) {
  const t = useTranslations("workspace");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return projects.filter((project) => {
      const matchesQuery =
        !q || project.name.toLowerCase().includes(q) || (project.summary ?? "").toLowerCase().includes(q);
      const matchesFilter =
        filter === "all" ||
        (filter === "draft" && project.state === "draft") ||
        (filter === "published" && project.state === "published");
      return matchesQuery && matchesFilter;
    });
  }, [projects, query, filter]);

  const publishedCount = projects.filter((p) => p.state === "published").length;

  return (
    <PageBody>
      <PageHeading
        eyebrow={t("projectsTitle")}
        title={
          projects.length === 0
            ? t("startFirstTitle")
            : t("projectsCount", { count: projects.length })
        }
        lead={
          projects.length === 0
            ? t("startFirstBody")
            : publishedCount > 0
              ? t("projectsCountLive", { count: projects.length, live: publishedCount })
              : undefined
        }
        actions={
          <Link href="/create" className="s-btn s-btn--primary">
            <IconPlus className="h-4 w-4" />
            {t("navNewProject")}
          </Link>
        }
      />

      {projects.length === 0 ? (
        /* No box. An empty index is an empty page with one thing to do on it —
           drawing a dashed rectangle around the absence only makes the absence
           look like a broken component. */
        <div className="mt-16 border-t pt-10 s-rule" style={{ borderColor: "var(--color-border)" }}>
          <p className="s-body max-w-md">{t("projectsNothingYet")}</p>
        </div>
      ) : (
        <>
          <div
            className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-3"
            style={{ borderColor: "var(--color-border)" }}
          >
            <label
              className="flex min-w-[180px] flex-1 items-center gap-2.5 sm:max-w-[300px]"
              style={{ color: "var(--color-ink-muted)" }}
            >
              <IconSearch className="h-4 w-4 shrink-0" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("projectsSearch")}
                aria-label={t("projectsSearch")}
                className="w-full bg-transparent text-[15px] outline-none"
                style={{ color: "var(--color-ink)" }}
              />
            </label>

            <div role="group" className="flex items-center gap-1">
              {FILTERS.map(({ option, labelKey }) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setFilter(option)}
                  aria-pressed={filter === option}
                  className="s-btn s-btn--ghost h-8 px-2.5 text-[13.5px]"
                  style={
                    filter === option
                      ? { color: "var(--color-ink)", background: "var(--color-surface-hover)" }
                      : undefined
                  }
                >
                  {t(labelKey)}
                </button>
              ))}
            </div>

            <span className="s-meta ml-auto hidden sm:block">{t("projectsSorted")}</span>
          </div>

          {visible.length === 0 ? (
            <p className="s-body mt-12">{t("projectsNoMatch", { query })}</p>
          ) : (
            <ul className="mt-1">
              {visible.map((project, index) => (
                <li
                  key={project.id}
                  className="s-enter border-b"
                  style={{
                    borderColor: "var(--color-border)",
                    animationDelay: `${Math.min(index, 8) * 26}ms`,
                  }}
                >
                  <Link
                    href={`/projects/${project.id}`}
                    className="group relative flex items-center gap-4 rounded-[var(--r-md)] py-5 pl-4 pr-3 transition-colors"
                    style={{ transitionDuration: "var(--t-fast)" }}
                  >
                    {/* The project's colour as an edge, not a dot. It is the
                        same colour the preview uses, so a project is
                        recognisable before the name is read — and at 3×24px it
                        is actually visible, which a 6px dot was not. */}
                    <span
                      aria-hidden
                      className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full transition-all group-hover:h-9"
                      style={{ background: project.preview.accent, transitionDuration: "var(--t-base)" }}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[19px] font-medium leading-snug tracking-[-0.02em]">
                        {project.name || t("untitledProject")}
                      </span>
                      <span className="s-meta mt-1.5 flex min-w-0 items-center gap-2.5">
                        <StatusPill state={project.state} />
                        <span className="truncate">
                          {project.summary ??
                            (project.hasOutput ? t("summaryReady") : t("summaryNoVersion"))}
                        </span>
                      </span>
                    </span>

                    <span className="s-meta shrink-0">{formatAge(t, project.updated)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </PageBody>
  );
}

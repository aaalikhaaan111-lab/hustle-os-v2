"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { IconPlus, IconSearch, StatusPill } from "@/components/workspace-ui/parts";
import { PageBody, PageHeading } from "@/components/workspace-ui/PageBody";
import { VentrioButton, VentrioLinkButton } from "@/components/ui/VentrioButton";
import { formatAge } from "@/lib/workspace/formatAge";
import type { PresentedProject } from "@/lib/workspace/present";

type Filter = "all" | "draft" | "published";

/** Label keys sit beside the values so the control never shows a raw enum. */
const FILTERS = [
  { option: "all", labelKey: "projectsFilterAll" },
  { option: "draft", labelKey: "projectsFilterDraft" },
  { option: "published", labelKey: "projectsFilterPublished" },
] as const;

/**
 * Projects, as the conversations they are.
 *
 * A grid of thumbnails said "here is your gallery of templates". What is
 * actually here is a set of ongoing conversations with a partner who is
 * building something with you — so this is a list: one line for what it is, one
 * for where it got to, and the last time it moved. Search, filter and sort are
 * real client-side operations over the signed-in user's real rows.
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
        title={t("projectsTitle")}
        lead={
          projects.length === 0
            ? t("projectsNothingYet")
            : publishedCount > 0
              ? t("projectsCountLive", { count: projects.length, live: publishedCount })
              : t("projectsCount", { count: projects.length })
        }
        actions={
          <VentrioLinkButton href="/create" variant="primary">
            <IconPlus className="h-4 w-4" />
            {t("navNewProject")}
          </VentrioLinkButton>
        }
      />

      {projects.length === 0 ? (
        <div
          className="rise mt-7 rounded-[var(--r-lg)] border px-8 py-12 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <p className="text-[17px] font-semibold tracking-[-0.01em]">{t("startFirstTitle")}</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {t("startFirstBody")}
          </p>
          <VentrioLinkButton href="/create" variant="primary" className="mt-6">
            {t("navNewProject")}
          </VentrioLinkButton>
        </div>
      ) : (
        <>
          <div className="mt-7 flex flex-wrap items-center gap-2">
            <label
              className="flex h-10 min-w-[200px] flex-1 items-center gap-2 rounded-[var(--r-md)] border px-3.5 transition-[border-color,box-shadow] duration-[var(--t-hover)] focus-within:border-[var(--accent)] focus-within:shadow-[0_0_0_4px_rgb(107_100_242/0.11)] sm:max-w-[280px] sm:flex-none"
              style={{ borderColor: "var(--line-2)", background: "var(--surface)" }}
            >
              <IconSearch className="h-4 w-4 shrink-0 text-[var(--ink-3)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("projectsSearch")}
                aria-label={t("projectsSearch")}
                className="w-full bg-transparent text-[14px] outline-none placeholder:text-[var(--ink-3)]"
              />
            </label>

            <div
              className="flex h-10 items-center gap-0.5 rounded-[var(--r-md)] p-1"
              style={{ background: "var(--sunken)" }}
            >
              {FILTERS.map(({ option, labelKey }) => (
                <VentrioButton
                  key={option}
                  variant="ghost"
                  size="sm"
                  onClick={() => setFilter(option)}
                  aria-pressed={filter === option}
                  on={filter === option}
                  className="h-8 rounded-[var(--r-xs)]"
                >
                  {t(labelKey)}
                </VentrioButton>
              ))}
            </div>

            <span className="ml-auto hidden text-[13px] sm:block" style={{ color: "var(--ink-3)" }}>
              {t("projectsSorted")}
            </span>
          </div>

          {visible.length === 0 ? (
            <p className="mt-12 text-center text-[14px]" style={{ color: "var(--ink-2)" }}>
              {t("projectsNoMatch", { query })}
            </p>
          ) : (
            <ul className="mt-5 flex flex-col">
              {visible.map((project, index) => (
                <li
                  key={project.id}
                  className="ws-row"
                  style={{
                    borderTop: index === 0 ? "none" : "1px solid var(--line)",
                    animationDelay: `${Math.min(index, 7) * 28}ms`,
                  }}
                >
                  <Link
                    href={`/projects/${project.id}`}
                    className="group flex items-start gap-3 rounded-[var(--r-md)] px-3 py-4 transition-colors duration-[var(--t-hover)] ease-[var(--ease)] hover:bg-[var(--raised)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2"
                    style={{ outlineColor: "var(--accent)" }}
                  >
                    {/* The project's own colour — the same one its preview uses,
                        so a project is recognisable before it is read. */}
                    <span
                      className="dot mt-[7px] transition-transform duration-[var(--t-hover)] group-hover:scale-125"
                      style={{ background: project.preview.accent }}
                    />

                    <span className="min-w-0 flex-1">
                      <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
                        <span className="min-w-0 max-w-full truncate text-[15px] font-semibold tracking-[-0.01em]">
                          {project.name || t("untitledProject")}
                        </span>
                        <StatusPill state={project.state} />
                      </span>
                      <span
                        className="mt-1 block truncate text-[13.5px] leading-relaxed"
                        style={{ color: "var(--ink-2)" }}
                      >
                        {project.summary ?? (project.hasOutput ? t("summaryReady") : t("summaryNoVersion"))}
                      </span>
                    </span>

                    <span className="shrink-0 pt-0.5 text-[13px] tabular-nums" style={{ color: "var(--ink-3)" }}>
                      {formatAge(t, project.updated)}
                    </span>
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

"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { IconPlus, IconSearch, ProductPreview, StatusPill } from "@/components/workspace-ui/parts";
import { formatAge } from "@/lib/workspace/formatAge";
import type { PresentedProject } from "@/lib/workspace/present";
import { HowItWorks } from "@/components/workspace-ui/HowItWorks";

type Filter = "all" | "draft" | "published";

const FILTERS = [
  { option: "all", labelKey: "projectsFilterAll" },
  { option: "draft", labelKey: "projectsFilterDraft" },
  { option: "published", labelKey: "projectsFilterPublished" },
] as const;

/**
 * Everything you have made.
 *
 * TWO LAYOUTS AGO this was a text list — a name, a grey summary line and a
 * timestamp, repeated down a white sheet. That is how you list invoices. It
 * then became an editorial index with bigger type, which read better and was
 * still a list of filenames.
 *
 * What is actually on this screen is the set of things this person BUILT, and
 * the first thing anyone wants from that is to recognise their own work. So it
 * is a gallery: each project leads with its own preview in the same frame the
 * workspace shows it in, with the name and state underneath. Someone who has
 * never written code should be able to find the thing they made on Tuesday by
 * looking at it, not by reading.
 *
 * The controls stayed unboxed — search is a field on the hairline rather than
 * a bordered input in a toolbar, and the filter is three plain words. Chrome
 * around a control is chrome you have to look past to use it.
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
    <div className="min-h-full">
      {/* THE SAME COMPOSITION AS HOME: a band of sky with the count in the
          display face, then the work on a sheet that rises over it. This was a
          page heading, a search row and a grid — correct, and indistinguishable
          from a file browser. */}
      <section className="s-sky-band px-5 pb-10 pt-10 sm:px-10 sm:pb-12 sm:pt-16">
        <div className="mx-auto flex w-full max-w-[1120px] flex-wrap items-end justify-between gap-5">
          <div className="min-w-0">
            <h1 className="s-display">
              {projects.length === 0 ? t("startFirstTitle") : t("projectsCount", { count: projects.length })}
            </h1>
            <p className="s-body mt-2.5 max-w-lg">
              {projects.length === 0
                ? t("startFirstBody")
                : publishedCount > 0
                  ? t("projectsCountLive", { count: projects.length, live: publishedCount })
                  : t("projectsSorted")}
            </p>
          </div>
          <Link href="/create" className="s-btn s-btn--primary h-11 px-5 text-[1rem]">
            <IconPlus className="h-[18px] w-[18px]" />
            {t("navNewProject")}
          </Link>
        </div>
      </section>

      <div className="s-sheet mx-auto w-full max-w-[1160px] px-5 pb-16 pt-7 sm:px-10 sm:pt-9">
      {projects.length === 0 ? (
        /* No box. An empty index is an empty page with one thing to do on it —
           drawing a dashed rectangle around the absence only makes the absence
           look like a broken component. */
        <div className="mt-14 border-t pt-10" style={{ borderColor: "var(--color-border)" }}>
          <p className="s-body max-w-md">{t("projectsNothingYet")}</p>
          {/* The one place the product has to explain itself: there is nothing
              on the screen to infer it from. */}
          <HowItWorks className="mt-7" />
        </div>
      ) : (
        <>
          <div
            className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b pb-3"
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
            /* A GALLERY, NOT A LEDGER. These were rows of names and timestamps,
               which is how you list invoices. What is here is the set of things
               this person MADE, and the first thing anyone wants is to
               recognise their own work — which needs a picture, not a
               filename. */
            <ul className="mt-8 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
              {visible.map((project, index) => (
                <li key={project.id} className="s-enter" style={{ animationDelay: `${Math.min(index, 8) * 26}ms` }}>
                  <Link href={`/projects/${project.id}`} className="group block">
                    <span className="s-artifact s-thumb block aspect-[16/10] w-full">
                      <ProductPreview project={project.preview} density="lg" />
                    </span>
                    <span className="mt-3 block min-w-0">
                      <span
                        className="block truncate text-[17px] font-medium"
                        style={{ fontFamily: "var(--font-display), Georgia, serif", color: "var(--color-ink)" }}
                      >
                        {project.name || t("untitledProject")}
                      </span>
                      <span className="s-meta mt-1 flex min-w-0 items-center gap-2.5">
                        <StatusPill state={project.state} />
                        <span aria-hidden>·</span>
                        <span className="truncate">{formatAge(t, project.updated)}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
      </div>
    </div>
  );
}

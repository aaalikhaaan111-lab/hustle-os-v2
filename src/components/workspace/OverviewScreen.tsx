"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconBuild, IconPlus, ProductPreview, StatusPill } from "@/components/workspace-ui/parts";
import { PageBody, PageHeading } from "@/components/workspace-ui/PageBody";
import { VentrioLinkButton } from "@/components/ui/VentrioButton";
import { formatAge } from "@/lib/workspace/formatAge";
import type { PresentedProject } from "@/lib/workspace/present";

/** The six stages, named in the catalogue so they read in either language. */
const LIFECYCLE_KEYS = [
  "lifecycleCreated",
  "lifecycleFirstVersion",
  "lifecyclePublished",
  "lifecycleFirstVisitor",
  "lifecyclePattern",
  "lifecycleNextVersion",
] as const;

export interface OverviewScreenProps {
  active: PresentedProject | null;
  recent: PresentedProject[];
  /** Real responses on the active project's publication, if any. */
  activeResponses: number;
}

/**
 * Overview, on real projects.
 *
 * One column, centred, in the order the question is actually asked: what am I
 * working on, what else is open, and is there anything to learn from yet.
 * Allowances are not here — they belong behind the composer's settings control
 * and in Settings, not in front of someone deciding what to do next.
 */
export function OverviewScreen({ active, recent, activeResponses }: OverviewScreenProps) {
  const t = useTranslations("workspace");
  const lifecycle = LIFECYCLE_KEYS.map((key) => t(key));

  if (!active) {
    return (
      <PageBody>
        <PageHeading title={t("navOverview")} lead={t("overviewEmptyLead")} />
        <div
          className="rise mt-7 rounded-[var(--r-lg)] border px-8 py-12 text-center"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <p className="text-[17px] font-semibold tracking-[-0.01em]">{t("startFirstTitle")}</p>
          <p className="mx-auto mt-2 max-w-md text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {t("startFirstBody")}
          </p>
          <VentrioLinkButton href="/create" variant="primary" className="mt-6">
            <IconPlus className="h-4 w-4" />
            {t("navNewProject")}
          </VentrioLinkButton>
        </div>
      </PageBody>
    );
  }

  // Only stages the data actually supports. Tracking has no pipeline, so the
  // furthest any project can currently reach is "published".
  const reached = active.state === "published" ? (activeResponses > 0 ? 3 : 2) : active.hasOutput ? 1 : 0;
  const nextStage = lifecycle[Math.min(reached + 1, lifecycle.length - 1)];
  const activeName = active.name || t("untitledProject");

  return (
    <PageBody>
      <PageHeading
        title={t("navOverview")}
        lead={
          active.state === "published"
            ? t("overviewLeadLive", { name: activeName })
            : t("overviewLeadDraft", { name: activeName })
        }
      />

      {/* The one project that matters most, at full size. */}
      <section
        className="rise mt-7 overflow-hidden rounded-[var(--r-lg)] border transition-shadow duration-[var(--t-ctl)] ease-[var(--ease)] hover:shadow-[0_1px_2px_rgb(14_16_22/0.04),0_16px_40px_-26px_rgb(14_16_22/0.3)]"
        style={{ borderColor: "var(--line)", background: "var(--surface)" }}
      >
        <div className="flex flex-col sm:flex-row">
          {/* The preview column exists only when there is something to put in
              it. A 280px panel holding the words "nothing here" is the emptiness
              this page was accused of. */}
          {active.hasOutput && (
            <div
              className="h-[180px] w-full shrink-0 overflow-hidden border-b sm:h-auto sm:w-[280px] sm:border-b-0 sm:border-r"
              style={{ borderColor: "var(--line)", background: "var(--raised)" }}
            >
              <ProductPreview project={active.preview} density="sm" />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col justify-between gap-6 p-5">
            <div>
              <div className="flex min-w-0 items-center gap-2">
                <h2 className="min-w-0 truncate text-[18px] font-semibold tracking-[-0.01em]">{activeName}</h2>
                <StatusPill state={active.state} />
              </div>
              {active.summary && (
                <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                  {active.summary}
                </p>
              )}
              <p className="mt-2.5 text-[13px]" style={{ color: "var(--ink-3)" }}>
                {t("projectsUpdated", { when: formatAge(t, active.updated) })}
              </p>
            </div>

            <div>
              {/* Where the project actually is, named — a bar on its own says
                  nothing about what happens next. */}
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-semibold" style={{ color: "var(--ink-2)" }}>
                  {lifecycle[reached]}
                </p>
                <p className="text-[13px] tabular-nums" style={{ color: "var(--ink-3)" }}>
                  {reached + 1}/{lifecycle.length}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {lifecycle.map((stage, index) => (
                  <span
                    key={stage}
                    className="h-1 flex-1 rounded-full transition-colors duration-[var(--t-ctl)]"
                    style={{ background: index <= reached ? "var(--accent)" : "var(--line-2)" }}
                  />
                ))}
              </div>
              <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
                <p className="text-[13px]" style={{ color: "var(--ink-3)" }}>
                  {t("overviewNextLabel")} <span style={{ color: "var(--ink-2)" }}>{nextStage}</span>
                </p>
                <VentrioLinkButton href={`/projects/${active.id}`} variant="primary">
                  <IconBuild className="h-4 w-4" />
                  {t("overviewContinue")}
                </VentrioLinkButton>
              </div>
            </div>
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-9">
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-semibold">{t("overviewRecent")}</h2>
            <Link
              href="/projects"
              className="text-[13px] font-semibold transition-opacity duration-[var(--t-hover)] hover:opacity-70"
              style={{ color: "var(--accent-ink)" }}
            >
              {t("overviewAllProjects")}
            </Link>
          </div>

          <ul className="mt-2 flex flex-col">
            {recent.map((project, index) => (
              <li key={project.id} style={{ borderTop: index === 0 ? "none" : "1px solid var(--line)" }}>
                <Link
                  href={`/projects/${project.id}`}
                  className="group flex items-start gap-3 rounded-[var(--r-md)] px-3 py-3.5 transition-colors duration-[var(--t-hover)] ease-[var(--ease)] hover:bg-[var(--raised)]"
                >
                  <span
                    className="dot mt-[7px] transition-transform duration-[var(--t-hover)] group-hover:scale-125"
                    style={{ background: project.preview.accent }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                      <span className="min-w-0 truncate text-[14.5px] font-semibold tracking-[-0.01em]">
                        {project.name || t("untitledProject")}
                      </span>
                      <StatusPill state={project.state} />
                    </span>
                    <span className="mt-0.5 block truncate text-[13px]" style={{ color: "var(--ink-2)" }}>
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
        </section>
      )}

      <section className="mt-9">
        <h2 className="text-[15px] font-semibold">{t("overviewEvolution")}</h2>
        <div
          className="mt-2.5 flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-md)] border px-4 py-3.5"
          style={{ borderColor: "var(--line-accent)", background: "var(--accent-soft)" }}
        >
          {/* No detection pipeline exists, so no project can have a signal.
              The state is honest rather than aspirational. */}
          <div className="min-w-0">
            <p className="text-[14px] font-semibold">{t("overviewSignalTitle")}</p>
            <p className="mt-0.5 text-[13px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {active.state === "published" ? t("overviewSignalLive") : t("overviewSignalDraft")}
            </p>
          </div>
          <Link
            href={`/projects/${active.id}/analytics`}
            className="shrink-0 text-[13px] font-semibold transition-opacity duration-[var(--t-hover)] hover:opacity-70"
            style={{ color: "var(--accent-ink)" }}
          >
            {t("overviewSignalLink")}
          </Link>
        </div>
      </section>
    </PageBody>
  );
}

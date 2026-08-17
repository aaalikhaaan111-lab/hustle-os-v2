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
        <PageHeading
          title={t("startFirstTitle")}
          lead={t("startFirstBody")}
          actions={
            <VentrioLinkButton href="/create" variant="primary">
              <IconPlus className="h-4 w-4" />
              {t("navNewProject")}
            </VentrioLinkButton>
          }
        />
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
      {/* THE PROJECT IS THE SUBJECT, not the word "Overview".
          The page used to open with a 26px heading reading "Overview" and a
          grey line underneath mentioning the project by name — so the largest
          type on the screen was a navigation label, and the thing the person
          came back for was set as a caption. The name is the headline now, and
          "Overview" is the eyebrow that says which screen this is. */}
      {/* No eyebrow. The shell's header bar says "Overview" directly above
          this, so an eyebrow repeating it put the word on screen twice. */}
      <PageHeading
        title={activeName}
        /* No lead. Both lead strings are of the form "<name> is still a
           draft" / "<name> is live", and the name is now the headline directly
           above — so the line restated the title and then told you a state that
           the status dot below states again. Two repetitions of one fact. */
        actions={
          <VentrioLinkButton href={`/projects/${active.id}`} variant="primary">
            <IconBuild className="h-4 w-4" />
            {t("overviewContinue")}
          </VentrioLinkButton>
        }
      />

      {/* The card around this is gone. It was a bordered panel holding a
          bordered preview column next to a stack of labels — a box inside a box
          on a page that is already one column. A hairline above it separates it
          from the heading, and that is enough. */}
      <section className="s-enter mt-12 border-t pt-8" style={{ borderColor: "var(--color-border)" }}>
        <div className="flex flex-col gap-6 sm:flex-row sm:gap-8">
          {/* The preview column exists only when there is something to put in
              it. A 280px panel holding the words "nothing here" is the emptiness
              this page was accused of. */}
          {active.hasOutput && (
            /* The preview is the artifact: lit, with the system's one real
               shadow, exactly as it appears in the workspace. */
            <div className="s-artifact h-[190px] w-full shrink-0 overflow-hidden sm:h-[210px] sm:w-[300px]">
              <ProductPreview project={active.preview} density="sm" />
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col justify-between gap-6">
            <div>
              <div className="flex min-w-0 items-center gap-3">
                <StatusPill state={active.state} />
                <span className="s-meta">{t("projectsUpdated", { when: formatAge(t, active.updated) })}</span>
              </div>
              {active.summary && <p className="s-body mt-3 max-w-lg">{active.summary}</p>}
            </div>

            <div>
              {/* Where the project actually is, named — a bar on its own says
                  nothing about what happens next. */}
              <div className="flex items-baseline justify-between gap-3">
                <p className="s-eyebrow">{lifecycle[reached]}</p>
                <p className="s-meta">
                  {reached + 1}/{lifecycle.length}
                </p>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                {lifecycle.map((stage, index) => (
                  <span
                    key={stage}
                    className="h-1 flex-1 rounded-full transition-colors duration-[var(--t-base)]"
                    style={{ background: index <= reached ? "var(--color-accent)" : "var(--color-border-strong)" }}
                  />
                ))}
              </div>
              <p className="s-meta mt-3.5">
                {t("overviewNextLabel")} <span style={{ color: "var(--color-ink-secondary)" }}>{nextStage}</span>
              </p>
            </div>
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="mt-9">
          <div className="flex items-baseline justify-between">
            <h2 className="s-eyebrow">{t("overviewRecent")}</h2>
            <Link
              href="/projects"
              className="text-[13px] font-semibold transition-opacity duration-[var(--t-fast)] hover:opacity-70"
              style={{ color: "var(--color-accent)" }}
            >
              {t("overviewAllProjects")}
            </Link>
          </div>

          <ul className="mt-2 flex flex-col">
            {recent.map((project, index) => (
              <li key={project.id} style={{ borderTop: index === 0 ? "none" : "1px solid var(--color-border)" }}>
                <Link
                  href={`/projects/${project.id}`}
                  className="group relative flex items-center gap-4 rounded-[var(--r-md)] py-4 pl-4 pr-3"
                >
                  <span
                    aria-hidden
                    className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full transition-all group-hover:h-7"
                    style={{ background: project.preview.accent, transitionDuration: "var(--t-base)" }}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16px] font-medium tracking-[-0.015em]">
                      {project.name || t("untitledProject")}
                    </span>
                    <span className="s-meta mt-1 flex min-w-0 items-center gap-2.5">
                      <StatusPill state={project.state} />
                      <span className="truncate">
                        {project.summary ?? (project.hasOutput ? t("summaryReady") : t("summaryNoVersion"))}
                      </span>
                    </span>
                  </span>
                  <span className="s-meta shrink-0">{formatAge(t, project.updated)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-9">
        <h2 className="s-eyebrow">{t("overviewEvolution")}</h2>
        <div
          className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-4"
          style={{ borderColor: "var(--color-border)" }}
        >
          {/* No detection pipeline exists, so no project can have a signal.
              The state is honest rather than aspirational. */}
          <div className="min-w-0">
            <p className="s-title">{t("overviewSignalTitle")}</p>
            <p className="s-body mt-1">
              {active.state === "published" ? t("overviewSignalLive") : t("overviewSignalDraft")}
            </p>
          </div>
          <Link
            href={`/projects/${active.id}/analytics`}
            className="shrink-0 text-[13px] font-semibold transition-opacity duration-[var(--t-fast)] hover:opacity-70"
            style={{ color: "var(--color-accent)" }}
          >
            {t("overviewSignalLink")}
          </Link>
        </div>
      </section>
    </PageBody>
  );
}

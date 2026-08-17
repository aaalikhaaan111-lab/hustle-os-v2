"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconBuild, IconPlus, StatusPill } from "@/components/workspace-ui/parts";
import { HowItWorks } from "@/components/workspace-ui/HowItWorks";
import { formatAge } from "@/lib/workspace/formatAge";
import type { PresentedProject } from "@/lib/workspace/present";
import { ProjectThumb, ProjectThumbEmpty } from "@/components/workspace/ProjectThumb";
import { ProjectCardMenu } from "@/components/workspace/ProjectCardMenu";

/* The six lifecycle stages drove a progress bar on this screen. The bar is
   gone — six stages with three of them unreachable is a meter measuring mostly
   nothing, and it was the most technical-looking object in the product. The
   vocabulary stays in the message catalogue for the workspace, which reports
   real state rather than a stage count. */

export interface OverviewScreenProps {
  active: PresentedProject | null;
  recent: PresentedProject[];
  /** Real responses on the active project's publication, if any. */
  activeResponses: number;
}

/**
 * HOME. A greeting on the sky, and your work underneath it.
 *
 * One column, centred, in the order the question is actually asked: what am I
 * working on, what else is open, and is there anything to learn from yet.
 * Allowances are not here — they belong behind the composer's settings control
 * and in Settings, not in front of someone deciding what to do next.
 */
export function OverviewScreen({ active, recent, activeResponses }: OverviewScreenProps) {
  const t = useTranslations("workspace");

  /**
   * THE HOME SCREEN GREETS YOU AND SHOWS YOU YOUR WORK.
   *
   * It opened with the word "Overview" — a navigation label as the largest type
   * on the page — over a bordered card holding a progress bar and a list of
   * filenames. A status report about one project, on the screen you land on
   * every time you arrive.
   *
   * Now the sky opens, the product asks what you are making, and the one button
   * that matters is under the question. Everything you have made rises over the
   * field on a sheet.
   */
  const cards = [active, ...recent].filter(Boolean) as PresentedProject[];

  return (
    <div className="min-h-full">
      <section className="px-5 pb-8 pt-8 sm:px-10 sm:pb-10 sm:pt-12">
        <div className="mx-auto w-full max-w-[1120px]">
          <h1 className="s-greet max-w-[14ch]">
            {active ? t("greetReturning") : t("greetFirst")}
          </h1>
          <p className="s-body mt-3 max-w-lg">{t("startFirstBody")}</p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <Link href="/create" className="s-btn s-btn--primary">
              <IconPlus className="h-[18px] w-[18px]" />
              {t("navNewProject")}
            </Link>
            {active && (
              <Link href={`/projects/${active.id}`} className="s-btn s-btn--secondary">
                <IconBuild className="h-[18px] w-[18px]" />
                {t("homeContinue")}
              </Link>
            )}
          </div>

          {!active && <HowItWorks className="mt-10" />}
        </div>
      </section>

      {cards.length > 0 && (
        <section className="mx-auto w-full max-w-[1160px] px-5 pb-16 sm:px-10">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="s-title">{t("homeYourWork")}</h2>
            <Link href="/projects" className="s-link text-[14px]">
              {t("overviewAllProjects")}
            </Link>
          </div>

          <ul className="mt-6 grid grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">
            {cards.slice(0, 6).map((project, index) => (
              <li key={project.id} className="s-enter" style={{ animationDelay: `${Math.min(index, 6) * 26}ms` }}>
                <ProjectCardMenu
                  projectId={project.id}
                  slug={project.slug}
                >
                <Link href={`/projects/${project.id}`} className="group block">
                  <span className="s-artifact s-thumb block aspect-[16/10] w-full">
                    {project.content ? (
                      <ProjectThumb content={project.content} />
                    ) : (
                      <ProjectThumbEmpty label={t("summaryNoVersion")} />
                    )}
                  </span>
                  <span className="mt-3 block min-w-0">
                    <span
                      className="block truncate text-[17px] font-medium"
                      style={{ color: "var(--color-ink)" }}
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
                </ProjectCardMenu>
              </li>
            ))}
          </ul>

          {/* The one number on this screen that is a real signal rather than a
              stage counter. */}
          {active?.state === "published" && activeResponses > 0 && (
            <p className="s-meta mt-8 border-t pt-5" style={{ borderColor: "var(--color-border)" }}>
              {t("overviewSignalTitle")}{" "}
              <Link href={`/projects/${active.id}/analytics`} className="s-link">
                {t("overviewSignalLink")}
              </Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}

import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getProjectById } from "@/lib/build/queries";
import { parseStage3ProjectState } from "@/lib/build/stage3Types";
import { loadProjectPublicationSummaries } from "@/lib/publishing/queries";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { IconCheck } from "@/components/workspace-ui/parts";
import { PageBody, PageHeading } from "@/components/workspace-ui/PageBody";
import { VentrioLinkButton } from "@/components/ui/VentrioButton";

interface AnalyticsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Analytics before there is anything to analyse.
 *
 * Nothing here is measured except the two facts the database actually holds:
 * whether the project is published, and how many real responses it has. The
 * rest of the page is not a placeholder standing in for missing numbers — it is
 * what the owner needs in order to produce them: the sequence, where this
 * project currently sits in it, what Ventrio will watch for, and how much
 * repetition it takes before a pattern is worth acting on.
 */
export default async function ProjectAnalyticsPage({ params }: AnalyticsPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const project = await getProjectById(supabase, user.id, id);
  if (!project) notFound();

  const [t, publications] = await Promise.all([
    getTranslations("workspace"),
    loadProjectPublicationSummaries(supabase, user.id),
  ]);

  const publication = publications.get(project.id);
  const published = Boolean(publication?.isPublished);
  const responseCount = publication?.responseCount ?? 0;
  const stage3 = parseStage3ProjectState(project.snapshot_fields);
  const hasFirstVersion = Boolean(stage3?.output);

  // Each step is true only where the data says so. Tracking is false for
  // everyone today because the pipeline does not exist yet.
  const readiness = [
    { label: t("readinessCreated"), done: true },
    { label: t("readinessFirstVersion"), done: hasFirstVersion },
    { label: t("readinessPublished"), done: published },
    { label: t("readinessTracking"), done: false },
    { label: t("readinessFirstSession"), done: responseCount > 0 },
    { label: t("readinessPattern"), done: responseCount >= 3 },
  ];
  const doneCount = readiness.filter((step) => step.done).length;
  // The current stage is the first one still outstanding — not a guess about
  // progress, just the next thing that has to become true.
  const currentIndex = readiness.findIndex((step) => !step.done);

  const sequence = [
    t("analyticsStep1"),
    t("analyticsStep2"),
    t("analyticsStep3"),
    t("analyticsStep4"),
    t("analyticsStep5"),
  ];
  const watched = [
    t("analyzeCompletion"),
    t("analyzeAbandon"),
    t("analyzeRepeat"),
    t("analyzeBack"),
    t("analyzeInterest"),
    t("analyzeReturn"),
    t("analyzeFeedback"),
  ];

  return (
    <WorkspaceShell
      initials={(user.email ?? "?").slice(0, 2).toUpperCase()}
      project={{ id: project.id, name: project.name ?? t("untitledProject"), state: published ? "published" : "draft" }}
    >
      <PageBody>
        <PageHeading
          title={t("navAnalytics")}
          lead={responseCount > 0 ? t("analyticsLiveBody") : t("analyticsDraftTitle")}
        />

        {/* The lifecycle spine: the same six stages the whole product is built
            on, with only the stages the database can vouch for marked done. */}
        <section
          className="rise mt-6 rounded-[var(--r-lg)] border p-5"
          style={{ borderColor: "var(--line)", background: "var(--surface)" }}
        >
          <ol className="flex flex-col sm:flex-row sm:items-start">
            {readiness.map((step, index) => {
              const isCurrent = index === currentIndex;
              return (
                <li key={step.label} className="flex min-w-0 flex-1 gap-3 sm:flex-col sm:gap-2">
                  <div className="flex flex-col items-center sm:w-full sm:flex-row">
                    <span
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold"
                      style={{
                        background: step.done ? "var(--accent)" : isCurrent ? "var(--accent-soft)" : "var(--sunken)",
                        color: step.done ? "#fff" : isCurrent ? "var(--accent-ink)" : "var(--ink-3)",
                        border: isCurrent ? "1.5px solid var(--accent)" : "none",
                      }}
                    >
                      {step.done ? <IconCheck className="h-3 w-3" /> : index + 1}
                    </span>
                    {index < readiness.length - 1 && (
                      <span
                        className="h-6 w-[1.5px] sm:h-[1.5px] sm:w-full"
                        style={{ background: step.done ? "var(--accent)" : "var(--line-2)" }}
                      />
                    )}
                  </div>
                  <p
                    className="pb-4 text-[13px] leading-snug sm:pb-0 sm:pr-3"
                    style={{
                      color: step.done || isCurrent ? "var(--ink)" : "var(--ink-3)",
                      fontWeight: isCurrent ? 600 : 400,
                    }}
                  >
                    {step.label}
                  </p>
                </li>
              );
            })}
          </ol>
          <p className="mt-1 text-[13px] tabular-nums sm:mt-4" style={{ color: "var(--ink-3)" }}>
            {doneCount} / {readiness.length} complete
          </p>
        </section>

        {/* The only measured number this project has. It is shown when it
            exists, and nothing stands in for it when it does not. */}
        {responseCount > 0 && (
          <section
            className="rise mt-4 rounded-[var(--r-lg)] border p-5"
            style={{ borderColor: "var(--line)", background: "var(--surface)" }}
          >
            <p className="text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums">{responseCount}</p>
            <p className="mt-1.5 text-[13px]" style={{ color: "var(--ink-2)" }}>
              {t("analyticsResponses")}
            </p>
          </section>
        )}

        <section className="mt-8 border-t pt-7" style={{ borderColor: "var(--line)" }}>
          <h2 className="text-[15px] font-semibold">{t("analyzeTitle")}</h2>
          <ul className="mt-3 grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {watched.map((item) => (
              <li key={item} className="flex gap-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                <span className="dot mt-[9px]" style={{ background: "var(--accent)" }} />
                {item}
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
            {t("threshold1")} · {t("threshold2")} · {t("threshold3")}
          </p>
        </section>

        <section className="mt-8">
          <h2 className="text-[15px] font-semibold">{t("readinessSequenceTitle")}</h2>
          <ol className="mt-3 flex flex-col gap-2">
            {sequence.map((step, index) => (
              <li key={step} className="flex gap-3 text-[14px] leading-relaxed">
                <span className="w-4 shrink-0 tabular-nums" style={{ color: "var(--ink-3)" }}>
                  {index + 1}
                </span>
                <span style={{ color: "var(--ink-2)" }}>{step}</span>
              </li>
            ))}
          </ol>
        </section>

        {/* No detection pipeline exists, so no project can have a signal. */}
        <section
          className="mt-8 rounded-[var(--r-lg)] border p-5"
          style={{ borderColor: "var(--line-accent)", background: "var(--accent-soft)" }}
        >
          <p className="text-[13px] font-semibold uppercase tracking-[0.08em]" style={{ color: "var(--ink-3)" }}>
            {t("signalEmptyTitle")}
          </p>
          <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {t("signalEmptyBody")}
          </p>
          <p className="mt-3 text-[13px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
            {t("thresholdNote")}
          </p>
        </section>

        <div className="mt-7 flex flex-wrap gap-2">
          <VentrioLinkButton href={`/projects/${project.id}`} variant="primary">
            {t("analyticsBackToBuild")}
          </VentrioLinkButton>
          {published && publication?.slug && (
            <VentrioLinkButton href={`/p/${publication.slug}`} target="_blank" rel="noreferrer" variant="secondary">
              {t("viewLive")}
            </VentrioLinkButton>
          )}
        </div>
      </PageBody>
    </WorkspaceShell>
  );
}

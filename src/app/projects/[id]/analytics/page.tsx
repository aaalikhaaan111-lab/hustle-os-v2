import { notFound, redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getProjectById } from "@/lib/build/queries";
import { loadProjectAnalytics } from "@/lib/publishing/queries";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { loadShellNav } from "@/lib/workspace/shellNav";
import { PageBody, PageHeading } from "@/components/workspace-ui/PageBody";
import { VentrioLinkButton } from "@/components/ui/VentrioButton";
import { ResponsesChart } from "@/components/workspace/ResponsesChart";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/shadcn/table";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/shadcn/empty";

interface AnalyticsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * What Ventrio can honestly say about a published project.
 *
 * WHAT THIS PAGE USED TO BE. A readiness checklist, a five-step sequence, and a
 * seven-item list of the things Ventrio "watches for" — completion, abandonment,
 * repeat visits, returns. None of it was measured. One row of the checklist was
 * hard-coded to `done: false` with the comment "tracking is false for everyone
 * today because the pipeline does not exist yet", which is an accurate note to
 * leave in the code and a strange thing to show a person as progress.
 *
 * WHAT IT IS NOW. The numbers the database holds, and nothing beside them.
 * `project_responses` records one row per submission with a `submitter_hash`
 * and a timestamp, so responses, distinct people and dates are real counts.
 *
 * WHAT IS MISSING, AND STAYS MISSING. Views, visitors, sessions. Nothing in the
 * product records a request to a public page — no pageview table, no beacon on
 * `/p/[slug]`, no analytics provider — so those cannot be shown without being
 * invented. The page says so in one line rather than leaving a gap that reads
 * like zero traffic.
 */
export default async function ProjectAnalyticsPage({ params }: AnalyticsPageProps) {
  const { id } = await params;
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const project = await getProjectById(supabase, user.id, id);
  if (!project) notFound();

  const [t, format, analytics, nav] = await Promise.all([
    getTranslations("workspace"),
    getFormatter(),
    loadProjectAnalytics(supabase, user.id, project.id),
    loadShellNav(supabase, user.id, user.email),
  ]);

  const day = (value: string | null) =>
    value ? format.dateTime(new Date(value), { day: "numeric", month: "short", year: "numeric" }) : "—";

  /**
   * Three states, and each is a different thing to say. An unpublished project
   * has no audience yet; a published one with no responses is waiting; one with
   * responses has numbers. Showing zeroes for the first two would present "no
   * traffic" as a measurement when it is only an absence of one.
   */
  const state = !analytics.published ? "unpublished" : analytics.responseCount === 0 ? "quiet" : "live";

  return (
    <WorkspaceShell
      initials={nav.initials}
      email={nav.email}
      recent={nav.recent}
      project={{
        id: project.id,
        name: project.name ?? t("untitledProject"),
        state: analytics.published ? "published" : "draft",
      }}
    >
      <PageBody>
        <PageHeading
          title={t("navAnalytics")}
          lead={state === "live" ? t("analyticsLiveBody") : undefined}
        />

        {state === "live" ? (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Metric label={t("metricResponses")} value={String(analytics.responseCount)} />
              <Metric label={t("metricPeople")} value={String(analytics.uniqueSubmitters)} />
              <Metric label={t("metricLastActivity")} value={day(analytics.lastResponseAt)} />
              <Metric label={t("metricSince")} value={day(analytics.publishedAt)} />
            </div>

            {/* Only with more than one day of data. One point is not a trend,
                and drawing it as one is the kind of invented insight this page
                was rewritten to remove. */}
            {analytics.daily.length > 1 && (
              <div
                className="mt-4 rounded-[var(--r-lg)] border p-4"
                style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
              >
                <p className="s-eyebrow mb-3">{t("metricResponses")}</p>
                <ResponsesChart data={analytics.daily} label={t("metricResponses")} />
              </div>
            )}

            {/* The same series as a table. A chart shows the shape; the table is
                what a person reads when they want the number for a given day,
                and it is what a screen reader gets instead of an <svg>. */}
            {analytics.daily.length > 1 && (
              <div className="mt-4 overflow-hidden rounded-[var(--r-lg)] border"
                   style={{ borderColor: "var(--color-border)" }}>
                <Table>
                  <TableCaption className="sr-only">{t("metricResponses")}</TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("metricLastActivity")}</TableHead>
                      <TableHead className="text-right">{t("metricResponses")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[...analytics.daily]
                      .reverse()
                      .filter((row) => row.responses > 0)
                      .slice(0, 10)
                      .map((row) => (
                        <TableRow key={row.date}>
                          <TableCell>{row.date}</TableCell>
                          <TableCell className="text-right tabular-nums">{row.responses}</TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <p className="mt-4 text-[13px] leading-relaxed" style={{ color: "var(--color-ink-muted)" }}>
              {t("analyticsScopeNote")}
            </p>
          </>
        ) : (
          <EmptyState
            title={state === "unpublished" ? t("analyticsUnpublishedTitle") : t("analyticsQuietTitle")}
            body={state === "unpublished" ? t("analyticsUnpublishedBody") : t("analyticsQuietBody")}
            note={t("analyticsScopeNote")}
            action={
              <VentrioLinkButton href={`/projects/${project.id}`} variant="primary" size="sm">
                {t("analyticsBackToBuild")}
              </VentrioLinkButton>
            }
          />
        )}
      </PageBody>
    </WorkspaceShell>
  );
}

/** One measured number. No sparkline: there is no series behind it. */
function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="rounded-[var(--r-lg)] border p-4"
      style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
    >
      <p className="s-eyebrow" style={{ color: "var(--color-ink-muted)" }}>
        {label}
      </p>
      <p className="mt-1.5 text-[26px] font-semibold leading-none tabular-nums" style={{ color: "var(--color-ink)" }}>
        {value}
      </p>
    </div>
  );
}

/**
 * Replaced by `Empty`. The hand-written version was a bordered box with a
 * centred title, body, note and action — which is exactly what the primitive
 * is, so keeping a local copy meant two empty states to keep in step.
 */
function EmptyState({
  title,
  body,
  note,
  action,
}: {
  title: string;
  body: string;
  note: string;
  action: React.ReactNode;
}) {
  return (
    <Empty className="rounded-[var(--r-lg)] border" style={{ borderColor: "var(--color-border)" }}>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{body}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        {action}
        <p className="s-meta mt-2">{note}</p>
      </EmptyContent>
    </Empty>
  );
}

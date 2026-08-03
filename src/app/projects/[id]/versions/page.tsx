import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { getProjectById } from "@/lib/build/queries";
import { loadProjectPublicationSummaries } from "@/lib/publishing/queries";
import { loadProjectChanges, loadProjectVersions } from "@/lib/workspace/types";
import { WorkspaceShell } from "@/components/workspace-ui/WorkspaceShell";
import { PageBody, PageHeading } from "@/components/workspace-ui/PageBody";
import { VentrioLinkButton } from "@/components/ui/VentrioButton";

interface VersionsPageProps {
  params: Promise<{ id: string }>;
}

/**
 * Versions and unpublished changes for one project.
 *
 * `project_publications` keeps a single row per project and overwrites it on
 * update, so no history exists to list yet, and nothing records individual
 * changes. Both lists are therefore genuinely empty — and say so — rather than
 * showing an invented trail of edits the owner never made.
 */
export default async function ProjectVersionsPage({ params }: VersionsPageProps) {
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
  const versions = loadProjectVersions();
  const changes = loadProjectChanges();

  return (
    <WorkspaceShell
      initials={(user.email ?? "?").slice(0, 2).toUpperCase()}
      project={{ id: project.id, name: project.name ?? t("untitledProject"), state: published ? "published" : "draft" }}
    >
      <PageBody>
        <PageHeading
          title={t("tabVersions")}
          lead={published ? t("versionsEmptyPublished") : t("versionsEmptyBody")}
        />

        {/* The timeline as approved. Only one entry can be real today: the
            live publication. `project_publications` holds a single row per
            project and overwrites it, so there is no history to walk back
            through, and no proposed version exists until something produces
            one. Neither absence is dressed up as a card. */}
        <ol className="rise mt-6 flex max-w-[720px] flex-col">
          {published ? (
            <li className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold text-white"
                  style={{ background: "var(--ok)" }}
                >
                  1
                </span>
              </div>
              <div className="min-w-0 flex-1 pb-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[17px] font-semibold tracking-[-0.01em]">{project.name ?? t("untitledProject")}</h2>
                  <span
                    className="rounded-full px-2 py-[3px] text-[12px] font-medium leading-none"
                    style={{ background: "var(--ok-soft)", color: "var(--ok)" }}
                  >
                    {t("statusLive")}
                  </span>
                </div>
                {publication?.slug && (
                  <VentrioLinkButton
                    href={`/p/${publication.slug}`}
                    target="_blank"
                    rel="noreferrer"
                    variant="secondary"
                    size="sm"
                    className="mt-2.5"
                  >
                    {t("viewLive")}
                  </VentrioLinkButton>
                )}
              </div>
            </li>
          ) : (
            <li className="flex gap-4">
              <div className="flex flex-col items-center">
                <span
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12px] font-semibold"
                  style={{ background: "var(--sunken)", color: "var(--ink-3)" }}
                >
                  1
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-medium">{t("versionsEmptyTitle")}</p>
              </div>
            </li>
          )}
        </ol>

        {versions.length > 0 && (
          <ul className="mt-4 flex flex-col gap-2 text-[14px]" style={{ color: "var(--ink-2)" }}>
            {versions.map((version) => (
              <li key={version.id}>{version.label}</li>
            ))}
          </ul>
        )}

        <section className="mt-10 max-w-[720px] border-t pt-7" style={{ borderColor: "var(--line)" }}>
          <h2 className="text-[15px] font-semibold">{t("tabChanges")}</h2>
          {changes.length === 0 ? (
            <>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {t("changesEmptyTitle")}
              </p>
              <p className="mt-1 text-[13px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                {t("changesEmptyBody")}
              </p>
            </>
          ) : (
            <ul className="mt-3 flex flex-col gap-2 text-[14px]" style={{ color: "var(--ink-2)" }}>
              {changes.map((change) => (
                <li key={change.id}>{change.area}</li>
              ))}
            </ul>
          )}
        </section>
      </PageBody>
    </WorkspaceShell>
  );
}

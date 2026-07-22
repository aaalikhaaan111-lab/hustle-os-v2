import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";
import { listProjects } from "@/lib/build/queries";
import { parseSnapshotFields } from "@/lib/build/snapshot";
import { parseStage3ProjectState } from "@/lib/build/stage3Types";
import { loadProjectPublicationSummaries, type ProjectPublicationSummary } from "@/lib/publishing/queries";
import type { Database } from "@/types/supabase";

type ProjectRow = Database["public"]["Tables"]["projects"]["Row"];
type ProjectStatusKey = "statusFirstVersion" | "statusLive" | "statusDraft";

const TYPE_KEYS: Record<string, "typeDigitalProduct" | "typeService" | "typeContentMedia" | "typeCommunitySocial" | "typeOther"> = {
  digital_product: "typeDigitalProduct",
  service: "typeService",
  content_media: "typeContentMedia",
  community_social: "typeCommunitySocial",
};

function statusFor(project: ProjectRow, publication?: ProjectPublicationSummary): ProjectStatusKey {
  if (publication?.isPublished) return "statusLive";
  if (publication) return "statusDraft";
  const stage3 = parseStage3ProjectState(project.snapshot_fields);
  if (stage3?.status === "first_version_ready" && stage3.output) return "statusFirstVersion";
  return "statusDraft";
}

export default async function ProjectsPage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);
  if (!user) redirect("/login");

  const [projects, t, publications] = await Promise.all([
    listProjects(supabase, user.id),
    getTranslations("projects"),
    loadProjectPublicationSummaries(supabase, user.id),
  ]);

  return (
    <div className="projects-collection mx-auto flex w-full max-w-5xl flex-col">
      <header className="emergence flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-accent/75">{t("eyebrow")}</p>
          <h1 className="ventrio-display mt-3 text-[clamp(2.7rem,8vw,5.7rem)] leading-[0.92] text-ink">{t("title")}</h1>
          <p className="mt-4 max-w-xl text-sm leading-6 text-ink-secondary sm:text-base">{t("description")}</p>
        </div>
        {projects.length > 0 && (
          <Link href="/create" className="primary-action w-fit shrink-0 focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent">
            <span aria-hidden>＋</span> {t("newProject")}
          </Link>
        )}
      </header>

      {projects.length === 0 ? (
        <section className="emergence mt-16 flex min-h-[340px] flex-col items-center justify-center rounded-[2rem] border border-white/[0.055] bg-white/[0.018] px-6 text-center">
          <span className="creation-orbit scale-75" aria-hidden><span /></span>
          <h2 className="ventrio-display mt-7 text-3xl text-ink">{t("emptyTitle")}</h2>
          <p className="mt-3 max-w-md text-sm leading-6 text-ink-secondary">{t("emptyDescription")}</p>
          <Link href="/create" className="primary-action mt-7">{t("emptyCta")} <span aria-hidden>→</span></Link>
        </section>
      ) : (
        <section className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label={t("collectionLabel")}>
          {projects.map((project, index) => {
            const snapshot = parseSnapshotFields(project.snapshot_fields);
            const stage3 = parseStage3ProjectState(project.snapshot_fields);
            const publication = publications.get(project.id);
            const concept = stage3?.output?.identity.description ?? stage3?.direction?.concept ?? snapshot.solution ?? (stage3 ? t("exploringDescription") : t("conceptFallback"));
            const status = statusFor(project, publication);
            const typeKey = TYPE_KEYS[project.project_type] ?? "typeOther";
            return (
              <article key={project.id} className="project-collection-card group emergence" style={{ animationDelay: `${Math.min(index, 8) * 65}ms` }}>
                <div className={`project-identity identity-${project.project_type}`} aria-hidden><span /></div>
                <div className="flex items-center justify-between gap-3 text-[10px] font-semibold uppercase tracking-[0.15em] text-ink-muted">
                  <span>{t(typeKey)}</span>
                  <span className="inline-flex items-center gap-1.5"><i className={`h-1 w-1 rounded-full not-italic ${publication?.isPublished ? "bg-success" : "bg-accent"}`} />{t(status)}</span>
                </div>
                <div className="mt-8">
                  <h2 className="ventrio-display truncate text-[1.7rem] leading-none text-ink">
                    <Link href={`/projects/${project.id}`} className="focus-visible:outline-2 focus-visible:outline-offset-3 focus-visible:outline-accent">
                      {project.name || t("untitled")}
                    </Link>
                  </h2>
                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-ink-secondary">{concept}</p>
                </div>
                <div className="mt-auto pt-10">
                  {publication?.isPublished && <p className="mb-3 text-[11px] font-semibold text-success">{t("responseCount", { count: publication.responseCount })}</p>}
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold text-ink-muted">
                    <Link href={`/projects/${project.id}`} className="transition-colors hover:text-ink">{t("open")}</Link>
                    {publication?.isPublished ? (
                      <Link href={`/p/${publication.slug}`} target="_blank" className="inline-flex items-center gap-1.5 text-accent transition-colors hover:text-accent-hover">
                        {t("viewLive")} <span aria-hidden>↗</span>
                      </Link>
                    ) : (
                      <span className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden>→</span>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}

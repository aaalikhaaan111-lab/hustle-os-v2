import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { ProjectOutputRenderer } from "@/components/build/ProjectOutputRenderer";
import { PublicAppView } from "@/components/publishing/PublicAppView";
import { getPublicProject } from "@/lib/publishing/queries";
import { isPublicSlug } from "@/lib/publishing/slug";
import { getSiteUrl } from "@/lib/site";
import { canonicalProjectUrl } from "@/lib/publishing/publicUrl";
import { brandingRequiredFor } from "@/lib/publishing/branding";
import { VentrioBadge } from "@/components/publishing/VentrioBadge";
import { getTranslations } from "next-intl/server";
import { buildGeneratedApp } from "@/lib/v2/app/pipeline";

/**
 * A published project, for anyone with the link.
 *
 * Two shapes reach this page. A project built by the fixed renderer publishes a
 * page artifact and renders as it always has. A project built by the app
 * runtime publishes an application, and is compiled here and served in the same
 * sandboxed frame the owner sees in the workspace — same sandbox attributes,
 * same inner CSP, same nonce discipline. A visitor gets exactly the thing that
 * was built, with none of the trust the owner's session carries.
 */

export const revalidate = 3600;

interface PublicProjectPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PublicProjectPageProps): Promise<Metadata> {
  const { slug } = await params;
  if (!isPublicSlug(slug)) {
    return { title: "Project unavailable — Ventrio", robots: { index: false, follow: false } };
  }
  const publication = await getPublicProject(slug);
  if (!publication) {
    return { title: "Project unavailable — Ventrio", robots: { index: false, follow: false } };
  }

  // Both shapes carry a name and a description; the query normalises them so
  // this does not have to know which one it has.
  const title = publication.name;
  const description = publication.description;
  /**
   * The subdomain is the canonical address.
   *
   * `/p/[slug]` still resolves and always will — links already shared must not
   * rot — but pointing canonical at `[slug].ventrio.org` means search engines
   * and share sheets converge on one URL instead of splitting between two that
   * serve identical content.
   */
  const canonical = canonicalProjectUrl(publication.slug);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", siteName: "Ventrio", url: canonical, title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function PublicProjectPage({ params }: PublicProjectPageProps) {
  const { slug } = await params;
  if (!isPublicSlug(slug)) notFound();
  const publication = await getPublicProject(slug);
  if (!publication) notFound();

  // Whose project this is decides whether it carries the badge, so it is read
  // once here and used by whichever shape renders below.
  const branding = await brandingRequiredFor(publication.slug);
  const tBrand = await getTranslations({ locale: publication.locale, namespace: "branding" });
  const badgeLabels = {
    madeWith: tBrand("madeWith"),
    remove: tBrand("remove"),
    upgradeTitle: tBrand("upgradeTitle"),
    upgradeBody: tBrand("upgradeBody"),
    viewPricing: tBrand("viewPricing"),
    close: tBrand("close"),
  };

  if (publication.app) {
    /**
     * Compiled per request, from source, never from a stored document.
     *
     * The same rule the workspace follows: what is persisted is the project,
     * and the document is rebuilt every time it is shown. It carries this
     * request's CSP nonce, because a srcdoc frame inherits the parent page's
     * policy and would otherwise refuse Ventrio's own bootstrap script.
     */
    const nonce = (await headers()).get("x-nonce") ?? undefined;
    const built = await buildGeneratedApp(publication.app, { nonce });
    // A published application that no longer compiles is a 404 rather than a
    // broken page. It cannot be repaired from here, and showing a frame full of
    // build errors to a stranger is worse than showing nothing.
    if (!built.ok) notFound();

    return (
      <main className="public-project-page">
        <PublicAppView title={publication.name} document={built.document} locale={publication.locale} />
        {branding && <VentrioBadge labels={badgeLabels} pricingHref={`${getSiteUrl()}/pricing`} />}
      </main>
    );
  }

  if (!publication.output) notFound();

  return (
    <main className="public-project-page">
      {branding && <VentrioBadge labels={badgeLabels} pricingHref={`${getSiteUrl()}/pricing`} />}
      <ProjectOutputRenderer
        projectKey={publication.slug}
        slug={publication.slug}
        output={publication.output}
        locale={publication.locale}
        mode="public"
      />
    </main>
  );
}

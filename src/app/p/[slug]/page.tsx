import type { Metadata } from "next";
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
     * The document is NOT built here any more.
     *
     * It is still compiled per request from source — that rule has not changed,
     * and nothing stores a rendered document — but it is compiled by
     * `./app-document`, which serves it as its own response. Embedding it here
     * meant React Server Components serialised it twice, once as markup and
     * once as flight data, making a 2.4 MB document into 5.6 MB of page. A real
     * iPhone could not load that; the route comment records the whole finding.
     *
     * Two consequences worth stating. This page no longer compiles anything, so
     * it is cheap and fast. And a publication that fails to compile is no longer
     * a 404 here — the document request answers 404 and `PublicAppMonitor`
     * shows Ventrio's own failure state, which is a better answer for a link
     * someone has already shared than a page that simply does not exist.
     */
    return (
      <main className="public-project-page">
        <PublicAppView title={publication.name} slug={publication.slug} locale={publication.locale} />
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

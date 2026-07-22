import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProjectOutputRenderer } from "@/components/build/ProjectOutputRenderer";
import { getPublicProject } from "@/lib/publishing/queries";
import { isPublicSlug } from "@/lib/publishing/slug";
import { getSiteUrl } from "@/lib/site";

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

  const title = publication.output.identity.name;
  const description = publication.output.identity.description;
  const canonical = `${getSiteUrl()}/p/${publication.slug}`;
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

  return (
    <main className="public-project-page">
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

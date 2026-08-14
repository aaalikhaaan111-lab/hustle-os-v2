import "server-only";

import { unstable_cache } from "next/cache";
import { createServiceClient } from "@/lib/supabase/public";
import { entitlementsFor } from "@/lib/billing/plans";
import { isPublicSlug } from "@/lib/publishing/slug";
import { publicProjectCacheTag } from "@/lib/publishing/queries";

/**
 * Whether a published project must carry "Made with Ventrio".
 *
 * Asks the owner's plan, not the visitor's — the badge is a property of whose
 * project it is. A free project shows it; Pro and Studio do not. When billing
 * lands and a plan changes, this answer changes with it and no publication row
 * needs rewriting.
 *
 * Fails closed toward showing the badge: an unknown owner, a read error or an
 * unrecognised plan all mean "free", so the branding stays. Getting that wrong
 * in the other direction would quietly drop branding from projects that are
 * supposed to carry it.
 *
 * Cached on the same tag as the publication itself, so publishing or
 * unpublishing invalidates both together and a public page does not pay for two
 * extra round trips per visitor.
 */
async function readBrandingRequired(slug: string): Promise<boolean> {
  const service = createServiceClient();
  const { data: publication } = await service
    .from("project_publications")
    .select("user_id")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (!publication?.user_id) return true;

  const { data: profile } = await service
    .from("profiles")
    .select("plan")
    .eq("id", publication.user_id)
    .maybeSingle();

  return !entitlementsFor((profile as { plan?: unknown } | null)?.plan).canRemoveBranding;
}

export async function brandingRequiredFor(slug: string): Promise<boolean> {
  if (!isPublicSlug(slug)) return true;
  return unstable_cache(
    () => readBrandingRequired(slug),
    ["publication-branding", slug],
    { revalidate: 3600, tags: [publicProjectCacheTag(slug)] },
  )();
}

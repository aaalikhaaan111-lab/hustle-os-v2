"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { IconBack, StatusPill } from "@/components/workspace-ui/parts";

/**
 * The project's identity, for the head of the conversation card.
 *
 * WHY IT IS A COMPONENT AND NOT INLINE. Two different screens render the
 * workspace — `WorkspaceView` once a version exists, and `PreOutputWorkspace`
 * before one does — and both mount `BuildScreen`. The first version of this
 * was written inline in `WorkspaceView` only, so the name and the way back
 * simply did not exist on the pre-output path, which is most of the time a new
 * person spends in the product. One component, passed by both.
 *
 * It used to be a bar across the top of the entire application, naming a
 * screen the sidebar was already highlighting. It sits with the conversation
 * it belongs to now.
 */
export function ProjectHead({ name, published }: { name: string; published: boolean }) {
  const t = useTranslations("workspace");
  return (
    <>
      <Link
        href="/projects"
        aria-label={t("projectsTitle")}
        className="s-nav-item h-8 w-8 shrink-0 items-center justify-center rounded-full"
      >
        <IconBack className="h-4 w-4" />
      </Link>
      <span
        className="min-w-0 flex-1 truncate text-[19px] font-medium"
      >
        {name || t("untitledProject")}
      </span>
      <StatusPill state={published ? "published" : "draft"} />
    </>
  );
}

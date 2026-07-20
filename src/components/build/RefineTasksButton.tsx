"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { refineExistingTasksAction } from "@/lib/actions/build";

// Explicit, user-triggered "make my remaining tasks more specific to this
// project" action. Only refines pending tasks (server-side), never completed
// ones, and no-ops safely when AI is unavailable.
export function RefineTasksButton({ projectId }: { projectId: string }) {
  const t = useTranslations("build");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  function handleClick() {
    if (isPending) return;
    setMessage(null);
    startTransition(async () => {
      const result = await refineExistingTasksAction(projectId);
      if (result.error) {
        setMessage(result.error);
        return;
      }
      setMessage(result.refined > 0 ? t("tailorDone") : t("tailorNoChange"));
      if (result.refined > 0) router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex items-center gap-1.5 rounded-full border border-indigo-100 bg-accent-soft px-3.5 py-1.5 text-xs font-semibold text-accent transition-colors hover:bg-indigo-100 disabled:opacity-60"
      >
        {isPending ? t("tailoring") : `✨ ${t("tailorTasks")}`}
      </button>
      {message && <span className="text-xs text-ink-muted">{message}</span>}
    </div>
  );
}

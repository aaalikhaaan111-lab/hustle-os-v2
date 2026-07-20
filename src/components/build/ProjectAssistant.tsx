"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";

// The panel (and its chat code) is only pulled in once the user opens it, so
// the workspace renders without waiting for any assistant code or history.
const AssistantPanel = dynamic(
  () => import("@/components/build/AssistantPanel").then((mod) => mod.AssistantPanel),
  { ssr: false }
);

export function ProjectAssistant({ projectId }: { projectId: string }) {
  const t = useTranslations("build");
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom))] right-4 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 px-4 py-3 text-sm font-bold text-white shadow-[0_8px_24px_rgba(99,102,241,0.4)] transition-transform hover:scale-105 active:scale-95 md:bottom-6"
      >
        <span aria-hidden>🤖</span>
        <span className="hidden sm:inline">{t("assistantOpen")}</span>
      </button>
      {open && <AssistantPanel projectId={projectId} onClose={() => setOpen(false)} />}
    </>
  );
}

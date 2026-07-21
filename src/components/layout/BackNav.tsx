"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

interface BackNavProps {
  /** Safe internal destination when there's no usable in-app history. */
  fallback: string;
  /** Optional explicit label (e.g. "Back to Build"); defaults to "Back". */
  label?: string;
}

// A single, reusable back affordance for secondary/detail pages so none of them
// become dead ends. Prefers real in-app history when it exists (same-origin
// referrer + a navigable stack), otherwise routes to a known-safe fallback.
export function BackNav({ fallback, label }: BackNavProps) {
  const router = useRouter();
  const t = useTranslations("common");

  function handleBack() {
    if (typeof window !== "undefined") {
      const ref = document.referrer;
      const sameOrigin = ref && (() => {
        try {
          return new URL(ref).origin === window.location.origin;
        } catch {
          return false;
        }
      })();
      if (window.history.length > 1 && sameOrigin) {
        router.back();
        return;
      }
    }
    router.push(fallback);
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      className="press-scale group inline-flex items-center gap-1.5 rounded-full px-1 py-1 text-sm font-medium text-ink-secondary transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <span aria-hidden className="transition-transform duration-150 group-hover:-translate-x-0.5">
        ←
      </span>
      <span>{label ?? t("back")}</span>
    </button>
  );
}

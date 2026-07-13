"use client";

import { useTransition } from "react";
import { resetOnboardingAction } from "@/lib/actions/onboarding";

export function DevResetBar() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      if (typeof window !== "undefined") {
        Object.keys(window.localStorage)
          .filter((key) => key.startsWith("hustle:"))
          .forEach((key) => window.localStorage.removeItem(key));
      }
      await resetOnboardingAction();
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={isPending}
      className="fixed bottom-4 right-4 z-50 rounded-full bg-zinc-900 px-4 py-3 text-sm font-bold text-white shadow-xl transition-all duration-200 ease-out hover:scale-105 active:scale-95 disabled:opacity-60"
    >
      {isPending ? "🔄 Сбрасываем..." : "🛠️ DEV: Сбросить онбординг"}
    </button>
  );
}

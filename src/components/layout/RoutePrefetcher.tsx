"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";
import { useGameProgress } from "@/lib/game-progress/GameProgressContext";

// Once the user is authenticated and the app shell is idle, warm the router
// cache for the 5 primary destinations so the first tap on each nav item
// doesn't pay the full navigation cost. Gated on userId so this never fires
// for a logged-out visitor on /login or /signup (those prefetches would just
// bounce through the auth redirect for nothing). Five cheap prefetches once
// per login, not on every render or every navigation.
export function RoutePrefetcher() {
  const router = useRouter();
  const { userId } = useGameProgress();

  useEffect(() => {
    if (!userId) return;

    const prefetchAll = () => {
      for (const item of NAV_ITEMS) {
        router.prefetch(item.href);
      }
    };

    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(prefetchAll, { timeout: 2000 });
      return () => window.cancelIdleCallback(id);
    }

    const timeout = setTimeout(prefetchAll, 300);
    return () => clearTimeout(timeout);
  }, [router, userId]);

  return null;
}

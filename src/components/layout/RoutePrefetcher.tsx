"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { NAV_ITEMS } from "@/lib/constants";

// Once the user is authenticated and the app shell is idle, warm the router
// cache for the primary destinations so the first tap on each nav item
// doesn't pay the full navigation cost. Gated on isAuthenticated so this never
// fires for a logged-out visitor on /login or /signup (those prefetches would
// just bounce through the auth redirect for nothing). Cheap prefetches once
// per login, not on every render or every navigation.
export function RoutePrefetcher({ isAuthenticated }: { isAuthenticated: boolean }) {
  const router = useRouter();

  useEffect(() => {
    if (!isAuthenticated) return;

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
  }, [router, isAuthenticated]);

  return null;
}

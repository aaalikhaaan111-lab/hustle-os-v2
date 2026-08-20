"use client";

import { useTranslations } from "next-intl";
import type { SettingsLabelRef } from "@/lib/settings/registry";

/**
 * Turns a registry label reference into the words the UI actually shows.
 *
 * WHY IT IS SHARED. Both the Settings panel's search and the command palette
 * resolve the same `SettingsLabelRef` shape, and both had to know how to reach
 * four different i18n namespaces. Two copies of that dispatch is two places to
 * forget a namespace — and forgetting one does not fail loudly, it renders the
 * raw key to a user. One resolver, used by both.
 *
 * DISPATCHED WITH EXPLICIT CALLS rather than a lookup table: `useTranslations`
 * returns a different generic type per namespace, and a union of those types is
 * not callable. The `switch` is exhaustive over `SettingsNamespace`, so adding
 * a namespace to the registry without handling it here fails to compile — which
 * is the only reason this is a switch and not a default-carrying if-chain.
 */
export function useLabelResolver(): (ref: SettingsLabelRef) => string {
  const workspace = useTranslations("workspace");
  const profile = useTranslations("profile");
  const footer = useTranslations("footer");
  const nav = useTranslations("nav");

  return (ref: SettingsLabelRef): string => {
    switch (ref.ns) {
      case "profile":
        return profile(ref.key as never);
      case "footer":
        return footer(ref.key as never);
      case "nav":
        return nav(ref.key as never);
      case "workspace":
        return workspace(ref.key as never);
    }
  };
}

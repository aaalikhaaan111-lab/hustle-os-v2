"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast surface.
 *
 * The shipped version reads the current theme from `next-themes`. The package
 * is present (a transitive dependency), but this product mounts no theme
 * provider and offers no theme switcher, so that hook would return the default
 * on every render and the subscription would be dead weight. The palette comes
 * from the same tokens everything else reads.
 */
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    className="studio toaster group"
    icons={{
      success: <CircleCheckIcon className="size-4" />,
      info: <InfoIcon className="size-4" />,
      warning: <TriangleAlertIcon className="size-4" />,
      error: <OctagonXIcon className="size-4" />,
      loading: <Loader2Icon className="size-4 animate-spin" />,
    }}
    /**
     * EVERY VARIANT, NOT JUST THE NEUTRAL ONE.
     *
     * Only `--normal-*` was set, so a toast raised as `toast.success` — "Link
     * copied", "Published" — rendered in exactly the same grey as an
     * informational one. The tick icon was the single difference, which is a
     * lot of weight for a 16px glyph to carry, and an error looked identical to
     * a confirmation.
     *
     * Sonner exposes a triple per variant; these map onto the semantic tokens
     * the rest of the product already uses, so a success toast is the same
     * green as a success line inside the workspace rather than a second idea of
     * what success looks like.
     */
    style={
      {
        "--normal-bg": "var(--popover)",
        "--normal-text": "var(--popover-foreground)",
        "--normal-border": "var(--border)",
        "--success-bg": "var(--color-success-soft)",
        "--success-text": "var(--color-success)",
        "--success-border": "color-mix(in oklab, var(--color-success) 28%, transparent)",
        "--error-bg": "var(--color-danger-soft)",
        "--error-text": "var(--color-danger)",
        "--error-border": "color-mix(in oklab, var(--color-danger) 28%, transparent)",
        "--warning-bg": "var(--color-warning-soft)",
        "--warning-text": "var(--color-warning)",
        "--warning-border": "color-mix(in oklab, var(--color-warning) 28%, transparent)",
        "--border-radius": "var(--radius)",
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };

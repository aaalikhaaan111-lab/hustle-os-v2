import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "muted" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

/**
 * A small piece of status. Four variants, all of them legible.
 *
 * `accent` used to put #6b64f2 on #f0efff — 3.91:1, under AA at this size. The
 * palette fix (a darker accent) is what repaired it rather than anything here,
 * which is the point of having one: the badge did not have to know.
 */
const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-hover text-ink-secondary border border-border",
  accent: "bg-accent-soft text-accent border border-accent/25",
  muted: "bg-transparent text-ink-muted border border-border",
  outline: "bg-transparent text-ink-secondary border border-border-strong",
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        // 13px rather than 12px: this is the same size as `s-meta`, and a badge
        // is meta. 12px was the product's smallest text and it was being used
        // for the one word that says whether something is published.
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.8125rem] font-medium leading-snug",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "muted" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-hover text-ink-secondary border border-border",
  accent: "bg-accent-soft text-accent border border-accent/30",
  muted: "bg-transparent text-ink-muted border border-border",
  outline: "bg-transparent text-ink-secondary border border-border-strong",
};

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
}

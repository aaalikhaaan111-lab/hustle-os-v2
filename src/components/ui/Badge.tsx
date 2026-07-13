import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "accent" | "muted" | "outline";

interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-surface-hover text-ink-secondary border border-border",
  accent:
    "bg-gradient-to-tr from-indigo-50 to-pink-50 text-indigo-600 border border-indigo-100 shadow-[0_2px_12px_rgba(99,102,241,0.12)]",
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

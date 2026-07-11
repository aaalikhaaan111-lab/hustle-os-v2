import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
  size?: "default" | "compact";
  className?: string;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  size = "default",
  className,
}: EmptyStateProps) {
  const isCompact = size === "compact";

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface/40 text-center transition-colors duration-150",
        isCompact ? "px-5 py-8" : "px-6 py-14",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            "mb-4 flex items-center justify-center rounded-full bg-surface-hover text-ink-secondary",
            isCompact ? "h-10 w-10" : "h-12 w-12"
          )}
        >
          {icon}
        </div>
      )}
      <h3 className={cn("font-medium text-ink", isCompact ? "text-sm" : "text-base")}>
        {title}
      </h3>
      {description && (
        <p
          className={cn(
            "mt-2 text-ink-secondary",
            isCompact ? "max-w-[220px] text-xs" : "max-w-sm text-sm"
          )}
        >
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

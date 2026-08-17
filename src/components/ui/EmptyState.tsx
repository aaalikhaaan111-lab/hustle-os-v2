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

/**
 * Nothing here yet — said calmly.
 *
 * The dashed border is gone. A dashed outline is the web's convention for a
 * drop target, so an empty projects list read as somewhere to drag a file. It
 * is the same hairline every other surface uses; what marks the state as empty
 * is the words, which is the only thing that actually says so.
 */
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
        "s-panel flex flex-col items-center justify-center text-center",
        isCompact ? "px-6 py-10" : "px-6 py-14 sm:px-8",
        className
      )}
    >
      {icon && (
        <div
          className={cn(
            // Muted, not accented. The accent means "the thing to do", and in
            // an empty state that is the action at the bottom, not the picture.
            "mb-4 flex items-center justify-center rounded-full bg-surface-hover text-ink-muted",
            isCompact ? "h-10 w-10" : "h-12 w-12"
          )}
          aria-hidden
        >
          {icon}
        </div>
      )}
      <h3 className="s-title">{title}</h3>
      {description && (
        <p className={cn("s-body mt-2", isCompact ? "max-w-[240px]" : "max-w-sm")}>
          {description}
        </p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

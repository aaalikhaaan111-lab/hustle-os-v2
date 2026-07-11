import type { SelectHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { ChevronDownIcon } from "@/components/ui/icons";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: string;
}

export function Select({ className, error, children, ...props }: SelectProps) {
  return (
    <div className="relative">
      <select
        className={cn(
          "w-full appearance-none rounded-lg border bg-surface px-3 py-2 pr-9 text-sm text-ink transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40",
          error ? "border-danger" : "border-border focus:border-accent",
          className
        )}
        aria-invalid={!!error}
        {...props}
      >
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-muted" />
    </div>
  );
}

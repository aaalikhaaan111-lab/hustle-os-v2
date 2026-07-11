import type { TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: string;
}

export function Textarea({ className, error, rows = 4, ...props }: TextareaProps) {
  return (
    <textarea
      rows={rows}
      className={cn(
        "w-full resize-none rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40",
        error ? "border-danger" : "border-border focus:border-accent",
        className
      )}
      aria-invalid={!!error}
      {...props}
    />
  );
}

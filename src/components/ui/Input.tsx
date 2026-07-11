import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-lg border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40",
        error ? "border-danger" : "border-border focus:border-accent",
        className
      )}
      aria-invalid={!!error}
      {...props}
    />
  );
}

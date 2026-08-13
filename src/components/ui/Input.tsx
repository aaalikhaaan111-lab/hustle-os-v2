import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        // 16px below md so iOS Safari does not zoom the page when the field
        // takes focus; the sm scale returns from md up. Every sign-in and
        // sign-up field is this component.
        "w-full rounded-lg border bg-surface px-4 py-2.5 text-[16px] text-ink placeholder:text-ink-muted transition-colors focus:outline-none focus:ring-2 focus:ring-accent/40 md:text-sm",
        error ? "border-danger" : "border-border focus:border-accent",
        className
      )}
      aria-invalid={!!error}
      {...props}
    />
  );
}

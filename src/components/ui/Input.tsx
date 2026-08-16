import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: string;
}

export function Input({ className, error, ...props }: InputProps) {
  return (
    <input
      className={cn(
        "w-full rounded-[12px] border bg-surface px-4 text-ink transition-colors",
        // 16px, on every screen. Below 16px iOS Safari zooms the page when the
        // field takes focus, and it does not zoom back out — which is how a
        // sign-in form ends up horizontally scrolled. The old rule dropped to
        // 14px from `md` up, which is safe on a desktop but makes the same
        // field two sizes in one product for no reason a person benefits from.
        // Every sign-in and sign-up field is this component.
        "text-[16px]",
        // 46px: clears the 44px touch floor, and matches the height the button
        // beneath it resolves to, so a form reads as one stack of equals
        // rather than controls of drifting sizes.
        "min-h-[46px] py-2.5",
        "placeholder:text-ink-muted",
        // The focus ring is the accent at full strength rather than a 40%
        // wash. A focus indicator that is only just visible is not one.
        "focus:outline-none focus:ring-2 focus:ring-accent/50",
        error ? "border-danger" : "border-border focus:border-accent",
        className
      )}
      aria-invalid={error ? true : undefined}
      {...props}
    />
  );
}

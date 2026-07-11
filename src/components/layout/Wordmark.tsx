import { cn } from "@/lib/utils";

export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("text-sm font-semibold tracking-tight text-ink", className)}>
      HUSTLE<span className="text-accent">.OS</span>
    </span>
  );
}

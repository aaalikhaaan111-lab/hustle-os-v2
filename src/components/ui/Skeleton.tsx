import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse-soft rounded-lg bg-surface-hover", className)} aria-hidden />;
}

/**
 * A placeholder has one job: occupy exactly the space the real thing will.
 *
 * This one did not. It was `rounded-3xl` with `p-5 sm:p-8` while the card it
 * stands in for is a 16px `s-panel`, so the list visibly re-flowed the moment
 * the data arrived — the corners changed and every row moved. Sharing the
 * surface class is what makes the swap invisible, and it stays shared because
 * there is now only one place the geometry is written down.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("s-panel p-5", className)}>
      <div className="flex flex-col gap-4 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

/**
 * The same rule, applied to the header: it drew `border-b border-border/60`
 * under itself, and `PageHeader` no longer has a rule at all. So the page
 * loaded with a horizontal line across it that vanished on hydration. The
 * heights below are the `s-display` and `s-body` steps the real header renders.
 */
export function SkeletonPageHeader() {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-8 w-48 sm:h-9 sm:w-64" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
}

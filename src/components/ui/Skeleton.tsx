import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse-soft rounded-xl bg-zinc-900/[0.06]",
        className
      )}
    />
  );
}

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-[32px] border border-t-white/60 border-x-zinc-200/30 border-b-zinc-200/30 bg-white/75 p-5 sm:p-8",
        className
      )}
    >
      <div className="flex flex-col gap-4 py-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-6 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </div>
  );
}

export function SkeletonPageHeader() {
  return (
    <div className="flex flex-col gap-4 border-b border-border/60 pb-6">
      <Skeleton className="h-9 w-48 sm:h-11 sm:w-64" />
      <Skeleton className="h-4 w-full max-w-md" />
    </div>
  );
}

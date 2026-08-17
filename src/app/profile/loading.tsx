import { Skeleton } from "@/components/ui/shadcn/skeleton";

export default function ProfileLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      {/* The page header: a title and its one line of supporting text. */}
      <div className="flex flex-col gap-3">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80 max-w-full" />
      </div>
      {/* The single card this route renders. */}
      <div className="flex max-w-xl flex-col gap-4 rounded-[var(--radius-lg)] border p-6">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}

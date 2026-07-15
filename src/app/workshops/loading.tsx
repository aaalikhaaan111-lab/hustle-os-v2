import { SkeletonCard, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function WorkshopsLoading() {
  return (
    <div className="flex flex-col gap-8">
      <SkeletonPageHeader />
      <div className="flex flex-col gap-4">
        <SkeletonCard />
        <div className="grid gap-4 sm:grid-cols-3">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
      <SkeletonCard />
    </div>
  );
}

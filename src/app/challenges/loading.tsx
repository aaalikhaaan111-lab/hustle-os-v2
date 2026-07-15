import { SkeletonCard, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function ChallengesLoading() {
  return (
    <div className="flex flex-col gap-8">
      <SkeletonPageHeader />
      <div className="grid gap-6 sm:grid-cols-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}

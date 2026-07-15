import { SkeletonCard, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function ProfileLoading() {
  return (
    <div className="flex flex-col gap-8">
      <SkeletonPageHeader />
      <SkeletonCard className="max-w-xl" />
    </div>
  );
}

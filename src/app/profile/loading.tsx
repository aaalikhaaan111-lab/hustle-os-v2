import { SkeletonCard, SkeletonPageHeader } from "@/components/ui/Skeleton";

export default function ProfileLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-4 pb-16 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <SkeletonPageHeader />
      <SkeletonCard className="max-w-xl" />
    </div>
  );
}

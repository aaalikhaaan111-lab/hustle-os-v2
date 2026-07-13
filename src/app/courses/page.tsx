import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { CoursesIcon } from "@/components/ui/icons";

export default function CoursesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Courses"
        description="Structured courses will live here."
      />
      <EmptyState
        icon={<CoursesIcon className="h-6 w-6" />}
        title="Nothing here yet"
        description="This section is being prepared for the new HUSTLE.OS experience."
      />
    </div>
  );
}

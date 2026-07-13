import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { WorkshopsIcon } from "@/components/ui/icons";

export default function WorkshopsPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Workshops"
        description="Live and recorded workshops will live here."
      />
      <EmptyState
        icon={<WorkshopsIcon className="h-6 w-6" />}
        title="Nothing here yet"
        description="This section is being prepared for the new HUSTLE.OS experience."
      />
    </div>
  );
}

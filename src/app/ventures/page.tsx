import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { VenturesIcon } from "@/components/ui/icons";

export default function VenturesPage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ventures"
        description="Every venture you build lives here, tracked from mission to measurable progress."
      />
      <EmptyState
        icon={<VenturesIcon className="h-6 w-6" />}
        title="No ventures yet"
        description="Start by describing a mission. HUSTLE.OS will turn it into a working venture system."
        action={<Button href="/ventures/new">Build a venture</Button>}
      />
    </div>
  );
}

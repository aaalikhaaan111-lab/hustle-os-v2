import { PageHeader } from "@/components/ui/PageHeader";
import { VentureBriefForm } from "@/components/venture/VentureBriefForm";

export default function NewVenturePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="New venture"
        title="Describe the mission"
        description="This brief becomes the foundation for your venture system — Research, Product, Growth, Finance, and Operations will all work from it."
      />
      <VentureBriefForm />
    </div>
  );
}

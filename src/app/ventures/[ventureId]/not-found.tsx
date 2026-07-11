import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { VenturesIcon } from "@/components/ui/icons";

export default function VentureNotFound() {
  return (
    <div className="flex flex-col gap-8">
      <EmptyState
        icon={<VenturesIcon className="h-6 w-6" />}
        title="Venture not found"
        description="This venture doesn't exist, or you don't have access to it."
        action={<Button href="/ventures">Back to ventures</Button>}
      />
    </div>
  );
}

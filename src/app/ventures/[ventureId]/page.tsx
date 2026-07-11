import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClockIcon, DecisionIcon, FileIcon, InfoIcon } from "@/components/ui/icons";
import { DepartmentCard } from "@/components/venture/DepartmentCard";
import { DEPARTMENTS } from "@/lib/constants";

interface VentureRoomPageProps {
  params: Promise<{ ventureId: string }>;
}

export default async function VentureRoomPage({ params }: VentureRoomPageProps) {
  const { ventureId } = await params;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={`Venture · ${ventureId}`}
        title="Venture room"
        description="This room will hold the mission, decisions, and department work for this venture once it is connected to live data."
        actions={<Badge variant="muted">Not connected to live data</Badge>}
      />

      <Card>
        <CardContent className="flex gap-3 py-5">
          <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div>
            <h2 className="text-sm font-semibold text-ink">Mission overview</h2>
            <p className="mt-1.5 text-sm text-ink-secondary">
              Once ventures are connected to persistence, the mission, target audience,
              deadline, and budget captured for venture{" "}
              <span className="text-ink">{ventureId}</span> will appear here.
            </p>
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Departments</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Five coordinated departments will operate this venture. None are connected
            yet.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DEPARTMENTS.map((department) => (
            <DepartmentCard
              key={department.id}
              name={department.name}
              description={department.description}
              icon={department.icon}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        <EmptyState
          size="compact"
          icon={<DecisionIcon className="h-5 w-5" />}
          title="Founder decisions"
          description="Key decisions you make for this venture will be logged here."
        />
        <EmptyState
          size="compact"
          icon={<ClockIcon className="h-5 w-5" />}
          title="Activity"
          description="A record of real activity across departments will appear here."
        />
        <EmptyState
          size="compact"
          icon={<FileIcon className="h-5 w-5" />}
          title="Artifacts"
          description="Documents and assets produced for this venture will collect here."
        />
      </div>
    </div>
  );
}

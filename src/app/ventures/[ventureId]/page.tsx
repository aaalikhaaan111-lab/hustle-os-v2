import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { ClockIcon, DecisionIcon, FileIcon, InfoIcon } from "@/components/ui/icons";
import { DepartmentCard } from "@/components/venture/DepartmentCard";
import { ResearchDepartmentCard } from "@/components/venture/ResearchDepartmentCard";
import { DEPARTMENTS, VENTURE_CONTEXT_FIELDS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";

interface VentureRoomPageProps {
  params: Promise<{ ventureId: string }>;
}

export default async function VentureRoomPage({ params }: VentureRoomPageProps) {
  const { ventureId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const { data: venture, error } = await supabase
    .from("ventures")
    .select(
      "id, mission, budget, deadline, location, resources, status, created_at, research_report, research_completed_at"
    )
    .eq("id", ventureId)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (error) {
    // A real query failure (bad column, connection issue, etc.) is not the same
    // as "this venture doesn't exist" — don't mask it behind a 404.
    throw new Error(`Failed to load venture: ${error.message}`);
  }

  if (!venture) {
    notFound();
  }

  const contextEntries = VENTURE_CONTEXT_FIELDS.filter((field) => venture[field.id]);
  const researchDepartment = DEPARTMENTS.find((department) => department.id === "research")!;
  const otherDepartments = DEPARTMENTS.filter((department) => department.id !== "research");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow={`Venture · ${venture.status}`}
        title="Venture room"
        description="This room holds the mission and context you described. Departments will activate as the AI team comes online."
        actions={<Badge variant="muted">AI team not activated yet</Badge>}
      />

      <Card>
        <CardContent className="flex gap-3 py-5">
          <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-ink">Mission</h2>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-secondary">
              {venture.mission}
            </p>
            {contextEntries.length > 0 && (
              <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-border pt-4 sm:grid-cols-2">
                {contextEntries.map((field) => (
                  <div key={field.id} className="flex justify-between gap-4 text-sm">
                    <dt className="text-ink-secondary">{field.label}</dt>
                    <dd className="text-right text-ink">{venture[field.id]}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </CardContent>
      </Card>

      <section className="flex flex-col gap-4">
        <div>
          <h2 className="text-base font-semibold text-ink">Departments</h2>
          <p className="mt-1 text-sm text-ink-secondary">
            Five coordinated departments will operate this venture. Research is live — the rest
            activate as the AI team grows.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <ResearchDepartmentCard
            ventureId={venture.id}
            description={researchDepartment.description}
            initialReport={venture.research_report}
          />
          {otherDepartments.map((department) => (
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

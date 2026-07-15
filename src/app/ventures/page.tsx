import { redirect } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { VenturesIcon } from "@/components/ui/icons";
import { VentureCard } from "@/components/venture/VentureCard";
import { createClient } from "@/lib/supabase/server";

export default async function VenturesPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: ventures } = await supabase
    .from("ventures")
    .select("id, mission, status, created_at")
    .order("created_at", { ascending: false });

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Ventures"
        description="Every venture you build lives here, tracked from mission to measurable progress."
      />
      {!ventures || ventures.length === 0 ? (
        <EmptyState
          icon={<VenturesIcon className="h-6 w-6" />}
          title="No ventures yet"
          description="Start by describing a mission. Ventrio will turn it into a working venture system."
          action={<Button href="/ventures/new">Build a venture</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ventures.map((venture) => (
            <VentureCard key={venture.id} venture={venture} />
          ))}
        </div>
      )}
    </div>
  );
}

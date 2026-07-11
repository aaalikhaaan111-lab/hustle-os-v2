"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { InfoIcon, VenturesIcon } from "@/components/ui/icons";
import { DepartmentCard } from "@/components/venture/DepartmentCard";
import { DEPARTMENTS, VENTURE_CONTEXT_FIELDS, VENTURE_DRAFT_STORAGE_KEY } from "@/lib/constants";
import type { VentureDraft } from "@/types/venture";

export default function VenturePreviewPage() {
  const [draft, setDraft] = useState<VentureDraft | null>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    // One-time read from sessionStorage on mount, guarded so SSR/hydration
    // renders the empty-state default before this client-only sync runs.
    try {
      const raw = sessionStorage.getItem(VENTURE_DRAFT_STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setDraft(JSON.parse(raw) as VentureDraft);
    } catch {
      // Ignore malformed or inaccessible session data.
    } finally {
      setChecked(true);
    }
  }, []);

  if (!checked) return null;

  if (!draft || !draft.description) {
    return (
      <div className="flex flex-col gap-8">
        <PageHeader
          title="Venture preview"
          description="A preview of your venture room, based on the brief you describe."
        />
        <EmptyState
          icon={<VenturesIcon className="h-6 w-6" />}
          title="No venture brief yet"
          description="Start by describing what you want to build, then continue here to preview it."
          action={<Button href="/ventures/new">Start building</Button>}
        />
      </div>
    );
  }

  const contextEntries = VENTURE_CONTEXT_FIELDS.filter((field) => draft[field.id]);

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        eyebrow="Preview"
        title="Venture room preview"
        description="A static preview built only from the brief you just described."
        actions={<Badge variant="muted">Preview only — not connected to AI or persistence</Badge>}
      />

      <Card>
        <CardContent className="flex gap-3 py-5">
          <InfoIcon className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
          <div className="flex-1">
            <h2 className="text-sm font-semibold text-ink">Mission</h2>
            <p className="mt-1.5 whitespace-pre-wrap text-sm text-ink-secondary">
              {draft.description}
            </p>
            {contextEntries.length > 0 && (
              <dl className="mt-4 grid gap-x-6 gap-y-2 border-t border-border pt-4 sm:grid-cols-2">
                {contextEntries.map((field) => (
                  <div key={field.id} className="flex justify-between gap-4 text-sm">
                    <dt className="text-ink-secondary">{field.label}</dt>
                    <dd className="text-right text-ink">{draft[field.id]}</dd>
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
            Five coordinated departments will operate this venture once it is connected.
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

      <div>
        <Button href="/ventures/new" variant="secondary">
          Return and edit brief
        </Button>
      </div>
    </div>
  );
}

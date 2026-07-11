import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import type { VentureRecord } from "@/types/venture";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

interface VentureCardProps {
  venture: Pick<VentureRecord, "id" | "mission" | "status" | "created_at">;
}

export function VentureCard({ venture }: VentureCardProps) {
  return (
    <Link
      href={`/ventures/${venture.id}`}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50"
    >
      <Card>
        <CardContent className="flex h-full flex-col gap-3 py-5">
          <div className="flex items-center justify-between gap-2">
            <Badge variant="muted" className="capitalize">
              {venture.status}
            </Badge>
            <span className="text-xs text-ink-muted">{formatDate(venture.created_at)}</span>
          </div>
          <p className="line-clamp-3 text-sm text-ink-secondary">{venture.mission}</p>
          <span className="mt-1 text-sm font-medium text-accent">Open →</span>
        </CardContent>
      </Card>
    </Link>
  );
}

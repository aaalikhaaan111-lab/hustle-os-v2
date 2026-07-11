import type { ComponentType, SVGProps } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";

interface DepartmentCardProps {
  name: string;
  description: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  className?: string;
}

export function DepartmentCard({
  name,
  description,
  icon: Icon,
  className,
}: DepartmentCardProps) {
  return (
    <Card className={className}>
      <CardContent className="flex h-full flex-col gap-4 py-5">
        <div className="flex items-center justify-between">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover text-ink-secondary">
            <Icon className="h-5 w-5" />
          </div>
          <Badge variant="muted">AI team not activated yet</Badge>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-ink">{name}</h3>
          <p className="mt-1.5 text-sm text-ink-secondary">{description}</p>
        </div>
      </CardContent>
    </Card>
  );
}

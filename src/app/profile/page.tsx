import { Badge } from "@/components/ui/Badge";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileIcon } from "@/components/ui/icons";

const PLACEHOLDER_FIELDS = ["Name", "Email", "Workspace"];

export default function ProfilePage() {
  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Profile"
        description="Your account details will appear here once authentication is connected."
        actions={<Badge variant="muted">Not connected</Badge>}
      />
      <Card className="max-w-xl">
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-ink-secondary">
              <ProfileIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">No account connected</p>
              <p className="text-sm text-ink-secondary">
                Authentication will be added in a future phase.
              </p>
            </div>
          </div>
          <dl className="divide-y divide-border border-t border-border">
            {PLACEHOLDER_FIELDS.map((field) => (
              <div key={field} className="flex items-center justify-between py-2.5 text-sm">
                <dt className="text-ink-secondary">{field}</dt>
                <dd className="text-ink-muted">—</dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </div>
  );
}

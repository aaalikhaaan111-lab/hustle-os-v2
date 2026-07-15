import { redirect } from "next/navigation";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileIcon } from "@/components/ui/icons";
import { LogoutButton } from "@/components/profile/LogoutButton";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/currentUser";

export default async function ProfilePage() {
  const supabase = await createClient();
  const user = await getCurrentUser(supabase);

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Profile"
        description="Your account details."
        actions={<LogoutButton />}
      />
      <Card className="max-w-xl">
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-ink-secondary">
              <ProfileIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                {profile?.display_name || "No name set"}
              </p>
              <p className="text-sm text-ink-secondary">{user.email}</p>
            </div>
          </div>
          <div className="border-t border-border pt-5">
            <ProfileForm email={user.email ?? ""} displayName={profile?.display_name ?? ""} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import { redirect } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { ProfileIcon } from "@/components/ui/icons";
import { LogoutButton } from "@/components/profile/LogoutButton";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
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

  const t = await getTranslations("profile");
  const tFooter = await getTranslations("footer");

  return (
    <div className="flex flex-col gap-8">
      <PageHeader title={t("title")} description={t("description")} actions={<LogoutButton />} />
      <Card className="max-w-xl">
        <CardContent className="flex flex-col gap-5 py-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-hover text-ink-secondary">
              <ProfileIcon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                {profile?.display_name || t("noNameSet")}
              </p>
              <p className="text-sm text-ink-secondary">{user.email}</p>
            </div>
          </div>
          <div className="border-t border-border pt-5">
            <ProfileForm email={user.email ?? ""} displayName={profile?.display_name ?? ""} />
          </div>
          <div className="flex items-center justify-between border-t border-border pt-5">
            <span className="text-sm font-medium text-ink">{t("languageLabel")}</span>
            <LanguageSwitcher />
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-xl">
        <CardContent className="flex flex-col gap-3 py-5">
          <span className="text-xs font-bold uppercase tracking-[0.14em] text-ink-muted">
            {t("legalTitle")}
          </span>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <Link href="/privacy" className="text-accent hover:text-accent-hover">
              {tFooter("privacy")}
            </Link>
            <Link href="/terms" className="text-accent hover:text-accent-hover">
              {tFooter("terms")}
            </Link>
            <Link href="/cookies" className="text-accent hover:text-accent-hover">
              {tFooter("cookies")}
            </Link>
            <Link href="/contact" className="text-accent hover:text-accent-hover">
              {tFooter("contact")}
            </Link>
            <Link href="/delete-account" className="text-danger hover:text-danger/80">
              {t("deleteAccountLink")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { legalConfig } from "@/config/legal";

export async function PublicFooter() {
  const t = await getTranslations("footer");
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 flex flex-col gap-4 border-t border-border/60 pt-6 text-xs text-ink-muted">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link href="/privacy" className="hover:text-ink-secondary">
          {t("privacy")}
        </Link>
        <Link href="/terms" className="hover:text-ink-secondary">
          {t("terms")}
        </Link>
        <Link href="/cookies" className="hover:text-ink-secondary">
          {t("cookies")}
        </Link>
        <Link href="/contact" className="hover:text-ink-secondary">
          {t("contact")}
        </Link>
        <Link href="/delete-account" className="hover:text-ink-secondary">
          {t("deleteAccount")}
        </Link>
        <span className="ml-auto">
          <LanguageSwitcher />
        </span>
      </div>
      <p>{t("rights", { year, productName: legalConfig.productName })}</p>
    </footer>
  );
}

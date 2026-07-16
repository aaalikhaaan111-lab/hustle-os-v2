import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { QuestionIcon } from "@/components/ui/icons";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="flex flex-col gap-8">
      <EmptyState
        icon={<QuestionIcon className="h-6 w-6" />}
        title={t("notFoundTitle")}
        description={t("notFoundDescription")}
        action={<Button href="/dashboard">{t("backHome")}</Button>}
      />
    </div>
  );
}

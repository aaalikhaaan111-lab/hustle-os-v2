import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/Button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/shadcn/empty";
import { QuestionIcon } from "@/components/ui/icons";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <QuestionIcon className="h-6 w-6" />
        </EmptyMedia>
        <EmptyTitle>{t("notFoundTitle")}</EmptyTitle>
        <EmptyDescription>{t("notFoundDescription")}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button href="/projects">{t("backHome")}</Button>
      </EmptyContent>
    </Empty>
  );
}

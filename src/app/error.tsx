"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { AlertIcon } from "@/components/ui/icons";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("errors");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-8">
      <EmptyState
        icon={<AlertIcon className="h-6 w-6" />}
        title={t("genericTitle")}
        description={t("genericDescription")}
        action={
          <Button variant="secondary" onClick={reset}>
            {t("tryAgain")}
          </Button>
        }
      />
    </div>
  );
}

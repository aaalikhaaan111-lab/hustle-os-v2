"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { createWorkshopSessionAction } from "@/lib/actions/workshops";

export function CreateSessionButton({ slug }: { slug: string }) {
  const t = useTranslations("workshops");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await createWorkshopSessionAction(slug);
      // On success, createWorkshopSessionAction redirects and this line is unreachable.
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-1.5">
      <Button size="sm" onClick={handleClick} disabled={isPending}>
        {isPending ? t("creating") : t("hostButton")}
      </Button>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
    </div>
  );
}

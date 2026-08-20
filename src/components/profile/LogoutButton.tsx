"use client";

import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/lib/actions/auth";

export function LogoutButton() {
  const t = useTranslations("profile");
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      pending={isPending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {t("logout")}
    </Button>
  );
}

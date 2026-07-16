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
      disabled={isPending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {isPending ? t("logoutPending") : t("logout")}
    </Button>
  );
}

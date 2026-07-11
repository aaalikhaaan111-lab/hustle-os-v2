"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { signOutAction } from "@/lib/actions/auth";

export function LogoutButton() {
  const [isPending, startTransition] = useTransition();

  return (
    <Button
      variant="secondary"
      disabled={isPending}
      onClick={() => startTransition(() => signOutAction())}
    >
      {isPending ? "Logging out..." : "Log out"}
    </Button>
  );
}

"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { devAutoLoginAction } from "@/lib/actions/auth";

export function DevAutoLoginButton() {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await devAutoLoginAction();
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <div className="mx-auto -mt-4 flex w-full max-w-sm flex-col items-center gap-2 pb-8">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs text-ink-muted"
      >
        {isPending ? "Входим..." : "🛠️ Войти как Тест (Dev)"}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

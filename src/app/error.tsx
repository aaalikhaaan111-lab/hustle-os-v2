"use client";

import { useEffect } from "react";
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
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col gap-8">
      <EmptyState
        icon={<AlertIcon className="h-6 w-6" />}
        title="Что-то пошло не так"
        description="Произошла непредвиденная ошибка. Попробуй ещё раз."
        action={
          <Button variant="secondary" onClick={reset}>
            Попробовать снова
          </Button>
        }
      />
    </div>
  );
}

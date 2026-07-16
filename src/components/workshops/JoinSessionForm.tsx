"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { joinWorkshopSessionAction } from "@/lib/actions/workshops";

interface JoinSessionFormProps {
  defaultDisplayName: string;
  /** When set, the code is fixed (e.g. arriving via a direct /workshops/[code] link) and the code field is hidden. */
  fixedCode?: string;
}

export function JoinSessionForm({ defaultDisplayName, fixedCode }: JoinSessionFormProps) {
  const t = useTranslations("workshops");
  const [code, setCode] = useState(fixedCode ?? "");
  const [displayName, setDisplayName] = useState(defaultDisplayName);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!code.trim()) {
      setError(t("enterCode"));
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await joinWorkshopSessionAction(code, displayName);
      // On success, joinWorkshopSessionAction redirects and this line is unreachable.
      if (result?.error) {
        setError(result.error);
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {!fixedCode && (
        <Field label={t("sessionCode")} htmlFor="workshop-code" required>
          <Input
            id="workshop-code"
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            placeholder={t("sessionCodePlaceholder")}
            maxLength={8}
            className="font-mono tracking-widest"
          />
        </Field>
      )}
      <Field label={t("displayName")} htmlFor="workshop-display-name" hint={t("displayNameHint")}>
        <Input
          id="workshop-display-name"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder={t("displayNamePlaceholder")}
        />
      </Field>
      {error && <p className="text-xs font-semibold text-danger">{error}</p>}
      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? t("joining") : t("join")}
      </Button>
    </form>
  );
}

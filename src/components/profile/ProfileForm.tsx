"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { updateProfileAction, type UpdateProfileState } from "@/lib/actions/profile";

const initialState: UpdateProfileState = { error: null, success: false };

interface ProfileFormProps {
  email: string;
  displayName: string;
  preferredName: string;
  workDescription: string;
  personalInstructions: string;
}

/**
 * The General section of Settings.
 *
 * IT USED TO BE ONE FIELD. A large panel whose only editable value was a
 * display name reads as a screen that was never finished — there is nothing to
 * come back to and nothing the product does differently because you visited.
 *
 * The four fields here are the ones Ventrio can actually act on: what to call
 * you, what you do, and how you want to be worked with. They are saved in one
 * submit rather than one form per field, because they are a single statement
 * about a person and splitting them into four Save buttons would make a short
 * errand into four.
 *
 * NO CONTROL HERE IS DECORATIVE. Avatar upload is deliberately absent: there is
 * no storage bucket configured for user images, and an upload button that
 * silently does nothing is worse than the initials mark that honestly stands in
 * for one.
 */
export function ProfileForm({
  email,
  displayName,
  preferredName,
  workDescription,
  personalInstructions,
}: ProfileFormProps) {
  const t = useTranslations("profile");
  const [state, formAction, isPending] = useActionState(updateProfileAction, initialState);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="s-eyebrow">{t("email")}</p>
        <p className="mt-1 text-sm text-ink">{email}</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <Field label={t("displayNameLabel")} htmlFor="displayName">
          <Input
            id="displayName"
            name="displayName"
            defaultValue={displayName}
            placeholder={t("displayNamePlaceholder")}
            maxLength={80}
          />
        </Field>

        <Field label={t("preferredNameLabel")} htmlFor="preferredName" hint={t("preferredNameHint")}>
          <Input
            id="preferredName"
            name="preferredName"
            defaultValue={preferredName}
            placeholder={t("preferredNamePlaceholder")}
            maxLength={40}
          />
        </Field>

        <Field label={t("workLabel")} htmlFor="workDescription" hint={t("workHint")}>
          <Input
            id="workDescription"
            name="workDescription"
            defaultValue={workDescription}
            placeholder={t("workPlaceholder")}
            maxLength={120}
          />
        </Field>

        <Field
          label={t("instructionsLabel")}
          htmlFor="personalInstructions"
          hint={t("instructionsHint")}
        >
          <textarea
            id="personalInstructions"
            name="personalInstructions"
            defaultValue={personalInstructions}
            placeholder={t("instructionsPlaceholder")}
            maxLength={1200}
            rows={4}
            className="w-full rounded-[12px] border bg-surface px-4 py-3 text-[16px] leading-relaxed text-ink transition-colors placeholder:text-ink-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </Field>

        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.success && !state.error && <p className="text-sm text-success">{t("saved")}</p>}

        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? t("saving") : t("saveChanges")}
          </Button>
        </div>
      </form>
    </div>
  );
}

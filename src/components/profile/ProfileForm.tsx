"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { updateDisplayNameAction, type UpdateProfileState } from "@/lib/actions/profile";

const initialState: UpdateProfileState = { error: null, success: false };

interface ProfileFormProps {
  email: string;
  displayName: string;
}

export function ProfileForm({ email, displayName }: ProfileFormProps) {
  const [state, formAction, isPending] = useActionState(updateDisplayNameAction, initialState);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-ink-muted">Email</p>
        <p className="mt-1 text-sm text-ink">{email}</p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <Field label="Display name" htmlFor="displayName">
          <Input
            id="displayName"
            name="displayName"
            defaultValue={displayName}
            placeholder="Add your name"
          />
        </Field>
        {state.error && <p className="text-sm text-danger">{state.error}</p>}
        {state.success && !state.error && <p className="text-sm text-success">Saved.</p>}
        <div>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : "Save changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

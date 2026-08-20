"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/public";

export interface UpdateProfileState {
  error: string | null;
  success: boolean;
}

/**
 * What Settings can save about a person.
 *
 * It used to be one field. These are the four the panel now collects, and the
 * caps are product limits rather than database ones — a check constraint would
 * turn "you typed too much" into a failed request instead of a message beside
 * the field.
 *
 * `personalInstructions` is deliberately the long one: it is prose a person
 * writes once about how they want to be worked with, and cutting it to tweet
 * length would make it useless for the thing it exists for.
 */
const LIMITS = {
  displayName: 80,
  preferredName: 40,
  workDescription: 120,
  personalInstructions: 1200,
} as const;

/** Empty means "no answer", which is null — not an empty string. */
function field(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

export async function updateProfileAction(
  _prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const displayName = field(formData, "displayName");
  const preferredName = field(formData, "preferredName");
  const workDescription = field(formData, "workDescription");
  const personalInstructions = field(formData, "personalInstructions");

  const tooLong = (
    [
      [displayName, LIMITS.displayName, "name"],
      [preferredName, LIMITS.preferredName, "preferred name"],
      [workDescription, LIMITS.workDescription, "description"],
      [personalInstructions, LIMITS.personalInstructions, "instructions"],
    ] as const
  ).find(([value, max]) => value.length > max);

  if (tooLong) {
    const [, max, label] = tooLong;
    return { error: `Keep your ${label} under ${max} characters.`, success: false };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Your session has expired. Please log in again.", success: false };
  }

  const fields = {
    display_name: displayName || null,
    preferred_name: preferredName || null,
    work_description: workDescription || null,
    personal_instructions: personalInstructions || null,
  };

  /**
   * `.select("id")` IS THE POINT OF THIS CALL, not decoration.
   *
   * PostgREST reports no error when an UPDATE matches no rows — it reports
   * success and an empty result. This action used to discard that result and
   * return `success: true` regardless, so a user whose profile row was missing
   * saw "Saved" while nothing had been written. Asking for the row back is what
   * turns "the statement ran" into "the row exists and now holds this".
   *
   * The row should always exist: handle_new_user() provisions one inside the
   * signup transaction. But that trigger now catches its own failures rather
   * than aborting a signup over a profile (see
   * 20260820160300_fix_new_user_profile_identity.sql), which means a missing
   * row is rare instead of impossible — and a rare silent data-loss path is
   * worse than a common loud one.
   */
  const { data: updated, error } = await supabase
    .from("profiles")
    .update(fields)
    .eq("id", user.id)
    .select("id");

  if (error) {
    return { error: "Could not save your details. Please try again.", success: false };
  }

  if (!updated || updated.length === 0) {
    /**
     * No row to update, so create it — with the service role, because
     * `profiles` has no INSERT policy and deliberately keeps none. Adding one
     * would let a client insert its own row, and a client-written profile row
     * could carry a `plan` value, which is precisely the escalation that
     * 20260820160400 closes. Repairing it server-side keeps the write path
     * narrow: this code chooses the id and the four columns, not the caller.
     */
    const service = createServiceClient();
    const { error: repairError } = await service
      .from("profiles")
      .insert({ id: user.id, ...fields });

    if (repairError) {
      console.warn("[ventrio-profile]", JSON.stringify({
        event: "profile_missing_and_unrepairable",
        code: repairError.code,
      }));
      return { error: "Could not save your details. Please try again.", success: false };
    }
  }

  revalidatePath("/profile");
  return { error: null, success: true };
}

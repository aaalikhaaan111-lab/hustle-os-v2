"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName || null,
      preferred_name: preferredName || null,
      work_description: workDescription || null,
      personal_instructions: personalInstructions || null,
    })
    .eq("id", user.id);

  if (error) {
    return { error: "Could not save your details. Please try again.", success: false };
  }

  revalidatePath("/profile");
  return { error: null, success: true };
}

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { VENTURE_DESCRIPTION_MAX_LENGTH, VENTURE_DESCRIPTION_MIN_LENGTH } from "@/lib/constants";
import type { CreateVentureInput } from "@/types/venture";

export interface CreateVentureResult {
  error: string | null;
}

function cleanOptional(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createVentureAction(
  input: CreateVentureInput
): Promise<CreateVentureResult> {
  const mission = input.description.trim();

  if (mission.length < VENTURE_DESCRIPTION_MIN_LENGTH) {
    return { error: "Add a bit more detail before you start building." };
  }
  if (mission.length > VENTURE_DESCRIPTION_MAX_LENGTH) {
    return { error: `Keep the description under ${VENTURE_DESCRIPTION_MAX_LENGTH} characters.` };
  }

  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { data, error } = await supabase
    .from("ventures")
    .insert({
      owner_id: user.id,
      mission,
      budget: cleanOptional(input.budget),
      deadline: cleanOptional(input.deadline),
      location: cleanOptional(input.location),
      resources: cleanOptional(input.resources),
    })
    .select("id")
    .single();

  if (error || !data) {
    return { error: "Something went wrong while saving your venture. Please try again." };
  }

  redirect(`/ventures/${data.id}`);
}

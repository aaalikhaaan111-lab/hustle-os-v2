"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export interface UpdateProfileState {
  error: string | null;
  success: boolean;
}

const DISPLAY_NAME_MAX_LENGTH = 80;

export async function updateDisplayNameAction(
  _prevState: UpdateProfileState,
  formData: FormData
): Promise<UpdateProfileState> {
  const displayName = String(formData.get("displayName") ?? "").trim();

  if (displayName.length > DISPLAY_NAME_MAX_LENGTH) {
    return { error: `Keep your name under ${DISPLAY_NAME_MAX_LENGTH} characters.`, success: false };
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
    .update({ display_name: displayName || null })
    .eq("id", user.id);

  if (error) {
    return { error: "Could not save your name. Please try again.", success: false };
  }

  revalidatePath("/profile");
  return { error: null, success: true };
}

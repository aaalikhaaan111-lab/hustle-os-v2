import { redirect } from "next/navigation";

// The questionnaire route is retained only as a compatibility URL. Every new
// project now begins in the AI-native creation environment.
export default function NewProjectPage() {
  redirect("/create");
}

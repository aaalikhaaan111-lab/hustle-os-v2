import { redirect } from "next/navigation";

// Home/Dashboard is removed from the product. Projects is the new home; keep
// this route as a safe redirect so old links, bookmarks, and post-onboarding
// navigation never dead-end.
export default function DashboardPage() {
  redirect("/projects");
}

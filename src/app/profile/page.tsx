import { redirect } from "next/navigation";

// Profile is a section of Settings, not a separate product. Kept as a route so
// existing links and bookmarks keep working.
export default function ProfilePage() {
  redirect("/settings?section=profile");
}

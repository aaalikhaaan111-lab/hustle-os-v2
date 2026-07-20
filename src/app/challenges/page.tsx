import { redirect } from "next/navigation";

// Challenges moved into Learn as a tab. This route is kept only as a
// compatibility redirect so old bookmarks and existing deep links
// (`/challenges?open=<id>`) keep working — it forwards to the Challenges tab
// inside Learn, preserving the open param.
interface ChallengesPageProps {
  searchParams: Promise<{ open?: string }>;
}

export default async function ChallengesPage({ searchParams }: ChallengesPageProps) {
  const { open } = await searchParams;
  const target = open
    ? `/courses?tab=challenges&open=${encodeURIComponent(open)}`
    : "/courses?tab=challenges";
  redirect(target);
}

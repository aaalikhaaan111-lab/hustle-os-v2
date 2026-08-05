import { notFound } from "next/navigation";
import { IntakePreview } from "./IntakePreview";

/**
 * Development-only preview of the build intake.
 *
 * The intake lives inside an authenticated workspace behind a real project, so
 * reviewing it normally means signing in and spending a generation to get past
 * it. This renders the same components against fixed inputs so the flow can be
 * looked at, measured and screenshotted at each breakpoint for free.
 *
 * Available in local development and in Vercel Preview deployments, never in
 * Production. Preview builds run with NODE_ENV=production, so gating on that
 * alone hid the route from exactly the place it is most useful — a deployed
 * build a reviewer can open. VERCEL_ENV distinguishes the two; Production
 * still falls through to notFound().
 *
 * The route stays fixture-only in every environment: it reads no session, runs
 * no query, writes nothing, calls no action and no model, and touches no
 * secret. Nothing here becomes reachable by widening where it renders.
 */
export const dynamic = "force-dynamic";

export default function IntakePreviewPage() {
  const allowed =
    process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
  if (!allowed) notFound();
  return <IntakePreview />;
}

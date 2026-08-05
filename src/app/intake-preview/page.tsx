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
 * `notFound()` in production keeps it out of the reachable route table, the
 * same gate the fixture gallery uses. It calls no action and no model.
 */
export const dynamic = "force-dynamic";

export default function IntakePreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <IntakePreview />;
}

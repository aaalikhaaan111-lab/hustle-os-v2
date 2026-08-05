import { notFound } from "next/navigation";
import { Harness } from "./Harness";
import type { DeviceMode } from "@/lib/build/deviceWidths";

/**
 * Dev/Preview-only reproduction of the preview-viewport defect and its fix.
 * Renders a stored artifact through the real renderer and the real frame — no
 * session, no query, no model call. notFound() in Production.
 */
export const dynamic = "force-dynamic";

export default async function OutputPreviewPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; inline?: string; panel?: string }>;
}) {
  const allowed =
    process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
  if (!allowed) notFound();

  const { mode, inline, panel } = await searchParams;
  const device: DeviceMode =
    mode === "mobile" || mode === "tablet" || mode === "desktop" ? mode : "mobile";
  return <Harness mode={device} inline={inline === "1"} panel={Number(panel) || 0} />;
}

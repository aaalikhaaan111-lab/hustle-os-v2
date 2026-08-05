import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
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
  searchParams: Promise<{ mode?: string; inline?: string; panel?: string; controls?: string; screen?: string }>;
}) {
  const allowed =
    process.env.NODE_ENV !== "production" || process.env.VERCEL_ENV === "preview";
  if (!allowed) notFound();

  const { mode, inline, panel, controls, screen } = await searchParams;
  const device: DeviceMode =
    mode === "mobile" || mode === "tablet" || mode === "desktop" ? mode : "mobile";

  // `controls=1` mounts the real workspace, which reads the workspace
  // namespace, so it needs a provider the way the project page gives it one.
  const messages = (await import("../../../messages/en.json")).default;
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <Harness
        mode={device}
        inline={inline === "1"}
        panel={Number(panel) || 0}
        controls={controls === "1"}
        screen={screen ?? ""}
      />
    </NextIntlClientProvider>
  );
}

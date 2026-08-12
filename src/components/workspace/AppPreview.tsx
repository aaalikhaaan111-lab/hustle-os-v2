"use client";

/**
 * The generated application, running in the workspace.
 *
 * Separate from `CodegenPreview` for one reason that matters: codegen output is
 * a static document and runs under `sandbox=""`, which denies scripts. An
 * application has to execute, so this frame carries `SANDBOX_ATTRIBUTE` —
 * `allow-scripts allow-forms`, and never `allow-same-origin`, because that pair
 * returns the frame to Ventrio's origin and makes the sandbox decorative.
 *
 * Reusing the codegen component with a different attribute would have put those
 * two policies one prop apart. They are different boundaries and they stay in
 * different files.
 *
 * `srcDoc` rather than a URL: the document never becomes a fetchable, linkable
 * address, and the app inside has no way to reach the page hosting it.
 */

import { useEffect, useRef, useState } from "react";
import { SANDBOX_ATTRIBUTE } from "@/lib/v2/app/sandbox";
import { subscribePreview } from "@/lib/v2/app/protocol";
import type { DeviceMode } from "@/lib/build/deviceWidths";

export interface AppPreviewProps {
  document: string;
  device: DeviceMode;
  title: string;
  /** Called with distinct runtime errors, for whoever wants to act on them. */
  onRuntimeErrors?: (messages: string[]) => void;
}

export function AppPreview({ document: srcDoc, device, title, onRuntimeErrors }: AppPreviewProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);

  /**
   * The window to listen on comes from the frame, never from `window`.
   *
   * `ViewportFrame` portals this component into a same-origin iframe, so the
   * sandboxed preview's `parent` is that iframe's window and the page's own
   * `window` never sees the message. See `subscribePreview`, which owns the
   * reasoning and the resolution.
   *
   * The effect runs after refs are attached, so `frameRef.current` is the
   * mounted element here.
   */
  useEffect(
    () => subscribePreview(frameRef.current, { onReady: () => setReady(true), onRuntimeErrors }),
    [onRuntimeErrors],
  );

  return (
    <iframe
      ref={frameRef}
      srcDoc={srcDoc}
      sandbox={SANDBOX_ATTRIBUTE}
      title={title}
      data-ready={ready ? "true" : "false"}
      data-device={device}
      className="h-full w-full border-0 bg-white"
    />
  );
}

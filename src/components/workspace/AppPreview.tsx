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

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { SANDBOX_ATTRIBUTE } from "@/lib/v2/app/sandbox";
import { subscribePreview } from "@/lib/v2/app/protocol";
import type { DeviceMode } from "@/lib/build/deviceWidths";

/** How long after load to wait for `ready` before showing the app regardless. */
const REVEAL_GRACE_MS = 2_000;

export interface AppPreviewProps {
  document: string;
  device: DeviceMode;
  title: string;
  /** Called with distinct runtime errors, for whoever wants to act on them. */
  onRuntimeErrors?: (messages: string[]) => void;
}

export function AppPreview({ document: srcDoc, device, title, onRuntimeErrors }: AppPreviewProps) {
  const t = useTranslations("workspace");
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  /**
   * Which document reported that it started, rather than a boolean.
   *
   * A new document is a new boot, and a flag would have to be reset when
   * `srcDoc` changes — which is a setState inside an effect, and a cascading
   * render. Recording *what* became ready makes the answer derived: readiness
   * belongs to one document, so a different one is simply not ready yet, with
   * nothing to reset.
   */
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const ready = readyFor === srcDoc;

  /**
   * Shown anyway, because a handshake that never arrives must not be forever.
   *
   * `ready` is one message, sent once. If it is ever missed — a bug here, a
   * document that mounts without reaching the line that posts it — the overlay
   * would sit over a working application indefinitely. This is the floor: once
   * the document has loaded and a grace period has passed with no word, show
   * the app rather than a claim that it is still starting.
   */
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const booting = !ready && revealedFor !== srcDoc;
  const revealTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
  }, []);

  /**
   * The window to listen on comes from the frame, never from `window`.
   *
   * `ViewportFrame` portals this component into a same-origin iframe, so the
   * sandboxed preview's `parent` is that iframe's window and the page's own
   * `window` never sees the message. See `subscribePreview`, which owns the
   * reasoning and the resolution.
   *
   * A LAYOUT effect, and that is the whole fix for a race this component lost.
   *
   * The generated entry posts `ready` synchronously, right after
   * `createRoot().render()`. A passive `useEffect` runs after the browser has
   * already been handed the `srcDoc`, so the sandbox could parse, execute and
   * post before anyone was listening — and `ready` is sent once, so a missed
   * one was missed forever. React flushes layout effects synchronously at the
   * end of the same commit that sets the attribute, before the browser can run
   * the document's scripts, so the listener is always in place first.
   *
   * It re-subscribes when the document changes, because that is a different run
   * of a different application and the previous listener has nothing left to
   * hear.
   */
  useLayoutEffect(
    () => subscribePreview(frameRef.current, { onReady: () => setReadyFor(srcDoc), onRuntimeErrors }),
    [onRuntimeErrors, srcDoc],
  );

  /**
   * The frame is mounted before the app inside it has run.
   *
   * `ready` already existed and drove nothing but a data attribute, so an
   * application that took a second to boot — or a dark one that painted its
   * background before its content — was a white or black rectangle with no
   * indication that anything was happening. The overlay covers exactly that
   * gap and nothing else: the frame, its sandbox and its document are
   * untouched, and it is removed by the app's own `ready` message.
   */
  return (
    <div className="relative h-full w-full">
      <iframe
        ref={frameRef}
        srcDoc={srcDoc}
        sandbox={SANDBOX_ATTRIBUTE}
        title={title}
        data-ready={ready ? "true" : "false"}
        data-device={device}
        onLoad={() => {
          // The document has parsed and its scripts have run. If `ready` was
          // going to arrive it has by now or is microseconds away, so the grace
          // period is short — long enough not to flicker, short enough that a
          // broken handshake is not a wait.
          if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
          const forDocument = srcDoc;
          revealTimer.current = window.setTimeout(() => setRevealedFor(forDocument), REVEAL_GRACE_MS);
        }}
        className="h-full w-full border-0 bg-white"
      />
      {booting && (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center"
          style={{ background: "var(--surface)" }}
          role="status"
          aria-live="polite"
          data-testid="app-preview-booting"
        >
          <span aria-hidden className="ai-pending mb-1 h-9 w-9 rounded-full border-2" style={{ borderColor: "var(--line-2)" }} />
          <p className="text-[14px] font-medium" style={{ color: "var(--ink-2)" }}>{t("previewBootingTitle")}</p>
        </div>
      )}
    </div>
  );
}

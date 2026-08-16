"use client";

/**
 * The published application's frame, and what a visitor sees when it fails.
 *
 * WHY THIS IS A CLIENT COMPONENT AT ALL. `PublicAppView` was a server component
 * on the reasonable ground that a visitor should not download a bundle to look
 * at a page. The cost of that was silence: the workspace listens for the
 * `runtime-error` messages a generated app posts and states them, and this page
 * listened for nothing — so an app that threw here left a stranger looking at a
 * white rectangle with no indication that anything had happened, no way to tell
 * a slow app from a dead one, and nothing to report to the owner.
 *
 * A blank screen with no explanation is worse than a small bundle. This is the
 * smallest thing that fixes it: one listener, one piece of state, one message.
 *
 * WHAT IT DOES NOT DO. It does not show a stack trace, an error message or a
 * "reported to the developer" claim. A visitor is not debugging; they want to
 * know whether to wait, reload, or leave. The diagnostic detail still travels
 * the same protocol and is still available to the owner in the workspace, which
 * is where acting on it is possible.
 *
 * The security posture is untouched and non-negotiable: `SANDBOX_ATTRIBUTE` is
 * `allow-scripts allow-forms` and never `allow-same-origin`, the document is
 * `srcDoc` so it never becomes a fetchable address, and every message is parsed
 * by `subscribePreview`, which checks source, origin, shape and type.
 */

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { SANDBOX_ATTRIBUTE } from "@/lib/v2/app/sandbox";
import { describedFailureOrigin, subscribePreview, type RuntimeFailureOrigin } from "@/lib/v2/app/protocol";

export interface PublicAppFrameLabels {
  /** Shown while the app has not reported that it is running. */
  loading: string;
  /** The app itself failed. */
  appFailedTitle: string;
  appFailedBody: string;
  /** Ventrio could not deliver the app. Different cause, different sentence. */
  runtimeFailedTitle: string;
  runtimeFailedBody: string;
  reload: string;
}

export interface PublicAppFrameProps {
  title: string;
  document: string;
  labels: PublicAppFrameLabels;
}

/** How long to wait for `ready` before showing the frame regardless. */
const REVEAL_GRACE_MS = 4_000;

export function PublicAppFrame({ title, document: srcDoc, labels }: PublicAppFrameProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const [ready, setReady] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [failure, setFailure] = useState<RuntimeFailureOrigin | null>(null);
  const revealTimer = useRef<number | null>(null);

  /**
   * Classified by the shared function, so the sentence a visitor reads and the
   * sentence the owner reads describe the same failure the same way.
   */
  const onRuntimeErrors = useCallback((messages: string[]) => {
    if (messages.length === 0) return;
    setFailure(describedFailureOrigin(messages));
  }, []);

  useLayoutEffect(
    () => subscribePreview(frameRef.current, { onReady: () => setReady(true), onRuntimeErrors }),
    [onRuntimeErrors, srcDoc],
  );

  useLayoutEffect(() => () => {
    if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
  }, []);

  /**
   * The failure state replaces the app only when the app never appeared.
   *
   * An app that mounted and then threw somewhere non-fatal is still usable, and
   * covering a working page with an error panel would be a worse outcome than
   * the error. So a reported failure hides the frame only while nothing has
   * rendered; after `ready`, the app keeps the screen.
   */
  const broken = failure !== null && !ready;
  const booting = !ready && !revealed && !broken;

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh" }}>
      <iframe
        ref={frameRef}
        title={title}
        srcDoc={srcDoc}
        sandbox={SANDBOX_ATTRIBUTE}
        data-ready={ready ? "true" : "false"}
        onLoad={() => {
          if (revealTimer.current !== null) window.clearTimeout(revealTimer.current);
          revealTimer.current = window.setTimeout(() => setRevealed(true), REVEAL_GRACE_MS);
        }}
        // The app owns the whole viewport; Ventrio adds no frame around it.
        className="public-app-frame"
        style={{
          display: "block",
          width: "100%",
          height: "100dvh",
          border: "0",
          visibility: broken ? "hidden" : "visible",
        }}
      />

      {booting && (
        <div
          role="status"
          aria-live="polite"
          data-testid="public-app-booting"
          style={{
            position: "absolute", inset: 0, display: "flex", alignItems: "center",
            justifyContent: "center", background: "var(--surface, #fff)",
            font: "15px/1.5 ui-sans-serif, system-ui, sans-serif", color: "var(--ink-2, #5d5d58)",
          }}
        >
          {labels.loading}
        </div>
      )}

      {broken && (
        <div
          role="alert"
          data-testid="public-app-failed"
          data-origin={failure}
          style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", gap: "10px", padding: "24px",
            textAlign: "center", background: "var(--surface, #fff)",
            font: "15px/1.55 ui-sans-serif, system-ui, sans-serif", color: "var(--ink-2, #5d5d58)",
          }}
        >
          <p style={{ margin: 0, fontSize: "17px", fontWeight: 600, color: "var(--ink, #1b1b1a)" }}>
            {failure === "runtime" ? labels.runtimeFailedTitle : labels.appFailedTitle}
          </p>
          <p style={{ margin: 0, maxWidth: "34em" }}>
            {failure === "runtime" ? labels.runtimeFailedBody : labels.appFailedBody}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              marginTop: "6px", padding: "9px 16px", borderRadius: "9px", cursor: "pointer",
              border: "1px solid var(--line-2, #e3e3de)", background: "var(--surface, #fff)",
              font: "inherit", fontSize: "14.5px", fontWeight: 560, color: "var(--ink, #1b1b1a)",
            }}
          >
            {labels.reload}
          </button>
        </div>
      )}
    </div>
  );
}

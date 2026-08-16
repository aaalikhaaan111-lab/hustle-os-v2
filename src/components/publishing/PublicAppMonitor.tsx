"use client";

/**
 * Watches a published application boot, and refuses to spin forever.
 *
 * WHY THE DOCUMENT IS FETCHED RATHER THAN RENDERED. It used to be a prop, and
 * React Server Components serialise the whole server tree as flight data
 * alongside the HTML — so a 2.4 MB document became 5.6 MB of markup, the same
 * bytes twice, parsed in one go. Moving the iframe to a server component did
 * not help: flight data carries the server tree too. Sending it separately is
 * the only way to send it once, and it takes the page to ~60 kB.
 *
 * Desktop absorbs that. iOS does not: a tab gets a fraction of the memory, and
 * the reported failure was "Starting the app…" forever, then WebKit's own
 * "This page couldn't load" — which is what an out-of-memory kill looks like to
 * a person. The same app rendered fine in the authenticated workspace on the
 * same phone, and the difference is exactly this: there the preview is behind a
 * toggle, so the frame is never server-rendered and the document is attached as
 * a DOM property afterwards.
 *
 * So the server renders an empty frame and this component fills it: fetch the
 * document, re-stamp its nonce to this page's, assign `srcdoc`. Nothing large
 * crosses the server→client boundary at all.
 *
 * WHY THE DEADLINE IS ANCHORED AT MOUNT. The previous version revealed the app
 * on the frame's `load` event and showed a boot overlay until then. When the
 * renderer is struggling, `load` never fires — so the overlay had no end. A
 * deadline that starts when this component mounts cannot be starved by the
 * thing it is timing.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { describedFailureOrigin, subscribePreview, type RuntimeFailureOrigin } from "@/lib/v2/app/protocol";
import { withLiveNonce } from "@/lib/workspace/previewNonce";

/**
 * How far the boot is allowed to get, named so a failure says which step was
 * reached. This is the difference between "it broke" and a report someone can
 * act on without the device in front of them.
 */
type BootPhase =
  /** This component hydrated; the host page is alive. */
  | "fetching"
  /** The document arrived and was handed to the frame. */
  | "attached"
  /** The frame's document finished parsing and running its scripts. */
  | "frame-loaded"
  /** The app inside committed something to the DOM. */
  | "running"
  /** The document could not be fetched: Ventrio's failure, not the app's. */
  | "fetch-failed";

export interface PublicAppMonitorLabels {
  loading: string;
  appFailedTitle: string;
  appFailedBody: string;
  runtimeFailedTitle: string;
  runtimeFailedBody: string;
  /** Shown when nothing ever reported back — the case that used to hang. */
  stalledTitle: string;
  stalledBody: string;
  reload: string;
}

export interface PublicAppMonitorProps {
  /** The id of the server-rendered iframe this fills and watches. */
  frameId: string;
  /** Where to fetch the sandbox document from. See the route for why. */
  documentUrl: string;
  labels: PublicAppMonitorLabels;
  /**
   * How long to wait before calling the boot stalled.
   *
   * Generous on purpose: a 2 MB document on a mid-range phone can legitimately
   * take ten seconds to parse, compile and commit, and a deadline that fires
   * early would replace a hang with a lie.
   */
  deadlineMs?: number;
}

const DEFAULT_DEADLINE_MS = 25_000;

export function PublicAppMonitor({ frameId, documentUrl, labels, deadlineMs = DEFAULT_DEADLINE_MS }: PublicAppMonitorProps) {
  const [phase, setPhase] = useState<BootPhase>("fetching");
  const [failure, setFailure] = useState<RuntimeFailureOrigin | null>(null);
  const [stalled, setStalled] = useState(false);
  /** Kept for the diagnostic line, never rendered as a stack. */
  const reasons = useRef<string[]>([]);

  const onRuntimeErrors = useCallback((messages: string[]) => {
    if (messages.length === 0) return;
    reasons.current = messages;
    setFailure(describedFailureOrigin(messages));
  }, []);

  useEffect(() => {
    const frame = document.getElementById(frameId) as HTMLIFrameElement | null;
    if (!frame) return;

    /**
     * The host is alive, so the pure-CSS fallback underneath must not fire.
     * See `PublicAppView`: that fallback is the only thing that can speak if
     * this component never hydrates at all.
     */
    document.documentElement.setAttribute("data-ventrio-host", "alive");

    const onLoad = () => setPhase((p) => (p === "attached" ? "frame-loaded" : p));
    frame.addEventListener("load", onLoad);

    /**
     * Subscribed BEFORE the document is attached, deliberately.
     *
     * `ready` is posted once and never repeated, and a small app can boot
     * between the `srcdoc` assignment and a listener added afterwards. The
     * workspace lost exactly that race once; this does not re-lose it.
     */
    const stop = subscribePreview(frame, {
      onReady: () => { setPhase("running"); setStalled(false); },
      onRuntimeErrors,
    });

    const deadline = window.setTimeout(() => setStalled(true), deadlineMs);
    const aborter = new AbortController();

    void (async () => {
      try {
        const response = await fetch(documentUrl, { signal: aborter.signal, credentials: "same-origin" });
        if (!response.ok) throw new Error(`document responded ${response.status}`);
        const raw = await response.text();
        if (aborter.signal.aborted) return;

        /**
         * The nonce is re-stamped to the one THIS page runs under.
         *
         * A `srcdoc` frame inherits the embedding page's CSP, and Ventrio
         * allows scripts only by nonce. The document arrived on its own
         * request, so the nonce baked into it belongs to that request, not to
         * this page — leaving it would mean the document loads, the stylesheet
         * applies, and no script ever runs. `withLiveNonce` is the same
         * mechanism the workspace has used since `router.refresh()` first broke
         * the preview for exactly this reason.
         */
        frame.srcdoc = withLiveNonce(raw);
        setPhase((p) => (p === "fetching" ? "attached" : p));
      } catch (error) {
        if (aborter.signal.aborted) return;
        // Ventrio failed to deliver its own bytes. That is a different sentence
        // from "your app crashed", and the visitor should be told to retry.
        reasons.current = [`fetch: ${error instanceof Error ? error.message : "failed"}`];
        setPhase("fetch-failed");
        setFailure("runtime");
      }
    })();

    return () => {
      aborter.abort();
      frame.removeEventListener("load", onLoad);
      window.clearTimeout(deadline);
      stop();
    };
  }, [frameId, documentUrl, onRuntimeErrors, deadlineMs]);

  const running = phase === "running";

  /**
   * An app that started and then threw keeps the screen: it is still usable,
   * and covering a working page with an error panel is worse than the error.
   * Only a boot that never produced anything is replaced.
   */
  const broken = !running && (failure !== null || stalled);
  const booting = !running && !broken;

  useEffect(() => {
    const frame = document.getElementById(frameId);
    if (frame) (frame as HTMLElement).style.visibility = broken ? "hidden" : "visible";
  }, [broken, frameId]);

  if (running) return null;

  /**
   * Which sentence to show. A delivery failure is Ventrio's and worth
   * retrying; a crash in generated code is not; a boot that said nothing at all
   * is neither, and saying so is more honest than guessing.
   */
  const kind = failure ?? (stalled ? "stalled" : null);

  return (
    <>
      {booting && (
        <div role="status" aria-live="polite" data-testid="public-app-booting" style={overlay}>
          <span style={{ color: "var(--color-ink-secondary, #5d5d58)" }}>{labels.loading}</span>
        </div>
      )}

      {broken && (
        <div role="alert" data-testid="public-app-failed" data-origin={kind ?? "unknown"} data-phase={phase} style={overlay}>
          <p style={titleStyle}>
            {kind === "runtime" ? labels.runtimeFailedTitle
              : kind === "app" ? labels.appFailedTitle
              : labels.stalledTitle}
          </p>
          <p style={{ margin: 0, maxWidth: "34em", color: "var(--color-ink-secondary, #5d5d58)" }}>
            {kind === "runtime" ? labels.runtimeFailedBody
              : kind === "app" ? labels.appFailedBody
              : labels.stalledBody}
          </p>
          <button type="button" onClick={() => window.location.reload()} style={buttonStyle}>
            {labels.reload}
          </button>
          {/*
            A short, non-technical trace of how far the boot got. Not a stack —
            a visitor cannot use one — but enough that a person reporting this
            from a phone can say which step it reached, which is the whole
            difference between a bug report and "it doesn't work".
          */}
          <p data-testid="public-app-diagnostic" style={diagnosticStyle}>
            {[phase, kind ?? "no-signal", `${Math.round(deadlineMs / 1000)}s`].join(" · ")}
          </p>
        </div>
      )}
    </>
  );
}

const overlay: React.CSSProperties = {
  position: "absolute", inset: 0, display: "flex", flexDirection: "column",
  alignItems: "center", justifyContent: "center", gap: "10px", padding: "24px",
  textAlign: "center", background: "var(--color-surface, #fff)",
  font: "15px/1.55 ui-sans-serif, system-ui, sans-serif",
};

const titleStyle: React.CSSProperties = {
  margin: 0, fontSize: "17px", fontWeight: 600, color: "var(--color-ink, #1b1b1a)",
};

const buttonStyle: React.CSSProperties = {
  marginTop: "6px", padding: "11px 18px", borderRadius: "10px", cursor: "pointer",
  border: "1px solid var(--color-border-strong, #e3e3de)", background: "var(--color-surface, #fff)",
  font: "inherit", fontSize: "15px", fontWeight: 560, color: "var(--color-ink, #1b1b1a)",
  // A comfortable target on a phone; this is the one control on the screen.
  minHeight: "44px", minWidth: "44px",
};

const diagnosticStyle: React.CSSProperties = {
  margin: "2px 0 0", fontFamily: "ui-monospace, monospace", fontSize: "11px",
  color: "var(--color-ink-muted, #9a9a94)",
};

"use client";

import { useState, useTransition } from "react";
import { generateCodegenAction, type CodegenState } from "./actions";
import type { CompiledRoute } from "@/lib/v2/codegen/compile";
import type { CodegenTelemetry } from "@/lib/v2/codegen/generate";

/**
 * The codegen preview harness.
 *
 * Every generated document is mounted with `sandbox=""` — no scripts, no
 * same-origin access, no forms, no navigation — and each document additionally
 * carries its own `default-src 'none'` policy from the shell. The parent never
 * uses `dangerouslySetInnerHTML`: generated markup exists only inside the
 * `srcdoc` attribute string and is never parsed as markup by this document.
 *
 * The viewport widths are real, not simulated: the iframe is laid out at its
 * full target width, so the document's own layout viewport is exactly 390, 768
 * or 1440 CSS pixels and the media queries under test are the real ones. See
 * `ScaledFrame` for why the frame is not scaled down to fit.
 */

/**
 * Frame heights are fixed, and bounded by rasterisation rather than by taste.
 *
 * The height cannot be measured: the document is cross-origin to this page by
 * construction, so its scroll height is unreadable and there is no script
 * inside it to report one. That is the isolation working, not a gap to close.
 *
 * Nor can the height simply be made huge. `sandbox=""` puts the document in
 * its own process, and Chrome stops rasterising an out-of-process frame past
 * some surface size: measured here, 1440 x 1400 paints, while 1440 x 4200 and
 * 768 x 2600 both render blank while still reporting correct geometry. A
 * blank frame is a far worse failure than a cropped one — it looks like a
 * broken bundle when the bundle is fine — so these stay well under the
 * observed limit and taller pages scroll inside their own frame.
 */
const VIEWPORTS = [
  { id: "mobile", label: "390", width: 390, height: 2400 },
  { id: "tablet", label: "768", width: 768, height: 1600 },
  { id: "desktop", label: "1440", width: 1440, height: 1200 },
] as const;

type ViewportId = (typeof VIEWPORTS)[number]["id"];

export function CodegenHarness({ configured, benign, lastRun }: { configured: boolean; benign: CompiledRoute[]; lastRun: CompiledRoute[] | null }) {
  const [state, setState] = useState<CodegenState>({ status: "idle" });
  const [pending, startTransition] = useTransition();
  const [viewport, setViewport] = useState<ViewportId>("desktop");
  const [source, setSource] = useState<"benign" | "generated">("benign");
  const [routeIndex, setRouteIndex] = useState(0);

  // A run captured on the server outlives this component; live state wins.
  const generated = state.status === "ok" ? state.routes : (lastRun ?? []);
  const routes = source === "generated" ? generated : benign;
  const route = routes[Math.min(routeIndex, Math.max(routes.length - 1, 0))];
  const vp = VIEWPORTS.find((entry) => entry.id === viewport)!;

  return (
    <div>
      <div style={row}>
        <fieldset style={group}>
          <legend style={legend}>Bundle</legend>
          <button type="button" onClick={() => { setSource("benign"); setRouteIndex(0); }} style={tab(source === "benign")}>
            reference (hand-written)
          </button>
          <button
            type="button"
            disabled={generated.length === 0}
            onClick={() => { setSource("generated"); setRouteIndex(0); }}
            style={tab(source === "generated")}
          >
            generated {generated.length === 0 ? "(none yet)" : ""}
          </button>
        </fieldset>

        <fieldset style={group}>
          <legend style={legend}>Viewport</legend>
          {VIEWPORTS.map((entry) => (
            <button key={entry.id} type="button" onClick={() => setViewport(entry.id)} style={tab(viewport === entry.id)}>
              {entry.label}
            </button>
          ))}
        </fieldset>

        {routes.length > 1 && (
          <fieldset style={group}>
            <legend style={legend}>Route</legend>
            {routes.map((entry, index) => (
              <button key={entry.path} type="button" onClick={() => setRouteIndex(index)} style={tab(index === routeIndex)}>
                {entry.path}
              </button>
            ))}
          </fieldset>
        )}

        <button
          type="button"
          disabled={!configured || pending}
          onClick={() => startTransition(async () => setState(await generateCodegenAction()))}
          style={{ ...primary, opacity: !configured || pending ? 0.55 : 1 }}
        >
          {pending ? "generating…" : "Generate (max 2 requests)"}
        </button>
      </div>

      {!configured && (
        <p style={note}>No Gemini key is configured on this server, so generation is unavailable. The reference bundle still renders.</p>
      )}

      {state.status === "error" && (
        <div style={errorBox}>
          <strong style={{ display: "block", marginBottom: 6 }}>
            {state.stage ? `Refused at "${state.stage}"` : "Generation failed"}
          </strong>
          <p style={{ margin: "0 0 8px" }}>{state.message}</p>
          {state.issues && state.issues.length > 0 && (
            <ul style={{ margin: 0, paddingLeft: 18, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
              {state.issues.slice(0, 20).map((issue, index) => <li key={index}>{issue}</li>)}
            </ul>
          )}
          {state.telemetry && <Telemetry telemetry={state.telemetry} />}
        </div>
      )}

      {state.status === "ok" && (
        <div style={okBox}>
          <strong>Compiled.</strong> {state.routes.length} route(s), {state.report.cssBytes} B of CSS.
          {state.report.unusedContentKeys.length > 0 && (
            <span style={{ color: "#7a6a2a" }}> {state.report.unusedContentKeys.length} content key(s) unused.</span>
          )}
          <Telemetry telemetry={state.telemetry} />
        </div>
      )}

      {route && (
        <>
          <p style={{ ...note, marginTop: 20 }}>
            {source === "benign" ? "Hand-written reference bundle" : "Model-generated bundle"} · {route.path} ·
            rendered at {vp.width}px in a sandboxed frame
          </p>
          {/* Deliberately not keyed. A key remounts the iframe, and a freshly
              mounted out-of-process frame does not always get rasterised —
              it reports correct geometry and paints nothing until something
              forces a compositing update. Updating the same element in place
              avoids that entirely. */}
          <ScaledFrame
            width={vp.width}
            height={vp.height}
            srcDoc={route.srcDoc}
            label={`${route.path} at ${vp.width}px`}
          />
        </>
      )}
    </div>
  );
}

/**
 * A frame at its true target width, in a container that scrolls.
 *
 * It is deliberately NOT scaled to fit. `sandbox=""` gives the document an
 * opaque origin, which makes Chrome host it in its own process, and an
 * out-of-process frame inside a CSS `transform: scale()` is not rasterised —
 * the frame occupies the right box, reports the right size, and paints
 * nothing. Verified directly: removing the transform makes the identical frame
 * render immediately.
 *
 * Scaling with `zoom` instead is not a fix either, because zoom changes the
 * CSS pixel size the document sees, which would mean the 1440 button measured
 * something other than 1440.
 *
 * So the frame keeps its real width and the container scrolls. On a display
 * narrower than the target, use browser zoom to view the whole width — that
 * changes rasterisation, not the document's CSS viewport, so the breakpoint
 * under test stays honest.
 */
function ScaledFrame({ width, height, srcDoc, label }: { width: number; height: number; srcDoc: string; label: string }) {
  return (
    <div style={{ border: "1px solid #dfe3ec", borderRadius: 12, overflow: "auto", background: "#fff", maxWidth: "100%" }}>
      <iframe
        title={label}
        srcDoc={srcDoc}
        sandbox=""
        referrerPolicy="no-referrer"
        data-testid="codegen-frame"
        style={{ width, height, border: 0, display: "block" }}
      />
    </div>
  );
}

function Telemetry({ telemetry }: { telemetry: CodegenTelemetry }) {
  return (
    <p style={{ margin: "8px 0 0", fontFamily: "ui-monospace, monospace", fontSize: 12, color: "#5a6270" }}>
      {telemetry.requestCount} request(s) · {(telemetry.totalLatencyMs / 1000).toFixed(1)}s ·{" "}
      {telemetry.repaired ? "repaired" : "first attempt"} ·{" "}
      {telemetry.stages.map((stage) => `${stage.stage}:${stage.ok ? "ok" : "fail"}`).join(" ")}
    </p>
  );
}

const row: React.CSSProperties = { display: "flex", flexWrap: "wrap", gap: 12, alignItems: "flex-end", marginBottom: 14 };
const group: React.CSSProperties = { border: "1px solid #dfe3ec", borderRadius: 10, padding: "6px 8px 8px", display: "flex", gap: 4, margin: 0 };
const legend: React.CSSProperties = { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.08em", color: "#8b93a1", padding: "0 4px" };
const tab = (active: boolean): React.CSSProperties => ({
  padding: "5px 10px", borderRadius: 7, fontSize: 13, cursor: "pointer",
  border: active ? "1px solid #0e1116" : "1px solid transparent",
  background: active ? "#0e1116" : "transparent", color: active ? "#fff" : "#3c4452",
});
const primary: React.CSSProperties = {
  padding: "9px 16px", borderRadius: 9, border: 0, background: "#1f4f3f", color: "#fff",
  fontSize: 14, fontWeight: 600, cursor: "pointer", marginLeft: "auto",
};
const note: React.CSSProperties = { margin: "0 0 8px", fontSize: 13, color: "#5a6270" };
const errorBox: React.CSSProperties = { border: "1px solid #f0c9c4", background: "#fdf4f3", borderRadius: 10, padding: 14, fontSize: 13, color: "#7d2820", marginBottom: 14 };
const okBox: React.CSSProperties = { border: "1px solid #cde5d5", background: "#f3faf5", borderRadius: 10, padding: 14, fontSize: 13, color: "#20543a", marginBottom: 14 };

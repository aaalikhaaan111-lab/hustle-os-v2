"use client";

import { useState } from "react";
import { ProjectOutputRenderer } from "@/components/build/ProjectOutputRenderer";
import { BuildScreen } from "@/components/workspace/BuildScreen";
import { ViewportFrame } from "@/components/workspace/ViewportFrame";
import { DEVICE_WIDTHS, type DeviceMode } from "@/lib/build/deviceWidths";
import { CHRONOVERSE_OUTPUT } from "@/lib/build/outputFixtures";

/**
 * Renders the stored artifact through the SAME mechanism the workspace uses,
 * so the reproduction and the fix are measured on the real thing. `inline`
 * reproduces the old behaviour — a width-constrained div in this document —
 * which is what shredded the headings.
 *
 * `panel` constrains the surrounding column, standing in for a workspace whose
 * preview pane is narrower than the selected device. That is the case where a
 * naive fit would silently change the frame's viewport, so it needs measuring
 * directly rather than assuming.
 */
export function Harness({
  mode,
  inline,
  panel,
  controls,
}: {
  mode: DeviceMode;
  inline: boolean;
  panel: number;
  controls: boolean;
}) {
  const [device] = useState<DeviceMode>(mode);
  const width = DEVICE_WIDTHS[device];
  const output = (
    <ProjectOutputRenderer projectKey="fixture" output={CHRONOVERSE_OUTPUT} locale="en" mode="preview" />
  );

  // The whole workspace, with the real device switcher, the real fullscreen
  // control and the real rail — the controls a user actually clicks. The only
  // substitutions are the chat body and the share link; nothing here reaches a
  // session, a query or a model.
  if (controls) {
    return (
      <BuildScreen
        chat={() => (
          <div style={{ padding: 24, font: "14px system-ui" }}>chat stand-in</div>
        )}
        preview={output}
        published={false}
        shareUrl={null}
      />
    );
  }

  return (
    <div style={{ padding: 12, background: "#eef1f6", minHeight: "100vh" }}>
      <p style={{ font: "12px ui-monospace, monospace", marginBottom: 8 }}>
        {inline ? "BEFORE — width-constrained div (old)" : "AFTER — ViewportFrame (fixed)"} · {device} · {width}px
        {panel > 0 ? ` · panel ${panel}px` : ""}
      </p>
      <div
        data-testid="panel"
        style={{
          margin: "0 auto",
          // Never content-sized: the frame measures its container, so a
          // fit-content panel would size itself from the frame and back again.
          width: panel > 0 ? panel : "100%",
          maxWidth: "100%",
          background: "#fff",
          overflow: "hidden",
          borderRadius: 12,
        }}
      >
        {inline ? (
          <div data-testid="preview-surface" style={{ maxWidth: width }}>{output}</div>
        ) : (
          // Same structure as BuildScreen: a full-width centring container the
          // frame can measure without measuring itself.
          <div style={{ display: "flex", width: "100%", justifyContent: "center" }}>
            <ViewportFrame width={width} title="preview">{output}</ViewportFrame>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import { ProjectOutputRenderer } from "@/components/build/ProjectOutputRenderer";
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
export function Harness({ mode, inline, panel }: { mode: DeviceMode; inline: boolean; panel: number }) {
  const [device] = useState<DeviceMode>(mode);
  const width = DEVICE_WIDTHS[device];
  const output = (
    <ProjectOutputRenderer projectKey="fixture" output={CHRONOVERSE_OUTPUT} locale="en" mode="preview" />
  );

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

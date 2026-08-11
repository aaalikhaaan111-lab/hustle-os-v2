"use client";

import { useState } from "react";
import { ProjectOutputRenderer } from "@/components/build/ProjectOutputRenderer";
import { useTranslations } from "next-intl";
import { BuildScreen } from "@/components/workspace/BuildScreen";
import { GenerationSteps } from "@/components/workspace-ui/GenerationSteps";
import { ViewportFrame } from "@/components/workspace/ViewportFrame";
import { DEVICE_WIDTHS, type DeviceMode } from "@/lib/build/deviceWidths";
import { CHRONOVERSE_OUTPUT } from "@/lib/build/outputFixtures";
// The workspace's design tokens are scoped to `.wsRoot` and normally come from
// WorkspaceShell. Without both, every `var(--line)` and `var(--accent-soft)`
// falls back to its initial value and the UI renders in stark black on white —
// a harness artifact that looks exactly like a styling defect.
import "@/components/workspace-ui/tokens.css";

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
  screen,
  published,
}: {
  mode: DeviceMode;
  inline: boolean;
  panel: number;
  controls: boolean;
  screen: string;
  /** Fixture publish state, so the Live chip and copy control can be seen. */
  published: boolean;
}) {
  const t = useTranslations("stage3");
  const [device] = useState<DeviceMode>(mode);
  const width = DEVICE_WIDTHS[device];
  const output = (
    <ProjectOutputRenderer projectKey="fixture" output={CHRONOVERSE_OUTPUT} locale="en" mode="preview" />
  );

  // What a person sees while the first version is being generated: the real
  // workspace with no preview yet, and the real progress card in the chat
  // column where it actually appears.
  if (screen === "generation") {
    return (
      <div className="wsRoot h-screen w-full overflow-hidden" style={{ background: "var(--bg)" }}>
      <BuildScreen
        chat={() => (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto flex w-full flex-col gap-7 px-5 py-8 sm:px-8" style={{ maxWidth: 820 }}>
              <p className="whitespace-pre-wrap text-[19px] font-semibold leading-snug tracking-[-0.01em]">
                Build me the first version
              </p>
              <GenerationSteps
                title={t("genTitle")}
                steps={[
                  { label: t("genUnderstanding"), state: "done" },
                  { label: t("genAudience"), state: "done" },
                  { label: t("genDirection"), state: "done" },
                  { label: t("genGenerating"), state: "active" },
                ]}
              />
            </div>
          </div>
        )}
        preview={null}
        published={false}
        shareUrl={null}
      />
      </div>
    );
  }

  // The whole workspace, with the real device switcher, the real fullscreen
  // control and the real rail — the controls a user actually clicks. The only
  // substitutions are the chat body and the share link; nothing here reaches a
  // session, a query or a model.
  if (controls) {
    return (
      <div className="wsRoot h-screen w-full overflow-hidden" style={{ background: "var(--bg)" }}>
      <BuildScreen
        chat={() => (
          <div style={{ padding: 24, font: "14px system-ui" }}>chat stand-in</div>
        )}
        preview={output}
        published={published}
        shareUrl={published ? "https://ventrio.org/p/chronoverse-fixture" : null}
      />
      </div>
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

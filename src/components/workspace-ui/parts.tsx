"use client";

import type { ReactNode } from "react";
import { VentrioButton } from "@/components/ui/VentrioButton";
/** What a preview needs in order to be drawn — satisfied by a real project row
 *  or by lab demo content, without either knowing about the other. */
export type ProjectState = "draft" | "published" | "proposal";

export interface PreviewSpec {
  /** Which composition to draw. Derived from the project's real type. */
  shape: "booking" | "directory" | "archive" | "form";
  accent: string;
}

/* ── Icons: one family, 18px grid, 1.5 stroke, no fills ─────────────────── */

type IconProps = { className?: string };
const s = {
  viewBox: "0 0 18 18",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.5,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};
const c = (n?: string) => n ?? "h-[18px] w-[18px]";

export const IconOverview = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M3 9.4 9 3.6l6 5.8M4.6 8.4v5.2a.9.9 0 0 0 .9.9h7a.9.9 0 0 0 .9-.9V8.4" />
  </svg>
);
export const IconProjects = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M2.6 5.4A1.4 1.4 0 0 1 4 4h2.5l1.5 1.7h6a1.4 1.4 0 0 1 1.4 1.4v6a1.4 1.4 0 0 1-1.4 1.4H4a1.4 1.4 0 0 1-1.4-1.4z" />
  </svg>
);
export const IconPlus = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M9 4v10M4 9h10" />
  </svg>
);
export const IconBuild = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M9 2.8 10.3 6.5 14 7.8 10.3 9.1 9 12.8 7.7 9.1 4 7.8 7.7 6.5z" />
    <path d="M13.6 12.4l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" />
  </svg>
);
export const IconAnalytics = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M3 14.6h12M5.4 11.8V8.4M9 11.8V4.6M12.6 11.8V7" />
  </svg>
);
export const IconVersions = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <circle cx="5.2" cy="4.8" r="1.6" />
    <circle cx="5.2" cy="13.2" r="1.6" />
    <circle cx="12.8" cy="9" r="1.6" />
    <path d="M5.2 6.4v5.2M6.8 4.8h2.6A1.8 1.8 0 0 1 11.2 6.6v.9" />
  </svg>
);
export const IconSettings = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <circle cx="9" cy="9" r="2.2" />
    <path d="M9 2.4v1.6M9 14v1.6M15.6 9H14M4 9H2.4M13.7 4.3l-1.1 1.1M5.4 12.6l-1.1 1.1M13.7 13.7l-1.1-1.1M5.4 5.4 4.3 4.3" />
  </svg>
);
export const IconUser = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <circle cx="9" cy="6.4" r="2.7" />
    <path d="M3.8 15c.7-2.5 2.7-3.9 5.2-3.9s4.5 1.4 5.2 3.9" />
  </svg>
);
export const IconBack = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M11.2 4 6.4 9l4.8 5" />
  </svg>
);
export const IconMic = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <rect x="7.2" y="2.6" width="3.6" height="7.6" rx="1.8" />
    <path d="M4.6 8.8a4.4 4.4 0 0 0 8.8 0M9 13.2v2.2" />
  </svg>
);
export const IconSend = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M9 14.4V4.2M9 4.2 5.2 8M9 4.2 12.8 8" />
  </svg>
);
export const IconEye = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M1.9 9S4.7 4.4 9 4.4 16.1 9 16.1 9 13.3 13.6 9 13.6 1.9 9 1.9 9z" />
    <circle cx="9" cy="9" r="1.8" />
  </svg>
);
export const IconClose = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M5.2 5.2l7.6 7.6M12.8 5.2l-7.6 7.6" />
  </svg>
);
export const IconExpand = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M7 3.6H3.6V7M11 3.6h3.4V7M14.4 11v3.4H11M3.6 11v3.4H7" />
  </svg>
);
export const IconRefresh = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M14.4 9a5.4 5.4 0 1 1-1.6-3.8M14.6 3.2v3.2h-3.2" />
  </svg>
);
export const IconCheck = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M4.2 9.4 7.4 12.4 13.8 5.8" />
  </svg>
);
export const IconSearch = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <circle cx="8.2" cy="8.2" r="4.6" />
    <path d="M11.6 11.6 15 15" />
  </svg>
);
export const IconMore = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <circle cx="4.4" cy="9" r="1" fill="currentColor" stroke="none" />
    <circle cx="9" cy="9" r="1" fill="currentColor" stroke="none" />
    <circle cx="13.6" cy="9" r="1" fill="currentColor" stroke="none" />
  </svg>
);
export const IconCollapse = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <rect x="2.6" y="3.4" width="12.8" height="11.2" rx="1.8" />
    <path d="M7 3.4v11.2" />
  </svg>
);
export const IconCopy = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <rect x="6.4" y="6.4" width="8" height="8" rx="1.8" />
    <path d="M11.6 6.4V5.2a1.6 1.6 0 0 0-1.6-1.6H5.2a1.6 1.6 0 0 0-1.6 1.6V10a1.6 1.6 0 0 0 1.6 1.6h1.2" />
  </svg>
);
export const IconChat = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M15 8.6c0 2.9-2.7 5.2-6 5.2a7 7 0 0 1-1.9-.25L3.6 14.8l.9-2.6A5 5 0 0 1 3 8.6c0-2.9 2.7-5.2 6-5.2s6 2.3 6 5.2z" />
  </svg>
);
export const IconDesktop = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <rect x="2.4" y="3.8" width="13.2" height="8.4" rx="1.6" />
    <path d="M6.8 15h4.4M9 12.2V15" />
  </svg>
);
export const IconMobile = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <rect x="5.6" y="2.6" width="6.8" height="12.8" rx="1.8" />
    <path d="M8.2 13.2h1.6" />
  </svg>
);
export const IconPalette = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <circle cx="9" cy="9" r="6.2" />
    <path d="M9 2.8v12.4" />
  </svg>
);
export const IconMoon = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M15 10.4A6.2 6.2 0 0 1 7.6 3a6.2 6.2 0 1 0 7.4 7.4z" />
  </svg>
);
export const IconGlobe = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <circle cx="9" cy="9" r="6.2" />
    <path d="M2.9 7.2h12.2M2.9 10.8h12.2M9 2.8c1.7 1.8 2.6 3.9 2.6 6.2S10.7 13.4 9 15.2C7.3 13.4 6.4 11.3 6.4 9S7.3 4.6 9 2.8z" />
  </svg>
);
export const IconShield = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M9 2.8 14.2 5v3.8c0 3.1-2.1 5.6-5.2 6.4-3.1-.8-5.2-3.3-5.2-6.4V5z" />
  </svg>
);
export const IconSliders = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M3 5.6h7M13 5.6h2M3 12.4h2M8 12.4h7" />
    <circle cx="11.4" cy="5.6" r="1.7" />
    <circle cx="6.4" cy="12.4" r="1.7" />
  </svg>
);
export const IconMinimize = ({ className }: IconProps) => (
  <svg {...s} className={c(className)}>
    <path d="M3.6 7h3.4V3.6M14.4 7H11V3.6M11 11h3.4v3.4M7 11H3.6v3.4" />
  </svg>
);

/* ── Shared primitives ──────────────────────────────────────────────────── */

const STATE_STYLE: Record<ProjectState, { label: string; fg: string; bg: string }> = {
  draft: { label: "Draft", fg: "var(--ink-2)", bg: "var(--sunken)" },
  published: { label: "Published", fg: "var(--ok)", bg: "var(--ok-soft)" },
  proposal: { label: "Update ready", fg: "var(--accent-ink)", bg: "var(--accent-soft)" },
};

export function StatusPill({ state }: { state: ProjectState }) {
  const style = STATE_STYLE[state];
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2 py-[3px] text-[12px] font-semibold leading-none"
      style={{ color: style.fg, background: style.bg }}
    >
      {style.label}
    </span>
  );
}

/**
 * Kept as a thin alias so existing call sites keep working. Everything about
 * how a button looks and reacts now lives in VentrioButton.
 */
export function Button({
  children,
  variant = "secondary",
  size = "md",
  onClick,
}: {
  children: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  onClick?: () => void;
}) {
  return (
    <VentrioButton variant={variant} size={size} onClick={onClick}>
      {children}
    </VentrioButton>
  );
}

/**
 * The button for actions that ask the model to make something. Same component
 * as everything else — this is simply the primary variant, named for the job it
 * does at the call sites that use it.
 */
export function GenerativeButton({
  children,
  onClick,
  disabled,
  type = "button",
  size = "md",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  type?: "button" | "submit";
  size?: "md" | "sm";
  className?: string;
}) {
  return (
    <VentrioButton variant="generative" size={size} type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </VentrioButton>
  );
}

/**
 * The real Ventrio mark, drawn from the brand asset — never re-made in CSS.
 * The lockup shows mark plus wordmark; the collapsed rail shows the mark alone.
 */
export function VentrioMark({ size = 26 }: { size?: number }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a small fixed local asset; next/image adds nothing
    <img
      src="/ventrio-mark.png"
      alt=""
      width={size}
      height={size}
      aria-hidden
      className="block shrink-0 select-none"
      style={{ width: size, height: size }}
    />
  );
}

/**
 * The generated product, drawn rather than photographed.
 *
 * This is the piece that stops every surface from being a grey rectangle: the
 * same four compositions appear in the overview, the project tiles and the
 * preview canvas, at three densities, each tinted by its project. It reads as a
 * real page at 120px and holds up at 800px.
 */
export function ProductPreview({
  project,
  density = "sm",
  highlight,
}: {
  project: PreviewSpec;
  density?: "xs" | "sm" | "lg";
  highlight?: boolean;
}) {
  const u = density === "lg" ? 1 : density === "sm" ? 0.42 : 0.26;
  const px = (n: number) => `${Math.max(1, Math.round(n * u))}px`;
  const bar = (w: string, h: number, tone = "var(--line-2)") => (
    <span style={{ display: "block", width: w, height: px(h), borderRadius: px(h), background: tone }} />
  );

  return (
    <div
      className="flex h-full w-full flex-col overflow-hidden"
      style={{ background: "#fff", gap: px(14), padding: px(20) }}
    >
      {/* masthead */}
      <div className="flex items-center justify-between" style={{ gap: px(10) }}>
        {bar("22%", 8, project.accent)}
        <div className="flex" style={{ gap: px(8) }}>
          {bar(px(26), 5)}
          {bar(px(26), 5)}
          {bar(px(26), 5)}
        </div>
      </div>

      {/* hero */}
      <div
        style={{
          height: px(64),
          borderRadius: px(8),
          background: `linear-gradient(142deg, ${project.accent}, ${project.accent}33)`,
          flexShrink: 0,
        }}
      />

      <div className="flex flex-col" style={{ gap: px(7) }}>
        {bar("62%", 9)}
        {bar("42%", 7, "var(--line)")}
      </div>

      <div
        style={{
          width: px(96),
          height: px(24),
          borderRadius: px(6),
          background: project.accent,
          flexShrink: 0,
          transition: "box-shadow 240ms ease",
          boxShadow: highlight ? `0 0 0 ${px(6)} ${project.accent}26` : "none",
        }}
      />

      {/* the body varies by what the project actually is */}
      {project.shape === "booking" && (
        <div className="flex flex-col" style={{ gap: px(8) }}>
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="flex items-center justify-between"
              style={{
                gap: px(10),
                padding: px(12),
                borderRadius: px(7),
                border: `${px(1)} solid ${i === 1 && highlight ? project.accent : "var(--line)"}`,
                background: i === 1 && highlight ? `${project.accent}0d` : "transparent",
                transition: "border-color 240ms ease, background 240ms ease",
              }}
            >
              <div className="flex flex-col" style={{ gap: px(5) }}>
                {bar(px(84), 7)}
                {bar(px(54), 5, "var(--line)")}
              </div>
              {bar(px(38), 12, "var(--line)")}
            </div>
          ))}
        </div>
      )}

      {project.shape === "form" && (
        <div className="flex flex-col" style={{ gap: px(9) }}>
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col" style={{ gap: px(5) }}>
              {bar(px(52), 5, "var(--line)")}
              <div style={{ height: px(22), borderRadius: px(6), border: `${px(1)} solid var(--line)` }} />
            </div>
          ))}
        </div>
      )}

      {project.shape === "archive" && (
        <div className="grid grid-cols-3" style={{ gap: px(8) }}>
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="flex flex-col" style={{ gap: px(5) }}>
              <div style={{ height: px(34), borderRadius: px(6), background: "var(--sunken)" }} />
              {bar("80%", 5, "var(--line)")}
            </div>
          ))}
        </div>
      )}

      {project.shape === "directory" && (
        <div className="flex flex-col" style={{ gap: px(8) }}>
          <div style={{ height: px(46), borderRadius: px(7), background: "var(--sunken)" }} />
          <div className="flex" style={{ gap: px(8) }}>
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex-1 flex-col" style={{ display: "flex", gap: px(4) }}>
                {bar("100%", 6, "var(--line)")}
                {bar("64%", 5, "var(--line)")}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

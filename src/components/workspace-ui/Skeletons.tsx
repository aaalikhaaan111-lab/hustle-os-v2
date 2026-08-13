import type { CSSProperties } from "react";

/**
 * Loading placeholders in the workspace's own visual language.
 *
 * The product has two surfaces with separate tokens. Outer pages use the app
 * palette and are served by `components/ui/Skeleton.tsx`. Everything inside
 * `WorkspaceShell` uses `workspace-ui/tokens.css`, so these borrow that set —
 * the same `--r-*` radii, the same `--line` borders and the same `--surface`
 * the real cards sit on. A placeholder drawn in the other palette reads as a
 * different product for the half-second it is up.
 *
 * The only motion is `animate-pulse-soft`, which is the pulse the rest of the
 * app already uses; nothing here introduces a new animation.
 *
 * These are shapes, not content. They deliberately carry no text: a skeleton
 * that guesses at a heading is wrong more often than it is right, and it is the
 * layout holding still that makes the wait read as loading rather than broken.
 */

const fill: CSSProperties = { background: "var(--raised)" };

/** One placeholder block. Size it with `className`. */
export function WsBlock({ className = "", radius = "var(--r-xs)" }: { className?: string; radius?: string }) {
  return <div className={`animate-pulse-soft ${className}`} style={{ ...fill, borderRadius: radius }} />;
}

/** The heading block every workspace page opens with, matching `PageHeading`. */
export function WsHeadingSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <WsBlock className="h-[26px] w-52 max-w-full" />
        <WsBlock className="mt-2.5 h-[14px] w-72 max-w-full" />
      </div>
      {action && <WsBlock className="h-9 w-36 shrink-0" radius="var(--r-md)" />}
    </div>
  );
}

/** A bordered card on the workspace surface. */
export function WsCardSkeleton({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div
      className={`rounded-[var(--r-lg)] border p-4 ${className}`}
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      {children}
    </div>
  );
}

/** One metric tile, matching the `Metric` card on the analytics page. */
export function WsMetricSkeleton() {
  return (
    <WsCardSkeleton>
      <WsBlock className="h-[12px] w-24" />
      <WsBlock className="mt-2.5 h-[26px] w-16" />
    </WsCardSkeleton>
  );
}

/** One row of the projects list, matching the real row's rhythm. */
export function WsRowSkeleton() {
  return (
    <li className="flex items-start gap-3 px-3 py-4">
      <WsBlock className="mt-[7px] h-2 w-2 shrink-0" radius="9999px" />
      <div className="min-w-0 flex-1">
        <WsBlock className="h-[15px] w-48 max-w-full" />
        <WsBlock className="mt-2 h-[13px] w-64 max-w-full" />
      </div>
    </li>
  );
}

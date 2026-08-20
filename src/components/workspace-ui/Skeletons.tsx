import type { CSSProperties } from "react";

/**
 * Loading placeholders, shaped like the thing that replaces them.
 *
 * There is one palette now, so there is no longer a second set of tokens for
 * these to borrow — `--color-*` is the same inside the workspace and out.
 *
 * What DID need fixing is the shapes. These were drawn to match bordered cards
 * on a white sheet, and the screens they stand in for have no cards: the
 * heading is display type, the lists are hairline-separated rows, and the
 * active project is an artifact beside a column of metadata. A placeholder in
 * the previous layout does not just look wrong for half a second — it reflows
 * the entire page at the moment the data lands, which is the one thing a
 * skeleton exists to prevent.
 *
 * The motion is a shimmer that travels across each block. It replaced an
 * opacity pulse, which dimmed the whole page in unison and read more like a
 * fault than like loading — a moving highlight says work is passing through
 * this space, which is what a person is actually waiting to learn.
 *
 * These are shapes, not content. They deliberately carry no text: a skeleton
 * that guesses at a heading is wrong more often than it is right, and it is the
 * layout holding still that makes the wait read as loading rather than broken.
 */

const fill: CSSProperties = { background: "var(--color-surface-elevated)" };

/** One placeholder block. Size it with `className`. */
export function WsBlock({ className = "", radius = "var(--r-xs)" }: { className?: string; radius?: string }) {
  return <div className={`ws-shimmer ${className}`} style={{ ...fill, borderRadius: radius }} />;
}

/** The heading block every workspace page opens with, matching `PageHeading`. */
export function WsHeadingSkeleton({ action = false }: { action?: boolean }) {
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        <WsBlock className="h-[11px] w-24" />
        {/* The display step: 32px on a phone, 44px from md. */}
        <WsBlock className="mt-3 h-[38px] w-72 max-w-full sm:h-[48px]" />
        <WsBlock className="mt-4 h-[15px] w-80 max-w-full" />
      </div>
      {action && <WsBlock className="h-[38px] w-36 shrink-0" radius="var(--r-sm)" />}
    </div>
  );
}

/** A block separated by a hairline, which is what cards became. */
export function WsCardSkeleton({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <div className={`border-t py-4 ${className}`} style={{ borderColor: "var(--color-border)" }}>
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
    <li className="flex items-center gap-4 border-b py-5 pl-4" style={{ borderColor: "var(--color-border)" }}>
      <div className="min-w-0 flex-1">
        {/* 19px name, then the metadata line — the index row's real rhythm. */}
        <WsBlock className="h-[19px] w-56 max-w-full" />
        <WsBlock className="mt-2.5 h-[13px] w-72 max-w-full" />
      </div>
      <WsBlock className="h-[13px] w-14 shrink-0" />
    </li>
  );
}

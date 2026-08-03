import type { ReactNode } from "react";

/** One measure for the whole workspace, so no two routes disagree. */
const MEASURE = 960;

/**
 * The one content grid.
 *
 * Every route centres its content in the same column at the same width, so the
 * composition reads as balanced rather than pushed to one side, and headings
 * land on the same line whichever page you arrived from. Where prose needs a
 * shorter line, the block inside caps itself — the page origin never moves.
 */
export function PageBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`mx-auto w-full px-5 py-8 sm:px-8 sm:py-10 ${className}`} style={{ maxWidth: MEASURE }}>
      {children}
    </div>
  );
}

/** The heading block every page opens with, so the type scale never drifts. */
export function PageHeading({
  title,
  lead,
  actions,
}: {
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-[26px] font-semibold leading-tight tracking-[-0.02em]">{title}</h1>
        {lead && (
          <p className="mt-1.5 text-[14.5px] font-normal leading-relaxed" style={{ color: "var(--ink-2)" }}>
            {lead}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

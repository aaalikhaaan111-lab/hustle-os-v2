import type { ReactNode } from "react";

/**
 * The one content column.
 *
 * Widened from 960 to 1080 and given far more vertical air. The old page
 * opened 32px from the top of a white sheet that was itself inset from a grey
 * desk, so content began roughly 60px down inside two nested boxes. There is
 * no sheet now — the page sits directly in the room — so the space has to be
 * real space rather than the gap between two containers.
 */
const MEASURE = 1080;

export function PageBody({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div
      className={`mx-auto w-full px-5 pb-24 pt-9 sm:px-10 sm:pb-16 sm:pt-14 ${className}`}
      style={{ maxWidth: MEASURE }}
    >
      {children}
    </div>
  );
}

/**
 * The heading block every page opens with.
 *
 * Editorial, not a dashboard label. The old title was 26px semibold with a
 * 14.5px lead under it — a two-point difference in a grey column, which is
 * why no screen had an obvious subject. `s-display` is 32/44px at weight 500
 * with real negative tracking, and the eyebrow above it names the region so
 * the title itself never has to carry the words "Your" or "All".
 */
export function PageHeading({
  eyebrow,
  title,
  lead,
  actions,
}: {
  eyebrow?: string;
  title: string;
  lead?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0 flex-1">
        {eyebrow && <p className="s-eyebrow mb-2.5">{eyebrow}</p>}
        {/* Serif. A screen title is a name, and names are set in the voice. */}
        <h1 className="s-display">{title}</h1>
        {lead && <p className="s-body mt-3 max-w-xl">{lead}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </header>
  );
}

import type { ReactNode } from "react";

/**
 * The masthead every inner public page opens with.
 *
 * WHAT IT REPLACES. `InfoLayout` centred its content in a 42rem column with its
 * own type scale; the legal pages used `PageHeader` inside a different width
 * again; /pricing set its own. Three measures and three heading scales across
 * five pages that are meant to read as one site.
 *
 * This uses the landing's own devices — the `lp-wrap` gutter, the eyebrow, the
 * two-weight display heading — so an inner page is recognisably the same
 * document as the homepage. `narrow` puts prose back in a reading measure
 * without changing the page's outer frame, which is what the legal pages need.
 */
export function PublicPage({
  eyebrow,
  title,
  lede,
  children,
  narrow = false,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  children: ReactNode;
  narrow?: boolean;
}) {
  return (
    <div className="lp-wrap lp-section lp-page">
      <header className="lp-page-head">
        {eyebrow ? <p className="lp-eyebrow">{eyebrow}</p> : null}
        <h1 className="lp-page-title">{title}</h1>
        {lede ? <p className="lp-page-lede">{lede}</p> : null}
      </header>
      <div className={narrow ? "lp-page-body lp-page-body--narrow" : "lp-page-body"}>
        {children}
      </div>
    </div>
  );
}

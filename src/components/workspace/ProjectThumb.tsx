import type { PresentedPreviewContent } from "@/lib/workspace/present";

/**
 * A project card's picture: the generated page's own content, at page scale.
 *
 * WHAT THIS REPLACES. `ProductPreview` drew a decorative mock — a coloured
 * masthead bar, a gradient block, four grey rules and a hashed accent. Every
 * project rendered the same drawing in a different hue, so a gallery of six
 * looked like six copies of one placeholder and you still had to read the names
 * to find anything.
 *
 * This draws the REAL page: its own eyebrow, its own headline, its own call to
 * action, its own section headings, in the palette the generator chose for it.
 * Two projects are now told apart by looking at them, which is the entire point
 * of a gallery.
 *
 * Rendered at a fixed 1120×700 and scaled to the card by `.s-thumb`, so the
 * proportions are a real page's rather than a card's.
 *
 * A project with no version yet gets `content: null` and the card shows an
 * honest empty state instead — a mock of a page that does not exist is worse
 * than saying nothing was built.
 */
export function ProjectThumb({ content }: { content: PresentedPreviewContent }) {
  const [ink, accent, wash] = content.palette;

  return (
    <div
      style={{
        background: wash,
        color: ink,
        padding: "3.5em 4em",
        display: "flex",
        flexDirection: "column",
        gap: "1.75em",
        fontFamily: "var(--font-ui), var(--font-geist-sans), system-ui, sans-serif",
      }}
    >
      {/* masthead */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "1.25em", fontWeight: 700, letterSpacing: "-0.01em", opacity: 0.9 }}>
          {content.eyebrow || " "}
        </span>
        <span style={{ display: "flex", gap: "0.625em" }}>
          {[0, 1, 2].map((i) => (
            <span key={i} style={{ width: "2.75em", height: "0.375em", borderRadius: "0.1875em", background: ink, opacity: 0.18 }} />
          ))}
        </span>
      </div>

      {/* the hero, which is what makes a page recognisable at a glance */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1.125em", marginTop: "1.5em" }}>
        <span
          style={{
            fontSize: "3.875em",
            lineHeight: 1.04,
            fontWeight: 700,
            letterSpacing: "-0.03em",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {content.headline}
        </span>
        <span
          style={{
            fontSize: "1.5em",
            lineHeight: 1.45,
            opacity: 0.72,
            maxWidth: "80%",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {content.subheadline}
        </span>
      </div>

      <span
        style={{
          alignSelf: "flex-start",
          marginTop: "0.5em",
          padding: "1em 1.875em",
          borderRadius: "62em",
          background: accent,
          color: wash,
          fontSize: "1.25em",
          fontWeight: 600,
        }}
      >
        {content.ctaLabel}
      </span>

      {content.sections.length > 0 && (
        <div style={{ display: "flex", gap: "1.25em", marginTop: "auto", opacity: 0.7 }}>
          {content.sections.map((title) => (
            <span
              key={title}
              style={{
                flex: 1,
                minWidth: 0,
                fontSize: "1.0625em",
                lineHeight: 1.3,
                paddingTop: "1em",
                borderTop: `0.125em solid ${ink}`,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {title}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/** What a card shows before anything has been generated. */
export function ProjectThumbEmpty({ label }: { label: string }) {
  return (
    <div
      className="flex h-full w-full items-center justify-center"
      style={{ background: "var(--muted)" }}
    >
      <span style={{ fontSize: "2em", color: "var(--muted-foreground)" }}>{label}</span>
    </div>
  );
}

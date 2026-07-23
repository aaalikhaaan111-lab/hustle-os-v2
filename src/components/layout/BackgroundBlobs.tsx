// App-wide aurora atmosphere: a few large, very soft indigo/teal gradients that
// give the dark canvas a sense of place without ever competing with content.
// The slow drift respects prefers-reduced-motion (handled globally).
//
// variant="minimal" drops the concentric contour rings. The landing already
// carries its own layered atmosphere, so on that route the extra rings only
// add to the "too many orbital lines" repetition — we keep the soft aurora
// wash but omit the rings there.
export function BackgroundBlobs({ variant = "full" }: { variant?: "full" | "minimal" }) {
  return (
    <div aria-hidden className="midnight-environment pointer-events-none fixed inset-0 z-0 select-none overflow-hidden">
      <div className="aurora-field aurora-field-primary" />
      <div className="aurora-field aurora-field-secondary" />
      <div className="aurora-field aurora-field-depth" />
      {variant === "full" && (
        <>
          <div className="atmospheric-contour atmospheric-contour-one" />
          <div className="atmospheric-contour atmospheric-contour-two" />
        </>
      )}
      <div className="atmospheric-grain" />
    </div>
  );
}

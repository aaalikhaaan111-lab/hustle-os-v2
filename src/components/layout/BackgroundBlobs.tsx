// App-wide aurora atmosphere: a few large, very soft indigo/teal gradients that
// give the dark canvas a sense of place without ever competing with content.
// The slow drift respects prefers-reduced-motion (handled globally).
export function BackgroundBlobs() {
  return (
    <div aria-hidden className="midnight-environment pointer-events-none fixed inset-0 z-0 select-none overflow-hidden">
      <div className="aurora-field aurora-field-primary" />
      <div className="aurora-field aurora-field-secondary" />
      <div className="aurora-field aurora-field-depth" />
      <div className="atmospheric-contour atmospheric-contour-one" />
      <div className="atmospheric-contour atmospheric-contour-two" />
      <div className="atmospheric-grain" />
    </div>
  );
}

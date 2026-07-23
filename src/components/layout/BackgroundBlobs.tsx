// App-wide atmosphere. In the light-neutral system this is deliberately almost
// nothing: a single fixed layer carrying a barely-there tonal gradient (defined
// on `.midnight-environment` in globals.css). No orbital lines, drifting blobs,
// or grain — the calm canvas is the point, and the UI is the focus.
export function BackgroundBlobs() {
  return <div aria-hidden className="midnight-environment pointer-events-none fixed inset-0 -z-10" />;
}

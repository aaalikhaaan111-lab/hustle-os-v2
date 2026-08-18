/**
 * The stored picture of a generated project.
 *
 * WHAT THIS IS AND IS NOT. It is a screenshot of the project actually running,
 * taken once by the worker from the same document the published page serves,
 * and stored. It is not a drawing, not a frame running the app in the card, and
 * not metadata arranged to look like a page.
 *
 * A PLAIN `<img>` ON PURPOSE. `next/image` would need the Supabase storage host
 * in `images.remotePatterns` and would put an optimiser in front of a file that
 * is already exactly the size it is displayed at — 1280x800 for a 16:10 card.
 * There is nothing for it to do here except add a hop.
 *
 * The capture is the card's aspect ratio exactly, so `cover` crops nothing; it
 * is there so a future capture size cannot letterbox the card. `object-position:
 * top` means that if one ever does crop, it keeps the top of the page, which is
 * the part that identifies a project.
 */
export function ProjectShot({ src, name }: { src: string; name: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={name}
      width={1280}
      height={800}
      loading="lazy"
      decoding="async"
      className="block h-full w-full object-cover object-top"
    />
  );
}

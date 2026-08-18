"use client";

import type React from "react";
import { useEffect, useRef, useState } from "react";
import { SANDBOX_ATTRIBUTE } from "@/lib/v2/app/sandbox";
import { withLiveNonce } from "@/lib/workspace/previewNonce";

/**
 * A published project's card, showing the project.
 *
 * WHY THIS IS THE ONLY HONEST THUMBNAIL AVAILABLE. A generated application is
 * source, not a picture: the only way to see what it looks like is to run it.
 * Everything short of that — a headline over a palette, a mock hero — is a
 * drawing of a project rather than the project, which is exactly what was
 * asked not to be shipped.
 *
 * So this runs the real thing, in the same sandbox the workspace uses:
 * `srcdoc`, `allow-scripts allow-forms`, and never `allow-same-origin`. The
 * document comes from the route `/p/[slug]/app-document`, which already exists
 * to serve exactly these bytes to the public page.
 *
 * IT COSTS NOTHING UNTIL IT IS SEEN. Building that document runs the compiler,
 * so a gallery that fetched eagerly would build every published project on
 * every page load. An IntersectionObserver holds each frame until its card is
 * actually near the viewport, and each card fetches once.
 *
 * ONLY PUBLISHED PROJECTS. An unpublished one has no such route, and inventing
 * one would mean building arbitrary drafts on demand from a gallery — a
 * different and much heavier decision than this component is allowed to make.
 * Those keep the plain label, which is the truthful thing to show.
 *
 * The frame is inert: `pointer-events: none`, not focusable, and scaled down
 * so a desktop-width layout reads as a thumbnail rather than a cropped corner.
 */
export function LiveThumb({
  slug,
  label,
  fallback,
}: {
  slug: string;
  label: string;
  /** Shown until the frame is ready, and instead of it if it never is. */
  fallback: React.ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [document_, setDocument] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || document_ || failed) return;

    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        observer.disconnect();
        fetch(`/p/${encodeURIComponent(slug)}/app-document`)
          .then((response) => (response.ok ? response.text() : Promise.reject(new Error("unavailable"))))
          .then((text) => {
            // The document was built for its own request; the page runs under a
            // different nonce and would refuse the scripts otherwise.
            if (!cancelled) setDocument(withLiveNonce(text));
          })
          .catch(() => {
            // A project that will not build is not an error the gallery should
            // report; it simply shows the label it would have shown anyway.
            if (!cancelled) setFailed(true);
          });
      },
      { rootMargin: "200px" },
    );
    observer.observe(host);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [slug, document_, failed]);

  return (
    <span ref={hostRef} className="s-livethumb" aria-label={label} role="img">
      {(!document_ || failed) && <span className="s-livethumb-fallback">{fallback}</span>}
      {document_ && !failed && (
        <iframe
          title={label}
          srcDoc={document_}
          sandbox={SANDBOX_ATTRIBUTE}
          tabIndex={-1}
          aria-hidden
          loading="lazy"
        />
      )}
    </span>
  );
}

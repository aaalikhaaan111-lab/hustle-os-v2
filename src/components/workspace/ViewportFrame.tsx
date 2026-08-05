"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders the preview inside a real nested browsing context.
 *
 * THE BUG THIS EXISTS TO FIX. The device switcher used to set `maxWidth: 390`
 * on a div in the workspace document. That narrows the box and nothing else:
 * `vw` units and `@media` queries are answered by the *browser* viewport, which
 * is still 1440 wide. So picking "phone" gave the generated site its desktop
 * stylesheet inside a 390px column — multi-column grids never collapsed,
 * `clamp(2.75rem, 7vw, …)` stayed at desktop size, and headings shredded into
 * one or two letters per line. The preview was lying about what a phone shows.
 *
 * An iframe is the fix because it *is* a viewport. Media queries inside it
 * resolve against the frame's own width, so 390 means 390. Nothing else does
 * this — container queries would require rewriting the generated stylesheet,
 * and transform-scaling a wide render only shrinks pixels, it does not change
 * which breakpoint applies.
 *
 * The children are portalled rather than serialised, so the preview keeps its
 * React identity: forms stay interactive, edits re-render in place, and there
 * is no HTML round-trip to keep in sync.
 *
 * When the panel is narrower than the selected width, the frame is scaled down
 * rather than narrowed. Narrowing would make the frame's viewport the panel's
 * width, so "desktop" in a half-width panel would quietly stop meaning 1280 —
 * the same class of lie this component exists to remove. Scaling keeps the
 * layout viewport at the selected width and only shrinks the pixels, which is
 * what a device toolbar does.
 */

interface ViewportFrameProps {
  /** CSS pixels the document inside should believe it has. */
  width: number;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title: string;
}

export function ViewportFrame({ width, children, className, style, title }: ViewportFrameProps) {
  const frameRef = useRef<HTMLIFrameElement | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const [body, setBody] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(640);
  const [available, setAvailable] = useState(0);

  // Adopt the parent's styles into the frame, then expose its body as the
  // portal target. Same-origin (`about:blank`), so this is all direct DOM.
  useEffect(() => {
    const frame = frameRef.current;
    const doc = frame?.contentDocument;
    if (!doc) return;

    doc.documentElement.style.height = "auto";
    doc.body.style.margin = "0";
    doc.body.style.background = "transparent";

    // The generated site is styled by the app's own stylesheets. Copying the
    // nodes is what makes the frame render identically to the inline version —
    // minus the wrong viewport.
    const head = doc.head;
    for (const node of Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))) {
      head.appendChild(node.cloneNode(true));
    }

    // A phone frame must report a phone viewport to the document inside it,
    // including for `vw` and `dvh`.
    const meta = doc.createElement("meta");
    meta.name = "viewport";
    meta.content = "width=device-width, initial-scale=1";
    head.appendChild(meta);

    setBody(doc.body);
  }, []);

  // The frame has no intrinsic height, so it is measured from its content and
  // grows with it — the preview scrolls in the workspace, not inside the frame.
  useEffect(() => {
    if (!body) return;
    const measure = () => {
      const next = Math.max(
        body.scrollHeight,
        body.ownerDocument.documentElement.scrollHeight,
      );
      if (next > 0) setHeight(next);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(body);
    // Late webfonts and images change height after the first measure.
    const timer = setInterval(measure, 400);
    const stop = setTimeout(() => clearInterval(timer), 4000);
    return () => {
      observer.disconnect();
      clearInterval(timer);
      clearTimeout(stop);
    };
  }, [body, width]);

  // How much room the panel gives us, measured rather than assumed, so the
  // frame reacts to the chat pane opening and to entering/leaving fullscreen.
  //
  // The measured parent must NOT be content-sized. A `w-fit` parent takes its
  // width from this shell, so shrinking the shell shrinks the parent, which
  // reports less room, which shrinks the shell again — the scale latches at its
  // smallest value and never recovers when the panel grows back. The parent is
  // therefore a full-width centering container, whose width is independent of
  // what it contains.
  useEffect(() => {
    const container = shellRef.current?.parentElement;
    if (!container) return;
    const measure = () => setAvailable(container.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Only ever scale down. Blowing a 390px phone render up to fill a wide panel
  // would misrepresent it just as badly in the other direction.
  const scale = available > 0 && available < width ? available / width : 1;

  return (
    // The shell occupies the scaled footprint. Without it the unscaled frame
    // would still claim its full width and height for layout, leaving a large
    // empty gap under and beside the preview.
    <div
      ref={shellRef}
      className={className}
      style={{
        ...style,
        width: width * scale,
        height: height * scale,
        overflow: "hidden",
        // Content-box so a caller's border sits outside the scaled viewport
        // instead of eating pixels off its right and bottom edges.
        boxSizing: "content-box",
        // The centring container is a flex container, and a flex item shrinks
        // below its width by default. That would crop the scaled frame while
        // leaving the scale untouched, so the preview would silently lose its
        // right edge instead of fitting.
        flexShrink: 0,
      }}
    >
      <iframe
        ref={frameRef}
        title={title}
        // `width` is the point of the component: it is the viewport the document
        // inside gets, not a max-width applied to a div in this document. It
        // stays at the selected width at every scale.
        style={{
          width,
          height,
          border: 0,
          display: "block",
          transform: scale === 1 ? undefined : `scale(${scale})`,
          transformOrigin: "0 0",
        }}
        // No sandbox: this is Ventrio's own React tree portalled into a
        // same-origin frame, and an opaque origin would break both the portal
        // and the style adoption above. It would also break this transform —
        // Chrome will not rasterise an out-of-process frame under `scale()`.
      >
        {body ? createPortal(children, body) : null}
      </iframe>
    </div>
  );
}

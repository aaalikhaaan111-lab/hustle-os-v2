/**
 * A published application, for a visitor.
 *
 * Deliberately not `AppPreview`. That component is a *workspace* frame: it
 * listens for runtime errors from the app so the owner can act on them, and it
 * is sized to a device toggle. A visitor has neither concern — they came to use
 * the thing — so this renders the same sandboxed document at full bleed and
 * listens for nothing.
 *
 * The security posture is identical and non-negotiable: `SANDBOX_ATTRIBUTE` is
 * `allow-scripts allow-forms` and never `allow-same-origin`, which is what
 * keeps the frame on an opaque origin with no route back to Ventrio's. The
 * document is `srcDoc`, so it never becomes a fetchable address of its own.
 *
 * A server component on purpose. There is no state here, and a visitor should
 * not download a client bundle to look at a page.
 */

import { SANDBOX_ATTRIBUTE } from "@/lib/v2/app/sandbox";

export interface PublicAppViewProps {
  title: string;
  document: string;
}

export function PublicAppView({ title, document }: PublicAppViewProps) {
  return (
    <iframe
      title={title}
      srcDoc={document}
      sandbox={SANDBOX_ATTRIBUTE}
      // The app owns the whole viewport; Ventrio adds no frame around it.
      className="public-app-frame"
      style={{ display: "block", width: "100%", height: "100dvh", border: "0" }}
    />
  );
}

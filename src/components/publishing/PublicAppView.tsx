/**
 * A published application, for a visitor.
 *
 * THE DOCUMENT IS NOT IN THIS TREE, and that is the whole point of the shape.
 *
 * It used to be passed down as a prop and rendered as `srcdoc`. React Server
 * Components serialise the entire server tree as flight data alongside the
 * HTML, so a 2.4 MB document became 5.6 MB of markup — the same bytes twice —
 * parsed in one go, on a route that is dynamic and pays it every visit. Desktop
 * absorbed it. A real iPhone did not: "Starting the app…" forever, then WebKit's
 * "This page couldn't load", which is an out-of-memory kill. The same app
 * rendered fine in the workspace on the same phone, where the preview sits
 * behind a toggle and the frame is never server-rendered.
 *
 * Moving the iframe from a client component to this one did not help, because
 * flight data carries the server tree too. The only way to send the document
 * once is to send it separately, which `./p/[slug]/app-document` now does. This
 * page is ~60 kB.
 *
 * The frame is rendered here without a source; `PublicAppMonitor` fetches the
 * document, re-stamps its nonce to the one this page runs under, and sets
 * `srcDoc`. The security posture is unchanged: `allow-scripts allow-forms`,
 * never `allow-same-origin`, an opaque origin, and a document that still never
 * becomes a loadable page — see the route for why `text/plain` and `nosniff`
 * are what preserve that.
 */

import { getTranslations } from "next-intl/server";
import { SANDBOX_ATTRIBUTE } from "@/lib/v2/app/sandbox";
import { PublicAppMonitor } from "@/components/publishing/PublicAppMonitor";

export interface PublicAppViewProps {
  title: string;
  /** The publication this belongs to; the document is fetched from its route. */
  slug: string;
  /** The publication's own locale, so a visitor reads the owner's language. */
  locale: string;
}

const FRAME_ID = "ventrio-app-frame";

export async function PublicAppView({ title, slug, locale }: PublicAppViewProps) {
  const t = await getTranslations({ locale, namespace: "publishing" });

  return (
    <div style={{ position: "relative", width: "100%", height: "100dvh" }}>
      <iframe
        id={FRAME_ID}
        title={title}
        sandbox={SANDBOX_ATTRIBUTE}
        // The app owns the whole viewport; Ventrio adds no frame around it.
        className="public-app-frame"
        style={{ display: "block", width: "100%", height: "100dvh", border: "0" }}
      />

      {/*
        The last-resort message, and the only one that survives a page whose
        JavaScript never runs.

        `PublicAppMonitor` reports every failure it can observe, but it has to
        hydrate first — and the failure this exists for is one where the renderer
        is already in trouble, which is exactly when hydration may not happen.
        This is server-rendered, hidden, and revealed by a CSS animation after
        the monitor's own deadline. No JavaScript participates, so it cannot be
        starved by the thing it reports on; the monitor sets
        `data-ventrio-host="alive"` on mount, which cancels it.
      */}
      <div data-testid="public-app-nojs" className="ventrio-boot-fallback" role="alert">
        <p className="ventrio-boot-fallback__title">{t("appStalledTitle")}</p>
        <p className="ventrio-boot-fallback__body">{t("appStalledBody")}</p>
        <a className="ventrio-boot-fallback__action" href="">{t("appReload")}</a>
      </div>

      <PublicAppMonitor
        frameId={FRAME_ID}
        documentUrl={`/p/${encodeURIComponent(slug)}/app-document`}
        labels={{
          loading: t("appLoading"),
          appFailedTitle: t("appFailedTitle"),
          appFailedBody: t("appFailedBody"),
          runtimeFailedTitle: t("appRuntimeFailedTitle"),
          runtimeFailedBody: t("appRuntimeFailedBody"),
          stalledTitle: t("appStalledTitle"),
          stalledBody: t("appStalledBody"),
          reload: t("appReload"),
        }}
      />
    </div>
  );
}

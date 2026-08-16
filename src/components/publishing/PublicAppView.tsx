/**
 * A published application, for a visitor.
 *
 * Deliberately not `AppPreview`. That component is a *workspace* frame: it is
 * sized to a device toggle and it surfaces every runtime error the app reports,
 * with the detail an owner needs in order to act. A visitor has neither concern
 * — they came to use the thing — so this renders the same sandboxed document at
 * full bleed and says only what a visitor can do something about.
 *
 * It does listen, though, and that is what changed. Listening for nothing meant
 * an app that failed here showed a stranger a white rectangle: no way to tell a
 * slow app from a dead one, and no reason given. The frame and its one piece of
 * state live in `PublicAppFrame`, which is a client component for that reason
 * alone; this stays responsible for the copy, resolved on the server so the
 * client carries no translation payload.
 *
 * The security posture is identical and non-negotiable: `SANDBOX_ATTRIBUTE` is
 * `allow-scripts allow-forms` and never `allow-same-origin`, which is what keeps
 * the frame on an opaque origin with no route back to Ventrio's. The document is
 * `srcDoc`, so it never becomes a fetchable address of its own.
 */

import { getTranslations } from "next-intl/server";
import { PublicAppFrame } from "@/components/publishing/PublicAppFrame";

export interface PublicAppViewProps {
  title: string;
  document: string;
  /** The publication's own locale, so a visitor reads the owner's language. */
  locale: string;
}

export async function PublicAppView({ title, document, locale }: PublicAppViewProps) {
  const t = await getTranslations({ locale, namespace: "publishing" });

  return (
    <PublicAppFrame
      title={title}
      document={document}
      labels={{
        loading: t("appLoading"),
        appFailedTitle: t("appFailedTitle"),
        appFailedBody: t("appFailedBody"),
        runtimeFailedTitle: t("appRuntimeFailedTitle"),
        runtimeFailedBody: t("appRuntimeFailedBody"),
        reload: t("appReload"),
      }}
    />
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";

/**
 * "Made with Ventrio", on published projects.
 *
 * WHERE IT LIVES, AND WHY THAT MATTERS. Ventrio's publication shell renders it,
 * outside the sandboxed frame — it is a sibling of the iframe, not content
 * inside it. Generated code has no route to it: the frame runs on an opaque
 * origin without `allow-same-origin`, so it cannot reach this DOM, and the
 * badge is not part of any string the model writes. Putting it in the generated
 * source instead would have made it a line the next generation could drop.
 *
 * Only on genuinely public published projects. The owner's workspace preview
 * renders `AppPreview`, which never mounts this, so nobody is shown a badge on
 * their own work-in-progress.
 *
 * Fixed to the bottom corner with `pointer-events` off on the wrapper, so it
 * covers a corner of the app visually and blocks nothing: taps pass through
 * everywhere except the badge itself. Safe-area padding keeps it clear of the
 * home indicator on phones.
 */
export interface BadgeLabels {
  madeWith: string;
  remove: string;
  upgradeTitle: string;
  upgradeBody: string;
  viewPricing: string;
  close: string;
}

/**
 * Labels arrive as props rather than from `useTranslations`.
 *
 * The public project route renders without `NextIntlClientProvider` — the root
 * layout drops the whole shell for it — so a hook would throw. Passing the six
 * strings the server already resolved also keeps the message bundle off a page
 * that exists to show someone else's application.
 */
export function VentrioBadge({ labels, pricingHref }: { labels: BadgeLabels; pricingHref: string }) {
  const t = (key: keyof BadgeLabels) => labels[key];
  const [prompt, setPrompt] = useState(false);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex justify-end p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pr-[max(0.75rem,env(safe-area-inset-right))]"
      data-testid="ventrio-badge"
    >
      {prompt ? (
        <div
          role="dialog"
          aria-label={t("upgradeTitle")}
          className="pointer-events-auto max-w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-black/10 bg-white/95 p-3.5 text-left shadow-[0_18px_50px_-20px_rgb(14_16_22/0.45)] backdrop-blur"
        >
          <p className="text-[13px] font-semibold leading-snug text-[#0e1016]">{t("upgradeTitle")}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#0e1016]/65">{t("upgradeBody")}</p>
          <div className="mt-3 flex items-center gap-2">
            <Link
              href={pricingHref}
              className="rounded-lg bg-[#0e1016] px-3 py-1.5 text-[12.5px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              {t("viewPricing")}
            </Link>
            <button
              type="button"
              onClick={() => setPrompt(false)}
              className="rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium text-[#0e1016]/60 transition-colors hover:text-[#0e1016]"
            >
              {t("close")}
            </button>
          </div>
        </div>
      ) : (
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-black/10 bg-white/90 py-1 pl-2.5 pr-1 shadow-[0_10px_30px_-14px_rgb(14_16_22/0.5)] backdrop-blur">
          <Link
            href="/"
            target="_blank"
            rel="noreferrer noopener"
            className="text-[12px] font-medium tracking-[-0.005em] text-[#0e1016]/70 transition-colors hover:text-[#0e1016]"
          >
            {t("madeWith")}
          </Link>
          {/*
            The close control does not close anything on a free project. It is
            the upgrade path, and saying so plainly beats a dismissal that
            silently comes back on the next page load.
          */}
          <button
            type="button"
            aria-label={t("remove")}
            title={t("remove")}
            onClick={() => setPrompt(true)}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[#0e1016]/40 transition-colors hover:bg-black/5 hover:text-[#0e1016]/70"
          >
            <svg viewBox="0 0 16 16" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}

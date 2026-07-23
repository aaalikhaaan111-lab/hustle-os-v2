import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ReactNode } from "react";

// Shared frame for the lightweight static pages (About / Who it's for / FAQ).
// Calm, spacious, product-first: a centered column on the light canvas.
export async function InfoLayout({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) {
  const t = await getTranslations("info");
  return (
    <div className="mx-auto w-full max-w-2xl px-5 pb-24 pt-[max(4.5rem,calc(env(safe-area-inset-top)+4rem))] sm:px-8">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-muted transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <span aria-hidden>←</span>
        {t("backHome")}
      </Link>
      <p className="mt-10 text-[11px] font-semibold uppercase tracking-[0.2em] text-accent">{eyebrow}</p>
      <h1 className="mt-3 text-[clamp(2rem,5vw,3rem)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink text-balance">
        {title}
      </h1>
      <div className="mt-8">{children}</div>
      <div className="mt-14 border-t border-border pt-8">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-[14px] font-semibold text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          {t("cta")}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}

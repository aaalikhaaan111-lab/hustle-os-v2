import Link from "next/link";
import Image from "next/image";
import { getTranslations } from "next-intl/server";
import { PLANS, type PlanId } from "@/lib/billing/plans";
import { LandingComposer } from "@/components/landing/LandingComposer";
import { CardDeck } from "@/components/landing/LandingParts";
import { Chip } from "@/components/public/PublicHeader";
import { Faq } from "@/components/public/Faq";
import { AfterStage } from "@/components/landing/AfterStage";

/**
 * The public landing page.
 *
 * WHAT IT REPLACES. A near-black page with a blue glow, a headline about ideas,
 * and a composer — a different product from the warm-neutral application behind
 * it, and a promise ("turn an idea into a first version") that stopped at the
 * moment Ventrio's actual value begins.
 *
 * The positioning is the conversation that continues after launch. The page is
 * therefore built around the loop rather than around generation: create,
 * publish, talk, change, learn.
 *
 * WHAT IS AND IS NOT CLAIMED. There are no customers, no testimonials, no
 * usage numbers, no logo wall and no integrations on this page, because Ventrio
 * has none of those to show. The one forward-looking section — messengers — is
 * labelled "coming" and says in its own copy that it is not available yet. The
 * prices and limits are read from `PLANS`, the same object the quota resolver
 * enforces against, so the page cannot advertise a limit the product does not
 * apply.
 */
export async function Landing({ isAuthenticated }: { isAuthenticated: boolean }) {
  const t = await getTranslations("landing");
  const tp = await getTranslations("pricing");

  const start = isAuthenticated ? "/create?fresh=1" : "/signup?next=%2Fcreate";

  const loop = [1, 2, 3, 4, 5].map((n) => ({
    n,
    title: t(`loop${n}` as never),
    body: t(`loop${n}Body` as never),
  }));

  const why = [1, 2, 3, 4].map((n) => ({
    n,
    title: t(`why${n}` as never),
    body: t(`why${n}Body` as never),
  }));

  /* Each action drives one state of the stage beside it. */
  const afterIds = ["words", "device", "feedback", "anywhere"] as const;
  const after = afterIds.map((id, index) => ({
    id,
    title: t(`after${index + 1}` as never),
    body: t(`after${index + 1}Body` as never),
  }));

  const faq = [1, 2, 3, 4, 5, 6].map((n) => ({
    q: t(`faq${n}` as never),
    a: t(`faq${n}Body` as never),
  }));

  const PRICE: Record<PlanId, string> = { free: "$0", pro: "$19", studio: "$49" };
  const plans: PlanId[] = ["free", "pro", "studio"];

  return (
    <>
      {/* ── hero ─────────────────────────────────────────────────────────── */}
      <section className="lp-wrap">
        <div className="lp-hero-canvas">
          <p className="lp-eyebrow">{t("heroEyebrow")}</p>
          <h1 className="lp-h1">
            {t("heroTitle")} <em>{t("heroTitleEm")}</em>
          </h1>
          <p className="lp-lede">{t("heroLede")}</p>

          <div className="lp-hero-actions">
            {/* The real entry point, unchanged: it writes the seed and routes
                into /create, or through signup first. */}
            <LandingComposer isAuthenticated={isAuthenticated} variant="hero" textareaId="lp-hero-composer" />
            <p className="lp-hero-note">{t("heroNote")}</p>
          </div>
        </div>
      </section>

      {/* ── the loop ─────────────────────────────────────────────────────── */}
      <section id="how" className="lp-wrap lp-section">
        <div className="lp-head">
            <div>
              <p className="lp-eyebrow">{t("loopEyebrow")}</p>
              <h2 className="lp-h2">
                {t("loopTitle")} <em>{t("loopTitleEm")}</em>
              </h2>
            </div>
            <p>{t("loopLede")}</p>
          </div>

        <div className="lp-loop">
          {loop.map((step) => (
            <div key={step.n} className="lp-loop-step">
              <span className="lp-loop-n">{String(step.n).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── why it is different ──────────────────────────────────────────── */}
      <section className="lp-wrap lp-section">
        <div className="lp-head">
            <div>
              <p className="lp-eyebrow">{t("whyEyebrow")}</p>
              <h2 className="lp-h2">
                {t("whyTitle")} <em>{t("whyTitleEm")}</em>
              </h2>
            </div>
            <p>{t("whyLede")}</p>
          </div>

        <CardDeck cards={why} />
      </section>

      {/* ── after launch: list + a real conversation ─────────────────────── */}
      <section id="after" className="lp-wrap lp-section">
        <div className="lp-head">
            <div>
              <p className="lp-eyebrow">{t("afterEyebrow")}</p>
              <h2 className="lp-h2">
                {t("afterTitle")} <em>{t("afterTitleEm")}</em>
              </h2>
            </div>
            <p>{t("afterLede")}</p>
          </div>

        <AfterStage items={after} />

      </section>

      {/* ── messengers, honestly labelled ────────────────────────────────── */}
      <section className="lp-wrap lp-section">
        <div className="lp-head">
            <div>
              <p className="lp-eyebrow">{t("chatEyebrow")}</p>
              <h2 className="lp-h2">
                {t("chatTitle")} <em>{t("chatTitleEm")}</em>
              </h2>
            </div>
            <p>{t("chatLede")}</p>
          </div>

        {/* The section carried no picture at all, which left the one
            forward-looking claim on the page as bare prose. The asset shows the
            change being asked for in a message and landing in the live product,
            and carries its own "Coming soon" — the copy above says the same
            thing, so the two agree. */}
        <figure className="lp-shot">
          <Image
            src="/landing-images/landing-messenger.png"
            alt={t("chatTitle")}
            width={1312}
            height={816}
            sizes="(max-width: 767px) calc(100vw - 2.5rem), (max-width: 1199px) calc(100vw - 4rem), 1120px"
            className="lp-shot-img"
            loading="lazy"
          />
        </figure>
      </section>

      {/* ── pricing, from the real entitlements ──────────────────────────── */}
      <section id="pricing" className="lp-wrap lp-section">
        <div className="lp-head">
            <div>
              <p className="lp-eyebrow">{t("priceEyebrow")}</p>
              <h2 className="lp-h2">
                {t("priceTitle")} <em>{t("priceTitleEm")}</em>
              </h2>
            </div>
            <p>{t("priceLede")}</p>
          </div>

        <div className="lp-plans">
          {plans.map((plan) => (
            <article key={plan} className="lp-plan" data-recommended={plan === "pro" ? "true" : undefined}>
                <p className="lp-plan-name">
                  {tp(`${plan}Name` as never)}
                  {plan === "pro" && <span className="lp-plan-tag">{tp("mostPeople")}</span>}
                </p>
                <p className="lp-plan-price">
                  {PRICE[plan]}
                  {plan !== "free" && <span className="lp-plan-per"> {tp("perMonth")}</span>}
                </p>
                <p className="lp-plan-line">{tp(`${plan}Tagline` as never)}</p>
                <ul>
                  <li>{tp("featureGenerations", { count: PLANS[plan].generationsPerMonth })}</li>
                  <li>
                    {PLANS[plan].maxPublishedProjects === null
                      ? tp("featurePublishMany")
                      : tp("featurePublishOne")}
                  </li>
                  <li>{PLANS[plan].canRemoveBranding ? tp("featureBrandingOff") : tp("featureBrandingOn")}</li>
                  <li>{tp("featureSubdomain")}</li>
                </ul>
                <div className="lp-plan-cta">
                  <Chip href={start} label={t("ctaStart")} />
                </div>
              </article>
          ))}
        </div>

        <p className="mt-8 text-[13px]" style={{ color: "var(--muted-foreground)" }}>
            <Link href="/pricing" className="underline underline-offset-4">
              {t("priceSee")}
            </Link>
          </p>
      </section>

      {/* ── questions ───────────────────────────────────────────────────── */}
      <section id="faq" className="lp-wrap lp-section">
        <div className="lp-head">
            <div>
              <p className="lp-eyebrow">{t("faqEyebrow")}</p>
              <h2 className="lp-h2">
                {t("faqTitle")} <em>{t("faqTitleEm")}</em>
              </h2>
            </div>
          </div>

        <Faq items={faq} />
      </section>

      {/* ── closing ─────────────────────────────────────────────────────── */}
      <section className="lp-wrap lp-section">
        <div className="lp-closing">
            <h2 className="lp-h2">{t("closeTitle")}</h2>
            <p className="lp-lede">{t("closeLede")}</p>
            <div className="lp-hero-actions">
              <LandingComposer isAuthenticated={isAuthenticated} variant="final" textareaId="lp-final-composer" />
              <p className="lp-hero-note">{t("heroNote")}</p>
            </div>
          </div>
      </section>

    </>
  );
}

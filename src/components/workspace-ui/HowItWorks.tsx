"use client";

import { useTranslations } from "next-intl";

const STEPS = ["stepDescribe", "stepTalk", "stepSee", "stepImprove", "stepPublish"] as const;

/**
 * The five steps, in plain language.
 *
 * WHY THIS EXISTS. Ventrio's own screens never said what Ventrio does. Someone
 * who has never written code opened it to a text field and an instruction to
 * describe something, with no way to know whether that produced a document, a
 * design, an app, or an invoice — and no idea what happened after. Every empty
 * state assumed the person already understood the product.
 *
 * Five words, once, wherever there is nothing else on the screen yet:
 *
 *   Describe it → Talk it through → See it → Improve it → Put it online
 *
 * Deliberately not a wizard, a progress bar or a checklist. It is not tracking
 * anything and it does not claim to know where you are; it is a sentence about
 * what the product is, set as five short pieces so it can be read at a glance.
 * It is absent from every screen where the person is already doing the thing.
 */
export function HowItWorks({ className = "" }: { className?: string }) {
  const t = useTranslations("workspace");

  return (
    <ol className={`s-steps ${className}`} aria-label={t("stepsLabel")}>
      {STEPS.map((key, index) => (
        <li key={key} className="s-step">
          <span className="s-step-num" aria-hidden>
            {index + 1}
          </span>
          {t(key)}
          {index < STEPS.length - 1 && (
            <span className="s-step-sep ml-1 hidden sm:inline" aria-hidden>
              →
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}

"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { LogoutButton } from "@/components/profile/LogoutButton";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PageBody } from "@/components/workspace-ui/PageBody";
import {
  IconAnalytics,
  IconGlobe,
  IconMoon,
  IconPalette,
  IconSettings,
  IconShield,
  IconUser,
} from "@/components/workspace-ui/parts";
import { VentrioButton, VentrioLinkButton } from "@/components/ui/VentrioButton";
import { Progress } from "@/components/ui/shadcn/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/shadcn/card";
import type { WorkspaceUsage } from "@/lib/workspace/usage";

export type SettingsSection =
  | "profile" | "usage" | "appearance" | "language" | "privacy" | "account";
type Section = SettingsSection;

/**
 * Settings as one product: sections on the left, the selected one on the right.
 *
 * WHAT CHANGED, AND WHY. The right column was a hairline rule and then loose
 * content — a label, a value, a form control — floating in a 1080px field. At
 * that width a display name input ran most of the screen and the page read as
 * unstyled markup rather than a screen. Each section is a Card now, on a
 * reading column that stops at 640px: the same containment every other surface
 * in the product uses, and a measure a form can actually be read at.
 *
 * The section list is sticky on desktop so it stays put while a long section
 * scrolls, and on a phone it is a scrolling row that ends with real padding —
 * the last item used to be clipped by the viewport edge with nothing to
 * indicate more.
 *
 * Every control here is wired to something that already works — the display
 * name form, the language switcher, logout, the legal routes and the existing
 * account-deletion flow. Appearance is the exception, and it says so plainly
 * rather than offering a theme selector that would change nothing.
 */
export function SettingsClient({
  initialSection,
  email,
  displayName,
  usage,
  embedded = false,
}: {
  initialSection: Section;
  email: string;
  displayName: string;
  usage: WorkspaceUsage;
  /**
   * Rendered inside the overlay rather than as the /settings route.
   *
   * The only difference is the frame: the dialog supplies its own padding and
   * scroll container, so the page shell's wide measure and tall top margin
   * would double up inside it. Everything below this line is identical, which
   * is the point — one settings implementation, two places to meet it.
   */
  embedded?: boolean;
}) {
  const t = useTranslations("workspace");
  const tFooter = useTranslations("footer");
  const tProfile = useTranslations("profile");
  const [section, setSection] = useState<Section>(initialSection);

  const sections: { id: Section; label: string; Icon: (p: { className?: string }) => ReactNode }[] = [
    { id: "profile", label: t("settingsProfile"), Icon: IconUser },
    { id: "usage", label: t("usage"), Icon: IconAnalytics },
    { id: "appearance", label: t("settingsAppearance"), Icon: IconPalette },
    { id: "language", label: t("settingsLanguage"), Icon: IconGlobe },
    { id: "privacy", label: t("settingsPrivacy"), Icon: IconShield },
    { id: "account", label: t("settingsAccount"), Icon: IconSettings },
  ];

  const initials = (displayName || email || "?").slice(0, 2).toUpperCase();

  const body = (
    <>
      <h1 className={embedded ? "s-title" : "s-display"}>{t("settingsTitle")}</h1>

      <div className="mt-8 flex flex-col gap-8 md:flex-row md:gap-12">
        {/* A list on desktop, a compact scrollable selector on small screens.
            `-mx-5 px-5` lets the row bleed to the screen edge while keeping a
            gutter at both ends, so the last section is never half-cut. */}
        <nav
          aria-label={t("settingsTitle")}
          className={`flex shrink-0 gap-1 overflow-x-auto pb-1 [scrollbar-width:none] md:sticky md:top-0 md:mx-0 md:h-fit md:w-52 md:flex-col md:overflow-visible md:px-0 md:pb-0 ${
            /* Bleed to whichever edge this is mounted against, so the last
               section is never half-cut by the container's own padding. */
            embedded ? "-mx-6 px-6 md:-mx-0 md:px-0" : "-mx-5 px-5 md:px-0"
          }`}
        >
          {sections.map((item) => {
            const active = section === item.id;
            return (
              <VentrioButton
                key={item.id}
                variant="ghost"
                size="md"
                on={active}
                aria-current={active ? "true" : undefined}
                onClick={() => setSection(item.id)}
                align="start" weight="medium" className="md:w-full"
              >
                <item.Icon className="h-[17px] w-[17px] shrink-0" />
                {item.label}
              </VentrioButton>
            );
          })}
        </nav>

        {/* 640px: a form is read one line at a time, and a name field that
            runs 900px wide looks like a mistake rather than a field. */}
        <div key={section} className="ws-page min-w-0 flex-1 md:max-w-[640px]">
          {section === "profile" && (
            <Panel title={t("settingsProfile")} description={t("settingsProfileBody")}>
              {/* The identity block sits on the card's own sunken surface so it
                  reads as "who this is" rather than as the first form row. */}
              <div className="flex items-center gap-4 rounded-[var(--r-md)] bg-muted/60 p-4">
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full text-[16px] font-semibold"
                  style={{ background: "var(--color-accent-soft)", color: "var(--color-accent)" }}
                  aria-hidden
                >
                  {initials}
                </span>
                {/* Name only. The form below already shows the signed-in
                    address as its own row, and printing it twice sixty pixels
                    apart reads as a mistake rather than as emphasis. */}
                <span className="min-w-0 truncate text-[15px] font-medium">
                  {displayName || email.split("@")[0]}
                </span>
              </div>
              <div className="mt-6">
                <ProfileForm email={email} displayName={displayName} />
              </div>
            </Panel>
          )}

          {section === "usage" && (
            <Panel title={t("usage")} description={t("usageNote")}>
              <ul className="flex flex-col gap-5">
                {[
                  { label: t("usageChanges"), counter: usage.aiChanges },
                  { label: t("usageBuilds"), counter: usage.projectBuilds },
                  { label: t("usageEvolution"), counter: usage.evolutionCredits },
                ].map(({ label, counter }) => (
                  <li key={label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px]" style={{ color: "var(--color-ink-secondary)" }}>
                        {label}
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--color-ink-muted)" }}>
                        {counter.available ? `${counter.used}/${counter.limit}` : t("usageUnavailable")}
                      </span>
                    </div>
                    {/* A real ratio — what you have used out of what you have —
                        so it is a real meter rather than an invented one. The
                        hand-rolled two-div bar it replaces carried no ARIA at
                        all; Progress reports its value to a screen reader. */}
                    {counter.available && (
                      <Progress
                        className="mt-2 h-1.5"
                        value={Math.min(100, (counter.used / Math.max(1, counter.limit)) * 100)}
                        aria-label={label}
                      />
                    )}
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {section === "appearance" && (
            <Panel title={t("settingsAppearance")} description={t("settingsAppearanceBody")}>
              {/* Both themes are listed so the section reads as complete, but the
                  one that does not exist yet is disabled and says why. */}
              <div className="flex flex-col gap-1.5" role="radiogroup" aria-label={t("settingsAppearance")}>
                <VentrioButton
                  variant="secondary"
                  size="lg"
                  on
                  role="radio"
                  aria-checked
                  align="start" weight="medium" className="w-full px-3.5"
                >
                  <IconPalette className="h-[17px] w-[17px] shrink-0" />
                  {t("settingsAppearanceLight")}
                  <span className="ml-auto text-[13px] font-normal" style={{ color: "var(--color-ink-muted)" }}>
                    {tProfile("languageInUse")}
                  </span>
                </VentrioButton>
                <VentrioButton
                  variant="secondary"
                  size="lg"
                  disabled
                  role="radio"
                  aria-checked={false}
                  align="start" weight="medium" className="w-full px-3.5"
                >
                  <IconMoon className="h-[17px] w-[17px] shrink-0" />
                  {t("settingsAppearanceDark")}
                  <span className="ml-auto text-[13px] font-normal" style={{ color: "var(--color-ink-muted)" }}>
                    {t("settingsAppearanceSoon")}
                  </span>
                </VentrioButton>
                <VentrioButton
                  variant="secondary"
                  size="lg"
                  disabled
                  role="radio"
                  aria-checked={false}
                  align="start"
                  weight="medium"
                  className="w-full px-3.5"
                >
                  <IconSettings className="h-[17px] w-[17px] shrink-0" />
                  {t("settingsAppearanceSystem")}
                  <span className="ml-auto text-[13px] font-normal" style={{ color: "var(--color-ink-muted)" }}>
                    {t("settingsAppearanceSoon")}
                  </span>
                </VentrioButton>
              </div>
            </Panel>
          )}

          {section === "language" && (
            <Panel
              title={t("settingsLanguage")}
              description={`${t("settingsLanguageBody")} ${t("settingsLanguageImmediate")}`}
            >
              {/* The same switcher the landing footer uses, in its light list
                  presentation — one implementation of changing locale. */}
              <LanguageSwitcher variant="list" />
            </Panel>
          )}

          {section === "privacy" && (
            <Panel title={t("settingsPrivacy")} description={t("settingsLegalNote")}>
              <div className="-mx-2 flex flex-col">
                {[
                  { href: "/privacy", label: tFooter("privacy") },
                  { href: "/terms", label: tFooter("terms") },
                  { href: "/cookies", label: tFooter("cookies") },
                  { href: "/contact", label: tFooter("contact") },
                ].map((item) => (
                  <VentrioLinkButton
                    key={item.href}
                    href={item.href}
                    variant="ghost"
                    size="lg"
                    weight="normal" style={{ justifyContent: "space-between" }} className="px-2"
                  >
                    {item.label}
                    <span aria-hidden style={{ color: "var(--color-ink-muted)" }}>
                      ↗
                    </span>
                  </VentrioLinkButton>
                ))}
              </div>
            </Panel>
          )}

          {section === "account" && (
            <Panel title={t("settingsAccount")} description={t("settingsAccountBody")}>
              <div className="flex items-center justify-between gap-4 rounded-[var(--r-md)] bg-muted/60 px-4 py-3 text-[14px]">
                <span className="shrink-0 text-muted-foreground">{t("settingsEmail")}</span>
                <span className="min-w-0 truncate font-medium">{email}</span>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <LogoutButton />
                {/* Real destination — the existing deletion flow with its own
                    confirmation. Nothing is deleted from here. */}
                <VentrioLinkButton href="/delete-account" variant="danger" size="md">
                  {t("settingsDeleteAccount")}
                </VentrioLinkButton>
              </div>
            </Panel>
          )}
        </div>
      </div>
    </>
  );

  // The overlay owns its padding and scrolling; the route owns its column.
  // `min-h-full` so a short section still fills the fixed panel and the
  // section list does not float in the middle of an empty box.
  return embedded ? <div className="min-h-full p-6 md:p-10">{body}</div> : <PageBody>{body}</PageBody>;
}

/**
 * One card per section, so the right column reads as a single object.
 *
 * The previous version was a hairline and then bare content, on the reasoning
 * that five boxes for five lists is over-containment. That is true when the
 * sections are stacked; here only ONE is ever on screen, so the hairline had
 * nothing to separate it from and the content simply floated. A card gives the
 * selected section an edge, and the header gives it a name and a sentence —
 * which several sections previously had to state inside their own body.
 */
function Panel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <Card className="s-enter">
      <CardHeader>
        <CardTitle className="text-[17px]">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

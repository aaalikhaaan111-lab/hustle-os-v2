"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { LanguageSwitcher } from "@/components/layout/LanguageSwitcher";
import { LogoutButton } from "@/components/profile/LogoutButton";
import { ProfileForm } from "@/components/profile/ProfileForm";
import { PageBody, PageHeading } from "@/components/workspace-ui/PageBody";
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
import type { WorkspaceUsage } from "@/lib/workspace/usage";

type Section = "profile" | "usage" | "appearance" | "language" | "privacy" | "account";

/**
 * Settings as one product: sections on the left, the selected one on the right,
 * kept to a reading column with dividers instead of cards.
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
}: {
  initialSection: Section;
  email: string;
  displayName: string;
  usage: WorkspaceUsage;
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

  return (
    <PageBody>
      <PageHeading title={t("settingsTitle")} />

      <div className="mt-6 flex flex-col gap-8 md:flex-row md:gap-10">
        {/* A list on desktop, a compact scrollable selector on small screens. */}
        <nav
          aria-label={t("settingsTitle")}
          className="flex shrink-0 gap-1 overflow-x-auto pb-1 md:w-48 md:flex-col md:overflow-visible md:pb-0"
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

        <div key={section} className="ws-page min-w-0 flex-1">
          {section === "profile" && (
            <Panel>
              <div className="flex items-center gap-4">
                <span
                  className="grid h-14 w-14 shrink-0 place-items-center rounded-full text-[18px] font-semibold"
                  style={{ background: "var(--accent-soft)", color: "var(--accent-ink)" }}
                  aria-hidden
                >
                  {initials}
                </span>
                <p className="min-w-0 truncate text-[15px] font-medium">{displayName || email.split("@")[0]}</p>
              </div>
              {/* The form already shows the signed-in address; repeating it
                  beside the avatar would say the same thing twice. */}
              <div className="mt-5">
                <ProfileForm email={email} displayName={displayName} />
              </div>
            </Panel>
          )}

          {section === "usage" && (
            <Panel>
              <p className="text-[15px] font-semibold">{t("usage")}</p>
              <ul className="mt-4 flex flex-col gap-4">
                {[
                  { label: t("usageChanges"), counter: usage.aiChanges },
                  { label: t("usageBuilds"), counter: usage.projectBuilds },
                  { label: t("usageEvolution"), counter: usage.evolutionCredits },
                  { label: t("usageSessions"), counter: usage.trackedSessions },
                ].map(({ label, counter }) => (
                  <li key={label}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px]" style={{ color: "var(--ink-2)" }}>
                        {label}
                      </span>
                      <span className="text-[13px] font-semibold tabular-nums" style={{ color: "var(--ink-3)" }}>
                        {counter.available ? `${counter.used}/${counter.limit}` : t("usageUnavailable")}
                      </span>
                    </div>
                    {counter.available && (
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full" style={{ background: "var(--sunken)" }}>
                        <div
                          className="h-full rounded-full transition-[width] duration-[var(--t-layout)] ease-[var(--ease)]"
                          style={{
                            width: `${Math.min(100, (counter.used / Math.max(1, counter.limit)) * 100)}%`,
                            background: "var(--accent-grad)",
                          }}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              <p className="mt-5 text-[13px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
                {t("usageNote")}
              </p>
            </Panel>
          )}

          {section === "appearance" && (
            <Panel>
              <p className="text-[15px] font-semibold">{t("settingsAppearance")}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {t("settingsAppearanceBody")}
              </p>
              {/* Both themes are listed so the section reads as complete, but the
                  one that does not exist yet is disabled and says why. */}
              <div className="mt-4 flex flex-col gap-1.5" role="radiogroup" aria-label={t("settingsAppearance")}>
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
                  <span className="ml-auto text-[13px] font-normal" style={{ color: "var(--ink-3)" }}>
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
                  <span className="ml-auto text-[13px] font-normal" style={{ color: "var(--ink-3)" }}>
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
                  <span className="ml-auto text-[13px] font-normal" style={{ color: "var(--ink-3)" }}>
                    {t("settingsAppearanceSoon")}
                  </span>
                </VentrioButton>
              </div>
            </Panel>
          )}

          {section === "language" && (
            <Panel>
              <p className="text-[15px] font-semibold">{t("settingsLanguage")}</p>
              <p className="mt-1.5 text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {t("settingsLanguageBody")} {t("settingsLanguageImmediate")}
              </p>
              {/* The same switcher the landing footer uses, in its light list
                  presentation — one implementation of changing locale. */}
              <div className="mt-4">
                <LanguageSwitcher variant="list" />
              </div>
            </Panel>
          )}

          {section === "privacy" && (
            <Panel>
              <p className="text-[14px] leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {t("settingsLegalNote")}
              </p>
              <div className="mt-2 flex flex-col">
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
                    <span aria-hidden style={{ color: "var(--ink-3)" }}>
                      ↗
                    </span>
                  </VentrioLinkButton>
                ))}
              </div>
            </Panel>
          )}

          {section === "account" && (
            <Panel>
              <div
                className="flex h-11 items-center justify-between gap-4 border-b text-[14px]"
                style={{ borderColor: "var(--line)" }}
              >
                <span className="shrink-0" style={{ color: "var(--ink-2)" }}>
                  {t("settingsEmail")}
                </span>
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
    </PageBody>
  );
}

/** One card per section, so the right column reads as a single object. */
function Panel({ children }: { children: ReactNode }) {
  return (
    <div
      className="rise rounded-[var(--r-lg)] border p-5"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      {children}
    </div>
  );
}

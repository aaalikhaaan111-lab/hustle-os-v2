"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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
import { useLabelResolver } from "@/lib/workspace/useLabelResolver";
import {
  SETTINGS_ENTRIES,
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_LABELS,
  type SettingsSection,
} from "@/lib/settings/registry";

export type { SettingsSection };
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
  initialAnchor,
  email,
  displayName,
  preferredName,
  workDescription,
  personalInstructions,
  usage,
  embedded = false,
}: {
  initialSection: Section;
  /**
   * A control to scroll to and highlight on mount, from `?focus=` — how the
   * command palette hands off to a specific setting. Already validated against
   * the registry by the route.
   */
  initialAnchor?: string;
  email: string;
  displayName: string;
  preferredName: string;
  workDescription: string;
  personalInstructions: string;
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
  /**
   * The search filters the section list, and that is all it does.
   *
   * With seven sections it is not strictly needed — but it is the first thing
   * the eye lands on in a settings panel of this shape, and a box that looked
   * like search while doing nothing would be exactly the sort of decorative
   * control this pass exists to remove. It filters, visibly, and says so when
   * nothing matches.
   */
  const [query, setQuery] = useState("");

  /* Shared with the command palette, which resolves the same registry refs —
     see useLabelResolver for why the dispatch lives in one place. */
  const label = useLabelResolver();

  const ICONS: Record<Section, (p: { className?: string }) => ReactNode> = {
    profile: IconUser,
    usage: IconAnalytics,
    appearance: IconPalette,
    language: IconGlobe,
    privacy: IconShield,
    account: IconSettings,
  };

  /* The navigation IS the registry — there is no second list to fall behind. */
  const sections = SETTINGS_SECTIONS.map((id) => ({
    id,
    label: label(SETTINGS_SECTION_LABELS[id]),
    Icon: ICONS[id],
  }));

  const initials = (displayName || email || "?").slice(0, 2).toUpperCase();

  /**
   * The aliases, as one object per locale keyed by entry id.
   *
   * `t.raw` because this is deliberately data rather than a sentence: adding
   * "dark mode" as a way to reach the theme setting should not require touching
   * the registry, and a missing entry is simply no aliases rather than an error.
   */
  const keywords = ((t as unknown as { raw: (key: string) => unknown }).raw(
    "settingsSearchKeywords",
  ) ?? {}) as Record<string, string>;

  const q = query.trim().toLowerCase();

  /**
   * Results: every section heading and every individual setting inside them.
   *
   * A setting matches on the label a person can actually see or on its aliases,
   * so "dark mode" finds Appearance's dark option and "пароль" finds nothing
   * rather than something wrong. Sections are listed first because choosing one
   * is the coarser, safer answer when the query is vague.
   */
  const sectionHits = q
    ? sections.filter((item) => item.label.toLowerCase().includes(q))
    : [];
  const entryHits = q
    ? SETTINGS_ENTRIES.filter((entry) => {
        const text = `${label(entry.label)} ${keywords[entry.id] ?? ""}`.toLowerCase();
        return text.includes(q);
      })
    : [];
  const hasResults = sectionHits.length > 0 || entryHits.length > 0;

  /**
   * Opening a section and focusing something inside it are two renders apart:
   * the control does not exist until the section it lives in is mounted.
   *
   * The anchor rides in a ref rather than in state, so consuming it does not
   * schedule another render. `jump` is what actually wakes the effect — a plain
   * counter, because choosing a result inside the section you are already in
   * must still scroll and highlight, and `section` alone would not have
   * changed.
   */
  const pendingAnchor = useRef<string | null>(initialAnchor ?? null);
  /* Starts at 1 when the palette handed us an anchor, so the effect below runs
     on mount and consumes it — the same path an in-page search result takes,
     rather than a second mechanism that could drift from it. */
  const [jump, setJump] = useState(initialAnchor ? 1 : 0);

  useEffect(() => {
    const id = pendingAnchor.current;
    if (!id) return;
    pendingAnchor.current = null;

    let frame = 0;
    let attempts = 0;
    let clear = 0;

    /**
     * WAITING FOR LAYOUT, NOT JUST FOR THE NODE.
     *
     * The in-page path — clicking a search result — runs long after hydration
     * and lands first time. The `?focus=` path does not: it fires on mount,
     * and on a streamed page the section's markup can still be sitting in
     * React's hidden staging container at that moment. `getElementById` finds
     * it there, so a naive version thinks it succeeded — but the node has no
     * box, `scrollIntoView` on a `display: none` element does nothing, and the
     * highlight gets written to markup that is about to be thrown away. The
     * result is a deep link that silently lands nowhere, which was exactly the
     * behaviour observed in the browser.
     *
     * `offsetParent` is the cheap test for "this is actually laid out"; a
     * displayed element always has one (barring `position: fixed`, which no
     * settings control uses). Retrying by frame rather than on a timer means we
     * act on the first paint where it is real, and the cap keeps a genuinely
     * missing anchor from spinning forever.
     */
    const settle = () => {
      const node = document.getElementById(id);
      if (!node || !node.offsetParent) {
        if (attempts++ < 30) frame = requestAnimationFrame(settle);
        return;
      }
      node.scrollIntoView({ block: "center", behavior: "smooth" });
      /* Focus where focus means something; the highlight is what makes a row
         that cannot hold focus — a usage meter, the signed-in address — land in
         the same place the search promised. */
      node.focus({ preventScroll: true });
      node.setAttribute("data-found", "true");
      clear = window.setTimeout(() => node.removeAttribute("data-found"), 1400);
    };

    frame = requestAnimationFrame(settle);
    return () => {
      cancelAnimationFrame(frame);
      if (clear) window.clearTimeout(clear);
    };
  }, [jump]);

  function goTo(target: Section, anchor?: string) {
    pendingAnchor.current = anchor ?? null;
    setSection(target);
    setJump((n) => n + 1);
  }

  const body = (
    /* TITLE, SEARCH AND SECTIONS IN ONE COLUMN, CONTENT IN THE OTHER.
       The heading used to run the full width above both columns, which made the
       panel read as a page with a nav strip rather than as a settings window.
       A single hairline divides the two columns on desktop — the same rule the
       reference uses, and the thing that makes the left side read as a rail. */
    <div className="flex flex-col gap-6 md:flex-row md:gap-0">
      <aside className="shrink-0 md:w-60 md:border-r md:pr-6">
        <h1 className={embedded ? "s-title" : "s-display"}>{t("settingsTitle")}</h1>

        <div className="mt-4">
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("settingsSearch")}
            aria-label={t("settingsSearch")}
            className="s-search"
          />
        </div>

        {/* A column on desktop, a compact scrollable row on small screens.
            The negative margin lets the row bleed to the screen edge while
            keeping a gutter at both ends, so the last section is never
            half-cut. */}
        <nav
          aria-label={t("settingsTitle")}
          className={`mt-3 flex gap-1 overflow-x-auto pb-1 [scrollbar-width:none] md:mx-0 md:h-fit md:flex-col md:overflow-visible md:px-0 md:pb-0 ${
            embedded ? "-mx-6 px-6 md:-mx-0 md:px-0" : "-mx-5 px-5 md:px-0"
          }`}
        >
          {q && !hasResults && (
            <p className="s-meta px-1 py-2">{t("settingsNoMatch")}</p>
          )}

          {/* Searching replaces the section list with what was actually found,
              rather than filtering the list and leaving individual settings
              unreachable — the whole point of the search is the things that are
              NOT sections. */}
          {q
            ? (
              <>
                {sectionHits.map((item) => (
                  <VentrioButton
                    key={`section-${item.id}`}
                    variant="ghost"
                    size="md"
                    onClick={() => goTo(item.id)}
                    align="start" weight="medium" className="md:w-full"
                  >
                    <item.Icon className="h-[17px] w-[17px] shrink-0" />
                    {item.label}
                  </VentrioButton>
                ))}

                {entryHits.map((entry) => {
                  const inner = (
                    <>
                      <span className="min-w-0 truncate">{label(entry.label)}</span>
                      {/* Which section it lives in, so a bare label like
                          "Contact" is not ambiguous. */}
                      <span className="ml-auto shrink-0 pl-2 text-[12px] text-ink-muted">
                        {label(SETTINGS_SECTION_LABELS[entry.section])}
                      </span>
                    </>
                  );
                  return entry.href ? (
                    <VentrioLinkButton
                      key={entry.id}
                      href={entry.href}
                      variant="ghost"
                      size="md"
                      align="start" weight="normal" className="md:w-full"
                    >
                      {inner}
                    </VentrioLinkButton>
                  ) : (
                    <VentrioButton
                      key={entry.id}
                      variant="ghost"
                      size="md"
                      onClick={() => goTo(entry.section, entry.anchor)}
                      align="start" weight="normal" className="md:w-full"
                    >
                      {inner}
                    </VentrioButton>
                  );
                })}
              </>
            )
            : sections.map((item) => {
              const active = section === item.id;
              return (
                <VentrioButton
                  key={item.id}
                  variant="ghost"
                  size="md"
                  on={active}
                  aria-current={active ? "true" : undefined}
                  onClick={() => goTo(item.id)}
                  align="start" weight="medium" className="md:w-full"
                >
                  <item.Icon className="h-[17px] w-[17px] shrink-0" />
                  {item.label}
                </VentrioButton>
              );
            })}
        </nav>
      </aside>

        {/* 640px: a form is read one line at a time, and a name field that
            runs 900px wide looks like a mistake rather than a field. */}
        <div key={section} className="ws-page min-w-0 flex-1 md:max-w-[640px] md:pl-8">
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
                <ProfileForm
                email={email}
                displayName={displayName}
                preferredName={preferredName}
                workDescription={workDescription}
                personalInstructions={personalInstructions}
              />
              </div>
            </Panel>
          )}

          {section === "usage" && (
            <Panel title={t("usage")} description={t("usageNote")}>
              <ul className="flex flex-col gap-5">
                {[
                  { id: "usageChanges", label: t("usageChanges"), counter: usage.aiChanges },
                  { id: "usageBuilds", label: t("usageBuilds"), counter: usage.projectBuilds },
                  { id: "usageEvolution", label: t("usageEvolution"), counter: usage.evolutionCredits },
                ].map(({ id, label, counter }) => (
                  /* `tabIndex={-1}` so search can focus a row that is a meter
                     rather than a control. It stays out of the tab order. */
                  <li key={id} id={`setting-${id}`} tabIndex={-1}>
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
                  id="setting-themeLight"
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
                  id="setting-themeDark"
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
                  id="setting-themeSystem"
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
              <div
                id="setting-accountEmail"
                tabIndex={-1}
                className="flex items-center justify-between gap-4 rounded-[var(--r-md)] bg-muted/60 px-4 py-3 text-[14px]"
              >
                <span className="shrink-0 text-muted-foreground">{t("settingsEmail")}</span>
                <span className="min-w-0 truncate font-medium">{email}</span>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <span id="setting-logout" tabIndex={-1}>
                  <LogoutButton />
                </span>
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

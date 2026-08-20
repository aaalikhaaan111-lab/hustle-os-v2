/**
 * Every place in Settings a person can be sent, in one list.
 *
 * WHY A REGISTRY AND NOT A SEARCH INDEX. A second list of settings written for
 * search is stale the first time somebody renames a field, and stale search is
 * worse than no search: it sends people to things that are not there. So this
 * is the ONLY list. `SettingsClient` builds its section navigation from
 * `SETTINGS_SECTIONS`, `/settings` validates its `?section=` against the same
 * constant, and search resolves `SETTINGS_ENTRIES` — one edit adds a setting to
 * the nav, the route and the search at once.
 *
 * LABELS ARE REFERENCES, NEVER COPIES. Each entry names the i18n key the UI
 * itself renders rather than repeating the words. A renamed label changes in
 * search automatically, translations come free in every locale the project
 * ships, and there is no second English string to forget to translate.
 *
 * Keywords are the one thing search needs that the UI does not have — the words
 * someone types when they do not know what the field is called ("dark mode",
 * "пароль", "cancel"). They live in a single `settingsSearchKeywords` object per
 * locale, keyed by entry id, so adding aliases never touches this file.
 */

/** The sections, in the order they are listed. */
export const SETTINGS_SECTIONS = [
  "profile",
  "usage",
  "appearance",
  "language",
  "privacy",
  "account",
] as const;

export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

export function isSettingsSection(value: unknown): value is SettingsSection {
  return (SETTINGS_SECTIONS as readonly unknown[]).includes(value);
}

/**
 * The namespaces labels are drawn from.
 *
 * `nav` joined the three Settings uses when the command palette started
 * resolving labels through this same type — it needs "Pricing", which only
 * exists there. Every consumer dispatches on this union explicitly, so adding a
 * namespace here without handling it fails to compile rather than falling back
 * to a missing-key placeholder at runtime.
 */
export type SettingsNamespace = "workspace" | "profile" | "footer" | "nav";

export interface SettingsLabelRef {
  ns: SettingsNamespace;
  key: string;
}

export interface SettingsEntry {
  /** Stable identity: the React key, the keywords key, and the DOM anchor. */
  id: string;
  /** The section this lives in. Choosing the entry opens it. */
  section: SettingsSection;
  /** The i18n key of the label the UI actually renders for this thing. */
  label: SettingsLabelRef;
  /**
   * The element to focus once the section is open.
   *
   * Omitted where the section heading IS the destination — a section with one
   * control does not need to point at it.
   */
  anchor?: string;
  /**
   * A route, for the entries that leave Settings entirely (the legal pages,
   * account deletion). These navigate instead of switching section.
   */
  href?: string;
}

/**
 * The section headings themselves, so searching "usage" finds the section and
 * not only the counters inside it.
 */
export const SETTINGS_SECTION_LABELS: Record<SettingsSection, SettingsLabelRef> = {
  profile: { ns: "workspace", key: "settingsProfile" },
  usage: { ns: "workspace", key: "usage" },
  appearance: { ns: "workspace", key: "settingsAppearance" },
  language: { ns: "workspace", key: "settingsLanguage" },
  privacy: { ns: "workspace", key: "settingsPrivacy" },
  account: { ns: "workspace", key: "settingsAccount" },
};

/**
 * Every individual setting, nested ones included.
 *
 * Anchors match ids that exist in the rendered markup — the profile fields
 * already carried them, the rest were added alongside this list. An anchor that
 * names nothing focuses nothing, which the regression test checks for.
 */
export const SETTINGS_ENTRIES: SettingsEntry[] = [
  // ── profile ──────────────────────────────────────────────────────────────
  { id: "displayName", section: "profile", label: { ns: "profile", key: "displayNameLabel" }, anchor: "displayName" },
  { id: "preferredName", section: "profile", label: { ns: "profile", key: "preferredNameLabel" }, anchor: "preferredName" },
  { id: "workDescription", section: "profile", label: { ns: "profile", key: "workLabel" }, anchor: "workDescription" },
  { id: "personalInstructions", section: "profile", label: { ns: "profile", key: "instructionsLabel" }, anchor: "personalInstructions" },

  // ── usage ────────────────────────────────────────────────────────────────
  { id: "usageChanges", section: "usage", label: { ns: "workspace", key: "usageChanges" }, anchor: "setting-usageChanges" },
  { id: "usageBuilds", section: "usage", label: { ns: "workspace", key: "usageBuilds" }, anchor: "setting-usageBuilds" },
  { id: "usageEvolution", section: "usage", label: { ns: "workspace", key: "usageEvolution" }, anchor: "setting-usageEvolution" },

  // ── appearance ───────────────────────────────────────────────────────────
  { id: "themeLight", section: "appearance", label: { ns: "workspace", key: "settingsAppearanceLight" }, anchor: "setting-themeLight" },
  { id: "themeDark", section: "appearance", label: { ns: "workspace", key: "settingsAppearanceDark" }, anchor: "setting-themeDark" },
  { id: "themeSystem", section: "appearance", label: { ns: "workspace", key: "settingsAppearanceSystem" }, anchor: "setting-themeSystem" },

  // ── language ─────────────────────────────────────────────────────────────
  // Deliberately no entry: the section holds ONE control and its label is the
  // section heading, so listing it would put the same words in the results
  // twice — the "Language" section and the "Language" setting inside it.

  // ── privacy and data ─────────────────────────────────────────────────────
  { id: "privacyPolicy", section: "privacy", label: { ns: "footer", key: "privacy" }, href: "/privacy" },
  { id: "terms", section: "privacy", label: { ns: "footer", key: "terms" }, href: "/terms" },
  { id: "cookies", section: "privacy", label: { ns: "footer", key: "cookies" }, href: "/cookies" },
  { id: "contact", section: "privacy", label: { ns: "footer", key: "contact" }, href: "/contact" },

  // ── account ──────────────────────────────────────────────────────────────
  { id: "accountEmail", section: "account", label: { ns: "workspace", key: "settingsEmail" }, anchor: "setting-accountEmail" },
  { id: "logout", section: "account", label: { ns: "profile", key: "logout" }, anchor: "setting-logout" },
  { id: "deleteAccount", section: "account", label: { ns: "workspace", key: "settingsDeleteAccount" }, href: "/delete-account" },
];

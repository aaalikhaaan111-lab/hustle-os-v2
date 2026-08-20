import {
  SETTINGS_ENTRIES,
  SETTINGS_SECTIONS,
  SETTINGS_SECTION_LABELS,
  type SettingsLabelRef,
} from "@/lib/settings/registry";

/**
 * Everywhere the command palette can send someone, in one list.
 *
 * WHY THIS EXISTS. The palette used to carry five destinations hardcoded into
 * its JSX plus the project list. Everything else the product has — Pricing, the
 * legal pages, and all six Settings sections with the twenty settings inside
 * them — was unreachable from it, so "billing" and "dark mode" found nothing
 * while both were one click away in the UI.
 *
 * IT IS DERIVED, NOT DUPLICATED. The Settings half is generated from
 * `SETTINGS_SECTIONS` and `SETTINGS_ENTRIES`, the same constants that build the
 * Settings navigation and validate the `?section=` route. Adding a setting adds
 * it to the nav, the route AND the palette in one edit. A second list written
 * for search is stale the first time somebody renames a field, and stale search
 * is worse than no search: it sends people to things that are not there.
 *
 * LABELS ARE REFERENCES. Each destination names the i18n key the UI itself
 * renders rather than repeating the words, so a renamed label changes here
 * automatically and every locale is covered without a second English string.
 */

export type CommandGroup = "action" | "page" | "settings";

export type CommandIcon =
  | "plus"
  | "overview"
  | "projects"
  | "settings"
  | "analytics"
  | "user"
  | "palette"
  | "globe"
  | "shield"
  | "external";

export interface CommandDestination {
  /** Stable identity: React key and the key its keyword aliases live under. */
  id: string;
  group: CommandGroup;
  /** The i18n key of the label the UI actually renders for this thing. */
  label: SettingsLabelRef;
  href: string;
  icon: CommandIcon;
  /**
   * Offered only while a project is open, with `:id` replaced by its id.
   * The palette is reachable from everywhere, and a link to "this project"
   * from the gallery would point at nothing.
   */
  scoped?: boolean;
}

/** What someone came here to do, rather than somewhere to read. */
const ACTIONS: CommandDestination[] = [
  { id: "newProject", group: "action", label: { ns: "workspace", key: "navNewProject" }, href: "/create?fresh=1", icon: "plus" },
];

/**
 * The routes a signed-in person can reach.
 *
 * Deliberately NOT every route in the app: /login, /signup, /build/*,
 * /intake-preview, /output-preview and /v2-gallery are either unreachable when
 * signed in or internal previews, and offering them would be offering dead
 * ends. /pricing is here because it is where plan and billing actually live —
 * there is no billing section in Settings, and inventing one in search would
 * promise a page that does not exist.
 */
const PAGES: CommandDestination[] = [
  { id: "overview", group: "page", label: { ns: "workspace", key: "navOverview" }, href: "/dashboard", icon: "overview" },
  { id: "projects", group: "page", label: { ns: "workspace", key: "projectsTitle" }, href: "/projects", icon: "projects" },
  { id: "settings", group: "page", label: { ns: "workspace", key: "navSettings" }, href: "/settings", icon: "settings" },
  { id: "pricing", group: "page", label: { ns: "nav", key: "pricing" }, href: "/pricing", icon: "external" },
  { id: "thisProject", group: "page", label: { ns: "workspace", key: "navThisProject" }, href: "/projects/:id", icon: "overview", scoped: true },
  { id: "analytics", group: "page", label: { ns: "workspace", key: "navAnalytics" }, href: "/projects/:id/analytics", icon: "analytics", scoped: true },
];

/** Which icon stands for each settings section. */
const SECTION_ICON: Record<(typeof SETTINGS_SECTIONS)[number], CommandIcon> = {
  profile: "user",
  usage: "analytics",
  appearance: "palette",
  language: "globe",
  privacy: "shield",
  account: "settings",
};

/**
 * Every Settings section, then every individual setting inside them.
 *
 * Sections come first because choosing one is the coarser, safer answer when a
 * query is vague — the same ordering the Settings page's own search uses.
 *
 * An entry with an `href` leaves Settings entirely (the legal pages, account
 * deletion) and keeps that href. Everything else deep-links to its section, and
 * carries its anchor as `?focus=` so the palette lands on the actual control
 * rather than dropping someone at the top of a panel to hunt for it.
 */
const SETTINGS: CommandDestination[] = [
  ...SETTINGS_SECTIONS.map((section) => ({
    id: `section:${section}`,
    group: "settings" as const,
    label: SETTINGS_SECTION_LABELS[section],
    href: `/settings?section=${section}`,
    icon: SECTION_ICON[section],
  })),
  ...SETTINGS_ENTRIES.map((entry) => ({
    id: entry.id,
    group: "settings" as const,
    label: entry.label,
    href:
      entry.href ??
      `/settings?section=${entry.section}${entry.anchor ? `&focus=${entry.anchor}` : ""}`,
    icon: SECTION_ICON[entry.section],
  })),
];

export const COMMAND_DESTINATIONS: CommandDestination[] = [...ACTIONS, ...PAGES, ...SETTINGS];

/** Resolves `:id` for the project-scoped rows, and drops them when there is none. */
export function destinationsFor(projectId?: string): CommandDestination[] {
  return COMMAND_DESTINATIONS.filter((d) => !d.scoped || projectId).map((d) =>
    d.scoped && projectId ? { ...d, href: d.href.replace(":id", projectId) } : d,
  );
}

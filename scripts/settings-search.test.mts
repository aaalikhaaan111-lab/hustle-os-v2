import { readFileSync } from "node:fs";

/**
 * The settings search registry, and the promises it makes.
 *
 * Search that sends someone to a setting that is not there is worse than no
 * search at all, and every failure mode here is silent in the browser: a label
 * key that does not resolve renders the key itself, an anchor that names
 * nothing focuses nothing, a missing Russian keyword just quietly finds less.
 * None of that throws, so it has to be tested.
 */
let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const { SETTINGS_ENTRIES, SETTINGS_SECTIONS, SETTINGS_SECTION_LABELS, isSettingsSection } =
  await import("../src/lib/settings/registry");
/* The palette derives its settings half from the registry above; both are
   loaded so this file can assert they agree. */
const { COMMAND_DESTINATIONS } = await import("../src/lib/workspace/commandRegistry");

const en = JSON.parse(read("messages/en.json")) as Record<string, Record<string, unknown>>;
const ru = JSON.parse(read("messages/ru.json")) as Record<string, Record<string, unknown>>;
const client = read("src/app/settings/SettingsClient.tsx");
const profileForm = read("src/components/profile/ProfileForm.tsx");
const route = read("src/app/settings/page.tsx");

/* ── 1. one list, not two ────────────────────────────────────────────────── */

/**
 * The registry is the source for the navigation AND the route's `?section=`
 * validation. A second copy of the section list is exactly the thing that goes
 * stale the first time a section is added.
 */
check("the navigation is built from the registry",
  /SETTINGS_SECTIONS\.map/.test(client) && /SETTINGS_SECTION_LABELS/.test(client));
check("and the route validates against the same list",
  /isSettingsSection/.test(route) && !/const SECTIONS = \[/.test(route),
  "the route used to carry its own copy of the section names");
check("every entry belongs to a real section",
  SETTINGS_ENTRIES.every((entry) => isSettingsSection(entry.section)));
check("every section has a heading label",
  SETTINGS_SECTIONS.every((id) => Boolean(SETTINGS_SECTION_LABELS[id])));

/* ── 2. no duplicates, nothing invented ──────────────────────────────────── */

const ids = SETTINGS_ENTRIES.map((entry) => entry.id);
check("entry ids are unique", new Set(ids).size === ids.length,
  ids.filter((id, i) => ids.indexOf(id) !== i).join(", "));

/**
 * A label is a REFERENCE to the key the UI renders, never a copy of the words.
 * If a key does not exist the panel renders the key name, which looks like a
 * bug and reads like one.
 */
function resolves(bundle: Record<string, Record<string, unknown>>, ns: string, key: string): boolean {
  return typeof bundle[ns]?.[key] === "string";
}

for (const locale of [["en", en], ["ru", ru]] as const) {
  const [name, bundle] = locale;
  check(`every entry label resolves in ${name}`,
    SETTINGS_ENTRIES.every((entry) => resolves(bundle, entry.label.ns, entry.label.key)),
    SETTINGS_ENTRIES.filter((e) => !resolves(bundle, e.label.ns, e.label.key))
      .map((e) => `${e.id} -> ${e.label.ns}.${e.label.key}`).join(", "));
  check(`every section label resolves in ${name}`,
    SETTINGS_SECTIONS.every((id) => {
      const ref = SETTINGS_SECTION_LABELS[id];
      return resolves(bundle, ref.ns, ref.key);
    }));
}

/* ── 3. aliases, in every language ───────────────────────────────────────── */

/**
 * Keywords are how somebody finds "dark mode" when the label says "Dark", and
 * they only work if they are translated — an English-only alias list makes
 * search useful for half the product's users.
 */
for (const locale of [["en", en], ["ru", ru]] as const) {
  const [name, bundle] = locale;
  const kw = bundle.workspace?.settingsSearchKeywords as Record<string, string> | undefined;
  check(`the ${name} keyword table exists`, Boolean(kw) && typeof kw === "object");
  check(`every entry has ${name} aliases`,
    Boolean(kw) && SETTINGS_ENTRIES.every((entry) => typeof kw?.[entry.id] === "string" && kw[entry.id].length > 0),
    SETTINGS_ENTRIES.filter((e) => !kw?.[e.id]).map((e) => e.id).join(", "));
  /**
   * ONE ALIAS TABLE, TWO REGISTRIES.
   *
   * The command palette resolves the same object, so its destination ids are
   * legitimate keys here — that is the point of sharing it rather than starting
   * a second list that drifts. What must still hold is that every key names
   * something real: an alias for an id no registry defines is a word that can
   * never match anything, which is how a keyword table quietly rots.
   */
  const known = [...ids, ...COMMAND_DESTINATIONS.map((d) => d.id)];
  check(`the ${name} keyword table invents nothing`,
    Boolean(kw) && Object.keys(kw ?? {}).every((id) => known.includes(id)),
    Object.keys(kw ?? {}).filter((id) => !known.includes(id)).join(", "));
}

/* ── 4. every destination is reachable ───────────────────────────────────── */

/**
 * An anchor has to name an id that is actually rendered. These are checked
 * against the source rather than a browser because the failure is silent:
 * `document.getElementById` returns null and the effect simply does nothing.
 */
const markup = client + profileForm;
const anchored = SETTINGS_ENTRIES.filter((entry) => entry.anchor);

/**
 * An anchor is satisfied either by a literal `id="…"` or by a row that builds
 * its id from a `setting-${id}` template over a list the entry id appears in —
 * which is how the usage meters are rendered. Both are checked here; the
 * browser pass in the verification round confirms the resolved ids for real.
 */
const templated = /id=\{`setting-\$\{/.test(markup);
function anchorExists(entry: { id: string; anchor?: string }): boolean {
  if (!entry.anchor) return true;
  if (markup.includes(`id="${entry.anchor}"`)) return true;
  return templated && entry.anchor === `setting-${entry.id}` && markup.includes(`id: "${entry.id}"`);
}

check("every anchor names an id that exists in the markup",
  anchored.every(anchorExists),
  anchored.filter((e) => !anchorExists(e)).map((e) => `${e.id} -> #${e.anchor}`).join(", "));

check("every entry is reachable — an anchor or a route, never neither",
  SETTINGS_ENTRIES.every((entry) => Boolean(entry.anchor) || Boolean(entry.href)),
  SETTINGS_ENTRIES.filter((e) => !e.anchor && !e.href).map((e) => e.id).join(", "));

check("routed entries point at real app routes",
  SETTINGS_ENTRIES.filter((e) => e.href).every((e) => e.href!.startsWith("/")));

/* ── 5. the field, and where search sends you ────────────────────────────── */

const studio = read("src/app/studio.css");

/**
 * The old focus state was `outline-2 outline-offset-2` in the accent colour —
 * a hard ring floating two pixels off a field that still had the platform's own
 * search chrome under it.
 */
check("the search field wears Ventrio's focus state, not the browser's",
  /className="s-search"/.test(client) &&
  !/focus-visible:outline-2/.test(client),
  "a detached 2px accent ring is the browser's idea of focus, not this product's");
check("and it is still unmistakably focused for a keyboard",
  /\.s-search:focus-visible \{[\s\S]{0,200}box-shadow: 0 0 0 3px/.test(studio));
check("the platform's own search chrome is suppressed",
  /\.s-search \{[\s\S]{0,300}appearance: none/.test(studio));
check("landing on a result is visible as well as programmatic",
  /\[data-found="true"\]/.test(studio) && /data-found/.test(client));

/* ── the palette hands off to a CONTROL, not just a panel ────────────────── */

/**
 * `?focus=` is what makes a settings result in the command palette land on the
 * field itself. Searching "dark mode" and arriving at the top of Appearance to
 * hunt for the option is most of the way to not having search at all.
 *
 * These assert the wiring end to end because the browser could not: the anchor
 * scroll fires once, during hydration, and the automation context reattaches to
 * a stale document after a navigation often enough that observing it there was
 * not trustworthy. What CAN be pinned is that every link the palette emits names
 * an anchor the registry defines, that the route refuses anything else, and that
 * the effect waits for real layout.
 */
check("the route accepts a focus parameter",
  /searchParams: Promise<\{[^}]*focus\?: string/.test(route));
check("and validates it against the registry rather than trusting it",
  /SETTINGS_ENTRIES\.find\(\(entry\) => entry\.anchor === focus\)\?\.anchor/.test(route),
  "this value reaches getElementById; only ids the registry names are legitimate");
check("the validated anchor is handed to the client",
  /initialAnchor=\{anchor\}/.test(route));

/**
 * THE RACE THIS GUARDS. The in-page path runs long after hydration and lands
 * first time. `?focus=` fires on mount, when the section's markup can still be
 * in React's hidden staging container — `getElementById` finds it there, so a
 * naive version believes it succeeded while scrolling a `display: none` node and
 * writing the highlight to markup about to be discarded. Observed in the browser
 * before the fix: the deep link silently landed nowhere.
 */
check("the anchor effect waits for the node to be laid out, not merely present",
  /!node\.offsetParent/.test(client) && /requestAnimationFrame\(settle\)/.test(client),
  "presence is not layout; a streamed page has both a real node and a hidden one");
check("and it gives up rather than spinning on an anchor that never appears",
  /attempts\+\+ < \d+/.test(client));

/* Every settings destination the palette emits must point at something real. */
for (const destination of COMMAND_DESTINATIONS.filter((d) => d.group === "settings")) {
  const anchor = /focus=([^&]+)/.exec(destination.href)?.[1];
  if (!anchor) continue;
  check(`the palette's "${destination.id}" link names a real anchor`,
    SETTINGS_ENTRIES.some((entry) => entry.anchor === anchor),
    `${anchor} is not an anchor any registry entry defines`);
}

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ settings search: ${passed} checks passed`);

/**
 * The preview toolbar on a phone.
 *
 *   npx tsx --conditions=react-server scripts/mobile-toolbar.test.mts
 *
 * THE COMPLAINT, in the owner's own words: he knows Publish, Copy link and Open
 * public page exist because he built them. A new person would not — on an
 * iPhone the toolbar scrolled sideways and those controls were off-screen.
 *
 * An earlier fix pinned Publish and Close outside the scrolling region, which
 * solved the two that mattered most and left the rest inside it. Reload, Copy
 * link and Open public page were still reachable only by dragging a toolbar,
 * which is indistinguishable from not existing.
 *
 * The rule this file enforces: on a narrow screen nothing in the toolbar
 * scrolls horizontally, and every action is either pinned or in a labelled
 * menu. Desktop is untouched — the row does not overflow there, and the wide
 * layout is the one it always was.
 *
 * Offline. Whether it is comfortable under a thumb is a real-device question.
 */

import { readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const screen = read("src/components/workspace/BuildScreen.tsx");
const code = screen
  .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

/* ── nothing scrolls sideways on a phone ─────────────────────────────────── */

check("the toolbar does not scroll horizontally when narrow",
  /narrow \? "overflow-hidden" : "overflow-x-auto"/.test(code),
  "a control reachable only by dragging a toolbar is one a new person never finds");

/* ── every required action is reachable ──────────────────────────────────── */

/**
 * The list the sprint named: Preview, Reload, Publish/Unpublish, Open public
 * page, Copy/share link. Each is either pinned in the bar or in the menu.
 */
check("Publish stays pinned", /\{publishControl && \(/.test(code));
check("Close stays pinned", /closePreview/.test(code));
check("Reload is in the menu", /key: "reload"/.test(code));
check("Copy link is in the menu", /key: "copy"/.test(code));
check("Open public page is in the menu", /key: "open"/.test(code));
check("and the menu only appears when there is something to act on",
  /narrow && hasOutput && \(\s*<ToolbarMenu/.test(code));

/**
 * Share controls are absent, not disabled, for a draft — a preview that exists
 * on screen has no address, and offering a copy control that copies nothing is
 * worse than not offering one.
 */
check("share actions appear only with a real URL", /\.\.\.\(shareUrl$/m.test(code) || /\.\.\.\(shareUrl\s*\n/.test(code));

/* ── the menu is findable, not a row of mystery icons ────────────────────── */

check("menu items carry words", /label: t\("reload"\)/.test(code) && /label: t\("copyPreviewLink"\)/.test(code));
check("the trigger is labelled for assistive tech", /aria-label=\{label\}/.test(code));
check("it is a menu to assistive tech", /role="menu"/.test(code) && /role="menuitem"/.test(code));
check("the external link still opens in a new tab", /target="_blank"/.test(code) && /rel="noreferrer"/.test(code));

/* ── touch targets ───────────────────────────────────────────────────────── */

check("menu rows are comfortable under a thumb", /min-h-\[44px\]/.test(code));
check("and so is the trigger", /h-11 w-11/.test(code));

/* ── desktop is unchanged ────────────────────────────────────────────────── */

check("the viewport toggles are a wide-screen affordance",
  /hasOutput && !narrow && \(/.test(code),
  "a phone IS the mobile viewport; the toggles are what made the row overflow");
check("the wide toolbar still scrolls rather than wrapping",
  /overflow-x-auto/.test(code),
  "a toolbar that reflows to two rows pushes the preview down the page");
check("the inline share controls remain on wide screens", /shareUrl && !narrow && \(/.test(code));
check("the menu never renders on a wide screen", /narrow && hasOutput/.test(code));

/* ── the copy exists in both locales ─────────────────────────────────────── */

for (const locale of ["en", "ru"]) {
  const messages = JSON.parse(read(`messages/${locale}.json`)) as { workspace: Record<string, string> };
  check(`${locale}: workspace.moreActions exists`,
    typeof messages.workspace.moreActions === "string" && messages.workspace.moreActions.trim().length > 0);
}

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ mobile toolbar: ${passed} checks passed`);

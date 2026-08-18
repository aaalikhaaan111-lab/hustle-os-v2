import { readFileSync, existsSync } from "node:fs";

/**
 * Real project thumbnails: the pipeline that takes one, and the traps in it.
 *
 * The gallery used to draw generated APPS from metadata — a name and a list of
 * routes — because an app is source and the only faithful picture of one is a
 * running copy. The worker now renders and photographs it once and stores the
 * result. These checks guard the parts of that which are easy to get subtly
 * wrong and impossible to notice afterwards.
 */
let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");

const migration = read("supabase/migrations/20260818140000_add_project_thumbnails.sql");
const capture = read("worker/thumbnail.ts");
const task = read("worker/captureTask.ts");
const worker = read("worker/main.ts");
const present = read("src/lib/workspace/present.ts");
const studio = read("src/app/studio.css");
const pkg = JSON.parse(read("package.json")) as {
  dependencies: Record<string, string>;
};

/* ── 1. the infinite re-capture trap ─────────────────────────────────────── */

/**
 * `set_projects_updated_at` fires on EVERY update and sets `updated_at =
 * now()`. Writing a thumbnail is an update, so without a carve-out the write
 * pushes `updated_at` past the `thumbnail_captured_at` it just wrote — the
 * project is stale the instant it is captured, and the worker re-screenshots
 * the same few projects on every idle tick forever.
 */
check("capturing a thumbnail does not count as changing the project",
  /create or replace function public\.set_projects_updated_at/.test(migration) &&
  /to_jsonb\(new\) - 'thumbnail_url' - 'thumbnail_captured_at' - 'updated_at'/.test(migration) &&
  /new\.updated_at = old\.updated_at/.test(migration),
  "without this the worker re-captures the same projects forever");
check("and the carve-out compares the whole row, not a list of columns",
  !/new\.name is distinct from old\.name/.test(migration),
  "a column added later must be covered without anyone remembering this file");
check("the shared updated_at trigger is left alone for every other table",
  !/create or replace function public\.set_updated_at\b/.test(migration));

/* ── 2. what is due ──────────────────────────────────────────────────────── */

/**
 * PostgREST compares a column to a VALUE and never to another column, so
 * `thumbnail_captured_at < updated_at` cannot be a query parameter. The rule
 * lives in a view so it is stated once rather than half in SQL and half in a
 * JavaScript filter that drifts.
 */
check("the staleness rule is a view, not a PostgREST filter",
  /create or replace view public\.projects_needing_thumbnail/.test(migration) &&
  /from\("projects_needing_thumbnail"\)/.test(task) &&
  !/thumbnail_captured_at\.lt\.updated_at/.test(task),
  "a column-to-column filter silently returns nothing useful");
check("the view is not reachable by the API roles",
  /revoke all on public\.projects_needing_thumbnail from anon, authenticated/.test(migration),
  "snapshot_fields carries generated source");
check("and the index matches the view's predicate",
  /where thumbnail_captured_at is null or thumbnail_captured_at < updated_at/.test(migration));

/* ── 3. a capture can never hurt a generation ────────────────────────────── */

check("capture runs only on a tick that found no job",
  /if \(!worked\) \{[\s\S]{0,400}captureDueThumbnails/.test(worker),
  "a hung browser must not be able to delay a claim, a refund or a heartbeat");
check("and every failure is swallowed into a null",
  /return null;/.test(capture) && /} catch \{/.test(capture));
check("a project that cannot be captured still records the attempt",
  /thumbnail_captured_at: new Date\(\)\.toISOString\(\)/.test(task),
  "otherwise it sits at the head of the queue forever and starves the rest");
check("the browser is closed when the worker drains",
  /closeThumbnailBrowser/.test(worker));

/* ── 4. running generated code with the service role in the process ──────── */

check("the captured page is given no network at all",
  /page\.route\("\*\*\/\*", \(route\) => route\.abort\(\)\)/.test(capture),
  "the document must not be able to reach anything even if its own CSP were circumvented");
check("and the whole capture is bounded",
  /CAPTURE_TIMEOUT_MS/.test(capture) && /timeout: CAPTURE_TIMEOUT_MS/.test(capture));
check("no HTTP, no route and no token are involved",
  /setContent/.test(capture) && !/localhost|https?:\/\//.test(capture),
  "screenshotting a URL would need a deployed origin and an auth surface for unpublished projects");

/* ── 5. the browser is not downloaded on every install ───────────────────── */

check("playwright-core, so no ~150 MB browser download on Vercel",
  Boolean(pkg.dependencies["playwright-core"]) && !pkg.dependencies["playwright"],
  "nothing in the web app uses a browser; only the worker does");
check("and a missing browser disables capture instead of crashing the worker",
  /unavailable = true/.test(capture) && /thumbnail_unavailable/.test(capture));

/* ── 6. the gallery ──────────────────────────────────────────────────────── */

check("a stored picture is first in the card's ladder",
  ["src/components/workspace/ProjectsScreen.tsx", "src/components/workspace/OverviewScreen.tsx"]
    .every((f) => /\{project\.thumbnailUrl \? \([\s\S]{0,160}<ProjectShot/.test(read(f))),
  "a real photograph beats every drawing below it");
check("and the drawings remain as the fallback",
  ["src/components/workspace/ProjectsScreen.tsx", "src/components/workspace/OverviewScreen.tsx"]
    .every((f) => /<ProjectThumb /.test(read(f)) && /<AppThumb /.test(read(f))));
check("the presenter carries the url", /thumbnailUrl: project\.thumbnail_url \?\? null/.test(present));

/**
 * `.s-thumb > *` is UNLAYERED and sets `width: 70em` for the page-scaling
 * trick, so it beats a component's Tailwind `w-full` silently. An image needs
 * its own rule or it is sized by a coincidence of that em maths.
 */
check("a screenshot is sized explicitly inside the card",
  /\.s-thumb > img \{[\s\S]{0,120}width: 100%/.test(studio));

/* ── 7. the capture itself, when a browser is available ──────────────────── */

const chromium = process.env.VENTRIO_CHROMIUM_PATH;
if (chromium && existsSync(chromium)) {
  const { APP_FIXTURES } = await import("../../src/lib/v2/app/fixtures/index");
  const { captureAppThumbnail, closeThumbnailBrowser } = await import("../../worker/thumbnail");

  const png = await captureAppThumbnail((APP_FIXTURES as Record<string, unknown>).timeline);
  check("a real fixture renders and photographs",
    png !== null && png.byteLength > 20_000,
    "a blank page compresses to almost nothing; a rendered app does not");
  check("and the result is a PNG at the card's aspect ratio",
    png !== null && png.subarray(1, 4).toString() === "PNG");

  // A project whose app no longer validates has no picture, exactly as the
  // published route has no page for it.
  const broken = await captureAppThumbnail({ not: "an app" });
  check("an app that does not compile yields no picture rather than an error",
    broken === null);

  await closeThumbnailBrowser();
} else {
  console.log("  (live capture skipped: set VENTRIO_CHROMIUM_PATH to a Chrome/Chromium binary)");
}

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ project thumbnails: ${passed} checks passed`);

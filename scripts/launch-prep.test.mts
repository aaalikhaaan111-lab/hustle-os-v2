/**
 * Launch prep: subdomains, branding, plans, and the publish notice.
 *
 *   npx tsx --conditions=react-server scripts/launch-prep.test.mts
 *
 * Four things ship together and each can break the others quietly. A slug that
 * is a valid path but an invalid hostname publishes fine and is unreachable. A
 * reserved name that only the application checks is claimable through the
 * database. A pricing page that hardcodes its numbers drifts from the quota the
 * server actually enforces. So the numbers, the names and the URL shapes are
 * all pinned to one source here.
 *
 * Offline. Pure functions and source-level assertions; there is no DOM in this
 * repo's test environment.
 */

import { readFileSync } from "node:fs";
import { PLANS, PLAN_IDS, entitlementsFor, planFrom } from "../src/lib/billing/plans";
import { isPublicSlug, RESERVED_SLUGS, slugifyProjectName } from "../src/lib/publishing/slug";
import {
  MAX_DNS_LABEL,
  isPublishableSubdomain,
  slugFromHost,
  publicProjectUrl,
  canonicalProjectUrl,
} from "../src/lib/publishing/publicUrl";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}
const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

// `getSiteUrl` falls back to localhost off-production; pin the origin so the
// URL assertions below describe production and not the test environment.
process.env.NEXT_PUBLIC_SITE_URL = "https://ventrio.org";

/* ── 1. subdomains ───────────────────────────────────────────────────────── */

check("a normal slug is publishable as a subdomain", isPublishableSubdomain("sat-prep"));
check("and becomes the subdomain URL", publicProjectUrl("sat-prep") === "https://sat-prep.ventrio.org");
check("canonical is the subdomain, not the path", canonicalProjectUrl("sat-prep") === "https://sat-prep.ventrio.org");

// A DNS label stops at 63. 64 is a fine path segment and an unreachable host.
check(`${MAX_DNS_LABEL} characters is the ceiling`, MAX_DNS_LABEL === 63);
check("a 63-character slug is accepted", isPublicSlug("a".repeat(63)) && isPublishableSubdomain("a".repeat(63)));
check("a 64-character slug is rejected", !isPublicSlug("a".repeat(64)) && !isPublishableSubdomain("a".repeat(64)));

// Every name the launch brief required, plus the routes.
for (const reserved of [
  "www", "app", "api", "admin", "dashboard", "auth", "login", "status",
  "billing", "pay", "account", "support", "help", "docs", "blog", "static",
  "assets", "cdn", "dev", "staging", "test", "mail", "smtp", "imap", "pop",
  "ftp", "ns1", "ns2", "mx", "vercel",
]) {
  check(`"${reserved}" is reserved`, RESERVED_SLUGS.has(reserved) && !isPublishableSubdomain(reserved));
  check(`"${reserved}" does not resolve as a host`, slugFromHost(`${reserved}.ventrio.org`) === null);
}

// Host resolution.
check("a project host resolves to its slug", slugFromHost("sat-prep.ventrio.org") === "sat-prep");
check("the apex is not a project", slugFromHost("ventrio.org") === null);
check("a nested label is not a project", slugFromHost("a.b.ventrio.org") === null);
check("a foreign host is not a project", slugFromHost("sat-prep.example.com") === null);
check("a port is tolerated", slugFromHost("sat-prep.ventrio.org:443") === "sat-prep");
check("case is normalised", slugFromHost("SAT-PREP.Ventrio.org") === "sat-prep");
check("an absent host is not a project", slugFromHost(null) === null);

// A project named after a reserved word must not mint that slug in the first
// place — the constraint would reject the publish, which is a worse moment to
// find out than at naming time.
for (const name of ["www", "Admin", "API", "Mail"]) {
  const minted = slugifyProjectName(name);
  check(`"${name}" does not mint a reserved slug`, isPublishableSubdomain(minted), minted);
}
check("an ordinary name still mints cleanly", slugifyProjectName("SAT Prep") === "sat-prep");

// The reserved list must exist in the database too — the application gives the
// better error, the constraint is the one that cannot be bypassed.
const migration = read("supabase/migrations/20260814150000_add_plan_and_subdomain_slugs.sql");
check("the database caps slugs at 63", /char_length\(slug\) between 2 and 63/.test(migration));
for (const reserved of ["www", "mail", "vercel", "cdn", "ns1"]) {
  check(`the database reserves "${reserved}"`, new RegExp(`'${reserved}'`).test(migration));
}

// Old links keep working: the route still exists and the proxy rewrites TO it.
check("the /p/[slug] route still exists", read("src/app/p/[slug]/page.tsx").includes("PublicProjectPage"));
const proxy = read("src/lib/supabase/proxy.ts");
check("the subdomain is served by rewriting to /p/[slug]", /url\.pathname = `\/p\/\$\{projectSlug\}`/.test(proxy));
check("it rewrites rather than redirects", /NextResponse\.rewrite/.test(proxy));

// Auth must never follow a project host.
// Compare the call sites, not the imports — both names appear at the top of
// the file and an import order proves nothing.
check("the project-host branch returns before any Supabase session work",
  proxy.indexOf("const projectSlug = slugFromHost") < proxy.indexOf("const supabase = createServerClient"));
check("no cookie is ever scoped to a parent domain",
  !/domain:\s*["'`]\.?ventrio/.test(read("src/lib/supabase/proxy.ts") + read("src/lib/actions/locale.ts")));

/* ── 2. branding ─────────────────────────────────────────────────────────── */

const publicPage = read("src/app/p/[slug]/page.tsx");
check("the published page renders the badge", /<VentrioBadge/.test(publicPage));
check("and only when branding is required", /\{branding && <VentrioBadge/.test(publicPage));

const badge = read("src/components/publishing/VentrioBadge.tsx");
check("the badge is Ventrio's, not the generated app's",
  !/dangerouslySetInnerHTML|srcDoc/.test(badge));
check("removing it opens the upgrade prompt rather than dismissing",
  /onClick=\{\(\) => setPrompt\(true\)\}/.test(badge));
check("the prompt says branding removal needs a paid plan", /upgradeTitle/.test(badge));
check("and offers pricing", /viewPricing/.test(badge));
check("it never blocks the app underneath", /pointer-events-none/.test(badge));
check("and is safe-area aware on phones", /env\(safe-area-inset-bottom\)/.test(badge));

// The owner's workspace preview must not show it.
check("the workspace preview does not render the badge",
  !/VentrioBadge/.test(read("src/components/workspace/AppPreview.tsx")));

// Entitlement, not a hardcoded truth.
const branding = read("src/lib/publishing/branding.ts");
check("branding is decided by the owner's entitlements", /canRemoveBranding/.test(branding));
check("and fails closed toward showing it", /return true;/.test(branding));

/* ── 3. plans and entitlements ───────────────────────────────────────────── */

check("there are exactly three plans", PLAN_IDS.length === 3);
check("free = 3 generations a month", PLANS.free.generationsPerMonth === 3);
check("free = one published project", PLANS.free.maxPublishedProjects === 1);
check("free keeps the badge", PLANS.free.canRemoveBranding === false);

check("pro = 30 generations a month", PLANS.pro.generationsPerMonth === 30);
check("pro publishes without limit", PLANS.pro.maxPublishedProjects === null);
check("pro may remove branding", PLANS.pro.canRemoveBranding === true);

check("studio = 100 generations a month", PLANS.studio.generationsPerMonth === 100);
check("studio publishes without limit", PLANS.studio.maxPublishedProjects === null);
check("studio may remove branding", PLANS.studio.canRemoveBranding === true);

// Fails closed: anything unrecognised is free, never generous.
for (const bad of [null, undefined, "", "enterprise", "PRO", 7, {}]) {
  check(`"${String(bad)}" resolves to free`, planFrom(bad) === "free");
}
check("and gets free's entitlements", entitlementsFor("nonsense").generationsPerMonth === 3);

/* ── 4. the free monthly quota was not restored to daily ─────────────────── */

const usage = read("src/lib/ai/usageLimits.ts");
check("generations still refill monthly", /first_version_generation:\s*"month"/.test(usage));
check("and the free default is still three", /DEFAULT_FREE_GENERATIONS_PER_MONTH = 3/.test(usage));
check("no per-day generation variable came back", !/GENERATIONS_PER_DAY/.test(usage));

// The plan's number is what the reservation is checked against.
const stage3 = read("src/lib/actions/stage3.ts");
check("the reservation uses the plan's allowance",
  /generationsPerMonth/.test(stage3) && /reserveUsage\(/.test(stage3));

// The publication ceiling is enforced on the server, not in a button.
const publishing = read("src/lib/actions/publishing.ts");
check("the publish action enforces the published-project ceiling",
  /maxPublishedProjects/.test(publishing));
check("by counting live publications for this user",
  /is_published", true\)/.test(publishing) || /eq\("is_published", true\)/.test(publishing));
check("and unlimited plans skip the check entirely",
  /maxPublishedProjects !== null/.test(publishing));

// Public URLs come from one builder.
check("the publish action returns the subdomain URL", /publicUrl: publicProjectUrl\(slug\)/.test(publishing));

/* ── 5. pricing reflects what is enforced ────────────────────────────────── */

const pricing = read("src/app/pricing/page.tsx");
check("the pricing page reads the entitlements rather than restating them",
  /PLANS\[plan\]/.test(pricing) && /generationsPerMonth/.test(pricing));
check("paid plans do not pretend to subscribe", /disabled/.test(pricing));
check("and say billing is not connected", /billingSoon|billingPending/.test(pricing));
/**
 * What the page must not claim.
 *
 * Comments are stripped first: this file's own doc comment names the things it
 * refuses to promise, and matching that would be the test failing on its own
 * explanation. Only what a visitor can read counts.
 */
const pricingCopy = pricing
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
for (const promise of ["custom domain", "unlimited generation", "team", "autonomous"]) {
  check(`pricing promises no ${promise}`, !new RegExp(promise, "i").test(pricingCopy));
}

/* ── 6. the publish notice moved, and still exists ───────────────────────── */

/*
 * It is a toast now, not an inline message under the toolbar. The message it
 * carries is unchanged — the point of the check was that publishing SAYS
 * something, success or failure, rather than completing in silence.
 */
const controls = read("src/components/publishing/PublicationControls.tsx");
check("publishing reports its outcome", /toast\.success\(result\.message\)/.test(controls));
check("and a failed publish is an error, not a status",
  /toast\.error\(result\.error\)/.test(controls));
check("copying the public link says what happened",
  /toast\.success\(t\("linkCopied"\)\)/.test(controls) &&
  /toast\.error\(t\("copyFailed"\)\)/.test(controls));

/*
 * Unpublishing takes a page off the internet, so it still asks first — but
 * through a real dialog rather than window.confirm, which cannot be styled,
 * cannot be translated, and on iOS blocks the whole page.
 */
const controlsCode = controls
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
check("unpublishing still confirms, without window.confirm",
  !/window\.confirm/.test(controlsCode) && /AlertDialogAction/.test(controlsCode),
  "the comment explaining the replacement is not the replacement");
const css = read("src/app/globals.css");
/**
 * It no longer participates in the toolbar's layout at all.
 *
 * These used to assert `align-self: center` and a `max-width` — the careful
 * handling an IN-FLOW notice needs so it does not distort the row. It still
 * distorted it: up to 15rem of inline-flex appearing inside a phone toolbar
 * pushed the pinned Publish and Close controls sideways for as long as the
 * message was up, which is the "publish feedback temporarily disrupts the
 * toolbar" report. Anchored below the controls instead, so the guarantee is
 * now structural rather than a matter of tuning.
 */
const inlineRule = css.split(".publication-message--inline {")[1]?.split("}")[0] ?? "";
check("the notice is out of the toolbar's flow", /position: absolute/.test(inlineRule));
check("anchored below the controls", /top: 100%/.test(inlineRule));
check("and still cannot stretch across the screen", /max-width/.test(inlineRule));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`launch prep: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`launch prep: ${passed} checks passed`);

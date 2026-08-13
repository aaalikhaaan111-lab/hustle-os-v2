/**
 * The three things that stopped Ventrio being usable end to end.
 *
 *   npx tsx --conditions=react-server scripts/launch-flow.test.mts
 *
 *   1. Discovery ran on Anthropic. That account ran out of credit and the whole
 *      funnel stopped — no project could be started, and because only discovery
 *      sets a direction, no existing project could reach generation either.
 *   2. Three failures ended a project permanently, whatever caused them. What
 *      caused them was us: a function timeout, a suspended invocation, a
 *      validator reading prose as a frame escape.
 *   3. Publishing only understood the page artifact, so a project built by the
 *      app runtime could be generated and previewed and never shared.
 *
 * Offline.
 */

import { readFileSync } from "node:fs";
import {
  APP_PUBLICATION_KIND,
  appPublicationPayload,
  parsePublicationPayload,
  publicationDescription,
  publicationName,
} from "../src/lib/publishing/payload";
import { APP_STATE_VERSION, type AppProjectState } from "../src/lib/v2/app/projectState";
import { TIMELINE_APP } from "../src/lib/v2/app/fixtures/timeline";
import { MAX_FIRST_VERSION_ATTEMPTS, MAX_FIRST_VERSION_JOBS } from "../src/lib/jobs/firstVersion";
import { SANDBOX_ATTRIBUTE } from "../src/lib/v2/app/sandbox";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

/* ── 1. nothing in the path to generation calls Anthropic ────────────────── */

const creation = read("src/lib/actions/creation.ts");
check("discovery no longer imports the Anthropic SDK", !/@anthropic-ai\/sdk/.test(creation));
check("and no longer constructs a client", !/new Anthropic\(\)/.test(creation));
check("it asks the Gemini discovery seam instead", /requestDiscoveryTurn\(/.test(creation));

const discovery = read("src/lib/v2/gemini/discovery.ts");
check("which resolves the Gemini config", /resolveGeminiConfig/.test(discovery));
check("and sends exactly one request", (discovery.match(/transport\.send\(/g) ?? []).length === 1);
// A person is waiting on this with a cursor blinking; it is not a generation.
check("with a short timeout", /DISCOVERY_TIMEOUT_MS = 45_000/.test(discovery));
check("and the least reasoning the API offers", /thinkingLevel: "minimal"/.test(discovery));
check("the caller's validator is still the authority", /sanitizeCreationTurn\(result\.value\)/.test(creation));

/* ── 2. our failures do not consume a project ────────────────────────────── */

const jobs = read("src/lib/jobs/generationJobs.ts");

/**
 * The rule, stated as a query: an attempt is spent only when the job kept the
 * unit it reserved. A refunded job did not charge the person, so it must not
 * charge the project either.
 */
check("attempts count only jobs that kept their quota",
  /\.not\("usage_reserved_at", "is", null\)[\s\S]{0,80}\.is\("usage_released_at", null\)/.test(jobs));
check("and no longer count rows by error code",
  !/attemptsSoFar[\s\S]{0,600}?COSTLESS_ERROR_CODES/.test(jobs));
check("a separate count bounds retrying overall", /export async function jobsSoFar/.test(jobs));

const action = read("src/lib/actions/stage3.ts");
check("the action checks both ceilings",
  /attempts >= MAX_FIRST_VERSION_ATTEMPTS \|\| jobs >= MAX_FIRST_VERSION_JOBS/.test(action));
check("the loop bound is the looser of the two", MAX_FIRST_VERSION_JOBS > MAX_FIRST_VERSION_ATTEMPTS);
check("and the charged bound is unchanged", MAX_FIRST_VERSION_ATTEMPTS === 3);

/**
 * The production sequence, modelled: three failures that were all refunded.
 *
 * Every one of those was Ventrio's fault — a 300 s function timeout, a
 * suspended invocation, a validator false positive — and each refunded the
 * user's unit. Under the old rule the project was finished. Under this one it
 * has spent nothing.
 */
interface Job { reserved: boolean; released: boolean; costless: boolean }
const spent = (list: Job[]) => list.filter((j) => j.reserved && !j.released).length;
const tried = (list: Job[]) => list.filter((j) => !j.costless).length;

{
  const refunded: Job[] = [
    { reserved: true, released: true, costless: false },  // function timeout
    { reserved: true, released: true, costless: false },  // suspended invocation
    { reserved: true, released: true, costless: false },  // gate false positive
  ];
  check("three refunded failures spend no attempts", spent(refunded) === 0);
  check("so the project can still be built", spent(refunded) < MAX_FIRST_VERSION_ATTEMPTS);
  check("and they are still counted against the loop bound", tried(refunded) === 3);
  check("which is nowhere near reached", tried(refunded) < MAX_FIRST_VERSION_JOBS);
}
{
  // Charged generations still count, so the intended limit is intact.
  const charged: Job[] = Array.from({ length: 3 }, () => ({ reserved: true, released: false, costless: false }));
  check("three charged generations reach the cap", spent(charged) >= MAX_FIRST_VERSION_ATTEMPTS);
}
{
  // Refunded failures cannot be retried without end, either.
  const many: Job[] = Array.from({ length: MAX_FIRST_VERSION_JOBS }, () => ({ reserved: true, released: true, costless: false }));
  check("an endlessly refunded loop still stops", spent(many) === 0 && tried(many) >= MAX_FIRST_VERSION_JOBS);
}
{
  // A row refused for having no quota did no work and counts against nothing.
  const outOfQuota: Job[] = [{ reserved: false, released: false, costless: true }];
  check("a limit-reached row costs nothing", spent(outOfQuota) === 0 && tried(outOfQuota) === 0);
}

/* ── 3. an application can be published ──────────────────────────────────── */

const state: AppProjectState = {
  version: APP_STATE_VERSION,
  kind: "app",
  app: TIMELINE_APP,
  generatedAt: "2026-08-12T10:00:00.000Z",
  model: "gemini-3.6-flash",
};

{
  const payload = appPublicationPayload(state);
  check("an application produces a tagged payload", payload.kind === APP_PUBLICATION_KIND);
  check("carrying the project itself", payload.app.files === TIMELINE_APP.files);
  check("and its name, denormalised", payload.name === TIMELINE_APP.metadata.name);

  // The round trip a visitor's request actually performs.
  const parsed = parsePublicationPayload(JSON.parse(JSON.stringify(payload)));
  check("it reads back as an application", parsed?.kind === "app");
  check("byte-identical source survives",
    parsed?.kind === "app" && JSON.stringify(parsed.app.files) === JSON.stringify(TIMELINE_APP.files));
  check("the name resolves for either shape", !!parsed && publicationName(parsed) === TIMELINE_APP.metadata.name);
  check("and so does the description",
    !!parsed && publicationDescription(parsed) === TIMELINE_APP.metadata.description);
}

/**
 * The gate runs again on read. A publication stored under an older set of rules
 * is not served because it was once acceptable.
 */
{
  const broken = {
    ...appPublicationPayload(state),
    app: {
      ...TIMELINE_APP,
      files: { ...TIMELINE_APP.files, "src/App.tsx": 'export default () => <img src="https://x.test/a.jpg" />;' },
    },
  };
  check("a publication the validator now refuses is not served",
    parsePublicationPayload(JSON.parse(JSON.stringify(broken))) === null);
}
check("an unknown payload version is refused",
  parsePublicationPayload({ ...appPublicationPayload(state), version: 99 }) === null);
check("and so is something that is neither shape", parsePublicationPayload({ nope: true }) === null);

/* ── 4. the public route serves it, sandboxed ────────────────────────────── */

const publicPage = read("src/app/p/[slug]/page.tsx");
check("the public page compiles the application per request", /buildGeneratedApp\(publication\.app/.test(publicPage));
check("carrying the request's CSP nonce", /x-nonce/.test(publicPage));
// A published app that no longer compiles is a 404, not a page of build errors.
check("a publication that fails to build is not found", /if \(!built\.ok\) notFound\(\)/.test(publicPage));
check("and the page still serves page artifacts", /ProjectOutputRenderer/.test(publicPage));

const view = read("src/components/publishing/PublicAppView.tsx");
check("the visitor's frame uses the shared sandbox attribute",
  /sandbox=\{SANDBOX_ATTRIBUTE\}/.test(view));
check("the document is srcDoc, never an address", /srcDoc=\{document\}/.test(view));
// Asserted on the value, not on the file's text: the comment above it mentions
// the token it must never contain, and a grep would pass on the wrong grounds.
const tokens = SANDBOX_ATTRIBUTE.split(" ").filter(Boolean).sort();
check("that attribute grants scripts and forms",
  tokens.join(" ") === "allow-forms allow-scripts", SANDBOX_ATTRIBUTE);
// The one that would return the frame to Ventrio's origin and make the whole
// sandbox decorative.
check("and never same-origin", !tokens.includes("allow-same-origin"), SANDBOX_ATTRIBUTE);

/* ── 5. publishing stays explicit, and private stays private ─────────────── */

const publishing = read("src/lib/actions/publishing.ts");
check("publishing is an action, not a side effect of generating",
  /export async function publishProjectAction/.test(publishing));
check("it refuses a project with nothing to publish", /if \(!payload \|\| !name\) return failure/.test(publishing));
check("republishing pushes whatever the project holds now",
  /export async function updatePublishedVersionAction[\s\S]{0,900}?publishablePayload\(app, output\)/.test(publishing));
check("unpublishing still exists", /export async function unpublishProjectAction/.test(publishing));

// An application collects nothing through Ventrio, so the public form endpoint
// must not accept submissions naming one.
const responses = read("src/app/api/public/projects/[slug]/responses/route.ts");
check("the public form endpoint refuses app publications",
  /if \(!publication\.output\) return response\("not_found", 404\)/.test(responses));

/* ── 6. the workspace stops offering what it already did ─────────────────── */

const workspace = read("src/components/build/PreOutputWorkspace.tsx");
// The gate has since gained `&& !intake.step`, so the build question and this
// card can never offer the same step twice. What matters here is unchanged:
// it is `hasVersion` that hides the card, not `output` — gating on the page
// artifact alone kept offering "Create first version" to app-runtime projects
// that already had one.
// Written as a term the gate must contain, not the whole expression: it has
// since gained `job.loaded &&` in front and `!intake.step` behind, and neither
// changes what this pins — the card is hidden by `hasVersion`, never by
// `output` alone, which is what kept offering it to app-runtime projects.
check("the build card is hidden once a version exists in either shape",
  /&& !hasVersion && !job\.active && /.test(workspace));
check("and never gates on the artifact shape alone",
  !/\{!output && !job\.active && \(/.test(workspace));
// Publishing moved from the conversation into the preview toolbar, so the
// gate is now the toolbar slot. What matters is unchanged and is what is
// asserted: it is offered for `hasVersion` — an app or an artifact — and never
// for `output` alone, which is what left app-runtime projects unable to share.
check("and publishing is offered for either shape",
  /publishControl=\{\s*hasVersion \? \(/.test(workspace));
check("publishing is not gated on the artifact shape",
  !/publishControl=\{\s*output \?/.test(workspace));
check("both derive from the same test", /const hasVersion = Boolean\(output\) \|\| Boolean\(app\)/.test(workspace));

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`launch flow: ${passed} checks passed`);

/**
 * `/create` when discovery works, and when the provider does not.
 *
 *   npx tsx --conditions=react-server scripts/creation-fallback.test.mts
 *
 * WHY. Discovery is one model call standing in front of the whole product: it
 * is the only thing that sets a project's direction, so while it is down nobody
 * can start a project and no draft can reach generation. That has happened
 * twice — an Anthropic account out of credit, and a Gemini outage where a
 * trivial request took 34.5 s — and both times generation itself was healthy
 * and completely unreachable.
 *
 * So this pins both halves. Discovery still works and is still preferred; and
 * every way it can fail leaves the person a direction built from their own
 * words, which passes the same server-side validation a proposed direction does
 * and continues into the same flow.
 *
 * The transport runs for real against a fake `fetch`, so the reasons asserted
 * below are the strings production actually produces rather than strings this
 * file invented. Offline: no network, no database, no provider.
 */

import { readFileSync } from "node:fs";
import { requestDiscoveryTurn } from "../src/lib/v2/gemini/discovery";
import { buildFallbackDirection, nameFromIdea, shouldOfferFallback } from "../src/lib/build/creationFallback";
import { sanitizeCreationDirection, sanitizeCreationTurn } from "../src/lib/build/creationTypes";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

process.env.GEMINI_API_KEY = "AIzaSyFAKEKEYFAKEKEYFAKEKEYFAKEKEY0000000";

const realFetch = globalThis.fetch;
type Init = { signal?: AbortSignal };

/** Replaces `fetch` for one call. The transport resolves it at call time. */
function respondWith(status: number, payload: unknown, opts: { hang?: boolean } = {}): void {
  globalThis.fetch = (async (_url: string, init: Init) => {
    if (opts.hang) {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init.signal;
        const abort = () => reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
        if (signal?.aborted) abort();
        else signal?.addEventListener("abort", abort, { once: true });
      });
    }
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => payload,
      text: async () => (typeof payload === "string" ? payload : JSON.stringify(payload)),
    } as Response;
  }) as typeof globalThis.fetch;
}

const geminiSaying = (text: string) => ({
  candidates: [{ content: { parts: [{ text }] }, finishReason: "STOP" }],
  usageMetadata: { promptTokenCount: 900, candidatesTokenCount: 700 },
  modelVersion: "gemini-3.6-flash-001",
});

const HISTORY = [{ role: "user" as const, content: "a guide to glazing pottery for evening studio classes" }];
const ask = () => requestDiscoveryTurn({ system: "You are Ventrio's creation guide.", history: HISTORY });

/** A complete proposal, shaped the way the prompt asks for one. */
const PROPOSAL = JSON.stringify({
  phase: "propose",
  message: "Here are two ways to take this.",
  directions: [{
    name: "Wheelside Glaze Guide",
    concept: "A reference for evening pottery students choosing a glaze.",
    forWho: "Evening class potters",
    creates: "A page listing five cone-6 glaze combinations with photos",
    whyFits: "You already answer these questions in class.",
    projectType: "content_media",
    problem: "Students guess at glaze combinations and lose pieces.",
    audience: "Evening pottery students",
    niche: "pottery",
    creativeBrief: {
      startingMaterial: "your studio notes",
      motivation: "fewer ruined pieces",
      firstAudience: "your Tuesday class",
      desiredExperience: "look up a combination in ten seconds",
      personalIngredients: ["ten years at the wheel"],
      constraints: [],
      assumptions: ["cone 6 is the studio default"],
    },
  }],
});

/* ── 1. discovery works, and is the path taken ───────────────────────────── */

{
  respondWith(200, geminiSaying(PROPOSAL));
  const result = await ask();

  check("a good discovery response succeeds", result.ok === true, result.ok ? "" : result.reason);
  if (result.ok) {
    const turn = sanitizeCreationTurn(result.value);
    check("and validates into a turn", turn !== null);
    check("which proposes a direction", turn?.phase === "propose" && turn.directions.length === 1);
    check("carrying the model's own words", turn?.directions[0]?.name === "Wheelside Glaze Guide");
    // The model's brief is kept as the model wrote it: this path does not
    // touch what discovery earned by asking.
    check(
      "and the personal ingredients discovery collected",
      turn?.directions[0]?.creativeBrief.personalIngredients.length === 1,
    );
  }
}

/* ── 2. every provider failure offers a way forward ──────────────────────── */

const IDEA = "a guide to glazing pottery for evening studio classes";

const COPY = {
  audience: "Not narrowed yet",
  problem: "Taken from the idea as written",
  whyFits: "It is your own idea, in your own words.",
  creates: "A first version of the idea exactly as described",
  assumption: "The creation conversation did not happen; these are assumed.",
};

/**
 * The failures this has to survive, each produced by running the real
 * transport rather than by naming a code.
 */
const OUTAGES: Array<{ label: string; arrange: () => void; expect: string }> = [
  { label: "429 rate limit", arrange: () => respondWith(429, { error: "slow down" }), expect: "rate_limited" },
  { label: "503 unavailable", arrange: () => respondWith(503, { error: "overloaded" }), expect: "server_error" },
  { label: "500 server error", arrange: () => respondWith(500, { error: "boom" }), expect: "server_error" },
  { label: "a reply that is not JSON", arrange: () => respondWith(200, geminiSaying("I'd love to help!")), expect: "unparseable" },
];

for (const outage of OUTAGES) {
  outage.arrange();
  const result = await ask();

  check(`${outage.label} fails`, result.ok === false);
  const reason = result.ok ? "" : result.reason;
  check(`${outage.label} reports ${outage.expect}`, reason.startsWith(outage.expect), reason);
  check(`${outage.label} offers the fallback`, shouldOfferFallback(reason), reason);
}

/* a missing key is an outage too, and the one that used to be fatal */

{
  const saved = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  const result = await ask();
  process.env.GEMINI_API_KEY = saved;

  const reason = result.ok ? "" : result.reason;
  check("an unconfigured provider fails", result.ok === false);
  check("and says so", reason.startsWith("unconfigured"), reason);
  check("and still offers the fallback", shouldOfferFallback(reason), reason);
}

/* ── 3. the fallback direction is usable, and is theirs ──────────────────── */

{
  const direction = buildFallbackDirection({ idea: IDEA, copy: COPY });
  check("a real idea produces a direction", direction !== null);
  if (direction) {
    check("whose concept is the person's own words", direction.concept === IDEA, direction.concept);
    check("and whose starting material is too", direction.creativeBrief.startingMaterial === IDEA);
    check("named from what they wrote", direction.name.toLowerCase().startsWith("a guide to"), direction.name);

    /**
     * The check that matters most.
     *
     * The direction travels back through the client and is re-validated by
     * `selectCreationDirectionAction` exactly like a direction the model
     * proposed. If it does not survive that, the offer is a button that leads
     * nowhere.
     */
    const round = sanitizeCreationDirection(direction);
    check("and survives the same validation a proposed direction faces", round !== null);
    check("with the concept intact", round?.concept === IDEA);
    check("and a valid preset", round?.projectType === "digital_product");
    check("and a niche the sanitizer filled in", round?.niche === "other", String(round?.niche));

    /* it must not invent what discovery earns by asking */
    check("no personal ingredients are invented", direction.creativeBrief.personalIngredients.length === 0);
    check("no constraints are invented", direction.creativeBrief.constraints.length === 0);
    check(
      "and what was assumed is recorded as an assumption",
      direction.creativeBrief.assumptions.length === 1
        && direction.creativeBrief.assumptions[0] === COPY.assumption,
      JSON.stringify(direction.creativeBrief.assumptions),
    );
  }
}

/* ── 4. it declines when there is nothing to build from ──────────────────── */

for (const thin of ["hi", "   ", "help me", "?", "a site"]) {
  check(
    `"${thin.trim()}" is not enough to build a project from`,
    buildFallbackDirection({ idea: thin, copy: COPY }) === null,
  );
}

check(
  "a long idea in Russian works the same way",
  buildFallbackDirection({ idea: "справочник по глазурям для вечерних занятий керамикой", copy: COPY }) !== null,
);

/* ── 5. storage failures are not offered a fallback ──────────────────────── */

// Taking the fallback writes to the same tables that just refused a write, so
// offering it would promise a way forward that cannot work.
check("a snapshot save failure offers nothing", !shouldOfferFallback("snapshot_save_failed"));
check("an assistant message save failure offers nothing", !shouldOfferFallback("assistant_message_save_failed"));
check("and neither does an empty history", !shouldOfferFallback("empty_history"));
check("while a validation failure does", shouldOfferFallback("turn_failed_validation"));
check("and so does a throw", shouldOfferFallback("threw:TypeError:x"));
check("and a timeout", shouldOfferFallback("timeout:The request exceeded its budget."));

/* ── 6. negative controls ────────────────────────────────────────────────── */

/**
 * Without these the suite would pass against a builder that returned a
 * half-built direction, or a validator that accepted anything.
 */
{
  const missingCopy = buildFallbackDirection({ idea: IDEA, copy: { ...COPY, whyFits: "   " } });
  check("a direction with a missing field is not returned", missingCopy === null);

  const stripped = { ...buildFallbackDirection({ idea: IDEA, copy: COPY })!, audience: "" };
  check("and the validator would have rejected it anyway", sanitizeCreationDirection(stripped) === null);

  check("nameFromIdea refuses a name it cannot make", nameFromIdea("  ") === "");
}

/* ── 7. the copy the action asks for exists in both languages ────────────── */

const KEYS = ["fallbackOffer", "fallbackNote", "fallbackAudience", "fallbackProblem", "fallbackWhyFits", "fallbackCreates", "fallbackAssumption"];
for (const locale of ["en", "ru"]) {
  const messages = JSON.parse(readFileSync(new URL(`../messages/${locale}.json`, import.meta.url), "utf8")) as {
    create: Record<string, string>;
  };
  for (const key of KEYS) {
    check(`${locale}.${key} exists`, typeof messages.create[key] === "string" && messages.create[key].length > 0);
  }
}

/* ── 8. the stale Anthropic gate is gone ─────────────────────────────────── */

// It outlived its provider: discovery moved to Gemini and this line stayed,
// so `/create` was gated on a key it no longer used. A naive search finds the
// comment that explains it, so the code is read with comments stripped.
const creationSource = readFileSync(new URL("../src/lib/actions/creation.ts", import.meta.url), "utf8")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "");
check("discovery is not gated on an Anthropic key", !/ANTHROPIC_API_KEY/.test(creationSource));

globalThis.fetch = realFetch;

if (failures.length > 0) {
  console.error(`creation-fallback: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`creation-fallback: ${passed} checks passed`);

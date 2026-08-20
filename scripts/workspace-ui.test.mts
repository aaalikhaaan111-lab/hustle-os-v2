/**
 * The conversation-first workspace: what belongs where.
 *
 *   npx tsx --conditions=react-server scripts/workspace-ui.test.mts
 *
 * One product rule, checked six ways. The chat is for talking to Ventrio —
 * requests, answers, progress, decisions. The preview owns the thing Ventrio
 * made — viewport, publish, share, open. Before this pass the two were mixed:
 * publishing lived in the conversation, the viewport controls floated in a rail
 * over the work, proposals arrived as dashboard cards, generation covered the
 * screen with an overlay counting invented steps, and Versions was a navigation
 * item leading to a page whose only content was that it was empty.
 *
 * These are source-level assertions. There is no DOM in this repo's test
 * environment, so what can be pinned is which module renders which control, and
 * that is exactly what regressed here — a layout detail is a preference, but a
 * Publish button in the chat is the rule breaking again.
 *
 * Offline. No network, no database, no provider.
 */

import { existsSync, readFileSync } from "node:fs";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
/** Comments explain the removals at length; a naive search would find them. */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

const shell = read("src/components/workspace-ui/WorkspaceShell.tsx");
const buildScreen = read("src/components/workspace/BuildScreen.tsx");
const preOutput = read("src/components/build/PreOutputWorkspace.tsx");
const workspaceView = read("src/components/build/WorkspaceView.tsx");
const createExperience = read("src/components/create/CreateExperience.tsx");
const structuredChoice = read("src/components/build/Questionnaire.tsx");
const analytics = read("src/app/projects/[id]/analytics/page.tsx");
const publishing = read("src/lib/publishing/queries.ts");

/* ── 1. Versions is gone from the product, not from the code ─────────────── */

check(
  "the Versions route no longer exists",
  !existsSync(new URL("../src/app/projects/[id]/versions/page.tsx", import.meta.url)),
);
check("no navigation item points at it", !/\/versions/.test(code(shell)));
check("and nothing else links to it", !/\/versions/.test(code(workspaceView)));

// The infrastructure stays: this was a navigation decision, not a deletion.
const workspaceTypes = read("src/lib/workspace/types.ts");
check("the version types survive", /ProjectVersionSummary/.test(workspaceTypes));
check("and so does the loader", /export function loadProjectVersions/.test(workspaceTypes));

/* ── 2. product controls live in the preview toolbar ─────────────────────── */

const toolbar = buildScreen.slice(
  buildScreen.indexOf("The preview toolbar"),
  buildScreen.indexOf("min-h-0 flex-1 overflow-auto"),
);
for (const control of ["viewportDesktop", "viewportMobile", "fullScreen", "copyPreviewLink", "openPublicPage", "publishControl"]) {
  check(`the toolbar owns ${control}`, toolbar.includes(control), "missing from the toolbar block");
}

/**
 * THE FLOATING RAIL IS GONE, so there is nothing left to keep out of it.
 *
 * It was two icon buttons in a pill down the right edge for switching between
 * the conversation and the page. It reserved a 92px gutter that pushed the
 * page off-centre, and it duplicated a control that exists in two better
 * places: Close lives in the capsule attached to the page, and on a phone the
 * mode switch sits above both surfaces.
 */
check("the floating rail is retired", !/RailButton/.test(code(buildScreen)));
check("and its gutter with it", !/lg:pr-\[92px\]/.test(code(buildScreen)),
  "92px reserved for a rail that no longer exists, pushing the page off-centre");
check("closing the page is still reachable", /closePreview/.test(buildScreen));
check("and switching surface on a phone still is", /ModeSwitch/.test(buildScreen));

/* ── 3. no product controls left in the chat ─────────────────────────────── */

/**
 * The specific regression: `PublicationControls` used to render inside the
 * conversation column. It may now appear only as the toolbar's `publishControl`.
 */
const publishUses = [...code(preOutput).matchAll(/<PublicationControls/g)].length;
check("the chat renders publish exactly once, as the toolbar slot", publishUses === 1, `${publishUses} uses`);
check(
  "and that use is the toolbar slot",
  /publishControl=\{[\s\S]{0,200}<PublicationControls/.test(preOutput),
);
check("the toolbar form is the compact one", /compact\s*$/m.test(preOutput) || /compact\n/.test(preOutput));
check(
  "the compact form does not repeat the toolbar's own actions",
  !/copyLink|t\("open"\)|t\("share"\)/.test(
    read("src/components/publishing/PublicationControls.tsx").split("if (compact)")[1]?.split("return (")[1]?.slice(0, 900) ?? "",
  ),
);
/*
 * FEEDBACK IS NOT IN THE CHAT. It used to sit at the foot of the thread on
 * every project that had published anything, so a conversation you had just
 * opened ended with a responses section whether or not there were any
 * responses — furniture filling the space under the last message. Responses
 * are what the Analytics screen is for.
 */
check("the responses panel is not in the conversation",
  !/<FeedbackPanel/.test(preOutput),
  "a feedback section under every chat is filler, not a conversation");

/* ── 4. generation happens in the conversation ───────────────────────────── */

check(
  "the full-screen generation overlay is gone",
  !/CreationTransition/.test(createExperience),
  "the detached generation screen is back",
);
check("and its fixed overlay with it", !/fixed inset-0 z-\[90\]/.test(createExperience));
check(
  // Comment-stripped, and the window is 700 rather than 400: the indicator is
  // now the same three-dot element the conversation and the preview use, which
  // is four spans instead of one. The property under test is unchanged —
  // progress renders INLINE in the stream, not in a detached overlay.
  "progress is rendered inside the message stream",
  /creating && \([\s\S]{0,700}progressPreparing/.test(code(createExperience)),
);

/**
 * Truthfulness. Every progress line must correspond to a state the component is
 * genuinely in, so each one is checked against the phase that produces it.
 */
for (const [phase, key] of [["persisting", "progressPreparing"], ["generating", "progressBuilding"]] as const) {
  check(`"${key}" is shown for the ${phase} phase`, new RegExp(`"${phase}"[\\s\\S]{0,80}${key}`).test(createExperience));
}
const messages = JSON.parse(read("messages/en.json")) as { create: Record<string, string>; workspace: Record<string, string> };
for (const key of ["progressPreparing", "progressBuilding", "progressOpening"]) {
  check(`${key} exists`, typeof messages.create[key] === "string");
}

// The workspace's own progress still comes from the job row, not from a timer.
// Stages moved out of an inline label function into `generationProgress`, which
// maps the pipeline's own `progress_stage` values. Still the job row, one
// indirection along, and now the whole list rather than one active line.
check("workspace stages are read from the job", /generationProgress\(job\.stage, job\.phase\)/.test(preOutput));

/* ── 5. choices are stacked rows, not columns ────────────────────────────── */

const createCode = code(createExperience);
check(
  "no multi-column choice grid remains in /create",
  !/sm:grid-cols-|md:grid-cols-|lg:grid-cols-/.test(createCode),
  "a responsive column grid is back",
);
/*
 * THE OPTIONS LEFT THE TRANSCRIPT.
 *
 * They used to render inside the latest assistant turn, which is why they had
 * to be gated on being the latest one — options belonging to an older question
 * must never still be clickable. They are a strip docked above the composer
 * now, rendered straight from the CURRENT `turn`, so staleness is structurally
 * impossible rather than guarded: there is only ever one strip and it always
 * describes the question being asked.
 */
/*
 * THE OFFICIAL COMPONENT, not a reimplementation.
 *
 * Choice semantics, roving focus, keyboard shortcuts, validation, skip and
 * submit all come from `@shadcn/react/questionnaire` via the vendored registry
 * source. Asserting on our own markup for those would be asserting on code we
 * no longer own, so the checks here are: we use the real component, we pass it
 * the composer, and we allow a freeform answer.
 */
check("the proposal renders in the composer-attached surface",
  /<VentrioQuestionnaire[\s\S]{0,900}composer=\{/.test(createExperience));
check("with one chip per direction",
  /turn\?\.directions \?\? \[\]\)\.map/.test(createExperience));
check("and the large card is gone", !/direction-card|DirectionCard/.test(createCode));
/**
 * Two stacked surfaces now, not three: the proposal and the discovery choices.
 *
 * The third was the empty state's five starting points, which were full-width
 * rows under a marketing hero. The hero is gone — it was a landing page inside
 * the product — and the starting points are chips in the conversation flow, at
 * the weight of a suggestion. The rule they existed to satisfy still holds and
 * is asserted below: nothing on this screen is a column grid on a phone.
 */
check("discovery choices use that same surface",
  (createExperience.match(/<VentrioQuestionnaire/g) ?? []).length === 1 &&
  /showDirections\s*\?/.test(createExperience),
  "clarifications and proposals must not drift into two presentations again");
/**
 * DELIBERATELY REVERSED, and worth stating rather than quietly editing.
 *
 * This asserted chips in a wrapping row. It was itself the fix for an earlier
 * defect — the screen opened with a marketing hero (`clamp(2.35rem, 5vw, 3rem)`
 * plus a signal dot) over five bordered starting-point cards, and that was
 * removed as "a landing page inside the product".
 *
 * Chips over-corrected. A row of capsules is the web's convention for FILTERS —
 * ways to narrow something already on screen — and these are openings. At 17px
 * under a 17px question, the first screen of the product read as a form label
 * above a filter bar.
 *
 * The opening is now `s-opening` (24/28px), which is the size of someone asking
 * a question and is deliberately smaller than `s-display`; the starting points
 * are plain lines. The rule the hero violated still holds and is asserted right
 * below: no display face, no signal dot, nothing on this screen is a grid.
 */
/**
 * THE FRONT DOOR GREETS YOU, and this assertion has now moved three times, so
 * it is worth writing down what the rule actually is.
 *
 *   v1  a marketing hero: an "IDEA → POSSIBILITY" eyebrow, a headline at
 *       clamp(2.35rem, 8vw, 5.2rem), a subhead, a signal dot. Removed as "a
 *       landing page inside the product".
 *   v2  17px, which read as a form label on the first screen of the product.
 *   v3  24px, still described as weak typography.
 *   v4  the greeting, in the display serif, on the colour field.
 *
 * v4 is not a return to v1, and the difference is what this checks. A hero
 * SELLS: it has an eyebrow, a signal dot and a subhead written at the reader.
 * A greeting ASKS: it is the assistant's own question, in the product's voice,
 * with the answer field directly under it. Both reference products do exactly
 * this on their creation screen.
 *
 * What must stay true is that the display face never appears in the THREAD —
 * the original defect was a reply promoted to headline type.
 */
check("the front door greets rather than sells",
  /emptyPrompt/.test(createCode) && /s-greet/.test(createCode));
check("with no eyebrow, signal dot or marketing subhead",
  !/openingSignal/.test(createCode) && !/creation-signal-dot/.test(createCode),
  "checked against comment-stripped source: the prose explaining the rule names the very strings it forbids");
check("and no display face anywhere in the thread",
  !/s-greet|s-display/.test(createCode.slice(createCode.indexOf("messages.map"))),
  "a reply set as a headline is the defect this rule exists for");
check("and the marketing hero is gone",
  !/openingSignal/.test(createCode) && !/clamp\(2\.35rem/.test(createCode),
  "an 83px display headline and an eyebrow are an advertisement for a product already open");

// The compact intake was a sideways filmstrip; options off-screen are options
// nobody knows about.
/*
 * CHIPS THAT WRAP, not cards that stack.
 *
 * The options were full-width bordered cards, one per line — three tall
 * rectangles above the composer that read as a form docked to the page rather
 * than as a question somebody just asked. Wrapping chips let the whole question
 * occupy about the height of one message, which is what stops it looking like
 * permanent UI.
 */
check("intake options come from the official component",
  /@shadcn\/react\/questionnaire/.test(read("src/components/ui/shadcn/questionnaire.tsx")));
check("and the answer is never limited to the options",
  /freeformLabel/.test(structuredChoice),
  "a closed list of buttons tells people those are the only allowed answers");
check("and no longer scroll sideways", !/overflow-x-auto/.test(code(structuredChoice)));
check("nor snap horizontally", !/snap-x|snap-mandatory/.test(code(structuredChoice)));

const css = read("src/app/globals.css");
check("the row style is a single column", /\.choice-stack \{[\s\S]{0,120}flex-direction: column/.test(css));
check("and the supporting line is one line on a wide row", /\.choice-row-hint \{[\s\S]{0,220}white-space: nowrap/.test(css));
/**
 * ...and two on a phone. The hint is what separates one proposed direction
 * from another, so clipping it to an ellipsis at 390px hides the difference at
 * the moment the choice is made. Both halves are pinned: the row stays bounded
 * on desktop, and stays readable on mobile.
 */
check(
  "and wraps to two lines below md rather than clipping",
  /@media \(max-width: 767px\)[\s\S]{0,320}\.choice-row-hint \{[\s\S]{0,220}line-clamp: 2/.test(css),
);

/* ── 6. analytics shows only what is measured ────────────────────────────── */

check("analytics reads a real loader", /loadProjectAnalytics/.test(analytics));
check(
  "which counts responses and distinct submitters",
  /responseCount: rows\.length/.test(publishing) && /new Set\(rows\.map\(\(row\) => row\.submitter_hash\)\)\.size/.test(publishing),
);

// The invented furniture: a readiness checklist with a permanently-false row,
// a five-step sequence, and seven things Ventrio "watches for".
for (const gone of ["readinessTracking", "readinessPattern", "analyzeCompletion", "analyzeReturn", "analyticsStep1"]) {
  check(`analytics no longer renders ${gone}`, !analytics.includes(gone));
}
// Views and visitors are not tracked anywhere, so they must not be claimed.
for (const fake of ["views", "visitors", "sessions", "bounce", "impressions"]) {
  check(`analytics claims no ${fake} metric`, !new RegExp(`metric${fake}`, "i").test(analytics));
}
/*
 * A CHART IS DRAWN NOW — but only over a series that exists.
 *
 * The old rule was "no chart", because every chart on this screen plotted
 * invented numbers. The rule was never really about charts; it was that
 * nothing may be drawn that is not measured. Responses per day IS measured —
 * it is built from the `created_at` of the rows already fetched — so it is
 * allowed to be drawn, and the assertions now guard the thing that mattered:
 * the series is derived from real rows, and it is not drawn when there is
 * nothing to see.
 */
check("the response series is derived from real rows, not generated",
  /perDay/.test(publishing) && /daily\.push\(\{ date: key, responses: perDay\.get\(key\) \?\? 0 \}\)/.test(publishing),
  "a chart is only honest if its points are counts of things that happened");
check("no chart is drawn without at least two days to compare",
  /analytics\.daily\.length > 1 &&/.test(analytics),
  "a single point is not a trend, and an empty axis is not an insight");
check("and the metric tiles still claim nothing extra",
  !/sparkline/i.test(code(analytics)));
check("the gap is stated rather than hidden", /analyticsScopeNote/.test(analytics));
check(
  "and the note says what is not tracked",
  /does not track page views or visitors/.test(messages.workspace.analyticsScopeNote ?? ""),
);
check("unpublished projects get an empty state", /analyticsUnpublishedTitle/.test(analytics));
check("published-but-quiet projects get their own", /analyticsQuietTitle/.test(analytics));
check("zeroes are not shown as measurements", /state === "live" \?/.test(analytics));

/* ── the clarification panel is its own object ───────────────────────────── */

/**
 * The questionnaire used to draw ONE border around the question AND the
 * composer, with the composer's own border stripped inside it, so the input
 * appeared to grow upward to hold a question. The intent was that a question
 * belongs to the composer; the result was a single tall surface in which the
 * transcript, the question and the input all read as one oversized card.
 *
 * These check the SEPARATION only. The interaction is the registry's and is
 * asserted by its own presence below — nothing about answering, typing a
 * freeform reply, skipping or submitting moved.
 */
const ask = read("src/components/build/Questionnaire.tsx");
const studioCss = read("src/app/studio.css");

check("the composer is a sibling of the panel, not a child of it",
  /<\/div>\s*\{composer\}\s*<\/>/.test(ask),
  "wrapping the composer is what made one oversized surface");
check("the combined shell is gone",
  !/s-ask-shell/.test(ask) && !/s-ask-shell/.test(studioCss) &&
  !/s-ask-seam/.test(ask) && !/s-ask-seam/.test(studioCss));
/**
 * THE PANEL IS NOT BOUNDED ANY MORE, AND THAT IS THE FIX.
 *
 * Bounding it solved the first bug — the question no longer looked like part of
 * the composer — but created a second: three bordered boxes stacked vertically
 * (last message, panel, composer) read as a floating widget rather than as the
 * assistant's turn. The container is gone entirely; the options carry the only
 * borders, so the hierarchy a person sees is message, options, composer.
 */
check("the panel draws no container of its own",
  /\.s-ask-panel \{[^}]*\}/.test(studioCss) &&
  !/\.s-ask-panel \{[^}]*border:/.test(studioCss) &&
  !/\.s-ask-panel \{[^}]*background:/.test(studioCss) &&
  !/\.s-ask-panel:focus-within/.test(studioCss),
  "a border, a fill or a focus ring here is what made it a floating card");
check("it still carries spacing and an entry animation",
  /\.s-ask-panel \{[^}]*margin-bottom:/.test(studioCss) &&
  /\.s-ask-panel \{[^}]*animation: s-ask-in/.test(studioCss));
check("and the form is flush, so the options line up with the conversation",
  /\.s-ask-form \{ padding: 0 0 /.test(studioCss),
  "horizontal padding here insets the options from the transcript's left edge");

/* Each option is its own control now: a real border before you reach it, a
   hover, a distinct selected state, and a transition between them. */
check("every option has its own border rather than a transparent one",
  /\.cn-questionnaire-choice \{[^}]*border: 1px solid var\(--border\)/.test(studioCss),
  "a transparent border only looks clickable once the pointer is already there");
check("options have hover, selected and a bounded transition",
  /\.cn-questionnaire-choice:hover \{/.test(studioCss) &&
  /\.cn-questionnaire-choice\[data-checked\] \{[^}]*border-color: var\(--color-accent\)/.test(studioCss) &&
  /\.cn-questionnaire-choice \{[^}]*transition:[\s\S]{0,160}160ms/.test(studioCss));
check("and the composer keeps its own border and focus ring",
  !/\.s-ask-panel \.s-composer/.test(studioCss),
  "the old rule stripped the composer's border so the two would merge");
check("no question means no panel at all",
  /if \(options\.length === 0\) return <>\{composer\}<\/>;/.test(ask),
  "a clarification that is always there is furniture, not a clarification");

/* The behaviour is still the registry component's, untouched. */
check("answering, freeform, skip and submit are still the registry's",
  /<QuestionnaireChoices>/.test(ask) && /<QuestionnaireInput/.test(ask) &&
  /<QuestionnaireSkip/.test(ask) && /<QuestionnaireSubmit/.test(ask) &&
  /onAnswer\(\{ ids, text: text\.trim\(\) \}\)/.test(ask));

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`workspace-ui: ${failures.length} failed, ${passed} passed`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`workspace-ui: ${passed} checks passed`);

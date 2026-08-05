/**
 * Regression tests for the landing-to-generation activation flow.
 *
 *   npx tsx scripts/activation.test.mts
 *
 * Five separate defects broke the same journey: the landing prompt was lost at
 * the auth boundary, the assistant answered in the wrong language, the creation
 * guide refused to build until it had a complete picture, the preview panel did
 * not exist before the first generation, and a conversation had no address so
 * "new chat" did not survive a reload.
 *
 * The language rules are tested as behaviour. The rest are pinned at the source
 * level: they are routing, prompt and query decisions with no pure function to
 * call, and a source assertion that names the exact mistake is worth more than
 * no test at all. Each was checked against the mutation it describes.
 */

import { readFileSync } from "node:fs";
import { detectMessageLocale, replyLocaleFor } from "../src/lib/build/messageLocale";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const landing = read("src/components/landing/LandingComposer.tsx");
const signupForm = read("src/components/auth/SignupForm.tsx");
const callback = read("src/app/auth/callback/route.ts");
const assistant = read("src/lib/actions/assistant.ts");
const creation = read("src/lib/actions/creation.ts");
const buildAi = read("src/lib/actions/buildAi.ts");
const buildScreen = read("src/components/workspace/BuildScreen.tsx");
const chat = read("src/components/build/AssistantChat.tsx");
const projectPage = read("src/app/projects/[id]/page.tsx");

/* ── 1. the landing prompt survives authentication ──────────────────────── */

// The seed itself always worked. What was missing is that nothing told the auth
// round trip where to come back to, so Google sign-in ended on /dashboard with
// the idea still unread in sessionStorage.
check("the landing composer still captures the idea before routing", /writeSeed\(/.test(landing));
check(
  "logged out, the landing composer asks to return to /create",
  /\/signup\?next=\$\{encodeURIComponent\("\/create"\)\}/.test(landing),
);
check(
  "already authenticated, it goes straight to /create",
  /isAuthenticated \? "\/create"/.test(landing),
);
check("the signup form reads the requested destination", /searchParams\.get\("next"\)/.test(signupForm));
check("and hands it to Google sign-in", /next=\{next\}/.test(signupForm));

// The callback already understood `next`; it must keep doing so, and must keep
// refusing anything that is not a local path.
check("the callback honours a safe next", /isSafeRedirectPath\(requestedNext\)/.test(callback));
check("the callback still defaults to Overview when nothing was asked for", /safeNext \?\? "\/dashboard"/.test(callback));

/* ── 2. the reply follows the language of the message ───────────────────── */

check("a Russian idea is Russian", detectMessageLocale("сделай сайт про вселенную марвел") === "ru");
check("an English idea is English", detectMessageLocale("build me a site about the marvel universe") === "en");

// A Russian sentence carrying a Latin brand name is still Russian. This is the
// common case for the exact prompt in the bug report.
check("Latin brand names do not flip Russian", detectMessageLocale("сделай сайт про Marvel") === "ru");
check("Cyrillic wins on mixed text", detectMessageLocale("хочу landing page для кофейни") === "ru");

// Weak signals must not flip an established conversation mid-thread.
for (const weak of ["ok", "да", "123", "👍", "", "https://example.com/a/b"]) {
  check(`"${weak}" is not evidence of a language`, detectMessageLocale(weak) === null);
}
check("a weak message keeps the established language", replyLocaleFor("ok", "ru") === "ru");
check("a clear message overrides the stored language", replyLocaleFor("build me a landing page", "ru") === "en");
check("and in the other direction too", replyLocaleFor("сделай лендинг для кофейни", "en") === "ru");

// The three cases named in the report.
check("Russian prompt → Russian reply", replyLocaleFor("привет, сделай сайт про марвел", "en") === "ru");
check("English prompt → English reply", replyLocaleFor("hello, build a site about marvel", "ru") === "en");
check(
  "Russian UI with an English prompt → English reply",
  replyLocaleFor("build a site about marvel", "ru") === "en",
);

// The stored locale must no longer be the sole source of the reply language.
check(
  "the assistant derives its language from the message",
  /replyLocaleFor\(trimmed, storedLocale\)/.test(assistant),
);
check(
  "the creation guide does too",
  /replyLocaleFor\(message, storedLocale\)/.test(creation),
);
check(
  "a settled language change is persisted",
  /update\(\{ locale \}\)/.test(assistant) && /update\(\{ locale \}\)/.test(creation),
);

// The prompts must say the message wins, not the interface.
for (const [name, source] of [["assistant", buildAi], ["creation guide", creation]] as const) {
  check(
    `the ${name} prompt names the user's message as the language authority`,
    /most recent message/.test(source) && /overrides the interface language/.test(source),
  );
}

/* ── 3. the product builds instead of interviewing ──────────────────────── */

// The gate: a four-fact completeness threshold that had to be met before the
// guide was allowed to propose anything, which is what kept projects parked in
// discovery.
check(
  "the four-fact completeness gate is gone",
  !/Propose only when you can ground all four required facts/.test(creation),
);
check("the guide is told to build first", /BUILD FIRST/.test(creation));
check(
  "one question is the ceiling before proposing",
  /exactly ONE short question/.test(creation) && /Never ask a third/.test(creation),
);
check(
  "a buildable first message skips questions entirely",
  /go straight to "propose" without asking anything/.test(creation),
);
check(
  "missing facts become assumptions rather than questions",
  /Assume rather than interrogate/.test(creation),
);

// The workspace assistant is shown a stage label from a retired flow, and was
// narrating it back as a reason not to build.
check(
  "the stage label is explicitly not a gate",
  /NEVER GATE BUILDING ON A STAGE/.test(buildAi),
);
check(
  "and must not be quoted at the user",
  /never tell the user what stage the project is "at"/i.test(buildAi),
);

/* ── 4. the preview panel exists before the preview does ────────────────── */

check(
  "the rail no longer disappears when there is no output",
  !/\{hasPreview && \(\s*<div className="pointer-events-none absolute/.test(buildScreen),
);
check(
  "opening the preview is always offered",
  /canOpenPreview: !previewOpen/.test(buildScreen),
);
// It must still not *auto-open* an empty panel — the conversation keeps the
// screen until there is something to show, unless the person says otherwise.
check(
  "an empty panel does not open itself",
  /override \?\? \(hasOutput && storedOpen\)/.test(buildScreen),
);
check("the empty panel explains itself", /previewEmptyTitle/.test(buildScreen));
check("a running build says so", /previewGeneratingTitle/.test(buildScreen));
check("a failed build offers a retry", /previewFailedTitle/.test(buildScreen) && /previewRetry/.test(buildScreen));

const messages = ["en", "ru"].map((locale) => JSON.parse(read(`messages/${locale}.json`)) as {
  workspace: Record<string, string>;
});
for (const key of [
  "previewEmptyTitle",
  "previewEmptyBody",
  "previewGeneratingTitle",
  "previewFailedTitle",
  "previewRetry",
]) {
  check(`workspace.${key} exists in both locales`, messages.every((m) => typeof m.workspace[key] === "string"));
}

/* ── 4b. server-rendered copy follows the project, not the cookie ───────── */

// Found by running the flow: a Russian project on an English account was
// greeted with "X now has a complete first version" and "X is ready. You're
// building...". Both are built server-side with getTranslations, which defaults
// to the request's locale — the account cookie — so they arrived in the wrong
// language. The generation reply is persisted, so it stayed wrong forever.
const stage3 = read("src/lib/actions/stage3.ts");
const workspaceProps = read("src/lib/build/workspaceProps.ts");
check(
  "the generation reply is written in the project's language",
  /getTranslations\(\{ locale, namespace: "stage3" \}\)/.test(stage3),
);
check(
  "the workspace greeting is built in the project's language",
  /getTranslations\(\{ locale: projectLocale, namespace: "build" \}\)/.test(workspaceProps),
);

// The /create chrome must follow the conversation too, or Russian answers sit
// between English buttons.
const createPage = read("src/app/create/page.tsx");
check("the create page scopes its subtree to the conversation", /NextIntlClientProvider/.test(createPage));
check(
  "and prefers the draft's language over the account cookie",
  /isLocale\(initialDraft\?\.locale\) \? initialDraft\.locale : accountLocale/.test(createPage),
);
check(
  "a draft is no longer hidden for being in another language",
  !/candidate\.locale === locale &&/.test(creation),
);

/* ── 5. a conversation has an address ───────────────────────────────────── */

check(
  "a named conversation is loaded by id",
  /requested\s*\?\s*await query\.eq\("id", requested\)/.test(assistant),
);
check(
  "only an unnamed request falls back to the most recent",
  /: await query\.order\("updated_at", \{ ascending: false \}\)/.test(assistant),
);
check("the workspace reads the conversation from the URL", /searchParams/.test(projectPage) && /c\?: string/.test(projectPage));
check("new chat puts the new conversation in the URL", /router\.replace\(`\/projects\/\$\{projectId\}\?c=\$\{result\.conversationId\}`/.test(chat));
check(
  "new chat still clears the previous conversation's state",
  /setMessages\(\[\]\)[\s\S]{0,120}setProposal\(null\)/.test(chat),
);

/* ── 6. a landing idea starts its own project ───────────────────────────── */

// Found by running the flow on an account that already had an unfinished
// draft: the seed was only pre-filled into the composer, so the visitor landed
// inside an unrelated older conversation with their sentence sitting unsent.
const createExperience = read("src/components/create/CreateExperience.tsx");
check(
  "a seed always starts, never just pre-fills",
  !/if \(initialDraft\?\.messages\?\.length\) \{[\s\S]{0,120}setInput\(seed\.message\)/.test(createExperience),
);
check(
  "a seed opens its own session, so it becomes its own project",
  /const freshSession = crypto\.randomUUID\(\)/.test(createExperience),
);
// The fresh id has to be passed, not read back from state: setSessionId has not
// committed yet, so the closure would still see the previous session and
// silently continue the old project.
check(
  "the fresh session is passed to the turn rather than read from state",
  /runTurn\(message, point, requestId, freshSession\)/.test(createExperience),
);
check(
  "and it overrides the captured project and conversation ids",
  /sessionOverride \? null : projectId/.test(createExperience),
);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`activation: ${passed} checks passed`);

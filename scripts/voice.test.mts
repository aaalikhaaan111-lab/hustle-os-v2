/**
 * Regression tests for microphone onboarding.
 *
 *   npx tsx scripts/voice.test.mts
 *
 * The reported defect: clicking dictate and closing the browser's permission
 * prompt produced "Microphone access is blocked. Open this site's browser
 * permissions…" — settings instructions for a permission that had never been
 * refused. getUserMedia reports a dismissed prompt and a standing block with
 * the same NotAllowedError, and the hook collapsed both into one `permission`
 * error that every surface rendered as the blocked message.
 *
 * These tests pin the separation: only a genuine block may mention settings,
 * the first click still raises the native prompt, and nothing asks for the
 * microphone before a click.
 */

import { readFileSync } from "node:fs";
import { voiceErrorKey } from "../src/lib/workspace/useVoiceInput";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const hook = read("src/lib/workspace/useVoiceInput.ts");
const en = JSON.parse(read("messages/en.json")).build as Record<string, string>;
const ru = JSON.parse(read("messages/ru.json")).build as Record<string, string>;

/* ── 1. the two permission outcomes are different messages ──────────────── */

check("a dismissed prompt has its own message", voiceErrorKey("permission-dismissed") === "voiceDismissed");
check("a standing block has its own message", voiceErrorKey("permission-blocked") === "voiceBlocked");
check("they are not the same message", voiceErrorKey("permission-dismissed") !== voiceErrorKey("permission-blocked"));
check("no error is unmapped", voiceErrorKey("no-speech") === "voiceNoSpeech" && voiceErrorKey("insecure") === "voiceInsecure" && voiceErrorKey("failed") === "voiceFailed");
check("no error means no message", voiceErrorKey(null) === null);

/* ── 2. only a real block sends anyone to browser settings ──────────────── */

// The whole point of the fix: someone who simply closed the prompt is told to
// press the button again, not to go hunting through browser settings.
const SETTINGS_EN = /settings|browser permissions|site permissions/i;
const SETTINGS_RU = /настройк|разрешения сайта/i;

check("the dismissed message does not mention settings (en)", !SETTINGS_EN.test(en.voiceDismissed), en.voiceDismissed);
check("the dismissed message does not mention settings (ru)", !SETTINGS_RU.test(ru.voiceDismissed), ru.voiceDismissed);
check("the dismissed message says to try again (en)", /again/i.test(en.voiceDismissed), en.voiceDismissed);
check("the dismissed message says to try again (ru)", /ещё раз|еще раз|снова/i.test(ru.voiceDismissed), ru.voiceDismissed);
check("the blocked message does point at settings (en)", SETTINGS_EN.test(en.voiceBlocked), en.voiceBlocked);
check("the blocked message does point at settings (ru)", SETTINGS_RU.test(ru.voiceBlocked), ru.voiceBlocked);

// An insecure page is not an unsupported browser, and saying so sends people
// looking for the fix in the wrong place.
check("insecure and unsupported are different messages (en)", en.voiceInsecure !== en.voiceUnsupported);
check("the insecure message names the real cause (en)", /https|secure/i.test(en.voiceInsecure), en.voiceInsecure);
check("the insecure message names the real cause (ru)", /https|защищ/i.test(ru.voiceInsecure), ru.voiceInsecure);

for (const error of ["permission-dismissed", "permission-blocked", "no-speech", "insecure", "failed"] as const) {
  const key = voiceErrorKey(error) as string;
  check(`${key} exists in en`, typeof en[key] === "string" && en[key].length > 0);
  check(`${key} exists in ru`, typeof ru[key] === "string" && ru[key].length > 0);
}

/* ── 3. the prompt is raised by the click, and never before it ──────────── */

// getUserMedia only raises Chrome's prompt when it is reached synchronously
// from a user gesture. Called from an effect it silently fails, and asking on
// mount would prompt someone who never pressed anything.
check(
  "the microphone is requested exactly once in the source",
  (hook.match(/getUserMedia\(/g) ?? []).length === 1,
  String((hook.match(/getUserMedia\(/g) ?? []).length),
);

const startBody = hook.match(/const start = useCallback\([\s\S]*?\n  \}, \[/)?.[0] ?? "";
check("start() is where the request happens", /getUserMedia\(/.test(startBody));

// No effect may call start(): that would ask without a gesture.
const effects = hook.match(/useEffect\([\s\S]*?\);/g) ?? [];
check(
  "no effect requests the microphone",
  effects.every((effect) => !/start\(\)|getUserMedia/.test(effect)),
);

// The permission read is a diagnosis after a refusal, never a gate before the
// prompt — querying first and skipping getUserMedia would mean no prompt ever.
// Call sites only — `readPermission():` in the declaration is not one.
const permissionCalls = hook.match(/readPermission\(\)\s*(?:\.then|;)|await readPermission\(\)/g) ?? [];
check(
  "the permission state is read from exactly one place",
  permissionCalls.length === 1,
  String(permissionCalls.length),
);
check(
  "the refusal path is the one that reads it",
  /NotAllowedError[\s\S]{0,900}readPermission\(\)/.test(hook),
);

/* ── 4. an insecure context is detected before asking ───────────────────── */

check("availability distinguishes an insecure context", /isSecureContext/.test(hook));
check(
  "start() refuses early on an insecure origin",
  /readAvailability\(\)[\s\S]{0,200}"insecure"/.test(hook),
);

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`voice: ${passed} checks passed`);

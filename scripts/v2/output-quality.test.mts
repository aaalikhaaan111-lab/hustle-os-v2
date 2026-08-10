/**
 * The two output-quality gates, and the defects that bought them.
 *
 *   npx tsx --conditions=react-server scripts/v2/output-quality.test.mts
 *
 * Both come from one live generation that passed every gate and still looked
 * broken: nine hardcoded Unsplash avatars, blocked by CSP and rendered as
 * broken-image icons, and six labels at 10px. The security boundary held and
 * the compiler was correct; the product was wrong anyway.
 *
 * Offline.
 */

import { validateGeneratedApp } from "../../src/lib/v2/app/validate";
import { compileGeneratedApp } from "../../src/lib/v2/app/compile";
import { findUndersizedText, MIN_FONT_PX } from "../../src/lib/v2/app/typography";
import { appSystemPrompt } from "../../src/lib/v2/app/prompt";
import { APP_SCHEMA_VERSION } from "../../src/lib/v2/app/contract";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const project = (files: Record<string, string>) => ({
  schemaVersion: APP_SCHEMA_VERSION,
  metadata: { name: "Quality", description: "Output quality gates.", locale: "en" },
  runtime: { template: "react-spa", dependencies: ["react"] },
  routes: [{ path: "/", module: "src/App.tsx", title: "Quality" }],
  files: { "src/App.tsx": "export default () => null;", ...files },
});

/* ── 1. remote media is refused at the gate ──────────────────────────────── */

const REMOTE: Array<[string, string]> = [
  ["an img src", '<img src="https://images.unsplash.com/photo-1534528741775?w=150" alt="a" />'],
  ["a JSX expression src", '<img src={"https://cdn.example.com/a.png"} />'],
  ["srcSet", '<img srcSet="https://cdn.example.com/a.png 1x" />'],
  ["a video poster", '<video poster="https://cdn.example.com/p.jpg" />'],
  ["an inline backgroundImage", 'const s = { backgroundImage: "url(https://cdn.example.com/bg.jpg)" };'],
  ["http, not just https", '<img src="http://example.com/a.png" />'],
];

for (const [name, snippet] of REMOTE) {
  const result = validateGeneratedApp(project({
    "src/App.tsx": `export default function A(){ return <div>{/* x */}${snippet}</div>; }`,
  }));
  check(`refuses remote media: ${name}`, !result.ok);
  check(`  as remote_media`, !result.ok && result.issues.some((i) => i.code === "remote_media"),
    !result.ok ? result.issues.map((i) => i.code).join(",") : "");
}

{
  const css = validateGeneratedApp(project({
    "src/styles.css": '.hero { background: url("https://images.unsplash.com/x.jpg"); }',
  }));
  check("refuses url() in a stylesheet", !css.ok && css.issues.some((i) => i.code === "remote_media"));
}

/* what must still be allowed: this is not a ban on the letter h */

const ALLOWED: Array<[string, string]> = [
  ["a link to the company's own site", '<a href="https://instagram.com/kettle">Instagram</a>'],
  ["a URL in a comment", '// see https://example.com/docs for the algorithm'],
  ["a data URI image", '<img src="data:image/svg+xml,%3Csvg/%3E" alt="" />'],
  ["a local asset path", '<img src="/public/logo.svg" alt="" />'],
  ["an inline SVG", '<svg viewBox="0 0 10 10"><circle cx="5" cy="5" r="4" /></svg>'],
  ["a string that merely mentions https", 'const help = "Visit https://example.com to learn more";'],
];

for (const [name, snippet] of ALLOWED) {
  const result = validateGeneratedApp(project({
    "src/App.tsx": `export default function A(){ return <div>${snippet}</div>; }`,
  }));
  check(`still allows: ${name}`, result.ok,
    result.ok ? "" : result.issues.map((i) => `${i.code}`).join(","));
}

/* ── 2. the typographic floor, on compiled CSS ───────────────────────────── */

{
  const found = findUndersizedText(".chip { font-size: 10px } .body { font-size: 16px }");
  check("finds a 10px rule", found.length === 1 && found[0].px === 10);
  check("and names the selector", found[0]?.selector.includes(".chip"), found[0]?.selector);
  check("leaves a 16px rule alone", !found.some((f) => f.px === 16));

  check("catches rem below the floor", findUndersizedText(".a{font-size:0.625rem}").length === 1);
  check("accepts 0.75rem, which is exactly the floor", findUndersizedText(".a{font-size:0.75rem}").length === 0);
  check("catches pt below the floor", findUndersizedText(".a{font-size:8pt}").length === 1);
  check("ignores var(), which cannot be resolved statically",
    findUndersizedText(".a{font-size:var(--text-xs)}").length === 0);
  check("ignores inherit", findUndersizedText(".a{font-size:inherit}").length === 0);
  check("the floor is 12", MIN_FONT_PX === 12);
}

/* through the real compiler, from the source a model would write */

{
  const tiny = await compileGeneratedApp(project({
    "src/App.tsx": 'import "./styles.css";\nexport default function A(){ return <span className="text-[10px]">Project chip</span>; }',
    "src/styles.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
  }) as never);
  check("a project with 10px text fails the build", !tiny.ok);
  check("as a build failure", !tiny.ok && tiny.code === "build_failed");
  check("with a diagnostic naming the size",
    !tiny.ok && tiny.errors.some((e) => /10px/.test(e.text)), !tiny.ok ? tiny.errors[0]?.text : "");
  check("and the minimum", !tiny.ok && tiny.errors.some((e) => e.text.includes("minimum is 12px")));

  const fine = await compileGeneratedApp(project({
    "src/App.tsx": 'import "./styles.css";\nexport default function A(){ return <span className="text-sm">Readable</span>; }',
    "src/styles.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
  }) as never);
  check("a project with 14px text compiles", fine.ok,
    fine.ok ? "" : JSON.stringify(fine.errors?.slice(0, 2)));
}

/* ── 3. the prompt says all of it ────────────────────────────────────────── */

{
  const prompt = appSystemPrompt();
  check("the prompt forbids external imagery", /no image host|external URL/i.test(prompt));
  check("and offers what to do instead", /inline SVG|initials|duotone|CSS pattern/i.test(prompt));
  check("and forbids an empty media column", /never an empty box|will not load/i.test(prompt));
  check("the prompt states the 12px floor", /below 12px/i.test(prompt));
  check("and recommends 14–16px", /14–16px|14-16px/.test(prompt));
  check("the prompt names the purple default as a defect", /violet-to-indigo|purple/i.test(prompt));
  check("and asks for direction from the brief", /Choose the palette, type and surface/i.test(prompt));
  check("it does not introduce a theme enum",
    !/THEMES|choose one of the following themes/i.test(prompt));
  check("mobile must be composed, not compressed", /compressed desktop/i.test(prompt));
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`output quality: ${passed} checks passed`);

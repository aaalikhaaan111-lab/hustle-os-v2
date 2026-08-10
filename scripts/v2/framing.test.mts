/**
 * The framed project format: what it carries, and what it refuses.
 *
 *   npx tsx --conditions=react-server scripts/v2/framing.test.mts
 *
 * The format exists because six of eight live responses died hand-escaping
 * source into JSON strings. So the first half of this file is the content that
 * used to be impossible — JSX attributes with double quotes, nested template
 * literals, regexes, CSS, JSON, Cyrillic, emoji, markdown fences — carried
 * verbatim and compared byte for byte.
 *
 * The second half is everything the frame must refuse. A format that guesses
 * where a file ends is worse than JSON, because JSON at least fails loudly:
 * every ambiguous case below has to be a refusal, not a best effort.
 *
 * Offline. No provider.
 */

import {
  MARKER_PREFIX, PATCH_CLOSE, PATCH_OPEN, PROJECT_CLOSE, PROJECT_OPEN,
  encodeFramedProject, fileClose, fileOpen, parseFramedPatch, parseFramedProject,
} from "../../src/lib/v2/app/framing";
import { validateGeneratedApp } from "../../src/lib/v2/app/validate";
import { buildGeneratedApp } from "../../src/lib/v2/app/pipeline";
import { applyPatch, PATCH_SCHEMA_VERSION } from "../../src/lib/v2/app/edit";
import { APP_BUDGETS, APP_SCHEMA_VERSION } from "../../src/lib/v2/app/contract";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const HEADER = {
  schemaVersion: APP_SCHEMA_VERSION,
  metadata: { name: "Framed", description: "A framed project.", locale: "en" },
  runtime: { template: "react-spa", dependencies: ["react"] },
  routes: [{ path: "/", module: "src/App.tsx", title: "Framed" }],
};

/** Derives the manifest from the blocks unless the caller supplied one. */
const frame = (header: Record<string, unknown>, blocks: Array<[string, string]>) =>
  [
    PROJECT_OPEN,
    JSON.stringify("manifest" in header ? header : { ...header, manifest: blocks.map(([p]) => p) }, null, 2),
    PROJECT_CLOSE,
    ...blocks.flatMap(([path, body]) => [fileOpen(path), body, fileClose(path)]),
  ].join("\n") + "\n";

/* ── 1. the content that JSON could not carry ────────────────────────────── */

// Every one of these killed or nearly killed a paid generation.
const HARD_CONTENT: Array<[string, string]> = [
  ["JSX attributes with double quotes",
    'export default function A() {\n  return <div className="flex flex-col" data-x="y">ok</div>;\n}'],
  ["nested template literals",
    'const cls = `base ${active ? `on-${size}` : "off"} end`;\nconst q = `He said "hi" and \\`quoted\\``;'],
  ["a regex with slashes and escapes",
    'const re = /^\\/api\\/(\\d+)\\?q="([^"]*)"$/g;\nconst esc = "back\\\\slash";'],
  ["single quotes escaped the JS way",
    "const s = 'Sweet Child O\\' Mine';"],
  ["Cyrillic and emoji",
    'export const t = { title: "Личный кабинет", ok: "Готово ✅", ru: "Привет, мир" };'],
  ["a markdown fence inside the file",
    'export const doc = `\n```json\n{"a": 1}\n```\n`;'],
  ["raw JSON as a file",
    '{\n  "name": "data",\n  "items": [1, 2, 3],\n  "quote": "he said \\"no\\""\n}'],
  ["CSS with content strings",
    '.a::after { content: "\\201C"; }\n.b { font-family: "Inter", sans-serif; }\n@media (width >= 40rem) { .c { display: grid } }'],
  ["tabs and trailing whitespace",
    "function a() {\n\treturn 1;   \n}\n"],
  ["a lone backslash and a NUL-adjacent control char",
    "const path = \"C:\\\\Users\\\\x\";\nconst tab = \"a\\tb\";"],
];

for (const [name, body] of HARD_CONTENT) {
  const text = frame(HEADER, [["src/App.tsx", "export default () => null;"], ["src/hard.ts", body]]);
  const result = parseFramedProject(text);
  check(`carries: ${name}`, result.ok, result.ok ? "" : JSON.stringify(result.issues.slice(0, 2)));
  if (result.ok) {
    const files = (result.value as { files: Record<string, string> }).files;
    check(`  byte-identical: ${name}`, files["src/hard.ts"] === body,
      JSON.stringify({ got: files["src/hard.ts"]?.slice(0, 60), want: body.slice(0, 60) }));
  }
}

/* ── 2. round trip through encode ────────────────────────────────────────── */

{
  const files = Object.fromEntries(HARD_CONTENT.map(([, body], i) => [`src/f${i}.ts`, body]));
  files["src/App.tsx"] = "export default () => null;";
  const encoded = encodeFramedProject(HEADER, files);
  const result = parseFramedProject(encoded);
  check("an encoded project round-trips", result.ok);
  if (result.ok) {
    const back = (result.value as { files: Record<string, string> }).files;
    check("every file survives byte-identical",
      Object.keys(files).every((p) => back[p] === files[p]));
    check("and no extra files appear", Object.keys(back).length === Object.keys(files).length);
  }
}

/* ── 3. what the frame must refuse ───────────────────────────────────────── */

const REFUSALS: Array<[string, string, string]> = [
  ["no header at all",
    `${fileOpen("src/App.tsx")}\nx\n${fileClose("src/App.tsx")}`, "header_missing"],
  ["prose before the header",
    `Here is your project:\n${frame(HEADER, [["src/App.tsx", "x"]])}`, "header_missing"],
  ["an unterminated header",
    `${PROJECT_OPEN}\n{"schemaVersion":"app-1"}`, "header_unterminated"],
  ["a malformed header",
    `${PROJECT_OPEN}\n{"schemaVersion": app-1,}\n${PROJECT_CLOSE}`, "header_malformed"],
  ["a header with no manifest",
    `${PROJECT_OPEN}\n${JSON.stringify(HEADER)}\n${PROJECT_CLOSE}`, "manifest_missing"],
  ["a manifest listing the same path twice",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["src/App.tsx", "src/App.tsx"] })}\n${PROJECT_CLOSE}`, "manifest_duplicate"],
  ["a file block that is never closed (truncation)",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["src/App.tsx"] })}\n${PROJECT_CLOSE}\n${fileOpen("src/App.tsx")}\nconst a = 1;`, "file_unterminated"],
  ["a close marker naming a different file",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["src/App.tsx"] })}\n${PROJECT_CLOSE}\n${fileOpen("src/App.tsx")}\nx\n${fileClose("src/Other.tsx")}`, "marker_mismatched"],
  ["a nested file block",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["src/a.ts", "src/b.ts"] })}\n${PROJECT_CLOSE}\n${fileOpen("src/a.ts")}\n${fileOpen("src/b.ts")}\nx\n${fileClose("src/b.ts")}\n${fileClose("src/a.ts")}`, "marker_in_content"],
  ["a fake marker inside content",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["src/a.ts"] })}\n${PROJECT_CLOSE}\n${fileOpen("src/a.ts")}\nconst s = "${MARKER_PREFIX}FILE /etc/passwd>>>";\n${fileClose("src/a.ts")}`, "marker_in_content"],
  ["the same file delivered twice",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["src/a.ts"] })}\n${PROJECT_CLOSE}\n${fileOpen("src/a.ts")}\nx\n${fileClose("src/a.ts")}\n${fileOpen("src/a.ts")}\ny\n${fileClose("src/a.ts")}`, "file_duplicate"],
  ["an unknown marker",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: [] })}\n${PROJECT_CLOSE}\n${MARKER_PREFIX}SOMETHING>>>\nx`, "marker_unknown"],
  ["loose content between blocks",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["src/a.ts"] })}\n${PROJECT_CLOSE}\nstray text\n${fileOpen("src/a.ts")}\nx\n${fileClose("src/a.ts")}`, "content_outside_file"],
  ["a manifest file that never arrives",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["src/a.ts", "src/missing.ts"] })}\n${PROJECT_CLOSE}\n${fileOpen("src/a.ts")}\nx\n${fileClose("src/a.ts")}`, "file_missing"],
  ["a file nobody announced",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["src/a.ts"] })}\n${PROJECT_CLOSE}\n${fileOpen("src/a.ts")}\nx\n${fileClose("src/a.ts")}\n${fileOpen("src/sneaky.ts")}\ny\n${fileClose("src/sneaky.ts")}`, "file_unlisted"],
  ["a traversal path",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["src/../../etc/passwd.ts"] })}\n${PROJECT_CLOSE}\n${fileOpen("src/../../etc/passwd.ts")}\nx\n${fileClose("src/../../etc/passwd.ts")}`, "path_traversal"],
  ["an absolute path",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["/etc/passwd.ts"] })}\n${PROJECT_CLOSE}\n${fileOpen("/etc/passwd.ts")}\nx\n${fileClose("/etc/passwd.ts")}`, "path_absolute"],
  ["a reserved path",
    `${PROJECT_OPEN}\n${JSON.stringify({ ...HEADER, manifest: ["package.json"] })}\n${PROJECT_CLOSE}\n${fileOpen("package.json")}\n{}\n${fileClose("package.json")}`, "path_reserved"],
];

for (const [name, text, code] of REFUSALS) {
  const result = parseFramedProject(text);
  check(`refuses: ${name}`, !result.ok);
  if (!result.ok) {
    check(`  as ${code}`, result.issues.some((i) => i.code === code),
      result.issues.map((i) => i.code).join(","));
  }
}

/* ── 4. budgets ──────────────────────────────────────────────────────────── */

{
  const many = Array.from({ length: APP_BUDGETS.maxFiles + 1 }, (_, i) => [`src/f${i}.ts`, "x"] as [string, string]);
  const result = parseFramedProject(frame({ ...HEADER, manifest: many.map(([p]) => p) }, many));
  check("refuses more files than the budget allows", !result.ok);
  check("  as budget_files", !result.ok && result.issues.some((i) => i.code === "budget_files"));

  const huge = "x".repeat(APP_BUDGETS.maxFileBytes + 1);
  const big = parseFramedProject(frame({ ...HEADER, manifest: ["src/big.ts"] }, [["src/big.ts", huge]]));
  check("refuses a file over the per-file budget", !big.ok);
  check("  as budget_file_bytes", !big.ok && big.issues.some((i) => i.code === "budget_file_bytes"));

  const chunk = "y".repeat(APP_BUDGETS.maxFileBytes - 1);
  const count = Math.ceil(APP_BUDGETS.maxTotalSourceBytes / chunk.length) + 1;
  const spread = Array.from({ length: count }, (_, i) => [`src/g${i}.ts`, chunk] as [string, string]);
  const total = parseFramedProject(frame({ ...HEADER, manifest: spread.map(([p]) => p) }, spread));
  check("refuses a project over the total source budget", !total.ok);
  check("  as budget_total_bytes", !total.ok && total.issues.some((i) => i.code === "budget_total_bytes"));
}

/* ── 5. framing hands the same object to the same gates ──────────────────── */

const REAL_APP = frame(
  {
    ...HEADER,
    metadata: { name: "Framed Counter", description: "A framed app that compiles.", locale: "en" },
    runtime: { template: "react-spa", dependencies: ["react"] },
    manifest: ["src/App.tsx", "src/styles.css"],
  },
  [
    ["src/App.tsx",
      'import { useState } from "react";\n' +
      'import "./styles.css";\n\n' +
      "export default function App() {\n" +
      "  const [n, setN] = useState(0);\n" +
      '  return (\n    <div className="wrap">\n' +
      '      <h1 className="title">Счёт: {n}</h1>\n' +
      '      <button className="btn" onClick={() => setN((v) => v + 1)}>+1</button>\n' +
      "    </div>\n  );\n}\n"],
    ["src/styles.css", '.wrap { padding: 2rem; }\n.title { font-family: "Inter", sans-serif; }\n'],
  ],
);

{
  const framed = parseFramedProject(REAL_APP);
  check("a real framed project parses", framed.ok, framed.ok ? "" : JSON.stringify(framed.issues));
  if (framed.ok) {
    const validation = validateGeneratedApp(framed.value);
    check("and passes the unchanged validator", validation.ok,
      validation.ok ? "" : validation.issues.map((i) => `${i.path} ${i.code}`).join(","));
    if (validation.ok) {
      const build = await buildGeneratedApp(validation.app);
      check("and the unchanged compiler", build.ok,
        build.ok ? "" : JSON.stringify(build.stage === "compile" ? build.errors.slice(0, 2) : build.issues.slice(0, 2)));
      if (build.ok) {
        check("producing a document", build.documentBytes > 1000);
        // esbuild escapes non-ASCII in its output, so the document carries
        // either form; the source is where byte-identity matters.
        check("with the Cyrillic intact through the compile",
          build.document.includes("Счёт") || build.document.includes("\\u0421\\u0447\\u0451\\u0442"),
          build.document.slice(build.document.indexOf("useState"), 60));
        check("and the JSX className survived", validation.app.files["src/App.tsx"].includes('className="wrap"'));
      }
    }
  }
}

/* the security gates are untouched: a framed project carrying a forbidden API
   is still refused, and framing is not a way around the scanner */
for (const [name, body, expect] of [
  ["fetch", 'export default function A(){ fetch("https://evil.example"); return null; }', "network"],
  ["localStorage", 'export default function A(){ localStorage.setItem("a","b"); return null; }', "storage"],
  ["eval", 'export default function A(){ eval("1+1"); return null; }', "eval"],
] as Array<[string, string, string]>) {
  const text = frame({ ...HEADER, manifest: ["src/App.tsx"] }, [["src/App.tsx", body]]);
  const framed = parseFramedProject(text);
  check(`framing accepts the bytes for ${name}`, framed.ok);
  if (framed.ok) {
    const validation = validateGeneratedApp(framed.value);
    check(`  but the validator still refuses ${name}`, !validation.ok);
    check(`  for the right reason`, !validation.ok &&
      new RegExp(expect, "i").test(validation.issues.map((i) => i.code).join(" ")));
  }
}

/* ── 6. the patch format, through the real applyPatch ────────────────────── */

{
  const base = validateGeneratedApp((parseFramedProject(REAL_APP) as { value: unknown }).value);
  check("the base for a patch is valid", base.ok);
  if (base.ok) {
    const patchText = [
      PATCH_OPEN,
      JSON.stringify({ schemaVersion: PATCH_SCHEMA_VERSION, summary: "Restyle the title", write: ["src/styles.css"] }),
      PATCH_CLOSE,
      fileOpen("src/styles.css"),
      '.wrap { padding: 3rem; }\n.title { font-family: "Inter", sans-serif; letter-spacing: -0.02em; }',
      fileClose("src/styles.css"),
    ].join("\n");

    const patch = parseFramedPatch(patchText);
    check("a framed patch parses", patch.ok, patch.ok ? "" : JSON.stringify(patch.issues));
    if (patch.ok) {
      const applied = applyPatch(base.app, patch.value);
      check("and applies through the unchanged applyPatch", applied.ok,
        applied.ok ? "" : applied.issues.map((i) => i.code).join(","));
      if (applied.ok) {
        check("the named file changed", applied.app.files["src/styles.css"].includes("3rem"));
        check("and the unnamed file is byte-identical",
          applied.app.files["src/App.tsx"] === base.app.files["src/App.tsx"]);
      }
    }

    // A patch whose body and manifest disagree is refused, both directions.
    const missing = [PATCH_OPEN, JSON.stringify({ schemaVersion: PATCH_SCHEMA_VERSION, summary: "s", write: ["src/styles.css"] }), PATCH_CLOSE].join("\n");
    const m = parseFramedPatch(missing);
    check("a patch that announces a file and sends nothing is refused",
      !m.ok && m.issues.some((i) => i.code === "file_missing"));

    const extra = [
      PATCH_OPEN, JSON.stringify({ schemaVersion: PATCH_SCHEMA_VERSION, summary: "s", write: [] }), PATCH_CLOSE,
      fileOpen("src/App.tsx"), "x", fileClose("src/App.tsx"),
    ].join("\n");
    const e = parseFramedPatch(extra);
    check("a patch that sends a file it did not announce is refused",
      !e.ok && e.issues.some((i) => i.code === "file_unlisted"));

    const truncated = [
      PATCH_OPEN, JSON.stringify({ schemaVersion: PATCH_SCHEMA_VERSION, summary: "s", write: ["src/styles.css"] }), PATCH_CLOSE,
      fileOpen("src/styles.css"), ".wrap { padding: 3rem",
    ].join("\n");
    const t = parseFramedPatch(truncated);
    check("a truncated patch is refused, not half-applied",
      !t.ok && t.issues.some((i) => i.code === "file_unterminated"));
  }
}

/* ── 7. a rewrite repair uses the same frame ─────────────────────────────── */

{
  // The rewrite path parses with exactly the project parser, so a rewrite that
  // came back framed is indistinguishable from a first generation — which is
  // the point: one format, three uses.
  const rewrite = parseFramedProject(REAL_APP);
  check("a rewrite repair parses through the project parser", rewrite.ok);
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`framing: ${passed} checks passed`);

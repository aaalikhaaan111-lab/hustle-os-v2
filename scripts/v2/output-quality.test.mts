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
import { attributeUndersized, classTokenFrom, findUndersizedText, MIN_FONT_PX } from "../../src/lib/v2/app/typography";
import { encodeFramedProject } from "../../src/lib/v2/app/framing";
import { generateApp } from "../../src/lib/v2/app/generate";
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
  check("and the minimum", !tiny.ok && tiny.errors.some((e) => /12px minimum/.test(e.text)));

  const fine = await compileGeneratedApp(project({
    "src/App.tsx": 'import "./styles.css";\nexport default function A(){ return <span className="text-sm">Readable</span>; }',
    "src/styles.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
  }) as never);
  check("a project with 14px text compiles", fine.ok,
    fine.ok ? "" : JSON.stringify(fine.errors?.slice(0, 2)));
}

/* ── 2b. the diagnostic must name the file that actually did it ──────────── */

/**
 * THE REGRESSION. The final landing canary put `text-[10px]` in two components
 * and none in the stylesheet. Every diagnostic said `src/styles.css` because
 * the file was hardcoded, so the one allowed repair rewrote the stylesheet —
 * which cannot remove a utility class emitted from a component — and the
 * rebuild failed with the identical error. The fixture below is that failure.
 */
{
  const offending = {
    "src/App.tsx":
      'import "./styles.css";\nimport Modal from "./components/SubscribeModal";\n' +
      'export default function App(){ return <div><span className="text-[10px]">SEASON 04</span><Modal /></div>; }',
    "src/components/SubscribeModal.tsx":
      'export default function SubscribeModal(){ return <p className="text-[10px] uppercase">Terms apply</p>; }',
    "src/styles.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
  };

  const built = await compileGeneratedApp(project(offending) as never);
  check("undersized text still fails the build", !built.ok);

  if (!built.ok) {
    const files = built.errors.map((e) => e.file);
    check("the diagnostic names src/App.tsx", files.includes("src/App.tsx"), JSON.stringify(files));
    check("and src/components/SubscribeModal.tsx",
      files.includes("src/components/SubscribeModal.tsx"), JSON.stringify(files));
    check("it does NOT blame src/styles.css, which has no such utility",
      !files.includes("src/styles.css"), JSON.stringify(files));
    check("every offending file is surfaced, not just the first",
      new Set(files.filter(Boolean)).size === 2, JSON.stringify(files));
    check("the message quotes the offending token",
      built.errors.some((e) => e.text.includes("text-[10px]")), built.errors[0]?.text);
    check("and still states the floor", built.errors.every((e) => /12px minimum/.test(e.text)));
  }

  // A rule genuinely written in CSS still belongs to the stylesheet.
  const authored = await compileGeneratedApp(project({
    "src/App.tsx": 'import "./styles.css";\nexport default function A(){ return <span className="chip">x</span>; }',
    "src/styles.css": ".chip { font-size: 10px }",
  }) as never);
  check("a CSS-authored undersized rule is attributed to the stylesheet",
    !authored.ok && authored.errors.some((e) => e.file === "src/styles.css"),
    !authored.ok ? JSON.stringify(authored.errors.map((e) => e.file)) : "");

  // The selector→token unescaping, in isolation.
  check("a compiled selector unescapes to the authored class",
    classTokenFrom(String.raw`.text-\[10px\]`) === "text-[10px]",
    classTokenFrom(String.raw`.text-\[10px\]`));
  check("attribution finds nothing rather than guessing",
    attributeUndersized([{ selector: ".nowhere", px: 9, declaration: "font-size: 9px" }],
      { "src/App.tsx": "export default () => null;" })[0].files.length === 0);
}

/* ── 2c. the repair context reaches the real files ───────────────────────── */

// The end of the failure that mattered: the repair must be shown the files it
// has to change. Driven through the real `generateApp` with a fake provider.
{
  const offending = {
    "src/App.tsx":
      'import "./styles.css";\nimport Modal from "./components/SubscribeModal";\n' +
      'export default function App(){ return <div><span className="text-[10px]">SEASON 04</span><Modal /></div>; }',
    "src/components/SubscribeModal.tsx":
      'export default function SubscribeModal(){ return <p className="text-[10px] uppercase">Terms apply</p>; }',
    "src/styles.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
  };
  const framed = encodeFramedProject(
    {
      schemaVersion: APP_SCHEMA_VERSION,
      metadata: { name: "Quality", description: "Output quality gates.", locale: "en" },
      runtime: { template: "react-spa", dependencies: ["react"] },
      routes: [{ path: "/", module: "src/App.tsx", title: "Quality" }],
    },
    offending,
  );

  const requests: Array<{ user: string }> = [];
  const transport = {
    async send(request: { user: string }) {
      requests.push(request);
      return requests.length === 1
        ? { ok: true as const, text: framed, latencyMs: 1 }
        : { ok: false as const, code: "transport_error" as const, message: "stop", latencyMs: 1 };
    },
  };

  await generateApp({ model: "fake", brief: "b", maxRequests: 2 }, transport as never);
  const repair = requests[1]?.user ?? "";
  check("a repair was requested", requests.length === 2);
  check("the repair context includes src/App.tsx", repair.includes("src/App.tsx"), "");
  check("and src/components/SubscribeModal.tsx", repair.includes("src/components/SubscribeModal.tsx"), "");
  check("and reproduces the offending line", repair.includes('className="text-[10px]"'));
  check("and does not point the model at the stylesheet",
    !/FILE src\/styles\.css/.test(repair));
}

/* ── 2d. eight offending files must all reach the repair ─────────────────── */

/**
 * THE SECOND REGRESSION. A landing generation put undersized type in eight
 * components. A six-file echo cap showed the first six, the model fixed all
 * six, and the run failed on the two it never saw — SubscribeModal and Footer,
 * exactly the two the cap excluded. A constant chosen for the fixtures decided
 * which real diagnostics were fixable.
 */
{
  const names = ["BookCover", "Navbar", "Subscriptions", "Reviews",
    "CurrentSeason", "ArchiveSeasons", "SubscribeModal", "Footer"];

  const files: Record<string, string> = {
    "src/App.tsx":
      'import "./styles.css";\n' +
      names.map((n) => `import ${n} from "./components/${n}";`).join("\n") +
      `\nexport default function App(){ return <div>${names.map((n) => `<${n} />`).join("")}</div>; }`,
    "src/styles.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
  };
  for (const n of names) {
    files[`src/components/${n}.tsx`] =
      `export default function ${n}(){ return <p className="text-[10px]">${n} label</p>; }`;
  }

  const built = await compileGeneratedApp(project(files) as never);
  check("eight offending files all fail the build", !built.ok);
  if (!built.ok) {
    const named = new Set(built.errors.map((e) => e.file));
    for (const n of names) {
      check(`  diagnostic names src/components/${n}.tsx`, named.has(`src/components/${n}.tsx`));
    }
    check("  all eight are surfaced, not six",
      names.every((n) => named.has(`src/components/${n}.tsx`)), `${named.size} named`);
  }

  // End to end: every implicated file must reach the repair prompt.
  const framed = encodeFramedProject(
    {
      schemaVersion: APP_SCHEMA_VERSION,
      metadata: { name: "Quality", description: "Output quality gates.", locale: "en" },
      runtime: { template: "react-spa", dependencies: ["react"] },
      routes: [{ path: "/", module: "src/App.tsx", title: "Quality" }],
    },
    { "src/App.tsx": files["src/App.tsx"], ...Object.fromEntries(
      names.map((n) => [`src/components/${n}.tsx`, files[`src/components/${n}.tsx`]])), 
      "src/styles.css": files["src/styles.css"] },
  );

  const requests: Array<{ user: string }> = [];
  const transport = {
    async send(request: { user: string }) {
      requests.push(request);
      return requests.length === 1
        ? { ok: true as const, text: framed, latencyMs: 1 }
        : { ok: false as const, code: "transport_error" as const, message: "stop", latencyMs: 1 };
    },
  };
  const result = await generateApp({ model: "fake", brief: "b", maxRequests: 2 }, transport as never);
  const repair = requests[1]?.user ?? "";

  check("the repair is a patch, not a rewrite", result.telemetry.repairMode === "patch",
    `${result.telemetry.repairMode} — ${result.telemetry.repairReason ?? ""}`);
  for (const n of names) {
    check(`  repair context reproduces ${n}.tsx`,
      repair.includes(`FILE src/components/${n}.tsx>>>`));
  }
  check("  the seventh and eighth files are not displaced by position",
    repair.includes("FILE src/components/SubscribeModal.tsx>>>") &&
    repair.includes("FILE src/components/Footer.tsx>>>"));
  // Files no diagnostic implicated stay out: implicated files come first and
  // supporting source does not consume the budget.
  check("  a file no diagnostic named is not echoed",
    !repair.includes("FILE src/App.tsx>>>\nimport"), "");
  check("  but the manifest still lists every path", repair.includes("- src/App.tsx"));
}

/* ── 2e. an over-budget required set is explicit, never truncated ─────────── */

{
  // Ten implicated files of 8 kB each: 80 kB against a 48 kB patch budget.
  // The run must say so and rewrite, not show six and claim a patch.
  const bulk = "x".repeat(8_000);
  const names = Array.from({ length: 10 }, (_, i) => `Big${i}`);
  const files: Record<string, string> = {
    "src/App.tsx":
      'import "./styles.css";\n' +
      names.map((n) => `import ${n} from "./components/${n}";`).join("\n") +
      `\nexport default function App(){ return <div>${names.map((n) => `<${n} />`).join("")}</div>; }`,
    "src/styles.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n",
  };
  for (const n of names) {
    files[`src/components/${n}.tsx`] =
      `// ${bulk}\nexport default function ${n}(){ return <p className="text-[10px]">${n}</p>; }`;
  }
  const framed = encodeFramedProject(
    {
      schemaVersion: APP_SCHEMA_VERSION,
      metadata: { name: "Quality", description: "Output quality gates.", locale: "en" },
      runtime: { template: "react-spa", dependencies: ["react"] },
      routes: [{ path: "/", module: "src/App.tsx", title: "Quality" }],
    },
    files,
  );
  const requests: Array<{ user: string }> = [];
  const transport = {
    async send(request: { user: string }) {
      requests.push(request);
      return requests.length === 1
        ? { ok: true as const, text: framed, latencyMs: 1 }
        : { ok: false as const, code: "transport_error" as const, message: "stop", latencyMs: 1 };
    },
  };
  const result = await generateApp({ model: "fake", brief: "b", maxRequests: 2 }, transport as never);
  check("an over-budget required set rewrites instead", result.telemetry.repairMode === "rewrite");
  check("  and says why, with the sizes", /over the 48000 B patch-context budget/.test(result.telemetry.repairReason ?? ""),
    result.telemetry.repairReason ?? "");
  check("  it does not send a partial patch",
    !(requests[1]?.user ?? "").includes("FILE src/components/Big0.tsx>>>"));
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

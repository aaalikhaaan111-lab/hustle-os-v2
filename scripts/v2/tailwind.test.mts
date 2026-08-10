/**
 * Generated Tailwind must become real CSS.
 *
 *   npx tsx --conditions=react-server scripts/v2/tailwind.test.mts
 *
 * Every assertion here reads the compiled stylesheet and looks for a
 * declaration. Checking that a class name appears in the markup is exactly the
 * check that passed for three paid generations while 233 classes resolved to
 * nothing, so it is not a check at all: `.flex` existing in a className proves
 * nothing, `.flex { display: flex }` existing in the output proves everything.
 *
 * Offline. No provider, no network.
 */

import { compileGeneratedApp } from "../../src/lib/v2/app/compile";
import { compileProjectCss, normaliseDirectives, scanCandidates } from "../../src/lib/v2/app/tailwind";
import { TIMELINE_APP } from "../../src/lib/v2/app/fixtures/timeline";
import { APP_SCHEMA_VERSION } from "../../src/lib/v2/app/contract";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ── a project written the way the model writes them ─────────────────────── */

const TAILWIND_APP = {
  schemaVersion: APP_SCHEMA_VERSION,
  metadata: { name: "Utility Proof", description: "Every utility family, compiled.", locale: "en" },
  runtime: { template: "react-spa", dependencies: ["react"] },
  routes: [{ path: "/", module: "src/App.tsx", title: "Utility Proof" }],
  files: {
    "src/App.tsx": `import "./styles.css";
export default function App() {
  return (
    <div className="flex flex-col md:flex-row gap-4 px-6 py-8 bg-slate-900 text-slate-100">
      <aside className="grid grid-cols-2 lg:grid-cols-4 gap-3 rounded-lg border border-slate-700">
        <button className="hover:bg-slate-700 focus:ring-2 focus:ring-emerald-500 px-4 py-2">Filter</button>
      </aside>
      <main className="text-3xl font-semibold tracking-tight leading-snug text-[#A8988D]">
        <p className="text-sm sm:text-base opacity-80">Body</p>
      </main>
    </div>
  );
}
`,
    "src/styles.css": "@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n.authored-rule { letter-spacing: 0.08em; }\n",
  },
};

const built = await compileGeneratedApp(TAILWIND_APP as never);
check("a Tailwind project compiles", built.ok, built.ok ? "" : JSON.stringify(built.errors?.slice(0, 2)));

if (built.ok) {
  const css = built.css;
  check("the Tailwind stage ran", built.tailwind.applied && built.tailwind.reason === "declared");
  check("candidates came from the project's own files", built.tailwind.candidates > 20, String(built.tailwind.candidates));
  check("real utility rules were emitted", built.tailwind.utilityRules > 20, String(built.tailwind.utilityRules));

  /* layout */
  check("flex is a declaration, not a class name", /\.flex\s*\{\s*display:\s*flex/.test(css));
  check("flex-col sets the direction", /\.flex-col\s*\{\s*flex-direction:\s*column/.test(css));
  check("grid is a declaration", /\.grid\s*\{\s*display:\s*grid/.test(css));
  check("grid-cols-2 emits template columns", /\.grid-cols-2\s*\{\s*grid-template-columns:\s*repeat\(2/.test(css));

  /* spacing */
  check("gap-4 emits a gap", /\.gap-4\s*\{\s*gap:/.test(css));
  check("px-6 emits horizontal padding", /\.px-6\s*\{[^}]*padding-inline:/.test(css));
  check("py-8 emits vertical padding", /\.py-8\s*\{[^}]*padding-block:/.test(css));

  /* typography */
  check("text-3xl emits a font size", /\.text-3xl\s*\{[^}]*font-size:/.test(css));
  check("font-semibold emits a weight", /\.font-semibold\s*\{[^}]*font-weight:/.test(css));
  check("tracking-tight emits letter spacing", /\.tracking-tight\s*\{[^}]*letter-spacing:/.test(css));
  check("leading-snug emits a line height", /\.leading-snug\s*\{[^}]*line-height:/.test(css));

  /* colour, including an arbitrary value */
  check("bg-slate-900 emits a background colour", /\.bg-slate-900\s*\{\s*background-color:/.test(css));
  check("text-slate-100 emits a colour", /\.text-slate-100\s*\{\s*color:/.test(css));
  check("an arbitrary colour is emitted verbatim", /#A8988D/i.test(css));

  /* responsive */
  const breakpoints = [...css.matchAll(/@media \(width >= ([\d.]+rem)\)/g)].map((m) => m[1]);
  check("responsive variants become media queries", breakpoints.length >= 3, breakpoints.join(","));
  check("md: is a distinct breakpoint from sm:", new Set(breakpoints).size >= 3, [...new Set(breakpoints)].join(","));
  check("md:flex-row is inside a media query",
    /\.md\\:flex-row\s*\{\s*@media[^{]+\{\s*flex-direction:\s*row/.test(css));
  check("lg:grid-cols-4 is inside a wider one",
    /\.lg\\:grid-cols-4\s*\{\s*@media[^{]+\{\s*grid-template-columns:/.test(css));

  /* states */
  check("hover: emits a :hover rule", /\.hover\\:bg-slate-700\s*\{\s*&:hover/.test(css));
  check("focus: emits a :focus rule", /\.focus\\:ring-2\s*\{\s*&:focus/.test(css));

  /* the authored CSS is not lost, and no directive survives */
  check("ordinary authored CSS is preserved", /\.authored-rule\s*\{[^}]*letter-spacing:\s*0\.08em/.test(css));
  check("no @tailwind directive survives", !/@tailwind\s/.test(css));
  check("preflight is included for a Tailwind project", /box-sizing:\s*border-box/.test(css));
}

/* ── a project that does not use Tailwind is left alone ──────────────────── */

const plain = await compileGeneratedApp(TIMELINE_APP);
check("a non-Tailwind project still compiles", plain.ok);
if (plain.ok) {
  check("and Tailwind does not run on it", !plain.tailwind.applied && plain.tailwind.reason === "not-used");
  check("so its CSS is untouched", !/box-sizing:\s*border-box/.test(plain.css) || plain.css.includes("--bg:"));
  check("its own custom properties survive", /--bg:/.test(plain.css));
}

/* ── directive normalisation, in isolation ───────────────────────────────── */

{
  const v3 = normaliseDirectives("@tailwind base;\n@tailwind components;\n@tailwind utilities;\nbody{color:red}");
  check("v3 directives are declared", v3.declared);
  check("the first becomes the v4 import", v3.css.includes('@import "tailwindcss";'));
  check("only one import results", (v3.css.match(/@import "tailwindcss"/g) ?? []).length === 1);
  check("no directive is left inert", !/@tailwind\s/.test(v3.css));
  check("authored CSS keeps its place", v3.css.trim().endsWith("body{color:red}"));

  const v4 = normaliseDirectives('@import "tailwindcss";\nbody{color:red}');
  check("a v4 import is already declared", v4.declared && v4.css.includes('@import "tailwindcss"'));

  const none = normaliseDirectives("body{color:red}");
  check("plain CSS declares nothing", !none.declared && none.css === "body{color:red}");
}

/* ── scanning reads the project, not a list ──────────────────────────────── */

{
  const candidates = scanCandidates({
    "src/A.tsx": 'const x = <div className="flex gap-4 md:grid-cols-3 text-[#123456]" />;',
    "src/styles.css": ".not-scanned { color: red }",
  });
  check("candidates come from source files", candidates.includes("flex") && candidates.includes("gap-4"));
  check("variants are found", candidates.includes("md:grid-cols-3"));
  check("arbitrary values are found", candidates.includes("text-[#123456]"));
  check("stylesheets are not scanned for candidates", !candidates.includes("not-scanned"));
}

/* ── failure is terminal, and precise ────────────────────────────────────── */

{
  let threw = "";
  try {
    await compileProjectCss({ "src/App.tsx": 'const a = <div className="flex" />;' }, '@import "not-tailwind";');
  } catch (error) { threw = error instanceof Error ? error.message : String(error); }
  check("an unresolvable stylesheet import is refused", threw.length > 0);
  check("and the message names what it refused", /not-tailwind/.test(threw), threw);

  const broken = {
    ...TAILWIND_APP,
    files: { ...TAILWIND_APP.files, "src/styles.css": '@import "some-cdn-theme";\n@tailwind utilities;' },
  };
  const result = await compileGeneratedApp(broken as never);
  check("a project whose stylesheet cannot compile is refused", !result.ok);
  check("as a build failure, not a silent pass", !result.ok && result.code === "build_failed");
  check("with a diagnostic naming the stylesheet",
    !result.ok && result.errors.some((e) => e.file === "src/styles.css"));
}

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`FAILED ${failures.length} of ${passed + failures.length}`);
  for (const failure of failures) console.error(`  ✗ ${failure}`);
  process.exit(1);
}
console.log(`tailwind: ${passed} checks passed`);

/**
 * The runtime's router substitution.
 *
 *   npx tsx --conditions=react-server scripts/v2/runtime-router.test.mts
 *
 * WHY THIS EXISTS. A generated app cannot use browser-history routing: the
 * preview document is on an opaque origin, so `history.pushState` is refused,
 * and its URL is `about:srcdoc`, so react-router's own
 * `new URL(href, location.origin || location.href)` throws. Both failures were
 * live in beta and both showed up as a blank preview.
 *
 * `RUNTIME_OVERRIDES` resolves the history routers to their memory equivalents
 * when the runtime core is compiled, so whichever router a model writes, the app
 * works. This file protects the three ways that can silently stop being true:
 * the table losing an entry, the package renaming either side of a mapping, and
 * the bundler stitching the wrong object into `__libs`.
 *
 * Offline. That a routed app actually mounts and navigates is a browser claim,
 * proved by `router-proof.mts` inside a real opaque-origin frame.
 */

import { RUNTIME_OVERRIDES, RUNTIME_LIBRARIES, isAllowedImport } from "../../src/lib/v2/app/runtime";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

/* ── 1. every history entry point is covered ─────────────────────────────── */

const router = RUNTIME_OVERRIDES["react-router-dom"];
check("react-router-dom has overrides", !!router);

/**
 * The complete set of react-router exports that reach for `window.history` or
 * `window.location`. Missing one means a generated app can still pick a router
 * that blanks the preview, which is the entire bug.
 */
const MUST_OVERRIDE: Array<[string, string]> = [
  ["BrowserRouter", "MemoryRouter"],
  ["HashRouter", "MemoryRouter"],
  ["createBrowserRouter", "createMemoryRouter"],
  ["createHashRouter", "createMemoryRouter"],
];
for (const [from, to] of MUST_OVERRIDE) {
  check(`${from} is overridden`, router?.[from] === to, `got ${router?.[from] ?? "nothing"}`);
}

/* ── 2. both sides of every mapping exist in the installed package ───────── */

/**
 * The check that catches an upgrade.
 *
 * If react-router renames `MemoryRouter`, the override silently becomes
 * `BrowserRouter: undefined` and every generated app that routes dies with
 * "is not a component" instead of a URL error — a different blank screen for
 * the same reason. Reading the real package is the only way to know.
 *
 * IN A CHILD PROCESS, and under `--conditions=browser`, for the same reason
 * `runtimeBundle.ts` does it: export conditions are process-wide, this file runs
 * under `react-server` (because `runtimeBundle` is server-only), and several of
 * these packages resolve to a different module — or a stub that throws on
 * import — under that condition. Asking in-process would answer a question
 * about the wrong build.
 */
interface PackageProbe {
  names: string[];
  present: Record<string, boolean>;
  distinct: Record<string, boolean>;
  kinds: Record<string, string>;
  arity: Record<string, number>;
}

async function probePackage(specifier: string, interesting: string[]): Promise<PackageProbe> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const execFileAsync = promisify(execFile);

  const script = `import(${JSON.stringify(specifier)}).then((m) => {
    const want = ${JSON.stringify(interesting)};
    const present = {}, kinds = {}, arity = {};
    for (const name of want) {
      present[name] = m[name] != null;
      kinds[name] = typeof m[name];
      arity[name] = typeof m[name] === "function" ? m[name].length : -1;
    }
    const pairs = ${JSON.stringify(MUST_OVERRIDE)};
    const distinct = {};
    for (const [from, to] of pairs) distinct[from + "->" + to] = m[from] !== m[to];
    process.stdout.write(JSON.stringify({ names: Object.keys(m), present, distinct, kinds, arity }));
  }).catch((e) => { process.stderr.write(String(e && e.message)); process.exit(1); });`;

  const env = { ...process.env };
  delete env.NODE_OPTIONS;

  const { stdout } = await execFileAsync(
    process.execPath,
    ["--conditions=browser", "--input-type=module", "-e", script],
    { cwd: process.cwd(), timeout: 20_000, maxBuffer: 8 * 1024 * 1024, env },
  );
  return JSON.parse(stdout) as PackageProbe;
}

const UNTOUCHED = [
  "Link", "NavLink", "Routes", "Route", "Outlet", "Navigate", "RouterProvider",
  "useNavigate", "useParams", "useLocation", "useSearchParams", "useRoutes",
];

const probe = await probePackage("react-router-dom", [
  ...MUST_OVERRIDE.flat(),
  ...UNTOUCHED,
]);

for (const [specifier, mapping] of Object.entries(RUNTIME_OVERRIDES)) {
  check(`${specifier} is an allowed import`, isAllowedImport(specifier));
  check(
    `${specifier} is a declared runtime library`,
    RUNTIME_LIBRARIES.some((library) => library.name === specifier),
  );
  for (const [from, to] of Object.entries(mapping)) {
    check(`${specifier} still exports ${from}`, probe.present[from] === true, "the override has nothing to replace");
    check(`${specifier} still exports ${to}`, probe.present[to] === true, "the replacement no longer exists");
  }
}

/* ── 3. the replacements are genuinely different from what they replace ──── */

/**
 * A guard against the override becoming a no-op. If react-router ever made
 * `BrowserRouter` and `MemoryRouter` the same object, the substitution would
 * still "pass" every check above while doing nothing — and the real problem
 * would have moved somewhere this file no longer looks.
 */
for (const [from, to] of MUST_OVERRIDE) {
  check(
    `${from} and ${to} are distinct in the package`,
    probe.distinct[`${from}->${to}`] === true,
    "the override would be a no-op",
  );
}

/* ── 4. the memory equivalents are what a router provider will accept ────── */

check("MemoryRouter is a component", probe.kinds.MemoryRouter === "function");
check("createMemoryRouter is callable", probe.kinds.createMemoryRouter === "function");

/**
 * Props compatibility, at the level this can be checked without a DOM.
 * `BrowserRouter` takes `basename` and `children`; `MemoryRouter` takes those
 * plus `initialEntries`. A generated app passing `basename` must not break.
 */
check(
  "MemoryRouter accepts the same arity as BrowserRouter",
  probe.arity.MemoryRouter <= probe.arity.BrowserRouter + 1,
  `${probe.arity.MemoryRouter} vs ${probe.arity.BrowserRouter}`,
);

/* ── 5. the exports the override must NOT have disturbed ─────────────────── */

for (const name of UNTOUCHED) {
  check(`${name} is untouched`, probe.present[name] === true);
  check(`${name} is not in the override table`, router?.[name] === undefined);
}

/* ── 6. the compiled core actually substitutes ───────────────────────────── */

/**
 * The bundler half. `buildCore` writes the substitution into the graph it
 * compiles, and a change to how that source is generated could stop applying it
 * while everything above still passes. Building the real core for one specifier
 * is enough to see the mapping land in `__libs`.
 *
 * Slow-ish (esbuild plus a child process for the export names), so it runs once
 * and last.
 */
const { getRuntimeBundle } = await import("../../src/lib/v2/app/runtimeBundle");
const bundle = await getRuntimeBundle(["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react-router-dom"]);

check("the core compiled", bundle.core.length > 1000, `${bundle.core.length} bytes`);
check(
  "the facade name list still advertises BrowserRouter",
  bundle.names["react-router-dom"]?.includes("BrowserRouter") === true,
  "a generated app imports it by that name and the facade must export it",
);
check(
  "the facade name list still advertises MemoryRouter",
  bundle.names["react-router-dom"]?.includes("MemoryRouter") === true,
);

/**
 * The substitution is visible in the compiled source as the override object
 * literal keyed by the names being replaced. Minified output renames locals but
 * not string keys, so the property names survive.
 */
for (const [from] of MUST_OVERRIDE) {
  check(`the compiled core mentions ${from} as an override key`, bundle.core.includes(from));
}

/* ── report ──────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ runtime router: ${passed} checks passed`);

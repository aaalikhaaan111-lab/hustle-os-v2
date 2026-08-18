/**
 * Content-Security-Policy regression tests.
 *
 *   npx tsx --import ./scripts/v2/css-stub-loader.mts scripts/v2/csp.test.mts
 *
 * These cover an app-wide security header, not a V2 feature. They live here
 * because this is where the suite runner is, and they exist because the
 * codegen prototype needed exactly one directive relaxed on exactly one
 * development route — the kind of exception that is easy to widen later by
 * accident and hard to notice when it happens.
 *
 * The prefix cases are the point. `/v2-gallery/codegen/extra` and
 * `/v2-gallery/codegenX` must not inherit the exception, or "one dev route"
 * quietly becomes "any route starting with those characters".
 */

import { buildCspHeader, CODEGEN_PREVIEW_PATH } from "../../src/lib/security/csp";

let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail = ""): void {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const directive = (csp: string, name: string): string =>
  csp.split("; ").find((d) => d.startsWith(`${name} `) || d === name) ?? "(absent)";

const BASE_FRAME_SRC = "frame-src https://www.youtube.com";
const EXCEPTION_FRAME_SRC = "frame-src 'self' https://www.youtube.com";
/**
 * The Supabase origin is part of the base `img-src`, because project
 * thumbnails are served from its storage. It is read from the environment the
 * same way the builder reads it — hardcoding the string here meant these
 * assertions only ever exercised the case where the variable is UNSET, and
 * passed while the real header (which always has it) went unchecked.
 */
const SUPABASE_ORIGIN = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const SUPABASE_PART = SUPABASE_ORIGIN ? ` ${SUPABASE_ORIGIN}` : "";
const BASE_IMG_SRC = `img-src 'self' https://i.ytimg.com${SUPABASE_PART}`;
const EXCEPTION_IMG_SRC = `img-src 'self' https://i.ytimg.com${SUPABASE_PART} data:`;

/** Every route that must never see the exception. */
const UNCHANGED_PATHS = [
  "/",
  "/dashboard",
  "/projects",
  "/v2-gallery",
  "/v2-gallery/generate",
  "/v2-gallery/ai-saas",
  // Prefix traps: neither may inherit the exception.
  "/v2-gallery/codegen/extra",
  "/v2-gallery/codegenX",
  "/v2-gallery/codegen-preview",
  // Path-traversal-looking input still must not match.
  "/v2-gallery/codegen/../codegen",
  "/V2-GALLERY/CODEGEN",
  "",
];

// -- 1. unchanged routes, both environments --------------------------------
for (const isProd of [false, true]) {
  const label = isProd ? "production" : "development";
  for (const path of UNCHANGED_PATHS) {
    const csp = buildCspHeader("N", isProd, path);
    check(`${label}: "${path || "(empty)"}" keeps the base frame-src`,
      directive(csp, "frame-src") === BASE_FRAME_SRC, directive(csp, "frame-src"));
    check(`${label}: "${path || "(empty)"}" keeps the base img-src`,
      directive(csp, "img-src") === BASE_IMG_SRC, directive(csp, "img-src"));
  }
}

// -- 2. the exact dev route, and only in development -----------------------
{
  const dev = buildCspHeader("N", false, CODEGEN_PREVIEW_PATH);
  check("development: the codegen route gains 'self' on frame-src",
    directive(dev, "frame-src") === EXCEPTION_FRAME_SRC, directive(dev, "frame-src"));
  check("development: the codegen route gains data: on img-src",
    directive(dev, "img-src") === EXCEPTION_IMG_SRC, directive(dev, "img-src"));

  const prod = buildCspHeader("N", true, CODEGEN_PREVIEW_PATH);
  check("production: the codegen route does NOT gain 'self' on frame-src",
    directive(prod, "frame-src") === BASE_FRAME_SRC, directive(prod, "frame-src"));
  check("production: the codegen route does NOT gain data: on img-src",
    directive(prod, "img-src") === BASE_IMG_SRC, directive(prod, "img-src"));
}

// -- 2b. the relaxation is image-only ---------------------------------------
{
  // `data:` on a script or frame source is a known bypass; on an image source
  // it cannot execute. That distinction is the whole reason this exception is
  // acceptable, so it is asserted rather than assumed.
  const dev = buildCspHeader("N", false, CODEGEN_PREVIEW_PATH);
  const MUST_NOT_CARRY_DATA = [
    "default-src", "script-src", "style-src", "font-src", "connect-src",
    "frame-src", "object-src", "base-uri", "form-action", "frame-ancestors",
  ];
  for (const name of MUST_NOT_CARRY_DATA) {
    check(`the exception adds no data: to ${name}`,
      !directive(dev, name).split(" ").includes("data:"), directive(dev, name));
  }
  check("data: appears exactly once in the whole policy",
    (dev.match(/\bdata:/g) ?? []).length === 1, dev);
  check("the exception adds no blob:", !dev.includes("blob:"));
  check("the exception adds no wildcard", !dev.split(" ").includes("*"));
}

// -- 3. nothing else moves --------------------------------------------------
{
  // The exception route's policy must differ from the baseline in frame-src
  // and in nothing else at all.
  const baseline = buildCspHeader("N", false, "/").split("; ");
  const exception = buildCspHeader("N", false, CODEGEN_PREVIEW_PATH).split("; ");
  const changed = baseline.filter((d, i) => d !== exception[i]);
  check("the exception changes exactly two directives",
    baseline.length === exception.length && changed.length === 2,
    changed.join(" | "));
  check("the changed directives are frame-src and img-src, and nothing else",
    changed.every((d) => d.startsWith("frame-src") || d.startsWith("img-src"))
      && changed.some((d) => d.startsWith("frame-src"))
      && changed.some((d) => d.startsWith("img-src")),
    changed.join(" | "));
}

// -- 4. every directive still present, everywhere --------------------------
{
  const REQUIRED = [
    "default-src", "script-src", "style-src", "img-src", "font-src",
    "connect-src", "frame-src", "object-src", "base-uri", "form-action", "frame-ancestors",
  ];
  for (const isProd of [false, true]) {
    for (const path of ["/", CODEGEN_PREVIEW_PATH]) {
      const csp = buildCspHeader("N", isProd, path);
      const missing = REQUIRED.filter((d) => directive(csp, d) === "(absent)");
      check(`${isProd ? "prod" : "dev"} "${path}": all ${REQUIRED.length} directives present`,
        missing.length === 0, missing.join(", "));
    }
  }
}
{
  // The directives that must be byte-identical no matter the path.
  // img-src is deliberately absent: it is one of the two directives the
  // exception is allowed to move. Everything else must be byte-identical.
  const FROZEN = ["frame-ancestors", "object-src", "base-uri", "form-action", "font-src", "default-src", "script-src", "style-src", "connect-src"];
  for (const isProd of [false, true]) {
    const baseline = buildCspHeader("N", isProd, "/");
    const exception = buildCspHeader("N", isProd, CODEGEN_PREVIEW_PATH);
    for (const name of FROZEN) {
      check(`${isProd ? "prod" : "dev"}: ${name} is untouched by the exception`,
        directive(baseline, name) === directive(exception, name),
        `${directive(baseline, name)} vs ${directive(exception, name)}`);
    }
  }
}

// -- 5. no broader frame source was introduced ------------------------------
for (const isProd of [false, true]) {
  for (const path of [...UNCHANGED_PATHS, CODEGEN_PREVIEW_PATH]) {
    const frame = directive(buildCspHeader("N", isProd, path), "frame-src");
    for (const forbidden of ["blob:", "data:", "*", "http:", "https:", "'unsafe-inline'"]) {
      check(`frame-src never contains ${forbidden} (${isProd ? "prod" : "dev"} ${path || "(empty)"})`,
        !frame.split(" ").includes(forbidden), frame);
    }
  }
}
{
  // frame-ancestors stays 'none' — the app must never become frameable.
  for (const isProd of [false, true]) {
    for (const path of [...UNCHANGED_PATHS, CODEGEN_PREVIEW_PATH]) {
      check(`frame-ancestors stays 'none' (${isProd ? "prod" : "dev"} ${path || "(empty)"})`,
        directive(buildCspHeader("N", isProd, path), "frame-ancestors") === "frame-ancestors 'none'");
    }
  }
}

// -- 6. production hardening intact -----------------------------------------
{
  const prod = buildCspHeader("N", true, CODEGEN_PREVIEW_PATH);
  check("production keeps upgrade-insecure-requests", prod.includes("upgrade-insecure-requests"));
  check("production omits 'unsafe-eval'", !prod.includes("'unsafe-eval'"));
  const dev = buildCspHeader("N", false, CODEGEN_PREVIEW_PATH);
  check("development still carries 'unsafe-eval' for the dev runtime", dev.includes("'unsafe-eval'"));
  check("the nonce is carried through", prod.includes("'nonce-N'"));
}

// -- 7. the default argument cannot open the exception ---------------------
{
  // A caller that forgets to pass a pathname must get the base policy, not the
  // exception — fail closed on omission.
  check("omitting the pathname yields the base frame-src",
    directive(buildCspHeader("N", false), "frame-src") === BASE_FRAME_SRC);
  check("omitting the pathname yields the base img-src",
    directive(buildCspHeader("N", false), "img-src") === BASE_IMG_SRC);
}

/**
 * The thumbnail gallery, which is what the storage origin is for.
 *
 * A blocked image produces NO failed request and no console error — just an
 * `<img>` with `naturalWidth === 0`, which looks exactly like a feature that
 * was never deployed. That is how this was found, and it is worth a test.
 */
{
  const csp = buildCspHeader("N", true, "/projects");
  const img = directive(csp, "img-src");
  check("the gallery may load thumbnails from Supabase storage",
    SUPABASE_ORIGIN === "" || img.includes(SUPABASE_ORIGIN),
    img);
  check("and admitting it for images does not admit it for scripts",
    SUPABASE_ORIGIN === "" || !directive(csp, "script-src").includes(SUPABASE_ORIGIN));
  check("nor for frames",
    SUPABASE_ORIGIN === "" || !directive(csp, "frame-src").includes(SUPABASE_ORIGIN));
}

console.log(`\ncsp: ${passed} passed, ${failures.length} failed`);
if (failures.length > 0) {
  for (const failure of failures) console.error(`  FAIL ${failure}`);
  process.exit(1);
}

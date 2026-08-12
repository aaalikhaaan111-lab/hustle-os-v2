import { existsSync, readFileSync } from "node:fs";
import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { RUNTIME_LIBRARIES } from "./src/lib/v2/app/runtime";

/**
 * Every package the generated-app bundler has to be able to resolve, plus
 * everything those packages need.
 *
 * THE DEFECT THIS FIXES. The workspace recompiles a stored application on every
 * read, and that compile bundles the runtime libraries from `node_modules` with
 * `resolveDir: process.cwd()`. Nothing in Ventrio's own source imports recharts
 * or framer-motion, so Next traced none of them into the serverless function,
 * and the first production generation that ever succeeded rendered as "Something
 * went wrong" — esbuild could not resolve nine specifiers. The application was
 * stored correctly and perfectly fine; there was simply nothing to build it
 * against.
 *
 * Computed rather than listed. A hand-written array would drift the first time a
 * library is added to `RUNTIME_LIBRARIES` or one of them gains a dependency, and
 * the failure it produces is a blank error page after a paid generation.
 */
function runtimeClosure(): string[] {
  const seen = new Set<string>();
  const walk = (name: string): void => {
    if (seen.has(name)) return;
    const manifest = `node_modules/${name}/package.json`;
    if (!existsSync(manifest)) return;
    seen.add(name);
    const pkg = JSON.parse(readFileSync(manifest, "utf8")) as { dependencies?: Record<string, string> };
    for (const dependency of Object.keys(pkg.dependencies ?? {})) walk(dependency);
  };
  // React itself is not in RUNTIME_LIBRARIES — it is the scaffold every
  // generated app is built on, so the bundler always needs it.
  for (const name of ["react", "react-dom", ...RUNTIME_LIBRARIES.map((library) => library.name)]) walk(name);
  return [...seen].sort();
}

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  /**
   * Tailwind compiles generated projects at request time, on the server.
   *
   * It is a runtime dependency of app generation, not a build-time tool for
   * this repo's own CSS: `src/lib/v2/app/tailwind.ts` calls its compiler on
   * model-authored stylesheets. Kept external so the native `@tailwindcss/oxide`
   * scanner is required from node_modules rather than bundled, and traced so
   * `tailwindcss/index.css` — which the compiler reads at runtime — ships with
   * the server output instead of 404ing in production.
   */
  serverExternalPackages: ["tailwindcss", "@tailwindcss/oxide", "esbuild"],
  outputFileTracingIncludes: {
    "/**": [
      "./node_modules/tailwindcss/*.css",
      // The libraries a generated app may import, and their dependencies. See
      // `runtimeClosure` — without these the workspace cannot rebuild a stored
      // application and shows an error page instead of the app.
      ...runtimeClosure().map((name) => `./node_modules/${name}/**`),
    ],
  },
  // Content-Security-Policy is set per-request in src/proxy.ts instead (it
  // needs a fresh nonce every request); everything here is static and
  // app-wide, including on routes the proxy matcher skips.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          ...(isProd
            ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }]
            : []),
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

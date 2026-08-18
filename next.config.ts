import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { runtimeClosure } from "./src/lib/v2/app/runtimeClosure";

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
          /**
           * `microphone=(self)`, not `microphone=()`.
           *
           * THIS HEADER WAS THE VOICE-INPUT BUG. An empty allowlist disables
           * the microphone for the whole origin: `getUserMedia` rejects with
           * NotAllowedError before any prompt is drawn, and Chrome reports the
           * permission as "denied" forever. So the product's own dictation
           * button could never work, the native permission request could never
           * appear, and the hook — which was correct — kept reporting a refusal
           * it had no way to attribute.
           *
           * `(self)` grants it to this origin only. Cross-origin frames still
           * get nothing, and the generated-app sandbox is not delegated the
           * feature (that needs an explicit `allow="microphone"` on the iframe,
           * which is deliberately not set), so a generated app still cannot
           * reach the microphone. Every other feature stays fully disabled.
           */
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(self), geolocation=(), payment=(), usb=()",
          },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);

import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

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
    "/**": ["./node_modules/tailwindcss/*.css"],
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

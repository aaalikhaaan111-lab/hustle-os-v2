import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Written by the workflow compiler on every build — a bundled copy of the
    // orchestrator plus the runtime's own route handlers. Generated, gitignored
    // by a .gitignore the plugin ships, and not ours to lint.
    "src/app/.well-known/workflow/**",
  ]),
]);

export default eslintConfig;

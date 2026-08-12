/**
 * Every package the generated-app bundler must be able to resolve.
 *
 * WHY THIS EXISTS. The workspace rebuilds a stored application on every read,
 * and that rebuild runs esbuild over `node_modules` with
 * `resolveDir: process.cwd()`. Nothing in Ventrio's own source imports recharts
 * or framer-motion, so Next traced none of them into the serverless function —
 * and the first production generation that ever succeeded rendered as "Something
 * went wrong". The application was stored correctly, twelve valid files the
 * worker had already compiled once. There was simply nothing to build it
 * against. `next.config.ts` turns this list into `outputFileTracingIncludes`.
 *
 * WHY IT IS COMPUTED. A hand-written array drifts the first time a library joins
 * `RUNTIME_LIBRARIES` or one of them gains a dependency, and the failure that
 * produces is an error page after a generation the person already paid for.
 *
 * PEER DEPENDENCIES COUNT. recharts imports `react-is` and declares it only as a
 * peer, which is exactly how the second round of this bug happened: walking
 * `dependencies` alone shrank the failure from nine unresolved specifiers to
 * one. A peer a bundler follows is a dependency in every sense that matters
 * here. Missing peers are skipped rather than fatal — an optional peer nobody
 * installed is not an error, and anything genuinely absent from `node_modules`
 * could not have been traced regardless.
 *
 * `scripts/v2/runtime-closure.test.mts` bundles the libraries against a tree
 * containing this list and nothing else, so an incomplete closure fails there
 * rather than in production.
 */

import { existsSync, readFileSync } from "node:fs";
import { RUNTIME_LIBRARIES } from "./runtime";

interface Manifest {
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

/**
 * The package a specifier lives in: `react-dom/client` ships inside `react-dom`,
 * and it is directories that get traced, not entry points.
 */
function packageOf(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

/**
 * `react` and `react-dom` are listed explicitly because a generated app is
 * always built on them whether or not it names them, and `RUNTIME_LIBRARIES`
 * describes what a model may choose.
 */
const ROOTS = [...new Set(["react", "react-dom", ...RUNTIME_LIBRARIES.map((library) => packageOf(library.name))])];

/** Package names reachable from the runtime libraries, sorted, deduplicated. */
export function runtimeClosure(root = "node_modules"): string[] {
  const seen = new Set<string>();

  const walk = (name: string): void => {
    if (seen.has(name)) return;
    const manifest = `${root}/${name}/package.json`;
    if (!existsSync(manifest)) return;
    seen.add(name);

    const pkg = JSON.parse(readFileSync(manifest, "utf8")) as Manifest;
    for (const group of [pkg.dependencies, pkg.peerDependencies, pkg.optionalDependencies]) {
      for (const dependency of Object.keys(group ?? {})) walk(dependency);
    }
  };

  for (const name of ROOTS) walk(name);
  return [...seen].sort();
}

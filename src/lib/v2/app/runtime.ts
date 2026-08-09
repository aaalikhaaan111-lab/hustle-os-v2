/**
 * The runtime a generated app is allowed to build against.
 *
 * THE RULE THIS ENFORCES: a generated project may *compose* anything from this
 * set and may *install* nothing. Installing a package runs its lifecycle
 * scripts on our machine at build time, so "let the model pick its
 * dependencies" is not a product decision about flexibility — it is a decision
 * to execute code chosen by a model on infrastructure holding user data. The
 * answer is a curated set that is genuinely capable, not a small one.
 *
 * Capability is the point. A generated app can route, animate, draw icons,
 * chart data, hold form state and compose class names. That is enough to build
 * a dashboard, a timeline, a booking flow or a catalogue — the things the page
 * renderer could not express at all. What it cannot do is reach the network,
 * touch the filesystem, or pull an arbitrary module off a registry.
 *
 * Adding to this list is a deliberate act with a review attached. Each entry
 * records why it is here, so the next person can tell a capability from an
 * accretion.
 */

export interface RuntimeLibrary {
  /** The bare specifier generated code imports. */
  name: string;
  /** Why a generated app needs it. */
  purpose: string;
}

/**
 * The curated set.
 *
 * Everything here is client-side, pure, and has no ambient authority: none of
 * them opens a socket, reads a file or touches storage on its own. That is the
 * admission criterion, not popularity.
 */
export const RUNTIME_LIBRARIES: readonly RuntimeLibrary[] = [
  { name: "react", purpose: "components, state and effects" },
  { name: "react-dom", purpose: "mounting the app" },
  { name: "react-dom/client", purpose: "createRoot" },
  { name: "react/jsx-runtime", purpose: "the automatic JSX transform" },
  { name: "react-router-dom", purpose: "client-side routes, links and navigation" },
  { name: "framer-motion", purpose: "transitions, gestures and layout animation" },
  { name: "lucide-react", purpose: "icons" },
  { name: "recharts", purpose: "charts for dashboards and data views" },
  { name: "clsx", purpose: "conditional class names" },
  { name: "date-fns", purpose: "dates, formatting and comparison" },
] as const;

const LIBRARY_NAMES: ReadonlySet<string> = new Set(RUNTIME_LIBRARIES.map((l) => l.name));

/**
 * The scaffolds a project can declare.
 *
 * One today. It exists as a named thing rather than an implicit default so a
 * second one — a different mount, a different router, a server-rendered
 * variant — is an addition rather than a rewrite of everything that assumes
 * there is only one.
 */
export const RUNTIME_TEMPLATES = {
  "react-spa": {
    /** Ventrio writes this file; the model supplies what it imports. */
    entry: "src/main.tsx",
    /** The component the entry mounts. */
    root: "src/App.tsx",
    description: "A client-rendered React application mounted into #root.",
  },
} as const;

export type RuntimeTemplateId = keyof typeof RUNTIME_TEMPLATES;

export function isRuntimeTemplate(value: string): value is RuntimeTemplateId {
  return Object.prototype.hasOwnProperty.call(RUNTIME_TEMPLATES, value);
}

/**
 * Whether a bare import specifier is allowed.
 *
 * Subpaths are permitted for the libraries that genuinely publish them
 * (`react-dom/client`, `date-fns/locale`), and only for those — an open subpath
 * rule would let `lucide-react/../../something` through on a resolver that
 * normalises differently from this check.
 */
export function isAllowedImport(specifier: string): boolean {
  if (LIBRARY_NAMES.has(specifier)) return true;
  const slash = specifier.indexOf("/");
  if (slash <= 0) return false;
  if (specifier.includes("..")) return false;
  const base = specifier.startsWith("@")
    ? specifier.split("/").slice(0, 2).join("/")
    : specifier.slice(0, slash);
  const rest = specifier.slice(base.length + 1);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/.test(rest)) return false;
  return SUBPATH_LIBRARIES.has(base);
}

/** Libraries whose documented subpaths are part of normal use. */
const SUBPATH_LIBRARIES: ReadonlySet<string> = new Set([
  "react", "react-dom", "date-fns", "lucide-react", "framer-motion", "recharts",
]);

export function isAllowedDependency(name: string): boolean {
  return LIBRARY_NAMES.has(name);
}

/** Rendered into the prompt, so the model is told exactly what it may import. */
export function describeRuntime(): string {
  return RUNTIME_LIBRARIES.map((l) => `  ${l.name} — ${l.purpose}`).join("\n");
}

/**
 * The project's package.json, generated from the declaration.
 *
 * Never accepted from a model, and this function is the only thing that writes
 * it. Two fields are the reason: `scripts`, which is a shell, and
 * `dependencies`, which is the allowlist. A model that could write either one
 * could run a command or pull a package, and the entire boundary would be
 * decoration.
 *
 * `scripts` is emitted empty rather than omitted — an absent field invites the
 * next person to add one, an explicitly empty one states the intent.
 */
export function buildPackageJson(input: {
  name: string;
  template: RuntimeTemplateId;
  dependencies: readonly string[];
}): string {
  const deps: Record<string, string> = {};
  for (const dep of [...new Set(dependencies(input.dependencies))].sort()) {
    deps[dep] = "*";
  }
  return `${JSON.stringify({
    name: safePackageName(input.name),
    private: true,
    version: "0.0.0",
    type: "module",
    ventrioTemplate: input.template,
    scripts: {},
    dependencies: deps,
  }, null, 2)}\n`;
}

/** Only real, allowlisted package names reach the manifest. */
function dependencies(declared: readonly string[]): string[] {
  return declared.filter((d) => LIBRARY_NAMES.has(d) && !d.includes("/"));
}

/**
 * npm's own name rules, applied to a name a model chose.
 *
 * A project called "../../etc" or "Chronoverse!" is not a security problem here
 * — nothing shells out — but it produces a manifest that no tool will read, and
 * a build that fails for a reason nobody can act on.
 */
export function safePackageName(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug.length > 0 ? slug : "generated-app";
}

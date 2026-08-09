# The generated-application runtime

Written 2026-08-10. Branch `feat/app-runtime`, from `integrate/visual-codegen`.

## What changed

The page renderer accepted an artifact whose shape *was* the product: a hero, a
list of section kinds from a closed enum, a form, a footer. Every page it could
describe was a permutation of that list, which is why eight art directions
produced eight colourways of one page. The limit was never styling.

Ventrio now generates applications. The contract describes a project — files at
paths, a route manifest, a declaration of which Ventrio-provided libraries the
code imports — and says nothing about what the application *is*. Two projects
under it can share no structure at all.

## The division

**The model owns** the component tree, file structure, state, interactions,
layout, typography and colour system.

**Ventrio owns** the dependency set, `package.json`, the asset registry, every
path that reaches disk, the execution boundary, the budgets, and versioning.

Each of those is a security boundary rather than a taste preference:

| Ventrio keeps | Because |
| --- | --- |
| The dependency set | Installing a package is arbitrary code execution on our machine at build time |
| `package.json` | `scripts` is a shell; `dependencies` is the allowlist |
| The asset registry | A model-authored URL is a network request nobody approved |
| Paths | Traversal, dotfiles and reserved names reach things that are not the project |
| The entry module | It decides what mounts and installs the error reporting |

## Execution

`sandbox="allow-scripts allow-forms"`, never `allow-same-origin` — that pair
returns the frame to Ventrio's origin and makes the sandbox decorative. It is
the single most important line in `sandbox.ts` and the test suite asserts the
combination can never appear.

A second `<meta>` CSP inside the document denies every network destination, so
"network denied by default" is enforced by the platform, not only by the source
scan that also refuses it. Two independent layers: a careless edit to either
leaves a boundary standing.

**srcdoc over a dedicated origin**, decided from the constraint. An opaque
origin has no storage to partition, so a second origin adds nothing there — and
it would give model-written code a fetchable, linkable, indexable address.
`srcdoc` has no address. If a future requirement needs persistent storage or a
service worker inside a generated app, that trade reverses; the note in
`sandbox.ts` records it so the decision is re-made rather than inherited.

Verified from inside a running app: `origin` is `"null"`, `parent.document`,
`parent.location` and `top.document` all throw `SecurityError`, `localStorage`
and `sessionStorage` throw, no Ventrio global is visible, and zero external
requests are made.

## Compiling

esbuild never sees a filesystem. Everything resolves through an in-memory plugin
whose entire world is the validated file map — no `node_modules`, no
`resolveDir`, no plugins from the project, bounded wall-clock and output size.
The bundler is also the second, independent import check: a specifier that
slipped past the validator's scan still has to come back through `onResolve`.

Runtime libraries are compiled into **one graph** in which React appears exactly
once, and per-specifier facades are built in-document. Three interop failures
forced this, each of which reads as a bug in generated code and is not:

1. `export { default } from "x"` beside `export *` → "Detected cycle while
   resolving name 'default'" for anything interoped from CommonJS.
2. CommonJS entries esbuild's lexer cannot read (React's is
   `module.exports = require(...)`) → no named exports → "does not provide an
   export named 'forwardRef'".
3. `react` external inside a CommonJS library → `__require("react")` in ESM
   output → "Dynamic require of react is not supported".

Export names are discovered in a child process with `--conditions=browser` and
`NODE_OPTIONS` stripped, because this code runs inside Next where `react-server`
is active and `react-dom/client` resolves to a stub that throws.

## Editing

An edit is a patch against a known base: the model returns only the files it
changes plus an explicit removal list, and everything unmentioned is carried
forward. Two validation passes — patch-level catches an illegal path,
whole-project catches a patch that is individually legal and leaves the project
broken. Nothing is applied in place, so a failed edit leaves the previous
version untouched.

## Offline proof

Three applications written to the contract, compiled through the real pipeline,
driven for real in Chrome at 390/768/1440.

| | files | bundle | interactions proved |
| --- | --- | --- | --- |
| timeline | 6 | 15 kB | era/thread/medium filters narrow the spine, selection fills a detail panel, clear restores |
| dashboard | 7 | 17 kB | sidebar switches views, recharts renders, tabs filter a table, form reports both validation errors then commits |
| local | 7 | 19 kB | modal gallery opens and closes on Escape, pricing toggle recalculates, enquiry validates then confirms |

No horizontal overflow, no unreadably narrow text, zero external requests, every
app mounts. A targeted edit changed 2 of 6 files and left the other 4
byte-identical while unrelated interactions kept working.

1,786 offline checks across 17 suites; typecheck, lint and production build
clean.

## What is NOT done

1. **No model has produced one of these.** The fixtures prove the contract can
   express three genuinely different applications and that the runtime compiles,
   isolates and runs them. They prove nothing about model output. This is the
   remaining canary and the largest open risk.
2. **Not wired to generation.** `renderProjectWithCodegen`'s equivalent for apps
   does not exist yet: no server action, no quota reservation, no job row, no
   persistence. The pattern is established by the codegen integration — one job,
   one reserved unit, one refund path — but it is not written.
3. **No workspace preview component.** `CodegenPreview` renders a static
   document; an app preview additionally needs the `postMessage` listener wired
   to `parsePreviewMessage` and the error log surfaced.
4. **The repair loop is not closed.** `appRepairPrompt` and `applyPatch` exist;
   nothing yet feeds build diagnostics into a bounded second request.
5. **Imagery.** Unchanged and unsolved. Generated apps have no pictures beyond
   the placeholder registry.
6. **Document size.** 1.1–1.7 MB per preview, dominated by the runtime graph.
   Acceptable for a preview, wrong for publishing.
7. **Where a build runs.** A generation is minutes and a compile is seconds of
   CPU. Serverless function limits are a deployment decision this does not make.

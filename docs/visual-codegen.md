# Visual codegen — the state of the replacement renderer

Written 2026-08-09. Branch `integrate/visual-codegen`, from `fix/production-ux`.

## Why this exists

The fixed renderer reached its ceiling. Its section vocabulary was a closed
enum, and a page was a fixed JSX sequence over it, so every generated site had
the same silhouette however many art directions, fonts and CSS patches were
added. Six directions produced six colourways of one page, not six pages. No
further enum was going to change that; the schema was the limit.

Codegen removes the enum. The model writes the markup and the stylesheet, and a
gate decides whether what it wrote is allowed.

## The safety boundary

Unchanged from the prototype in kind, stronger in implementation.

| Layer | What it does |
| --- | --- |
| Envelope | Shape, sizes, unknown keys refused |
| Content pack | Ventrio's words, validated before use |
| Raw budgets | On exactly the bytes the model produced |
| Reject pass | Scanner **and** parse5/css-tree, merged; both must pass |
| Substitution | Escaped content, so it cannot add structure |
| Media expansion | Ventrio's own `<img>`, from a registry id the gate approved |
| Expanded budgets | On the bytes the browser actually receives |
| Shell | Ventrio's document, `<meta>` CSP first in `<head>` |
| Frame | `sandbox=""` — no scripts, no same-origin, no forms, no navigation |

What the model may emit: an allowlisted tag set, an allowlisted attribute set,
`class`/`id`/`aria-*`/`data-*`, internal `href`s and fragments, and one
stylesheet. What it may not: any script, any inline `style` attribute, any
external URL, any `url()` in CSS, any `@import`, any comment, any `<img>` of its
own. Media is placed by naming a registry id; the compiler writes the `<img>`.

The parser gate is the part that was promoted for production. A scanner reasons
about source text; a browser reasons about the tree it builds from that text,
and those differ exactly where an attacker aims — `<scr<script>ipt>`,
entity-encoded schemes, attribute-position handlers, SVG foreign content. parse5
resolves all of it the way Chrome would. Both gates run and both must pass; where
they disagree (parse5 accepts implicit `<li>` closing, the scanner refuses) the
stricter rule wins, deliberately and on the record.

Nothing anywhere repairs its input. A bundle either conforms or it is refused.

## How it is wired in

Behind `VENTRIO_CODEGEN_RENDER=1`. Off by default. The fixed renderer is still
the shipped path and nothing about it has been removed.

- `projectContent.ts` projects a sanitised `Stage3ProjectOutput` onto the
  content contract. Ventrio owns the words, the model owns the design — which
  is what gives the `literal_copy` rule teeth.
- `projectBrief.ts` states the product and the two intake answers. A deferred
  answer contributes nothing rather than a placeholder.
- `renderProject.ts` runs the prototype pipeline on Anthropic. When the artifact
  says `imageryStrategy: "none"` it passes an empty registry, so prompt and gate
  agree there are no pictures.
- The design pass runs **inside the existing generation job**: one job row, one
  reserved quota unit, one refund path, one retry count. It is a second provider
  request but one generation from the person's side.
- Storage is the bundle, not the compiled page — a few kB instead of a few
  hundred, and the full gate re-runs on every read, so a bundle accepted by an
  older gate stops rendering when the gate is tightened.
- The preview nests a `sandbox=""` `srcdoc` frame inside `ViewportFrame`, so it
  inherits the viewport behaviour already fixed for the React preview.

There is no fallback to the fixed renderer for a project codegen built. A silent
fallback would make the canary meaningless.

## Evidence so far

Six sites written to the contract by hand (`src/lib/v2/codegen/siteFixtures.ts`),
compiled through the real gate chain, screenshotted at 390/768/1440. They carry a
navigation bar, a bento grid, a pricing table, a comparison table, a gallery, a
testimonial, an FAQ and a numeric band — none of which existed as a concept in
the old schema. Same content pack in all six, so every visible difference is
structure and design.

All six passed the gate unmodified on the first compile. The screenshots found
horizontal overflow in two (four-column pricing tables widening the document
past a phone viewport); fixed, and the harness now asserts `scrollWidth` so it is
caught mechanically.

## What still blocks real production use

1. **No model has ever produced one of these.** The fixtures prove the contract
   can express six finished designs. They do not prove a model will. That is
   what the canary is for, and it is the single largest open risk.
2. **Imagery.** The registry holds procedurally generated placeholders, not
   photography — 174–2412 unique colours against 8,000–16,000 for real photos.
   This is the most visible remaining gap against Lovable and Base44, and it is
   unchanged by moving renderer. See `docs/generated-imagery.md`.
3. **Editing.** `editProjectOutputAction` edits the artifact. A codegen project's
   design lives in the bundle, so "make the background darker" has nothing to act
   on yet. Either edits regenerate the bundle from an amended brief, or a second
   edit path targets the bundle. Not built.
4. **Publishing.** The publish pipeline serialises `Stage3ProjectOutput`. It has
   no codegen path, so a codegen project cannot be published.
5. **Cost.** Two provider requests per generation instead of one, plus up to one
   repair. Measured against a single unit of quota, so the unit economics change
   even though the user-facing allowance does not.
6. **Multi-route.** One route today. The contract allows four; the artifact has
   no second page in it, so growing this waits on the artifact.

## Canary

Three paid same-prompt runs are justified once the above is understood, because
item 1 is not answerable any other way — every offline check that could be run
has been run, and they all pass. Three runs on the same prompt measure the thing
that actually matters: whether the variance between runs is design variance or
quality variance. One run cannot distinguish a good model from a lucky one.

They have not been run. No Gemini or Anthropic request has been made in this
work.

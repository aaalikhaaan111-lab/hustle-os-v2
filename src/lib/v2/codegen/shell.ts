/**
 * The document shell — entirely Ventrio's, never the model's.
 *
 * The model supplies a stylesheet and body markup. Everything that decides what
 * kind of document this is, and what it is permitted to do, is assembled here
 * from constants.
 *
 * Two ordering facts are load-bearing:
 *
 * 1. The CSP `<meta>` is the first thing in `<head>`, before `<style>` and
 *    before any content. A policy declared after the content it governs is
 *    applied late, and "late" for a CSP means "after the thing it was meant to
 *    stop". Tests assert the ordering rather than trusting this comment.
 * 2. The stylesheet is mounted inside a `<style>` element whose contents were
 *    already refused if they contained `</` (see reject.ts). Without that rule,
 *    a stylesheet could close its own element and continue as markup.
 *
 * The inner CSP is not the only containment: the frame is `sandbox=""`, which
 * already denies scripts, same-origin access, forms and navigation. This policy
 * is the second, independent layer — a defence that holds even if the sandbox
 * attribute is ever weakened by a careless edit.
 */

import { escapeHtml } from "./content";

/**
 * Deny everything, then allow only what a static visual page needs.
 *
 * `style-src 'unsafe-inline'` is required because the whole design arrives as
 * an inline stylesheet; there is no nonce to give it, and no external
 * stylesheet is permitted. Inline *style attributes* are separately refused by
 * the reject pass, so this permission covers exactly one `<style>` element.
 *
 * `img-src data:` allows no network image of any kind — see reject.ts on why
 * `<img>` is not in the element allowlist at all.
 */
export const INNER_CSP = [
  "default-src 'none'",
  "script-src 'none'",
  "style-src 'unsafe-inline'",
  "img-src data:",
  "font-src 'none'",
  "connect-src 'none'",
  "media-src 'none'",
  "object-src 'none'",
  "frame-src 'none'",
  "worker-src 'none'",
  "form-action 'none'",
  "base-uri 'none'",
].join("; ");

/**
 * Normalisation the generated stylesheet can rely on.
 *
 * Kept minimal on purpose: this is a reset and a viewport contract, not a
 * design system. Anything opinionated here would silently become part of every
 * generated page's look, which would make the model's stylesheet harder to
 * judge — and judging it honestly is the point of the prototype.
 */
const BASE_CSS = `*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;min-height:100vh;overflow-x:hidden;text-rendering:optimizeLegibility}
img{max-width:100%;height:auto;display:block}
h1,h2,h3,h4,h5,h6,p,figure,blockquote,dl,dd{margin:0}
ul,ol{margin:0;padding:0;list-style:none}
a{color:inherit;text-decoration:none}
table{border-collapse:collapse;width:100%}`;

/**
 * The composition vocabulary's geometry.
 *
 * Ventrio owns these, not the model. A bundle asks for a layout by name —
 * `data-ventrio-layout="split"` — and gets a tested arrangement, rather than
 * having to derive a grid and get its breakpoints right. Three reasons this
 * belongs here:
 *
 * 1. The failure being designed out is compositional, not stylistic. The first
 *    canary produced a hero with an empty right column because the model was
 *    inventing its own two-column geometry with nothing to put in it. Naming
 *    the intention lets the gate check whether the intention is honest — see
 *    MEDIA_REQUIRING_LAYOUTS in reject.ts.
 * 2. Asymmetry, overlap and persistent columns are exactly the arrangements
 *    that are fiddly to express and easy to get subtly wrong at one
 *    breakpoint. Shipping them means a bundle can reach for them cheaply.
 * 3. It costs the model no new capability, so the security model is untouched:
 *    these are class and attribute selectors over markup that already passed
 *    the reject pass.
 *
 * Every layout is single-column at the base width and only becomes itself at
 * 768 or 1100, so mobile never inherits a desktop arrangement.
 */
const LAYOUT_CSS = `
[data-ventrio-layout]{display:grid;gap:clamp(24px,4vw,56px)}
[data-ventrio-layout="stack"]{grid-template-columns:minmax(0,1fr)}
[data-ventrio-layout="offset"]{grid-template-columns:minmax(0,1fr)}
.v-media{margin:0;overflow:hidden}
.v-media-img{width:100%;height:100%;object-fit:cover;display:block}
@media(min-width:768px){
  [data-ventrio-layout="rail"]{grid-template-columns:minmax(160px,.32fr) minmax(0,1fr);align-items:start}
  [data-ventrio-layout="mosaic"]{grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(12px,2vw,20px)}
  [data-ventrio-layout="mosaic"]>.v-media:first-child{grid-row:span 2}
}
@media(min-width:1100px){
  [data-ventrio-layout="split"]{grid-template-columns:minmax(0,1.15fr) minmax(0,.85fr);align-items:center}
  [data-ventrio-layout="split"][data-ventrio-flip="true"]{direction:rtl}
  [data-ventrio-layout="split"][data-ventrio-flip="true"]>*{direction:ltr}
  [data-ventrio-layout="offset"]{grid-template-columns:minmax(0,.14fr) minmax(0,1fr) minmax(0,.24fr)}
  [data-ventrio-layout="offset"]>*{grid-column:2}
  [data-ventrio-layout="overlap"]{grid-template-columns:repeat(12,minmax(0,1fr));align-items:center}
  [data-ventrio-layout="overlap"]>.v-media{grid-column:1 / span 8;grid-row:1}
  [data-ventrio-layout="overlap"]>:not(.v-media){grid-column:7 / span 6;grid-row:1;position:relative;z-index:1}
  [data-ventrio-layout="mosaic"]{grid-template-columns:repeat(3,minmax(0,1fr))}
  [data-ventrio-layout="bleed"]{grid-template-columns:minmax(0,1fr)}
  [data-ventrio-layout="bleed"]>.v-media{grid-column:1;grid-row:1;max-height:70vh}
  [data-ventrio-layout="bleed"]>:not(.v-media){grid-column:1;grid-row:1;position:relative;z-index:1;justify-self:start;max-width:52ch}
}`;

export interface ShellInput {
  title: string;
  css: string;
  bodyHtml: string;
  lang?: string;
}

/**
 * Builds the `srcdoc` string for one route.
 *
 * `title` is escaped because it is application-supplied text placed into
 * markup. `bodyHtml` and `css` are inserted verbatim — they have already passed
 * the reject pass, and escaping them here would defeat their purpose.
 */
export function buildSrcDoc({ title, css, bodyHtml, lang = "en" }: ShellInput): string {
  const safeLang = /^[a-z]{2}(-[A-Za-z0-9]{2,8})?$/.test(lang) ? lang : "en";
  return (
    `<!doctype html><html lang="${safeLang}"><head>` +
    `<meta http-equiv="Content-Security-Policy" content="${INNER_CSP}">` +
    `<meta charset="utf-8">` +
    `<meta name="viewport" content="width=device-width,initial-scale=1">` +
    `<title>${escapeHtml(title)}</title>` +
    `<style>${BASE_CSS}\n${LAYOUT_CSS}\n${css}</style>` +
    `</head><body>${bodyHtml}</body></html>`
  );
}

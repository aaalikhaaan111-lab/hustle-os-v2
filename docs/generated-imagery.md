# Imagery in generated sites — what exists and what production needs

Written 2026-08-09.

## What exists now

A registry of assets Ventrio owns (`src/lib/build/mediaAssets.ts`) and seven
treatments the renderer knows how to apply: full-bleed, split, background,
editorial crop, collage, framed, and none. The model picks an id and a
treatment; it never supplies a source. There is no path by which a
model-authored string becomes a URL or a network request.

`none` is deliberately first-class. A composition that works without an image
beats one that reserves a column for an image it does not have.

## What the six committed assets actually are

Procedurally generated locally with PIL: gradients, blurred colour blobs, flat
geometric shapes, and a little grain. They are **not photography** and should
not be described as such. Measured on a 160×100 sample they carry 174–2412
unique colours; real photography in the same sample runs 8,000–16,000.

They exist so the media pipeline and its treatments can be exercised and
reviewed offline. They are placeholders in everything but name, and they are
the main reason generated pages still do not feel finished.

## What production needs

1. **Real image generation.** A provider call per project, with the prompt
   derived from `hero.visualPrompt` and the section `visualPrompt` fields that
   already exist in the artifact. This is the single biggest visible gap
   against Lovable and Base44 — their pages carry real product shots and
   photography, ours carry type and colour.
2. **Storage and serving.** Generated assets need to live somewhere durable
   (Supabase storage or equivalent) and be served from an origin the CSP
   already allows. `img-src` currently permits `'self'` and `i.ytimg.com`
   only, so adding a bucket origin is a deliberate, reviewable change.
3. **Cost and quota.** Image generation is a second paid metric alongside
   `first_version_generation`. It needs its own counter, its own daily
   allowance, and the same refund-on-failure behaviour.
4. **Failure behaviour.** When generation fails or is refused, the page must
   fall back to a composition that works without media — which is what the
   `none` treatment already does. Nothing should ever render an empty frame.
5. **Licensing, if stock is used instead.** A stock source would need a
   licence that covers redistribution on user-published sites, and attribution
   handling if the licence requires it.

Until at least (1) and (2) exist, treat every generated page as a type-led
page and choose directions accordingly.

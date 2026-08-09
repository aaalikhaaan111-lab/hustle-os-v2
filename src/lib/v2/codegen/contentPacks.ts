/**
 * Content packs — the copy the model is allowed to place but not to write.
 *
 * Every value here is application-owned. The model receives the *keys* in its
 * prompt and composes around them, which is what makes "do not invent claims"
 * enforceable rather than aspirational: there is no key for a customer count,
 * so a generated page cannot assert one.
 *
 * Deliberately prosaic copy. A pack full of polished marketing lines would
 * flatter any layout it was poured into and make the visual verdict
 * meaningless — the point of the canary is to judge composition, so the words
 * should be ordinary and the design should have to carry the page.
 */

import type { ContentPack } from "./content";

/**
 * Relay — the canary subject. A build-log tool for solo hardware makers.
 *
 * Chosen because it is unglamorous and specific: no stock SaaS vocabulary to
 * fall back on, and a real information hierarchy (a log, a parts list, a
 * changelog) that a layout either expresses or flattens.
 */
export const RELAY_CONTENT: ContentPack = {
  "brand.name": "Relay",
  "brand.tagline": "A build log that survives the build",

  "hero.eyebrow": "For solo hardware makers",
  "hero.title": "Your project remembers what you did last Tuesday",
  "hero.body":
    "Relay keeps the running log, the parts you actually used, and the revision that finally worked — so picking a project back up after three weeks does not start with an hour of archaeology.",
  "hero.cta": "Start a build log",
  "hero.secondary": "See an example log",

  "problem.title": "Notes scatter faster than projects finish",
  "problem.body":
    "Measurements end up in a phone photo, the supplier link in a browser tab, the reason you abandoned revision two in nobody's memory at all.",
  "problem.point1.title": "The parts list drifts",
  "problem.point1.body": "What you ordered and what you fitted stop matching by the second revision.",
  "problem.point2.title": "Decisions go unrecorded",
  "problem.point2.body": "The why behind a change is the first thing lost and the thing most needed later.",
  "problem.point3.title": "Photos lose their context",
  "problem.point3.body": "A camera roll is not a build log; it is 400 pictures of the same bracket.",

  "how.title": "Three things, kept in one place",
  "how.step1.title": "Log as you work",
  "how.step1.body": "Short entries, timestamped, with whatever photo you already took.",
  "how.step2.title": "Track the real parts",
  "how.step2.body": "Each entry can pin the components it touched, with the supplier and the spec.",
  "how.step3.title": "Mark what worked",
  "how.step3.body": "Tag a revision as the one that held, and the log reorganises around it.",

  "detail.title": "Built for the way a bench actually works",
  "detail.body":
    "Entries can be written days late without lying about when the work happened. Nothing requires a network connection at the moment you are holding a soldering iron.",
  "detail.point1": "Backdated entries keep their real date",
  "detail.point2": "Works offline; syncs when it can",
  "detail.point3": "Exports to plain Markdown and CSV",
  "detail.point4": "No account needed to read a shared log",

  "pricing.title": "One price, no seats",
  "pricing.body": "Relay is a tool for one person and is priced like one.",
  "pricing.plan": "Maker",
  "pricing.price": "$6 / month",
  "pricing.note": "Billed yearly. Cancel any time; your logs export in full.",
  "pricing.cta": "Start the free month",

  "faq.title": "Before you ask",
  "faq.q1": "Does it work without internet?",
  "faq.a1": "Yes. Entries queue locally and sync when a connection returns.",
  "faq.q2": "Can I get my data out?",
  "faq.a2": "Markdown and CSV export, complete, at any time, including after cancelling.",
  "faq.q3": "Is there a team plan?",
  "faq.a3": "No. Relay is deliberately single-user; shared logs are read-only links.",

  "cta.title": "Start the log before the project starts",
  "cta.body": "The first entry is usually the parts order. It is a good place to begin.",
  "cta.button": "Create a build log",

  "footer.note": "Relay is an independent tool, built and maintained by one person.",
  "footer.contact": "hello@relay.example",

  "nav.home": "Overview",
  "nav.pricing": "Pricing",
  "page.home.title": "Relay — a build log that survives the build",
  "page.pricing.title": "Relay — pricing",
};

/**
 * The keys a prompt may reference, formatted for inclusion in a prompt.
 *
 * Generated from the pack rather than maintained by hand: a prompt listing a
 * key that no longer exists produces a bundle that fails substitution, and that
 * failure would cost a provider request to discover.
 */
export function describeContentKeys(pack: ContentPack): string {
  return Object.keys(pack)
    .sort()
    .map((key) => `  {{ventrio:text:${key}}} — ${truncate(pack[key], 70)}`)
    .join("\n");
}

function truncate(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}

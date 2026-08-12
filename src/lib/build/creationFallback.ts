/**
 * A project direction built from the person's own words, with no provider.
 *
 * WHY THIS EXISTS. Discovery is one model call standing in front of the entire
 * product: it is the only thing that sets a project's direction, so when it
 * fails nobody can start a project *and* no existing draft can reach generation.
 * That has already happened twice — an Anthropic account out of credit, and a
 * Gemini outage where a trivial request took 34.5 s — and both times generation
 * itself was healthy and completely unreachable. A funnel with a single point
 * of failure in front of it is not something a launch can carry.
 *
 * So discovery stays the preferred path and stops being a required one. When
 * the provider fails, the person is offered the thing they already gave us:
 * their idea, as the direction, straight into the same intake and generation
 * flow a proposed direction goes into.
 *
 * WHAT IT MUST NOT DO. Invent. Discovery's whole value is the audience, the
 * motivation and the first experience it works out with the person, and a
 * fallback that guessed at those would put words in their mouth and feed them
 * to generation as if they were confirmed. Everything here is either the
 * person's own text or an explicit placeholder recorded in `assumptions`, which
 * is the field the generation prompt already reads as "not confirmed".
 */

import { CREATION_LIMITS, type CreationDirection } from "@/lib/build/creationTypes";

/**
 * The translated phrases that stand in for what discovery would have asked.
 *
 * Passed in rather than looked up so this module stays pure and testable, and
 * so the wording lives with the rest of the product's copy.
 */
export interface CreationFallbackCopy {
  /** Stands in for the audience discovery would have narrowed. */
  audience: string;
  /** Stands in for the problem or desire behind the idea. */
  problem: string;
  /** Why this direction fits: because it is theirs, verbatim. */
  whyFits: string;
  /** What Ventrio will create. The caller interpolates the idea. */
  creates: string;
  /** Recorded so generation knows this was assumed, not confirmed. */
  assumption: string;
}

/**
 * Too short to be a direction.
 *
 * "hi" is not an idea, and a fallback built from it would produce a project
 * about nothing. Below this the offer is withheld and the person keeps only
 * Retry, which is the honest option when there is nothing to fall back to.
 */
const MIN_IDEA_CHARS = 12;

/** Sentence-ish terminators, including the ones Russian text actually uses. */
const SENTENCE_BREAK = /[.!?\n:;—–]/;

/**
 * A short name taken from the idea's opening words.
 *
 * Not a summary — summarising is what the model was for. This is the first
 * handful of words, which is what a person would have called it anyway, and
 * `selectCreationDirectionAction` still runs its own placeholder check over the
 * result.
 */
export function nameFromIdea(idea: string): string {
  const lead = idea.split(SENTENCE_BREAK, 1)[0] ?? "";
  const words = lead.trim().split(/\s+/).filter(Boolean).slice(0, 6).join(" ");
  const trimmed = words.slice(0, CREATION_LIMITS.name).trim();
  if (trimmed.length < 2) return "";
  return trimmed.charAt(0).toLocaleUpperCase() + trimmed.slice(1);
}

/**
 * The person's idea as a direction, or null when there is not enough to use.
 *
 * Null is a real answer: the caller offers the fallback only when this returns
 * something, so a person who typed "hi" is never handed a project built out of
 * "hi".
 *
 * The result is deliberately shaped to pass `sanitizeCreationDirection`
 * unchanged — it travels back through the client and is re-validated on the way
 * in, exactly like a direction the model proposed. Nothing here is trusted more
 * than that.
 */
export function buildFallbackDirection(input: {
  idea: string;
  copy: CreationFallbackCopy;
}): CreationDirection | null {
  const idea = input.idea.trim().replace(/\s+/g, " ");
  if (idea.length < MIN_IDEA_CHARS) return null;

  const name = nameFromIdea(idea);
  if (!name) return null;

  const concept = idea.slice(0, CREATION_LIMITS.text);
  const creates = input.copy.creates.trim().slice(0, CREATION_LIMITS.text);
  const audience = input.copy.audience.trim().slice(0, CREATION_LIMITS.audience);
  const problem = input.copy.problem.trim().slice(0, CREATION_LIMITS.text);
  const whyFits = input.copy.whyFits.trim().slice(0, CREATION_LIMITS.text);
  if (!creates || !audience || !problem || !whyFits) return null;

  return {
    name,
    concept,
    forWho: audience,
    creates,
    whyFits,
    /**
     * The most general of the four presets, and the one
     * `ensureCreationDraftAction` already wrote on the draft. Inferring a
     * narrower preset from keywords would be a guess about the shape of the
     * project dressed up as a decision.
     */
    projectType: "digital_product",
    problem,
    audience,
    // Left to the sanitizer's default rather than mined out of the text.
    niche: "",
    creativeBrief: {
      // The person's own words are the starting material. That is the entire
      // point of this path.
      startingMaterial: concept,
      motivation: problem,
      firstAudience: audience,
      desiredExperience: creates,
      // Never invented. Discovery earns these by asking; nothing else may.
      personalIngredients: [],
      constraints: [],
      assumptions: [input.copy.assumption.trim().slice(0, CREATION_LIMITS.briefItem)].filter(Boolean),
    },
  };
}

/**
 * Whether a failed discovery turn should offer the fallback.
 *
 * The reasons are the ones `generateCreationTurnAction` releases on. Provider
 * trouble — a timeout, a 429, a 5xx, an unparseable answer, an unconfigured
 * key, a throw — is exactly what this path exists for.
 *
 * Storage failures are the deliberate exception. Taking the fallback writes the
 * direction to the same tables that just refused a write, so offering it would
 * promise a way forward that cannot work. There the person keeps Retry.
 */
export function shouldOfferFallback(reason: string): boolean {
  return !reason.startsWith("snapshot_save_failed")
    && !reason.startsWith("assistant_message_save_failed")
    && !reason.startsWith("empty_history");
}

import { isProjectOutputEditRequest } from "@/lib/build/editIntent";

/**
 * What the person is asking for on this turn, decided in code.
 *
 * The model used to decide this implicitly, turn by turn, and it kept choosing
 * discovery: asked three times in a row to "сгенерируй сайт" it answered three
 * times that it could not build until the problem statement was confirmed and
 * saved. A model that can re-litigate the decision every turn will eventually
 * loop, so the decision is taken here instead and the model is told what was
 * decided.
 *
 * `BUILD_NOW` is the one that matters: it means generation runs on this turn,
 * whatever the project's stage says and whatever fields are unconfirmed.
 */
export type BuildIntent = "BUILD_NOW" | "CLARIFY_CRITICAL" | "DISCUSS" | "EDIT_EXISTING";

/** A build verb applied to a build noun: "сгенерируй сайт", "build the page". */
const BUILD_VERB_EN = /\b(?:generate|build|create|make|design|start)\b/i;
const BUILD_NOUN_EN = /\b(?:site|website|page|landing|product|app|prototype|first\s+version|version|mvp|it)\b/i;
const BUILD_VERB_RU = /(?:сгенерир|сгенери|созда|сдела|сдел|построй|постро|собери|собер|сверстай|свёрстай|начинай|начни|запусти|запускай)/i;
const BUILD_NOUN_RU = /(?:сайт|страниц|лендинг|продукт|прилож|прототип|перв[а-яё]*\s+верси|верси|мвп|платформ)/i;

/**
 * A bare imperative to get on with it, with no object named.
 *
 * "просто сделай", "начинай", "just build it". The object is obvious from the
 * conversation, and demanding a noun is what made "просто сделай, остальное
 * придумай сам" read as ordinary chat.
 */
const BARE_BUILD_RU = /(?:^|\s)(?:просто\s+)?(?:сделай|сгенерируй|создай|начинай|начни|поехали|давай\s+уже|строй|собирай)(?:\s|[.,!?]|$)/i;
const BARE_BUILD_EN = /(?:^|\s)(?:just\s+)?(?:build|generate|create|make)\s*(?:it|this|that)?(?:\s|[.,!?]|$)/i;

/**
 * "You decide the rest."
 *
 * This is the strongest build signal there is: the person is explicitly handing
 * over the very details the assistant was stopping to ask about. Answering it
 * with another question is the exact failure that was reported.
 */
const DEFER_RU = /(?:сам[аи]?\s+придума|придума[йские]*\s+сам|сам[аи]?\s+реши|реши[тесь]*\s+сам|остальное\s+(?:сам|на\s+тво|реши|придума)|на\s+тво[ёе]\s+усмотрен|как\s+считаешь\s+нужным|по\s+сво[ему]+\s+усмотрен)/i;
const DEFER_EN = /(?:you\s+decide|decide\s+(?:the\s+)?(?:details|rest|everything)?\s*yourself|make\s+(?:reasonable\s+)?assumptions|figure\s+(?:it\s+)?out\s+yourself|up\s+to\s+you|whatever\s+you\s+think)/i;

/** Questions about the first version are discovery, not an order to build. */
const DISCOVERY_QUESTION = /^(?:what|which|how|why|who|when|где|что|как|какой|какая|какие|почему|зачем|кто|когда)\b/i;

export interface BuildIntentContext {
  /** True once a first version exists; changes "build" into "edit". */
  hasOutput: boolean;
}

/**
 * True when the message is an explicit instruction to build, in any supported
 * language. Exported so the same rule can be asserted directly in tests.
 */
export function hasExplicitBuildIntent(message: string): boolean {
  const value = message.trim();
  if (value.length === 0) return false;

  // "what should the first version be?" is a question about building, not an
  // instruction to build. Deference overrides it: "какой сайт? реши сам" is a
  // handover, not a question.
  if (DISCOVERY_QUESTION.test(value) && !DEFER_RU.test(value) && !DEFER_EN.test(value)) {
    return false;
  }

  if (DEFER_RU.test(value) || DEFER_EN.test(value)) return true;
  if (BUILD_VERB_EN.test(value) && BUILD_NOUN_EN.test(value)) return true;
  if (BUILD_VERB_RU.test(value) && BUILD_NOUN_RU.test(value)) return true;
  if (BARE_BUILD_RU.test(value) || BARE_BUILD_EN.test(value)) return true;
  return false;
}

export function classifyBuildIntent(message: string, context: BuildIntentContext): BuildIntent {
  const value = message.trim();
  if (value.length === 0) return "DISCUSS";

  // With a first version on screen, "change the headline" is an edit. An
  // explicit build instruction is still an edit here, because the thing it
  // asks for already exists.
  if (context.hasOutput) {
    return isProjectOutputEditRequest(value) || hasExplicitBuildIntent(value) ? "EDIT_EXISTING" : "DISCUSS";
  }

  if (hasExplicitBuildIntent(value)) return "BUILD_NOW";
  return "DISCUSS";
}

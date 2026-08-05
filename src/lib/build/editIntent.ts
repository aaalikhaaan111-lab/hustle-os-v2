const DIRECT_EDIT = /^(?:please\s+)?(?:make|change|update|edit|rewrite|revise|improve|adjust|replace|remove|add|strengthen|clarify|narrow|sharpen|fix|use)\b/i;
const POLITE_EDIT = /^(?:can|could|would)\s+you\s+(?:please\s+)?(?:make|change|update|edit|rewrite|revise|improve|adjust|replace|remove|add|strengthen|clarify|narrow|sharpen|fix|use)\b/i;
const DIRECT_EDIT_RU = /^(?:пожалуйста[,.]?\s*)?(?:сделай|измени|обнови|отредактируй|перепиши|переработай|улучши|скорректируй|замени|убери|удали|добавь|усиль|уточни|сузь|исправь|используй)(?=\s|[.,!?]|$)/i;
const POLITE_EDIT_RU = /^(?:можешь|можете|мог(?:ла|ли)?\s+бы)\s+(?:пожалуйста[,.]?\s*)?(?:сделать|изменить|обновить|отредактировать|переписать|переработать|улучшить|скорректировать|заменить|убрать|удалить|добавить|усилить|уточнить|сузить|исправить|использовать)(?=\s|[.,!?]|$)/i;

export function isProjectOutputEditRequest(message: string): boolean {
  const value = message.trim();
  return DIRECT_EDIT.test(value)
    || POLITE_EDIT.test(value)
    || DIRECT_EDIT_RU.test(value)
    || POLITE_EDIT_RU.test(value);
}

/**
 * "Build me the thing" — an explicit request to generate the first version.
 *
 * Separate from the edit intents above: those refine output that already
 * exists, this one asks for output to exist at all. It is matched anywhere in
 * the message rather than only at the start, because the real phrasing people
 * used in production was a bare "сгенерируй сайт" as often as a full sentence.
 *
 * Kept deliberately tight. A false positive starts a generation the user did
 * not ask for, so this looks for a build verb applied to a build noun, not for
 * either on its own — "what could the first version become?" is discovery and
 * must not trip it.
 */
const BUILD_VERB_EN = /\b(?:generate|build|create|make|design)\b/i;
const BUILD_NOUN_EN = /\b(?:site|website|page|landing|product|app|prototype|first\s+version|mvp)\b/i;
const BUILD_VERB_RU = /(?:сгенерир|сгенери|созда|сдела|построй|постро|собери|собер|свёрстай|сверстай)/i;
const BUILD_NOUN_RU = /(?:сайт|страниц|лендинг|продукт|прилож|прототип|перв[а-яё]*\s+верси|мвп)/i;

/** Questions about the first version are discovery, not a build request. */
const DISCOVERY_QUESTION = /^(?:what|which|how|why|who|when|где|что|как|какой|какая|какие|почему|зачем|кто|когда)\b/i;

export function isFirstVersionRequest(message: string): boolean {
  const value = message.trim();
  if (value.length === 0) return false;
  if (DISCOVERY_QUESTION.test(value)) return false;
  const en = BUILD_VERB_EN.test(value) && BUILD_NOUN_EN.test(value);
  const ru = BUILD_VERB_RU.test(value) && BUILD_NOUN_RU.test(value);
  return en || ru;
}

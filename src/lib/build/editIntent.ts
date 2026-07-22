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

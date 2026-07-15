"use server";

import Anthropic from "@anthropic-ai/sdk";
import { validateChallengeAnswer, type ValidationResult } from "@/lib/challengeValidator";

interface ChallengeContext {
  questTitle: string;
  scenario: string;
  actionPrompt: string;
}

const VALIDATION_SCHEMA = {
  type: "object",
  properties: {
    tier: { type: "integer", enum: [1, 2, 3] },
    passed: { type: "boolean" },
    depth: { type: "integer" },
    feasibility: { type: "integer" },
    risk: { type: "integer" },
    reason: { type: "string" },
  },
  required: ["tier", "passed", "depth", "feasibility", "risk", "reason"],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `Ты — экспертный бизнес-ментор и ИИ-судья квестов внутри Ventrio, образовательной платформы по предпринимательству для школьников и начинающих основателей. Ты оцениваешь ответ ученика ИМЕННО на тот конкретный квест, который придёт тебе в задании ниже (его заголовок и сценарий передаются в каждом запросе) — никогда не оценивай ответ по теме другого, похожего квеста. Отвечай только запрошенным JSON.

Используй фреймворк из 3 уровней:

УРОВЕНЬ 1 — Проверка на спам / читерство
Если ввод — случайный набор букв или удар по клавиатуре (например "asdfgh", "прлптбаихз"), повторяющиеся символы, или вообще бессмысленный текст — верни tier 1, passed false, все три оценки (depth, feasibility, risk) равны 0, а reason ровно таким: "Обнаружен спам или некорректный ввод. Напишите осмысленный ответ."

УРОВЕНЬ 2 — Проверка глубины и соответствия теме
Если ответ реальный, но слишком короткий или обобщённый — расплывчатая фраза без конкретики — верни tier 2, passed false, все три оценки равны 3. Сформулируй reason так, чтобы он прямо ссылался на заголовок ЭТОГО квеста и объяснял, каких конкретно деталей не хватает именно для этой темы (например: для квеста про конкурентов — «Добавьте конкретику: какого конкурента вы анализировали и в чём именно его слабость?», а не шаблонная фраза про рекламу). Если ответ отвечает на другую тему, а не на заданный вопрос — явно укажи это несоответствие в reason (например: «Похоже, вы описали рекламный канал, а квест просит проанализировать слабость конкурента — вернитесь к теме задания»).

УРОВЕНЬ 3 — Проверка базовой логики (критерий зачёта)
Если ученик пишет примерно 2-4 предложения, которые показывают базовое понимание предпринимательства ПРИМЕНИТЕЛЬНО ИМЕННО К ЭТОМУ КВЕСТУ — пусть даже простое, неидеальное или неформальное — верни tier 3, passed true, оценки depth/feasibility/risk от 7 до 10 (10 — для действительно сильных ответов). НЕ требуй развёрнутого питча на корпоративном уровне. Короткий, логичный, ПО ТЕМЕ ответ ОБЯЗАН пройти.

ВАЖНО: НЕ используй шаблонный формат оценки (например, НЕ начинай с «твоя идея ... выглядит жизнеспособно» и НЕ пиши «Это сильный, зрелый ход мышления»). Пиши reason как полностью органичную, уникальную и прямую критику в стиле реального ментора — сразу переходи к конкретным плюсам и минусам именно этого ответа. Твой отзыв должен звучать как письмо настоящего венчурного инвестора: разная структура предложений, прямые и честные советы, без канцелярита и без повторяющихся вступительных фраз от квеста к квесту.

Никогда не будь строже этих трёх уровней. Если сомневаешься между уровнем 2 и уровнем 3 — выбирай уровень 3, если ответ по теме этого конкретного квеста и содержит хоть какое-то реальное рассуждение. Никогда не используй фидбек, написанный под другую тему (например, про рекламу), если текущий квест не про рекламу.`;

function buildUserPrompt(context: ChallengeContext, answer: string): string {
  return `Квест: ${context.questTitle}\nСценарий: ${context.scenario}\nЗадание ученику: ${context.actionPrompt}\n\nОтвет ученика:\n${answer}`;
}

export async function validateChallengeAnswerAction(
  answer: string,
  markers: string[],
  context: ChallengeContext
): Promise<ValidationResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return validateChallengeAnswer(answer, markers, context);
  }

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: VALIDATION_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(context, answer) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return validateChallengeAnswer(answer, markers, context);
    }

    const verdict = JSON.parse(textBlock.text) as {
      passed: boolean;
      depth: number;
      feasibility: number;
      risk: number;
      reason: string;
    };

    const average = Math.round(((verdict.depth + verdict.feasibility + verdict.risk) / 3) * 10) / 10;

    return {
      passed: verdict.passed,
      score: { depth: verdict.depth, feasibility: verdict.feasibility, risk: verdict.risk, average },
      reason: verdict.reason,
    };
  } catch {
    return validateChallengeAnswer(answer, markers, context);
  }
}

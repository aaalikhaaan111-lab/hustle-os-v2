import type { CreationDirection } from "@/lib/build/creationTypes";
import type { Locale } from "@/i18n/locale";
import { hasExplicitBuildIntent } from "@/lib/build/buildIntent";

/**
 * A direction assembled from what the project already knows, for when nobody
 * ever picked one.
 *
 * Generation used to refuse outright unless `stage3.direction` existed, and a
 * direction only ever came from clicking one of the cards in /create. So a
 * project that reached the workspace another way could never be built at all,
 * no matter what its owner typed — which is the hard stage gate behind
 * "I need your confirmation on the problem before building".
 *
 * Refusing was never the only option. Everything a direction carries is either
 * already on the project or can be assumed, and an assumption the person can
 * see and change beats a question that stops the product from working. Every
 * inferred field is listed in `assumptions`, which the generator is told to
 * treat as provisional, so nothing here is presented as confirmed research.
 *
 * This is deliberately not a model call: it runs on the path where the user has
 * just said "build it", so it must be instant, free and incapable of failing.
 * The creative work still happens in generation — this only decides what that
 * generation is about.
 */

export interface InferredDirectionInput {
  projectName: string | null;
  niche: string | null;
  /** Saved problem/audience/solution fields, any of which may be absent. */
  problem: string | null;
  audience: string | null;
  solution: string | null;
  /** The person's own words, most recent last. The subject usually lives here. */
  recentUserMessages: string[];
  locale: Locale;
}

const COPY = {
  ru: {
    audience: "Люди, которым эта тема близка",
    problemPrefix: "Тема проекта",
    creates: "Первая версия сайта проекта",
    why: "Собрано по вашему запросу — всё можно изменить дальше в разговоре",
    assumedAudience: "Аудитория выбрана предположительно и не подтверждена",
    assumedProblem: "Задача сформулирована предположительно, по описанию проекта",
    assumedExperience: "Первое действие для посетителя выбрано предположительно",
    experience: "Познакомиться с проектом и откликнуться",
    motivation: "Запустить первую версию и посмотреть на неё вживую",
    untitled: "Новый проект",
  },
  en: {
    audience: "People who care about this topic",
    problemPrefix: "The project's subject",
    creates: "A first version of the project's site",
    why: "Assembled from what you asked for — all of it can change as we talk",
    assumedAudience: "The audience is assumed, not confirmed",
    assumedProblem: "The problem is stated from the project description, not from research",
    assumedExperience: "The visitor's first action is assumed",
    experience: "Understand the project and respond to it",
    motivation: "Get a first version up and look at it for real",
    untitled: "New project",
  },
} as const;

/**
 * The instruction, with the "build it" part taken out.
 *
 * The message that triggers a build is frequently the longest one in the
 * conversation ("просто сгенерируй мне сайт. сам придумай"), and taking it
 * whole would make the project's subject the command itself. Sentences that
 * are only an instruction are dropped; a sentence that carries both a subject
 * and an instruction keeps its subject ("Платформа с мини-курсами для
 * школьников. Остальное придумай сам.").
 */
function describingPart(message: string): string {
  const sentences = message
    .split(/(?<=[.!?])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 0);
  const kept = sentences.filter((sentence) => !hasExplicitBuildIntent(sentence));
  return kept.join(" ").trim();
}

/** What the project is about, from the best evidence available. */
function subjectFrom(input: InferredDirectionInput): string | null {
  const described = [input.solution, input.problem, input.niche]
    .map((value) => value?.trim())
    .find((value) => value && value.length > 0);
  if (described) return described;

  const candidates = input.recentUserMessages
    .map((message) => describingPart(message))
    .filter((message) => message.length > 0);
  // The most substantial description wins; a bare command contributes nothing
  // because describingPart has already emptied it.
  return [...candidates].sort((a, b) => b.length - a.length)[0] ?? null;
}

export function inferDirection(input: InferredDirectionInput): CreationDirection {
  const copy = COPY[input.locale === "ru" ? "ru" : "en"];
  const subject = subjectFrom(input);
  const name = input.projectName?.trim() || copy.untitled;
  const concept = subject ?? `${copy.problemPrefix}: ${name}`;

  const assumptions: string[] = [];
  if (!input.audience) assumptions.push(copy.assumedAudience);
  if (!input.problem) assumptions.push(copy.assumedProblem);
  assumptions.push(copy.assumedExperience);

  return {
    name,
    concept,
    forWho: input.audience?.trim() || copy.audience,
    creates: copy.creates,
    whyFits: copy.why,
    // The safest preset: a content/media page makes sense for any subject and
    // does not promise mechanics (accounts, listings, bookings) that the person
    // never asked for.
    projectType: "content_media",
    problem: input.problem?.trim() || concept,
    audience: input.audience?.trim() || copy.audience,
    niche: input.niche?.trim() || name,
    creativeBrief: {
      startingMaterial: concept,
      motivation: copy.motivation,
      firstAudience: input.audience?.trim() || copy.audience,
      desiredExperience: copy.experience,
      personalIngredients: [],
      constraints: [],
      assumptions,
    },
  };
}

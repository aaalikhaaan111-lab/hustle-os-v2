export interface WorkshopQuestion {
  prompt: string;
  options: string[];
  correctIndex: number;
  timeLimitSeconds: number;
  points: number;
}

export interface WorkshopPack {
  slug: string;
  title: string;
  emoji: string;
  description: string;
  questions: WorkshopQuestion[];
}

export const WORKSHOP_PACKS: WorkshopPack[] = [
  {
    slug: "unit-economics",
    title: "Юнит-экономика на скорость",
    emoji: "📊",
    description: "CAC, LTV, Burn Rate, Runway — прогони команду через базовые метрики в живом режиме.",
    questions: [
      {
        prompt: "Что показывает метрика CAC?",
        options: [
          "Прибыль с одного клиента за всё время",
          "Стоимость привлечения одного клиента",
          "Скорость роста выручки",
          "Долю рынка компании",
        ],
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "LTV клиента должен быть...",
        options: [
          "Меньше CAC",
          "Равен CAC",
          "Больше CAC",
          "Не связан с CAC вообще",
        ],
        correctIndex: 2,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "Burn Rate — это...",
        options: [
          "Скорость, с которой стартап тратит деньги",
          "Скорость роста числа пользователей",
          "Процент оттока клиентов",
          "Курс валюты для расчётов",
        ],
        correctIndex: 0,
        timeLimitSeconds: 15,
        points: 800,
      },
      {
        prompt: "Runway показывает...",
        options: [
          "Сколько клиентов нужно для окупаемости",
          "На сколько месяцев хватит денег на счету",
          "Скорость выхода на новый рынок",
          "Долю расходов на маркетинг",
        ],
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "В точке безубыточности прибыль компании равна...",
        options: ["Максимуму", "Нулю", "CAC", "LTV"],
        correctIndex: 1,
        timeLimitSeconds: 15,
        points: 800,
      },
      {
        prompt: "Если Churn Rate растёт месяц к месяцу, это значит...",
        options: [
          "Клиенты чаще остаются с продуктом",
          "Клиенты чаще уходят от продукта",
          "Выручка обязательно растёт",
          "CAC автоматически падает",
        ],
        correctIndex: 1,
        timeLimitSeconds: 15,
        points: 800,
      },
    ],
  },
  {
    slug: "startup-basics",
    title: "Основы стартапа: правда или миф",
    emoji: "🚀",
    description: "MVP, Product-Market Fit, пивот, кастдев — база, которую должен знать каждый фаундер.",
    questions: [
      {
        prompt: "MVP — это...",
        options: [
          "Финальная версия продукта",
          "Минимально жизнеспособный продукт для проверки гипотезы",
          "Маркетинговый видеопрезент",
          "План выхода на IPO",
        ],
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "Главная цель первого CustDev-интервью — это...",
        options: [
          "Продать продукт прямо сейчас",
          "Найти реальные боли клиента",
          "Собрать email-базу",
          "Договориться об инвестициях",
        ],
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "Product-Market Fit наступает, когда...",
        options: [
          "У продукта красивый дизайн",
          "Продукт по-настоящему решает проблему рынка, и спрос растёт органически",
          "Стартап привлёк первый раунд инвестиций",
          "У продукта появился логотип",
        ],
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "Пивот — это...",
        options: [
          "Ежегодный отчёт инвесторам",
          "Резкое изменение курса или бизнес-модели стартапа",
          "Найм нового CTO",
          "Ребрендинг логотипа",
        ],
        correctIndex: 1,
        timeLimitSeconds: 15,
        points: 800,
      },
      {
        prompt: "TAM в анализе рынка означает...",
        options: [
          "Общий объём рынка, если бы продукт занял 100% спроса",
          "Команду, ответственную за маркетинг",
          "Технический аудит продукта",
          "Целевую аудиторию одного сегмента",
        ],
        correctIndex: 0,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "Traction (тракшн) — это...",
        options: [
          "Юридическая форма компании",
          "Измеримое доказательство роста: продажи, повторные покупки, растущий спрос",
          "Договор с сооснователем",
          "Название раунда инвестиций",
        ],
        correctIndex: 1,
        timeLimitSeconds: 15,
        points: 800,
      },
    ],
  },
  {
    slug: "fundraising",
    title: "Питчинг и инвестиции",
    emoji: "💼",
    description: "Pitch Deck, Cap Table, вестинг, дью-дилидженс — язык переговоров с инвестором.",
    questions: [
      {
        prompt: "Pitch Deck — это...",
        options: [
          "Финансовая отчётность за год",
          "Короткая презентация проекта для инвестора",
          "Договор о неразглашении",
          "План разработки продукта",
        ],
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "Вестинг долей нужен, чтобы...",
        options: [
          "Сразу отдать всю долю сооснователю",
          "Постепенно закреплять права на долю за оговорённый срок",
          "Увеличить оценку компании",
          "Упростить бухгалтерию",
        ],
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "Cap Table показывает...",
        options: [
          "График выручки по месяцам",
          "Кому и сколько принадлежит в компании",
          "План выхода на новые рынки",
          "Список конкурентов",
        ],
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "Дью-дилидженс — это...",
        options: [
          "Проверка компании инвестором перед сделкой",
          "Юридическое название стартапа",
          "Первая встреча с клиентом",
          "Тип раунда инвестиций",
        ],
        correctIndex: 0,
        timeLimitSeconds: 15,
        points: 800,
      },
      {
        prompt: "Размытие доли (dilution) происходит, когда...",
        options: [
          "Компания заключает договор с клиентом",
          "В компанию заходят новые инвесторы и выпускаются новые доли",
          "Основатель увольняет сотрудника",
          "Компания меняет юридический адрес",
        ],
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: "Term Sheet — это...",
        options: [
          "Финальный подписанный договор инвестиций",
          "Документ с основными условиями сделки до финального договора",
          "Список сотрудников компании",
          "Годовой финансовый прогноз",
        ],
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
    ],
  },
];

export function getWorkshopPack(slug: string): WorkshopPack | undefined {
  return WORKSHOP_PACKS.find((pack) => pack.slug === slug);
}

/**
 * Kahoot-style speed bonus: correct answers score between 50% and 100% of
 * the question's base points depending on how quickly they were submitted.
 */
export function calculateAwardedPoints(question: WorkshopQuestion, responseMs: number): number {
  const timeLimitMs = question.timeLimitSeconds * 1000;
  const clampedResponseMs = Math.min(Math.max(responseMs, 0), timeLimitMs);
  const speedRatio = 1 - clampedResponseMs / timeLimitMs;
  const multiplier = 0.5 + 0.5 * speedRatio;
  return Math.round(question.points * multiplier);
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no 0/O/1/I/L — avoids ambiguity when read aloud

export function generateSessionCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

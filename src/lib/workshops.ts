import type { Localized } from "@/i18n/content";

export interface WorkshopQuestion {
  prompt: Localized;
  options: Localized<string[]>;
  correctIndex: number;
  timeLimitSeconds: number;
  points: number;
}

export interface WorkshopPack {
  slug: string;
  title: Localized;
  emoji: string;
  description: Localized;
  questions: WorkshopQuestion[];
}

export const WORKSHOP_PACKS: WorkshopPack[] = [
  {
    slug: "unit-economics",
    title: { en: "Unit Economics Speed Round", ru: "Юнит-экономика на скорость" },
    emoji: "📊",
    description: {
      en: "CAC, LTV, burn rate, runway — put your team through the basic metrics live.",
      ru: "CAC, LTV, Burn Rate, Runway — прогони команду через базовые метрики в живом режиме.",
    },
    questions: [
      {
        prompt: { en: "What does the CAC metric show?", ru: "Что показывает метрика CAC?" },
        options: {
          en: [
            "Profit from one customer over their whole lifetime",
            "The cost of acquiring one customer",
            "The rate of revenue growth",
            "A company's market share",
          ],
          ru: [
            "Прибыль с одного клиента за всё время",
            "Стоимость привлечения одного клиента",
            "Скорость роста выручки",
            "Долю рынка компании",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: { en: "A customer's LTV should be...", ru: "LTV клиента должен быть..." },
        options: {
          en: ["Less than CAC", "Equal to CAC", "Greater than CAC", "Not related to CAC at all"],
          ru: ["Меньше CAC", "Равен CAC", "Больше CAC", "Не связан с CAC вообще"],
        },
        correctIndex: 2,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: { en: "Burn rate is...", ru: "Burn Rate — это..." },
        options: {
          en: [
            "The speed at which a startup spends money",
            "The rate of user growth",
            "The customer churn percentage",
            "The exchange rate used for calculations",
          ],
          ru: [
            "Скорость, с которой стартап тратит деньги",
            "Скорость роста числа пользователей",
            "Процент оттока клиентов",
            "Курс валюты для расчётов",
          ],
        },
        correctIndex: 0,
        timeLimitSeconds: 15,
        points: 800,
      },
      {
        prompt: { en: "Runway shows...", ru: "Runway показывает..." },
        options: {
          en: [
            "How many customers you need to break even",
            "How many months the money in the account will last",
            "The speed of entering a new market",
            "The share of spending on marketing",
          ],
          ru: [
            "Сколько клиентов нужно для окупаемости",
            "На сколько месяцев хватит денег на счету",
            "Скорость выхода на новый рынок",
            "Долю расходов на маркетинг",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: {
          en: "At the break-even point, a company's profit equals...",
          ru: "В точке безубыточности прибыль компании равна...",
        },
        options: {
          en: ["The maximum", "Zero", "CAC", "LTV"],
          ru: ["Максимуму", "Нулю", "CAC", "LTV"],
        },
        correctIndex: 1,
        timeLimitSeconds: 15,
        points: 800,
      },
      {
        prompt: {
          en: "If churn rate rises month over month, it means...",
          ru: "Если Churn Rate растёт месяц к месяцу, это значит...",
        },
        options: {
          en: [
            "Customers are sticking with the product more",
            "Customers are leaving the product more often",
            "Revenue is definitely growing",
            "CAC automatically drops",
          ],
          ru: [
            "Клиенты чаще остаются с продуктом",
            "Клиенты чаще уходят от продукта",
            "Выручка обязательно растёт",
            "CAC автоматически падает",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 15,
        points: 800,
      },
    ],
  },
  {
    slug: "startup-basics",
    title: { en: "Startup Basics: Fact or Myth", ru: "Основы стартапа: правда или миф" },
    emoji: "🚀",
    description: {
      en: "MVP, product-market fit, pivot, customer discovery — the basics every founder should know.",
      ru: "MVP, Product-Market Fit, пивот, кастдев — база, которую должен знать каждый фаундер.",
    },
    questions: [
      {
        prompt: { en: "An MVP is...", ru: "MVP — это..." },
        options: {
          en: [
            "The final version of the product",
            "A minimum viable product for testing a hypothesis",
            "A marketing video presentation",
            "A plan for going public (IPO)",
          ],
          ru: [
            "Финальная версия продукта",
            "Минимально жизнеспособный продукт для проверки гипотезы",
            "Маркетинговый видеопрезент",
            "План выхода на IPO",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: {
          en: "The main goal of a first customer discovery interview is...",
          ru: "Главная цель первого CustDev-интервью — это...",
        },
        options: {
          en: [
            "To sell the product right now",
            "To find the customer's real pain points",
            "To build an email list",
            "To arrange investment",
          ],
          ru: [
            "Продать продукт прямо сейчас",
            "Найти реальные боли клиента",
            "Собрать email-базу",
            "Договориться об инвестициях",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: { en: "Product-market fit happens when...", ru: "Product-Market Fit наступает, когда..." },
        options: {
          en: [
            "The product has a nice design",
            "The product truly solves a market problem and demand grows organically",
            "The startup raised its first funding round",
            "The product got a logo",
          ],
          ru: [
            "У продукта красивый дизайн",
            "Продукт по-настоящему решает проблему рынка, и спрос растёт органически",
            "Стартап привлёк первый раунд инвестиций",
            "У продукта появился логотип",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: { en: "A pivot is...", ru: "Пивот — это..." },
        options: {
          en: [
            "An annual report to investors",
            "A sharp change in a startup's direction or business model",
            "Hiring a new CTO",
            "A logo rebrand",
          ],
          ru: [
            "Ежегодный отчёт инвесторам",
            "Резкое изменение курса или бизнес-модели стартапа",
            "Найм нового CTO",
            "Ребрендинг логотипа",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 15,
        points: 800,
      },
      {
        prompt: { en: "TAM in market analysis stands for...", ru: "TAM в анализе рынка означает..." },
        options: {
          en: [
            "The total market size if the product captured 100% of demand",
            "The team responsible for marketing",
            "A technical audit of the product",
            "The target audience of one segment",
          ],
          ru: [
            "Общий объём рынка, если бы продукт занял 100% спроса",
            "Команду, ответственную за маркетинг",
            "Технический аудит продукта",
            "Целевую аудиторию одного сегмента",
          ],
        },
        correctIndex: 0,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: { en: "Traction is...", ru: "Traction (тракшн) — это..." },
        options: {
          en: [
            "The company's legal form",
            "Measurable proof of growth: sales, repeat purchases, growing demand",
            "An agreement with a co-founder",
            "The name of a funding round",
          ],
          ru: [
            "Юридическая форма компании",
            "Измеримое доказательство роста: продажи, повторные покупки, растущий спрос",
            "Договор с сооснователем",
            "Название раунда инвестиций",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 15,
        points: 800,
      },
    ],
  },
  {
    slug: "fundraising",
    title: { en: "Pitching and Investment", ru: "Питчинг и инвестиции" },
    emoji: "💼",
    description: {
      en: "Pitch deck, cap table, vesting, due diligence — the language of talking to investors.",
      ru: "Pitch Deck, Cap Table, вестинг, дью-дилидженс — язык переговоров с инвестором.",
    },
    questions: [
      {
        prompt: { en: "A pitch deck is...", ru: "Pitch Deck — это..." },
        options: {
          en: [
            "Annual financial statements",
            "A short project presentation for an investor",
            "A non-disclosure agreement",
            "A product development plan",
          ],
          ru: [
            "Финансовая отчётность за год",
            "Короткая презентация проекта для инвестора",
            "Договор о неразглашении",
            "План разработки продукта",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: { en: "Equity vesting exists so that...", ru: "Вестинг долей нужен, чтобы..." },
        options: {
          en: [
            "You hand over the whole stake to a co-founder right away",
            "Ownership rights are earned gradually over an agreed period",
            "The company's valuation goes up",
            "Accounting gets simpler",
          ],
          ru: [
            "Сразу отдать всю долю сооснователю",
            "Постепенно закреплять права на долю за оговорённый срок",
            "Увеличить оценку компании",
            "Упростить бухгалтерию",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: { en: "A cap table shows...", ru: "Cap Table показывает..." },
        options: {
          en: [
            "A month-by-month revenue chart",
            "Who owns how much of the company",
            "A plan for entering new markets",
            "A list of competitors",
          ],
          ru: [
            "График выручки по месяцам",
            "Кому и сколько принадлежит в компании",
            "План выхода на новые рынки",
            "Список конкурентов",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: { en: "Due diligence is...", ru: "Дью-дилидженс — это..." },
        options: {
          en: [
            "An investor's review of the company before the deal",
            "The startup's legal name",
            "The first meeting with a client",
            "A type of funding round",
          ],
          ru: [
            "Проверка компании инвестором перед сделкой",
            "Юридическое название стартапа",
            "Первая встреча с клиентом",
            "Тип раунда инвестиций",
          ],
        },
        correctIndex: 0,
        timeLimitSeconds: 15,
        points: 800,
      },
      {
        prompt: { en: "Equity dilution happens when...", ru: "Размытие доли (dilution) происходит, когда..." },
        options: {
          en: [
            "The company signs a deal with a client",
            "New investors come in and new shares are issued",
            "A founder fires an employee",
            "The company changes its legal address",
          ],
          ru: [
            "Компания заключает договор с клиентом",
            "В компанию заходят новые инвесторы и выпускаются новые доли",
            "Основатель увольняет сотрудника",
            "Компания меняет юридический адрес",
          ],
        },
        correctIndex: 1,
        timeLimitSeconds: 20,
        points: 1000,
      },
      {
        prompt: { en: "A term sheet is...", ru: "Term Sheet — это..." },
        options: {
          en: [
            "The final signed investment agreement",
            "A document with the deal's key terms before the final agreement",
            "A list of company employees",
            "An annual financial forecast",
          ],
          ru: [
            "Финальный подписанный договор инвестиций",
            "Документ с основными условиями сделки до финального договора",
            "Список сотрудников компании",
            "Годовой финансовый прогноз",
          ],
        },
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

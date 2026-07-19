import type { ChallengeCompletion } from "@/lib/game-progress/GameProgressContext";
import type { Locale } from "@/i18n/locale";
import { pick, type Localized } from "@/i18n/content";

export interface CourseQuizOption {
  text: Localized;
  isCorrect: boolean;
}

export interface CourseQuizQuestion {
  question: Localized;
  options: CourseQuizOption[];
}

export interface TheorySlide {
  emoji: string;
  title: Localized;
  body: Localized;
}

// Simulation configs are a discriminated union so the tree can grow new interactive
// formats (trade-off matrix, budget allocation, ...) without touching existing ones.
export interface PricingSimulationConfig {
  kind: "pricing";
  minPrice: number;
  maxPrice: number;
  defaultPrice: number;
  /** Variable cost to produce/deliver a single unit. */
  unitCost: number;
  /** Fixed monthly costs (rent, salaries, hosting...) that must be covered regardless of volume. */
  fixedCost: number;
  /** Units sold per period at the lowest possible price. */
  maxDemandUnits: number;
  /** Price at (or above) which demand collapses to zero — "too scary to buy". */
  demandFloorPrice: number;
  /** Price range where net profit is at (or near) its maximum. */
  sweetSpotMin: number;
  sweetSpotMax: number;
}

export type SimulationConfig = PricingSimulationConfig;

interface CourseLessonBase {
  id: string;
  moduleId: string;
  title: Localized;
  description: Localized;
  emoji: string;
  xpReward: number;
  /** Teacher-dashboard metadata — not rendered in the current UI, so left Russian-only. */
  learningObjectives: string[];
  estimatedDuration: number;
  deliverableName: string;
  /** Optional embedded explainer video for this lesson. */
  videoUrl?: string;
  slides: TheorySlide[];
}

export interface QuizLesson extends CourseLessonBase {
  type: "quiz";
  quiz: CourseQuizQuestion[];
}

export interface SimulationLesson extends CourseLessonBase {
  type: "simulation";
  simulation: SimulationConfig;
}

export type CourseLesson = QuizLesson | SimulationLesson;

export interface CourseModule {
  id: string;
  title: Localized;
  description: Localized;
  lessons: CourseLesson[];
}

export const COURSE_MODULES: CourseModule[] = [
  {
    id: "module-launch-from-zero",
    title: { en: "Launch From Zero", ru: "Запуск с нуля" },
    description: {
      en: "First steps: from an idea in your head to your first money in hand.",
      ru: "Первые шаги: от идеи в голове до первых денег в кармане.",
    },
    lessons: [
      {
        id: "course-niche-search",
        moduleId: "module-launch-from-zero",
        title: { en: "Finding a Niche", ru: "Поиск ниши" },
        description: {
          en: "Find a spot in the market where people are actually waiting for you.",
          ru: "Найди место на рынке, где тебя реально ждут.",
        },
        emoji: "🧭",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Определять узкую нишу с реальной болью",
          "Отличать нишу от абстрактной идеи",
        ],
        estimatedDuration: 15,
        deliverableName: "Профиль ниши на одну страницу",
        slides: [
          {
            emoji: "🎯",
            title: { en: "A Niche Isn't an Idea, It's a Gap", ru: "Ниша — это не идея, это дыра" },
            body: {
              en: "A niche is a narrow group of people with a specific pain point that nobody's properly solving right now. Don't try to please everyone — that's the fastest way to please no one.",
              ru: "Ниша — узкая группа людей с конкретной болью, которую сейчас никто нормально не закрывает. Не пытайся понравиться всем — это самый быстрый способ не понравиться никому.",
            },
          },
          {
            emoji: "🔍",
            title: { en: "Look Where People Are Already Paying", ru: "Ищи там, где уже платят" },
            body: {
              en: "The simplest signal of a good niche: people are already paying for a clunky, expensive, or inconvenient solution to their problem. Your job is to do the same thing, but better — not invent demand from scratch.",
              ru: "Самый простой сигнал хорошей ниши — люди уже платят за кривое, дорогое или неудобное решение своей проблемы. Твоя задача — сделать так же, но лучше, а не изобретать спрос с нуля.",
            },
          },
          {
            emoji: "🧩",
            title: { en: "Narrow + Specific = Strong", ru: "Уже + узко = сильно" },
            body: {
              en: "Example: not \"food delivery,\" but \"food delivery for people cutting weight who track their macros.\" The narrower the niche, the louder your voice is in it.",
              ru: "Пример: не «доставка еды», а «доставка еды для тех, кто на сушке и считает БЖУ». Чем уже ниша — тем громче в ней твой голос.",
            },
          },
        ],
        quiz: [
          {
            question: { en: "What makes a niche good?", ru: "Что делает нишу хорошей?" },
            options: [
              {
                text: {
                  en: "A narrow group of people with a specific, already-felt pain point",
                  ru: "Узкая группа людей с конкретной, уже ощутимой болью",
                },
                isCorrect: true,
              },
              {
                text: { en: "It's as broad as possible to reach everyone", ru: "Она максимально широкая, чтобы охватить всех" },
                isCorrect: false,
              },
              { text: { en: "Nobody needs it yet", ru: "Она никому пока не нужна" }, isCorrect: false },
            ],
          },
          {
            question: {
              en: "What signal tells you the market is real?",
              ru: "Какой сигнал говорит, что рынок реальный?",
            },
            options: [
              { text: { en: "Nobody has ever thought of it", ru: "Об этом никто никогда не думал" }, isCorrect: false },
              {
                text: {
                  en: "People are already paying for a bad solution to the problem",
                  ru: "Люди уже платят за плохое решение проблемы",
                },
                isCorrect: true,
              },
              { text: { en: "You have a nice logo", ru: "У тебя красивый логотип" }, isCorrect: false },
            ],
          },
          {
            question: {
              en: "Why is a narrow niche stronger than a broad one?",
              ru: "Почему узкая ниша сильнее широкой?",
            },
            options: [
              {
                text: { en: "Because advertising there is always free", ru: "Потому что реклама там всегда бесплатная" },
                isCorrect: false,
              },
              {
                text: { en: "Because there's no competition there at all", ru: "Потому что там вообще нет конкурентов" },
                isCorrect: false,
              },
              {
                text: {
                  en: "Because you're heard there and you solve a specific pain point",
                  ru: "Потому что в ней тебя слышно и ты решаешь конкретную боль",
                },
                isCorrect: true,
              },
            ],
          },
        ],
      },
      {
        id: "course-offer-formula",
        moduleId: "module-launch-from-zero",
        title: { en: "Crafting Your Offer", ru: "Формулировка оффера" },
        description: {
          en: "Put together an offer that hooks people in 5 seconds.",
          ru: "Собери предложение, которое цепляет за 5 секунд.",
        },
        emoji: "💥",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Формулировать оффер по формуле Результат + Срок + Без чего",
          "Убирать маркетинговую воду из текста",
        ],
        estimatedDuration: 15,
        deliverableName: "Оффер в одном предложении",
        slides: [
          {
            emoji: "⚡",
            title: { en: "An Offer = a Promise of a Result", ru: "Оффер = обещание результата" },
            body: {
              en: "People don't buy a product — they buy the result it delivers. Not \"an English course,\" but \"speak English in 30 days without rote memorization.\"",
              ru: "Люди не покупают продукт — они покупают результат, который он даёт. Не «курс по английскому», а «заговоришь на английском через 30 дней без зубрёжки».",
            },
          },
          {
            emoji: "🧠",
            title: { en: "A Formula That Works", ru: "Формула, которая работает" },
            body: {
              en: "Offer = Result + Timeframe + Without What (without the pain, effort, or risk). Put yours into one sentence and check if it hooks people in 5 seconds.",
              ru: "Оффер = Результат + Срок + Без чего (без боли, усилий или риска). Собери свой в одну фразу и проверь, цепляет ли она за 5 секунд.",
            },
          },
          {
            emoji: "🚫",
            title: { en: "Cut the Filler", ru: "Убери воду" },
            body: {
              en: "Words like \"innovative,\" \"unique,\" \"high-quality\" don't sell anything — they're just noise. Keep only the specifics: what the customer gets and when.",
              ru: "Слова вроде «инновационный», «уникальный», «качественный» ничего не продают — это шум. Оставь только конкретику: что получит клиент и когда.",
            },
          },
        ],
        quiz: [
          {
            question: { en: "What do people actually buy?", ru: "Что на самом деле покупают люди?" },
            options: [
              { text: { en: "Nice packaging", ru: "Красивую упаковку" }, isCorrect: false },
              {
                text: { en: "The result the product delivers", ru: "Результат, который даёт продукт" },
                isCorrect: true,
              },
              { text: { en: "The brand name", ru: "Название бренда" }, isCorrect: false },
            ],
          },
          {
            question: {
              en: "Which offer formula actually works?",
              ru: "Какая формула оффера рабочая?",
            },
            options: [
              { text: { en: "Price + Discount + Guarantee", ru: "Цена + Скидка + Гарантия" }, isCorrect: false },
              { text: { en: "Logo + Slogan + Color", ru: "Логотип + Слоган + Цвет" }, isCorrect: false },
              {
                text: { en: "Result + Timeframe + Without What", ru: "Результат + Срок + Без чего" },
                isCorrect: true,
              },
            ],
          },
          {
            question: { en: "What should you cut from an offer?", ru: "Что стоит убрать из оффера?" },
            options: [
              {
                text: {
                  en: "Generic words like \"unique\" and \"high-quality\"",
                  ru: "Общие слова вроде «уникальный» и «качественный»",
                },
                isCorrect: true,
              },
              {
                text: { en: "Specific numbers and deadlines", ru: "Конкретные цифры и сроки" },
                isCorrect: false,
              },
              {
                text: { en: "A description of the result for the customer", ru: "Описание результата для клиента" },
                isCorrect: false,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-pricing-value",
    title: { en: "The Price & Value Slider", ru: "Слайдер Цен и Ценность" },
    description: {
      en: "Feel firsthand how price decides: profit or bankruptcy.",
      ru: "Почувствуй на своей шкуре, как цена решает: прибыль или банкротство.",
    },
    lessons: [
      {
        id: "course-pricing-simulation",
        moduleId: "module-pricing-value",
        title: { en: "Price Simulator", ru: "Симулятор цены" },
        description: {
          en: "Move the slider and find the price with maximum profit.",
          ru: "Двигай слайдер и найди цену с максимальной прибылью.",
        },
        emoji: "💰",
        xpReward: 100,
        type: "simulation",
        learningObjectives: [
          "Находить цену с максимальной прибылью, а не просто повыше себестоимости",
          "Понимать связь цены, спроса и издержек",
          "Отличать ценообразование по себестоимости от ценообразования по ценности",
        ],
        estimatedDuration: 20,
        deliverableName: "Обоснованная цена продукта с расчётом прибыли",
        slides: [
          {
            emoji: "💰",
            title: { en: "Price Isn't Just Costs Plus a Markup", ru: "Цена — это не расходы + процент" },
            body: {
              en: "Many people set a price by eyeballing it: add up costs, tack on 20%, and sell. But the right price isn't tied to your costs — it's tied to how much the customer is willing to pay for the value they get.",
              ru: "Многие ставят цену «на глаз»: посчитали расходы, накинули 20% и продают. Но правильная цена завязана не на твоих затратах, а на том, сколько клиент готов заплатить за ценность, которую он получает.",
            },
          },
          {
            emoji: "📉",
            title: {
              en: "The Higher the Price, the Fewer the Buyers",
              ru: "Чем выше цена — тем меньше покупателей",
            },
            body: {
              en: "This isn't theory, it's the harsh reality of demand: raise the price and some customers will go to a competitor or skip the purchase entirely. Your job is to find the price where profit is maximized, not the price that just \"feels nice.\"",
              ru: "Это не теория, а суровая реальность спроса: подними цену — часть клиентов уйдёт к конкуренту или откажется от покупки вообще. Твоя задача — найти цену, где прибыль максимальна, а не там, где цена просто «красивая».",
            },
          },
          {
            emoji: "🎯",
            title: { en: "Now Test It With Real Numbers", ru: "Сейчас проверишь это на цифрах" },
            body: {
              en: "Below is a mini-simulator of your product. Move the price slider and watch demand, costs, and final profit change. Find the price where profit is maximized, and click \"Test hypothesis.\"",
              ru: "Ниже — мини-симулятор твоего продукта. Двигай слайдер цены и смотри, как меняются спрос, расходы и итоговая прибыль. Найди цену, при которой прибыль максимальна, и нажми «Тестировать гипотезу».",
            },
          },
        ],
        simulation: {
          kind: "pricing",
          minPrice: 10,
          maxPrice: 100,
          defaultPrice: 10,
          unitCost: 25,
          fixedCost: 200,
          maxDemandUnits: 50,
          demandFloorPrice: 90,
          sweetSpotMin: 50,
          sweetSpotMax: 65,
        },
      },
    ],
  },
  {
    id: "module-unit-economics",
    title: { en: "Unit Economics", ru: "Юнит-Экономика" },
    description: {
      en: "Understanding the numbers that decide whether a business survives.",
      ru: "Разбираемся в цифрах, которые решают, выживет бизнес или нет.",
    },
    lessons: [
      {
        id: "course-cac-ltv",
        moduleId: "module-unit-economics",
        title: { en: "Calculating CAC and LTV", ru: "Считаем CAC и LTV" },
        description: {
          en: "Find out how much a customer costs and how much they bring in.",
          ru: "Узнай, сколько стоит клиент и сколько он приносит.",
        },
        emoji: "🧮",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Считать стоимость привлечения клиента (CAC)",
          "Считать пожизненную ценность клиента (LTV)",
          "Оценивать здоровое соотношение LTV к CAC",
        ],
        estimatedDuration: 20,
        deliverableName: "Расчёт CAC и LTV для своего продукта",
        slides: [
          {
            emoji: "💸",
            title: { en: "CAC — the Price of One Customer", ru: "CAC — цена одного клиента" },
            body: {
              en: "CAC (Customer Acquisition Cost) is how much money you spend on ads and marketing to get one paying customer.",
              ru: "CAC (Customer Acquisition Cost) — сколько денег ты тратишь на рекламу и маркетинг, чтобы получить одного платящего клиента.",
            },
          },
          {
            emoji: "♻️",
            title: {
              en: "LTV — How Much a Customer Brings in Total",
              ru: "LTV — сколько клиент принесёт всего",
            },
            body: {
              en: "LTV (Lifetime Value) is how much money a customer brings you over their whole time with you, not just their first purchase.",
              ru: "LTV (Lifetime Value) — сколько денег клиент принесёт тебе за всё время, пока он с тобой, а не за одну первую покупку.",
            },
          },
          {
            emoji: "⚖️",
            title: { en: "The Golden Rule of Unit Economics", ru: "Главное правило юнит-экономики" },
            body: {
              en: "If LTV is less than CAC, you're paying to lose money on every customer. A healthy ratio is LTV at least 3 times CAC.",
              ru: "Если LTV меньше CAC — ты платишь за то, чтобы терять деньги на каждом клиенте. Здоровое соотношение — LTV минимум в 3 раза больше CAC.",
            },
          },
        ],
        quiz: [
          {
            question: { en: "What is CAC?", ru: "Что такое CAC?" },
            options: [
              { text: { en: "The company's total profit", ru: "Общая прибыль компании" }, isCorrect: false },
              {
                text: { en: "The name of a marketing strategy", ru: "Название маркетинговой стратегии" },
                isCorrect: false,
              },
              {
                text: { en: "The cost of acquiring one customer", ru: "Стоимость привлечения одного клиента" },
                isCorrect: true,
              },
            ],
          },
          {
            question: { en: "What does LTV show?", ru: "Что показывает LTV?" },
            options: [
              {
                text: {
                  en: "How much money a customer brings in over their whole time with the product",
                  ru: "Сколько денег клиент принесёт за всё время, пока остаётся с продуктом",
                },
                isCorrect: true,
              },
              {
                text: { en: "How much one ad click costs", ru: "Сколько стоит один клик по рекламе" },
                isCorrect: false,
              },
              {
                text: { en: "How many employees you need to hire", ru: "Сколько сотрудников нужно нанять" },
                isCorrect: false,
              },
            ],
          },
          {
            question: {
              en: "What LTV-to-CAC ratio is considered healthy?",
              ru: "Какое соотношение LTV к CAC считается здоровым?",
            },
            options: [
              { text: { en: "LTV should equal CAC", ru: "LTV должен быть равен CAC" }, isCorrect: false },
              {
                text: { en: "LTV should be at least 3 times CAC", ru: "LTV минимум в 3 раза больше CAC" },
                isCorrect: true,
              },
              { text: { en: "CAC should be greater than LTV", ru: "CAC должен быть больше LTV" }, isCorrect: false },
            ],
          },
        ],
      },
      {
        id: "course-breakeven",
        moduleId: "module-unit-economics",
        title: { en: "The Break-Even Point", ru: "Точка безубыточности" },
        description: {
          en: "Understand how much you need to sell to break even.",
          ru: "Пойми, сколько нужно продать, чтобы выйти в ноль.",
        },
        emoji: "⚖️",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Различать постоянные и переменные расходы",
          "Считать точку безубыточности в продажах",
          "Понимать, когда бизнес выходит в плюс",
        ],
        estimatedDuration: 20,
        deliverableName: "Расчёт точки безубыточности для своего продукта",
        slides: [
          {
            emoji: "🎯",
            title: { en: "The Break-Even Point Is Zero", ru: "Точка безубыточности — это ноль" },
            body: {
              en: "This is the moment revenue finally equals costs — you're not making money yet, but you're not losing it either.",
              ru: "Это момент, когда доходы наконец сравнялись с расходами — ты ещё не зарабатываешь, но уже не теряешь деньги.",
            },
          },
          {
            emoji: "🧱",
            title: {
              en: "Fixed and Variable Costs Are Different Things",
              ru: "Постоянные и переменные расходы — это разное",
            },
            body: {
              en: "Fixed costs (rent, salaries) don't change with the number of sales. Variable costs (materials, packaging) grow with every sale. The break-even point is calculated from fixed costs and the margin per sale.",
              ru: "Постоянные расходы (аренда, зарплата) не меняются от количества продаж. Переменные (сырьё, упаковка) растут с каждой продажей. Точку безубыточности считают именно от постоянных расходов и маржи с продажи.",
            },
          },
          {
            emoji: "📐",
            title: { en: "How to Calculate It Simply", ru: "Как её посчитать просто" },
            body: {
              en: "Divide your fixed costs by the margin on one sale — that gives you how many sales you need to break even.",
              ru: "Раздели постоянные расходы на маржу с одной продажи — получишь, сколько продаж нужно сделать, чтобы выйти в ноль.",
            },
          },
          {
            emoji: "🚀",
            title: { en: "After That Point, It's All Profit", ru: "После точки — только прибыль" },
            body: {
              en: "Every sale after the break-even point is pure profit, because all the fixed costs are already covered by previous sales.",
              ru: "Каждая продажа после точки безубыточности — это уже чистая прибыль, потому что все постоянные расходы уже покрыты предыдущими продажами.",
            },
          },
        ],
        quiz: [
          {
            question: {
              en: "What does the break-even point mean?",
              ru: "Что означает точка безубыточности?",
            },
            options: [
              {
                text: { en: "Revenue equals costs, there's no profit yet", ru: "Доходы сравнялись с расходами, прибыли ещё нет" },
                isCorrect: true,
              },
              {
                text: { en: "The business is already making steady profit", ru: "Бизнес уже приносит стабильную прибыль" },
                isCorrect: false,
              },
              { text: { en: "The business went bankrupt", ru: "Бизнес обанкротился" }, isCorrect: false },
            ],
          },
          {
            question: {
              en: "How do you calculate the break-even point in sales?",
              ru: "Как посчитать точку безубыточности в продажах?",
            },
            options: [
              {
                text: { en: "Multiply the price by the number of customers", ru: "Умножить цену на количество клиентов" },
                isCorrect: false,
              },
              {
                text: {
                  en: "Divide fixed costs by the margin on one sale",
                  ru: "Постоянные расходы разделить на маржу с одной продажи",
                },
                isCorrect: true,
              },
              { text: { en: "Add up all costs and revenue", ru: "Сложить все расходы и доходы" }, isCorrect: false },
            ],
          },
          {
            question: {
              en: "What happens to sales after the break-even point?",
              ru: "Что происходит с продажами после точки безубыточности?",
            },
            options: [
              { text: { en: "They're still covering losses", ru: "Они всё ещё покрывают убытки" }, isCorrect: false },
              {
                text: { en: "They don't change anything for the business", ru: "Они ничего не меняют в бизнесе" },
                isCorrect: false,
              },
              { text: { en: "They become pure profit", ru: "Они становятся чистой прибылью" }, isCorrect: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-custdev-interviews",
    title: { en: "Customer Discovery and Interviews", ru: "Кастдев и Интервью" },
    description: {
      en: "Learn to hear the truth, not a polite 'sounds interesting.'",
      ru: "Научись слышать правду, а не вежливое «звучит интересно».",
    },
    lessons: [
      {
        id: "course-custdev-interview",
        moduleId: "module-custdev-interviews",
        title: { en: "Customer Discovery Without Illusions", ru: "Кастдев без иллюзий" },
        description: {
          en: "Tell a customer's real interest apart from a polite lie.",
          ru: "Отличи настоящий интерес клиента от вежливой лжи.",
        },
        emoji: "🎙️",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Отличать настоящую валидацию от вежливой лжи",
          "Задавать вопросы про прошлый опыт, а не про гипотетическое будущее",
        ],
        estimatedDuration: 20,
        deliverableName: "Список из 5 вопросов для кастдев-интервью",
        slides: [
          {
            emoji: "🎙️",
            title: {
              en: "Customer Discovery Isn't a Pitch, It's an Intense Interrogation",
              ru: "Кастдев — это не питч, это допрос с пристрастием",
            },
            body: {
              en: "The interview's goal isn't to talk about your idea — it's to pull out the person's real experience, pain points, and the money they already spend on similar problems. Talk less, listen more.",
              ru: "Цель интервью — не рассказать о своей идее, а вытащить из человека его реальный опыт, боли и деньги, которые он уже тратит на похожие проблемы. Говори меньше, слушай больше.",
            },
          },
          {
            emoji: "🎭",
            title: { en: "False Validation Is Your Biggest Enemy", ru: "Ложная валидация — твой главный враг" },
            body: {
              en: "\"Sounds cool, I'd definitely buy that\" is the most dangerous phrase in customer discovery. People politely praise ideas they'll never buy. Trust past actions, not words: what has this person already tried doing about this problem?",
              ru: "«Звучит круто, я бы точно купил» — самая опасная фраза в кастдеве. Люди из вежливости хвалят идеи, которые никогда не купят. Верь не словам, а прошлым действиям: что человек уже пробовал делать с этой проблемой?",
            },
          },
          {
            emoji: "🔬",
            title: { en: "Ask About the Past, Not the Future", ru: "Спрашивай про прошлое, а не про будущее" },
            body: {
              en: "The question \"would you buy this?\" is almost useless — people are bad at predicting their own future behavior. The question \"how do you solve this problem right now, and how much do you spend on it?\" gives you real data.",
              ru: "Вопрос «купил бы ты это?» почти бесполезен — люди плохо предсказывают своё будущее поведение. Вопрос «как ты решаешь эту проблему сейчас и сколько на это тратишь?» даёт настоящие данные.",
            },
          },
        ],
        quiz: [
          {
            question: {
              en: "Which customer phrase is a classic sign of false validation?",
              ru: "Какая фраза клиента — классический признак ложной валидации?",
            },
            options: [
              {
                text: {
                  en: "\"I already pay a competitor $10 a month for this\"",
                  ru: "«Я плачу за это конкуренту 500 рублей в месяц»",
                },
                isCorrect: false,
              },
              {
                text: { en: "\"Sounds cool, I'd definitely buy that\"", ru: "«Звучит круто, я бы точно купил»" },
                isCorrect: true,
              },
              {
                text: {
                  en: "\"I tried solving it myself and gave up after a week\"",
                  ru: "«Я пробовал решить это сам и бросил через неделю»",
                },
                isCorrect: false,
              },
            ],
          },
          {
            question: {
              en: "Which question gives you more real data in an interview?",
              ru: "Какой вопрос даёт больше реальных данных в интервью?",
            },
            options: [
              { text: { en: "Would you buy my product?", ru: "Купил бы ты мой продукт?" }, isCorrect: false },
              { text: { en: "Do you like my idea?", ru: "Нравится ли тебе моя идея?" }, isCorrect: false },
              {
                text: { en: "How do you solve this problem right now?", ru: "Как ты решаешь эту проблему сейчас?" },
                isCorrect: true,
              },
            ],
          },
          {
            question: {
              en: "What should the interviewer be doing most of the time?",
              ru: "Что должен делать интервьюер большую часть времени?",
            },
            options: [
              { text: { en: "Listening", ru: "Слушать" }, isCorrect: true },
              { text: { en: "Presenting their idea", ru: "Презентовать свою идею" }, isCorrect: false },
              { text: { en: "Arguing with objections", ru: "Спорить с возражениями" }, isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-micro-marketing",
    title: { en: "Micro-Marketing & Traffic", ru: "Микро-Маркетинг & Трафик" },
    description: {
      en: "Your first customers don't fall from the sky — specific channels and numbers bring them in.",
      ru: "Первые клиенты не падают с неба — их приводят конкретные каналы и цифры.",
    },
    lessons: [
      {
        id: "course-micro-marketing",
        moduleId: "module-micro-marketing",
        title: { en: "Channels, CTR, and Conversion", ru: "Каналы, CTR и конверсия" },
        description: {
          en: "Understand exactly where your traffic leaks away and where it turns into money.",
          ru: "Пойми, куда именно утекает и где превращается в деньги твой трафик.",
        },
        emoji: "📡",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Выбирать конкретный канал привлечения клиентов",
          "Понимать разницу между CTR и конверсией",
          "Приоритизировать конверсию над объёмом трафика",
        ],
        estimatedDuration: 20,
        deliverableName: "План теста одного канала привлечения клиентов",
        slides: [
          {
            emoji: "📡",
            title: {
              en: "A Traffic Channel Isn't Just \"Advertising in General\"",
              ru: "Канал трафика — это не «реклама вообще»",
            },
            body: {
              en: "\"I'll run some ads\" doesn't mean anything. Instagram Reels, search ads, influencer partnerships, cold emails — every channel has its own customer cost and its own audience.",
              ru: "«Запущу рекламу» ничего не значит. Instagram Reels, поисковая реклама, партнёрства с блогерами, холодные письма — у каждого канала своя цена клиента и своя аудитория.",
            },
          },
          {
            emoji: "👆",
            title: { en: "CTR Is the Honesty of Your Ad", ru: "CTR — это честность твоего объявления" },
            body: {
              en: "CTR (click-through rate) shows what percentage of people who saw the ad clicked on it. A low CTR almost always means: wrong offer, wrong image, or wrong audience.",
              ru: "CTR (click-through rate) показывает, какой процент увидевших рекламу кликнул по ней. Низкий CTR почти всегда означает: не тот оффер, не та картинка или не та аудитория.",
            },
          },
          {
            emoji: "🔁",
            title: { en: "Conversion Matters More Than Traffic", ru: "Конверсия решает больше, чем трафик" },
            body: {
              en: "Bringing in 1,000 people at a 0.5% conversion rate is worse than bringing in 100 people at 10%. Before you pour in traffic, make sure your landing page can actually turn interest into a payment.",
              ru: "Привести 1000 человек с конверсией 0.5% хуже, чем привести 100 человек с конверсией 10%. Прежде чем лить трафик, убедись, что твоя посадочная страница вообще способна превращать интерес в оплату.",
            },
          },
        ],
        quiz: [
          {
            question: { en: "What does CTR show?", ru: "Что показывает CTR?" },
            options: [
              { text: { en: "Total profit from the ad", ru: "Общую прибыль от рекламы" }, isCorrect: false },
              { text: { en: "The number of ad impressions", ru: "Количество показов объявления" }, isCorrect: false },
              {
                text: {
                  en: "The share of people who saw the ad and clicked on it",
                  ru: "Долю увидевших рекламу, которые кликнули по ней",
                },
                isCorrect: true,
              },
            ],
          },
          {
            question: {
              en: "What's more important to grow first?",
              ru: "Что важнее нарастить в первую очередь?",
            },
            options: [
              {
                text: {
                  en: "Landing page conversion, not just traffic volume",
                  ru: "Конверсию посадочной страницы, а не просто объём трафика",
                },
                isCorrect: true,
              },
              { text: { en: "Impressions, at any cost", ru: "Любой ценой количество показов" }, isCorrect: false },
              {
                text: { en: "Social media follower count", ru: "Число подписчиков в соцсетях" },
                isCorrect: false,
              },
            ],
          },
          {
            question: {
              en: "Why is \"I'll run some ads\" a bad plan?",
              ru: "Почему «запущу рекламу» — плохой план?",
            },
            options: [
              {
                text: { en: "Because ads always work the same way", ru: "Потому что реклама всегда работает одинаково" },
                isCorrect: false,
              },
              {
                text: {
                  en: "Because no specific channel or audience is named",
                  ru: "Потому что не назван конкретный канал и аудитория",
                },
                isCorrect: true,
              },
              {
                text: { en: "Because ads are banned for new companies", ru: "Потому что реклама запрещена для новых компаний" },
                isCorrect: false,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-nocode-mvp",
    title: { en: "No-Code MVP", ru: "MVP без кода" },
    description: {
      en: "Test demand in one evening with zero budget.",
      ru: "Проверь спрос за один вечер и ноль рублей бюджета.",
    },
    lessons: [
      {
        id: "course-nocode-mvp",
        moduleId: "module-nocode-mvp",
        title: { en: "Testing Demand Without Development", ru: "Тестируем спрос без разработки" },
        description: {
          en: "Build an MVP from no-code tools and test your idea with money, not likes.",
          ru: "Собери MVP из конструкторов и проверь идею деньгами, а не лайками.",
        },
        emoji: "🧪",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Выбирать инструменты для MVP без программирования",
          "Проверять спрос деньгами, а не лайками",
        ],
        estimatedDuration: 20,
        deliverableName: "Работающий MVP-лендинг или форма для сбора заявок",
        slides: [
          {
            emoji: "🧪",
            title: { en: "An MVP Is an Experiment, Not a Product", ru: "MVP — это эксперимент, а не продукт" },
            body: {
              en: "An MVP's job isn't to impress — it's to quickly and cheaply test whether people are willing to pay for a solution to this problem. A Google Form, a no-code landing page, or a chat in a messaging app often work better than months of development.",
              ru: "Задача MVP не впечатлить, а быстро и дёшево проверить: готовы ли люди платить за решение этой проблемы. Google-форма, лендинг на конструкторе или чат в мессенджере часто справляются лучше, чем месяцы разработки.",
            },
          },
          {
            emoji: "🛠️",
            title: {
              en: "Tools That Replace a Developer",
              ru: "Инструменты, которые заменяют разработчика",
            },
            body: {
              en: "Landing page builders and Notion for a page, Google Forms for collecting leads, chatbot builders for a simple service — all of this lets you test an idea with zero lines of code.",
              ru: "Tilda и Notion для лендинга, Google Forms для сбора заявок, конструкторы Telegram-ботов для простого сервиса — всё это позволяет протестировать идею без единой строчки кода.",
            },
          },
          {
            emoji: "💳",
            title: { en: "Test With Money, Not Likes", ru: "Проверяй деньгами, а не лайками" },
            body: {
              en: "Likes and \"interesting, tell me more\" are worth nothing. A real demand test is a pre-order, a deposit, or a waitlist signup with a real card. Money doesn't lie.",
              ru: "Лайки и «интересно, расскажи ещё» ничего не стоят. Настоящая проверка спроса — это предзаказ, депозит или подписка на лист ожидания с реальной картой. Деньги не врут.",
            },
          },
        ],
        quiz: [
          {
            question: {
              en: "Which demand test is the most reliable?",
              ru: "Какая проверка спроса самая надёжная?",
            },
            options: [
              {
                text: { en: "An actual payment or pre-order", ru: "Реальная оплата или предзаказ" },
                isCorrect: true,
              },
              { text: { en: "The number of likes on a post", ru: "Количество лайков под постом" }, isCorrect: false },
              {
                text: { en: "Comments saying \"sounds interesting\"", ru: "Комментарии «звучит интересно»" },
                isCorrect: false,
              },
            ],
          },
          {
            question: { en: "Why do you need a no-code MVP?", ru: "Зачем нужен MVP без кода?" },
            options: [
              { text: { en: "To replace the final product forever", ru: "Заменить финальный продукт навсегда" }, isCorrect: false },
              {
                text: {
                  en: "To test demand fast and without a development budget",
                  ru: "Проверить спрос быстро и без бюджета на разработку",
                },
                isCorrect: true,
              },
              {
                text: { en: "To impress investors with design", ru: "Произвести впечатление на инвесторов дизайном" },
                isCorrect: false,
              },
            ],
          },
          {
            question: {
              en: "Which tool fits a no-code MVP?",
              ru: "Какой инструмент подходит для MVP без кода?",
            },
            options: [
              {
                text: { en: "Writing your own backend from scratch", ru: "Написание собственного бэкенда с нуля" },
                isCorrect: false,
              },
              { text: { en: "Hiring a team of 5 developers", ru: "Найм команды из 5 разработчиков" }, isCorrect: false },
              {
                text: {
                  en: "A landing page builder like Tilda or Carrd",
                  ru: "Конструктор лендингов вроде Tilda",
                },
                isCorrect: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-first-sales-scripts",
    title: { en: "First Sales & Scripts", ru: "Первые Продажи & Скрипты" },
    description: {
      en: "From the first 'no' to the first 'yes' — with a script ready to go.",
      ru: "От первого «нет» до первого «да» — с готовым скриптом в кармане.",
    },
    lessons: [
      {
        id: "course-first-sales",
        moduleId: "module-first-sales-scripts",
        title: { en: "Your First Sales", ru: "Первые продажи" },
        description: {
          en: "Get to your first 'yes' from a real customer.",
          ru: "Доберись до первого «да» от реального клиента.",
        },
        emoji: "🤝",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Проводить первые продажи вручную, без бюджета на маркетинг",
          "Различать подход к продажам в B2C и B2B",
          "Использовать отказы как обратную связь для доработки оффера",
        ],
        estimatedDuration: 20,
        deliverableName: "Скрипт первого продающего разговора",
        slides: [
          {
            emoji: "🥶",
            title: { en: "Your First Sale Isn't About the Money", ru: "Первая продажа — это не про деньги" },
            body: {
              en: "Your first sale proves your idea isn't just liked in theory — it's needed enough that someone will pay for it. It's your first real signal from the market.",
              ru: "Первая продажа доказывает, что твоя идея не просто нравится в теории, а реально нужна настолько, что за неё готовы платить. Это твой первый настоящий сигнал от рынка.",
            },
          },
          {
            emoji: "📞",
            title: { en: "Sell With Your Own Hands, Not Ads", ru: "Продавай руками, не рекламой" },
            body: {
              en: "At the start you don't need a marketing budget — you need personal messages, calls, and a dozen awkward conversations. Your first 10 customers almost always come by hand, not by algorithm.",
              ru: "На старте не нужен маркетинг-бюджет — нужны личные сообщения, звонки и десяток неловких разговоров. Первые 10 клиентов почти всегда приходят руками, а не алгоритмами.",
            },
          },
          {
            emoji: "🔁",
            title: { en: "A No Is Data, Not a Verdict", ru: "Отказ — это данные, а не приговор" },
            body: {
              en: "Every \"no\" tells you what to fix in your offer, price, or delivery. Treat rejections as free feedback from the market, not defeat.",
              ru: "Каждое «нет» говорит тебе, что поправить в оффере, цене или подаче. Считай отказы не поражением, а бесплатной обратной связью от рынка.",
            },
          },
          {
            emoji: "⚔️",
            title: { en: "B2C and B2B Sell Differently", ru: "B2C и B2B продаются по-разному" },
            body: {
              en: "In B2C you convince one person here and now — with emotion and simplicity. In B2B several people decide, and not right away — there, numbers, trust, and de-risking the purchase for the approver matter.",
              ru: "В B2C ты убеждаешь одного человека здесь и сейчас — эмоцией и простотой. В B2B решение принимает несколько людей и не сразу — там важны цифры, доверие и снятие рисков для того, кто одобряет покупку.",
            },
          },
        ],
        quiz: [
          {
            question: { en: "Why does your first sale matter?", ru: "Зачем нужна первая продажа?" },
            options: [
              { text: { en: "To pay back the ad budget", ru: "Чтобы окупить рекламный бюджет" }, isCorrect: false },
              {
                text: {
                  en: "To confirm people are actually willing to pay for the product",
                  ru: "Подтвердить, что за продукт реально готовы платить",
                },
                isCorrect: true,
              },
              {
                text: {
                  en: "To have something to show investors for appearances",
                  ru: "Чтобы было что показать инвесторам для вида",
                },
                isCorrect: false,
              },
            ],
          },
          {
            question: {
              en: "How do your first customers usually show up?",
              ru: "Как обычно приходят первые клиенты?",
            },
            options: [
              { text: { en: "Only through targeted ads", ru: "Только через таргетированную рекламу" }, isCorrect: false },
              {
                text: { en: "They find you on their own by chance", ru: "Сами находят тебя случайно" },
                isCorrect: false,
              },
              {
                text: { en: "Through personal messages and conversations", ru: "Через личные сообщения и разговоры" },
                isCorrect: true,
              },
            ],
          },
          {
            question: {
              en: "What's the right attitude toward rejections early on?",
              ru: "Как правильно относиться к отказам на старте?",
            },
            options: [
              {
                text: {
                  en: "As feedback that helps improve the offer",
                  ru: "Как к обратной связи, которая помогает улучшить оффер",
                },
                isCorrect: true,
              },
              { text: { en: "As a sign to quit everything", ru: "Как к знаку, что нужно всё бросить" }, isCorrect: false },
              { text: { en: "As a personal insult", ru: "Как к личному оскорблению" }, isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-team-delegation",
    title: { en: "Team & Delegation", ru: "Команда & Делегирование" },
    description: {
      en: "Recruit the first people who believe in the idea before they believe in the money.",
      ru: "Собери первых людей, которые поверят в идею раньше, чем в деньги.",
    },
    lessons: [
      {
        id: "course-team-hiring",
        moduleId: "module-team-delegation",
        title: { en: "Your First Hire", ru: "Первый найм" },
        description: {
          en: "Figure out who to hire first and how to negotiate equity.",
          ru: "Разберись, кого нанимать первым и как договариваться о доле.",
        },
        emoji: "🤝",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Оценивать компромисс между долей и зарплатой при найме",
          "Формулировать чёткую роль для первых сотрудников",
        ],
        estimatedDuration: 20,
        deliverableName: "Описание роли и условий для первого найма",
        slides: [
          {
            emoji: "🤝",
            title: {
              en: "Your First Hire Is a Co-Founder in Spirit, Not Just an Employee",
              ru: "Первый найм — это не сотрудник, а со-основатель по духу",
            },
            body: {
              en: "At the earliest stage, salary isn't the main argument — people come for the mission, the role, and the chance to grow with the project. Look for people who care about the outcome, not just the paycheck.",
              ru: "На самой ранней стадии зарплата не главный аргумент — люди приходят за миссией, ролью и шансом вырасти вместе с проектом. Ищи тех, кому важен результат, а не только оклад.",
            },
          },
          {
            emoji: "⚖️",
            title: { en: "Equity or Salary — Choose Deliberately", ru: "Доля или зарплата — выбирай осознанно" },
            body: {
              en: "Company equity motivates more in the long run, but it doesn't pay the bills right now. Salary is the opposite. Early teams are often offered a combination: less money now, plus a small equity stake for the risk.",
              ru: "Доля в компании мотивирует сильнее в долгую, но не кормит здесь и сейчас. Зарплата — наоборот. Ранним командам часто предлагают комбинацию: меньше денег сейчас, плюс небольшая доля за риск.",
            },
          },
          {
            emoji: "📋",
            title: { en: "Role Matters More Than Title", ru: "Роль важнее должности" },
            body: {
              en: "There's no time for vague responsibilities at the start. Spell out clearly: exactly what the person is responsible for, how their success is measured, and what happens if something doesn't work out.",
              ru: "На старте нет времени на расплывчатые обязанности. Чётко проговори: за что именно отвечает человек, как измеряется его успех и что произойдёт, если что-то не сработает.",
            },
          },
        ],
        quiz: [
          {
            question: {
              en: "What most often convinces early employees to join without much money?",
              ru: "Что чаще всего убеждает первых сотрудников присоединиться без больших денег?",
            },
            options: [
              {
                text: { en: "A promise of a high future salary", ru: "Обещание будущей высокой зарплаты" },
                isCorrect: false,
              },
              { text: { en: "A nice office", ru: "Красивый офис" }, isCorrect: false },
              {
                text: { en: "A mission and a role they can grow into", ru: "Миссия и роль, в которой можно вырасти" },
                isCorrect: true,
              },
            ],
          },
          {
            question: {
              en: "What's the difference between equity and salary?",
              ru: "В чём разница между долей и зарплатой?",
            },
            options: [
              {
                text: {
                  en: "Equity motivates long-term, salary covers current needs",
                  ru: "Доля мотивирует в долгую, зарплата закрывает текущие нужды",
                },
                isCorrect: true,
              },
              { text: { en: "They're the same thing", ru: "Это одно и то же" }, isCorrect: false },
              {
                text: {
                  en: "Equity is always better than salary in any situation",
                  ru: "Доля всегда лучше зарплаты в любой ситуации",
                },
                isCorrect: false,
              },
            ],
          },
          {
            question: {
              en: "What's important to clearly define with a first hire?",
              ru: "Что важно чётко определить при первом найме?",
            },
            options: [
              { text: { en: "Only the size of a future bonus", ru: "Только размер будущей премии" }, isCorrect: false },
              {
                text: {
                  en: "A specific role and how success is measured",
                  ru: "Конкретную роль и то, как измеряется успех",
                },
                isCorrect: true,
              },
              {
                text: { en: "The design of the employee's business card", ru: "Дизайн визитки сотрудника" },
                isCorrect: false,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-finance-pnl",
    title: { en: "Finance and P&L", ru: "Финансы и P&L" },
    description: {
      en: "Track your money so you're not the last to know about bankruptcy.",
      ru: "Следи за деньгами так, чтобы не узнать о банкротстве последним.",
    },
    lessons: [
      {
        id: "course-cashflow-runway",
        moduleId: "module-finance-pnl",
        title: { en: "Cash Flow and Runway", ru: "Cashflow и runway" },
        description: {
          en: "Understand the difference between profit on paper and money in the account.",
          ru: "Пойми разницу между прибылью на бумаге и деньгами на счету.",
        },
        emoji: "💧",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Различать прибыль по отчётам и реальное движение денег",
          "Считать runway и планировать финансовый запас",
        ],
        estimatedDuration: 20,
        deliverableName: "Таблица движения денег (cashflow) на 3 месяца вперёд",
        slides: [
          {
            emoji: "💧",
            title: { en: "Profit on Paper Isn't Money in the Bank", ru: "Прибыль на бумаге — не деньги на счету" },
            body: {
              en: "You can be \"profitable\" on paper and still go bankrupt from a cash gap: customers pay late, but salaries and rent are due now. Cash flow is about the real movement of money, not pretty numbers in a spreadsheet.",
              ru: "Можно быть «прибыльным» по отчётам и обанкротиться из-за кассового разрыва: клиенты платят с задержкой, а зарплаты и аренду нужно платить сейчас. Cashflow — это про реальное движение денег, а не про красивые цифры в таблице.",
            },
          },
          {
            emoji: "⏳",
            title: { en: "Runway Is Your Buffer of Time", ru: "Runway — это твой запас времени" },
            body: {
              en: "Runway shows how many months the business can survive on current money at current spending if revenue suddenly stopped. The shorter the runway, the faster you need to either earn or raise money.",
              ru: "Runway показывает, сколько месяцев бизнес проживёт на текущие деньги при текущих тратах, если доходы вдруг остановятся. Чем короче runway, тем быстрее нужно либо зарабатывать, либо привлекать деньги.",
            },
          },
          {
            emoji: "🚨",
            title: {
              en: "Running Out of Money Kills You, Not Losses",
              ru: "Банкротят не убытки, а кончившиеся деньги",
            },
            body: {
              en: "A company can operate at a loss for years if it has money in the bank. Conversely, a business that's profitable on paper shuts down if it physically has no money to pay its bills on time.",
              ru: "Компания может годами работать в минус, если у неё есть деньги на счету. И наоборот — прибыльный на бумаге бизнес закрывается, если у него физически нет денег заплатить по счетам вовремя.",
            },
          },
        ],
        quiz: [
          {
            question: {
              en: "Why might paper profit not save you from bankruptcy?",
              ru: "Почему прибыль на бумаге может не спасти от банкротства?",
            },
            options: [
              {
                text: {
                  en: "Because money from customers can arrive late, while bills are due now",
                  ru: "Потому что деньги от клиентов могут приходить с задержкой, а платить нужно сейчас",
                },
                isCorrect: true,
              },
              { text: { en: "Because profit is never real", ru: "Потому что прибыль никогда не бывает реальной" }, isCorrect: false },
              {
                text: { en: "Because taxes cancel out all the profit", ru: "Потому что налоги отменяют всю прибыль" },
                isCorrect: false,
              },
            ],
          },
          {
            question: { en: "What is runway?", ru: "Что такое runway?" },
            options: [
              { text: { en: "The company's total annual revenue", ru: "Общая выручка компании за год" }, isCorrect: false },
              {
                text: {
                  en: "How many months the business survives on current money with no new income",
                  ru: "Сколько месяцев бизнес проживёт на текущие деньги без новых поступлений",
                },
                isCorrect: true,
              },
              { text: { en: "The rate of customer growth", ru: "Скорость роста числа клиентов" }, isCorrect: false },
            ],
          },
          {
            question: {
              en: "What most often actually kills a business?",
              ru: "Что чаще всего реально убивает бизнес?",
            },
            options: [
              { text: { en: "A bad logo", ru: "Плохой логотип" }, isCorrect: false },
              { text: { en: "Too much profit", ru: "Слишком высокая прибыль" }, isCorrect: false },
              {
                text: {
                  en: "Running out of money in the account, not the losses themselves",
                  ru: "Закончившиеся на счету деньги, а не сами убытки",
                },
                isCorrect: true,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-pitch-piloting",
    title: { en: "Pitch Deck & Piloting", ru: "Pitch Deck & Пилотирование" },
    description: {
      en: "Build a pitch that opens the door, and a pilot plan that doesn't slam it shut.",
      ru: "Собери питч, который откроет дверь, и план пилота, который её не захлопнет.",
    },
    lessons: [
      {
        id: "course-pitch-deck",
        moduleId: "module-pitch-piloting",
        title: { en: "Pitch and Pilot", ru: "Питч и пилот" },
        description: {
          en: "Learn to pitch your idea to an investor and validate it with a pilot before scaling.",
          ru: "Научись презентовать идею инвестору и проверять её на пилоте перед ростом.",
        },
        emoji: "🎬",
        xpReward: 100,
        type: "quiz",
        learningObjectives: [
          "Строить питч по структуре проблема-решение-тракшн",
          "Планировать пилот перед масштабированием",
        ],
        estimatedDuration: 25,
        deliverableName: "Питч-дек из 5 слайдов и план пилота",
        slides: [
          {
            emoji: "🎬",
            title: { en: "A Pitch Is a Story, Not a List of Facts", ru: "Питч — это история, а не список фактов" },
            body: {
              en: "A strong pitch takes the investor on a journey: problem → why it matters now → your solution → why you. A slide with just numbers and no story is quickly forgotten.",
              ru: "Сильный питч ведёт инвестора по пути: проблема → почему это важно сейчас → твоё решение → почему именно ты. Слайд с одними цифрами без истории быстро забывается.",
            },
          },
          {
            emoji: "📈",
            title: {
              en: "Traction Convinces Investors, Not Promises",
              ru: "Инвестора убеждает тракшн, а не обещания",
            },
            body: {
              en: "First sales, a growing waitlist, repeat purchases — that's traction, and it speaks louder than any nice words about market potential.",
              ru: "Первые продажи, растущий список ожидания, повторные покупки — это тракшн, который говорит громче любых красивых слов о потенциале рынка.",
            },
          },
          {
            emoji: "🧭",
            title: { en: "A Pilot Is a Test Before Scaling", ru: "Пилот — это проверка перед масштабированием" },
            body: {
              en: "Before growing 10x, test your model with a small pilot: same product, same process, but at a controlled scale. A pilot shows you what actually breaks as you grow.",
              ru: "Прежде чем расти в 10 раз, проверь модель на небольшом пилоте: тот же продукт, тот же процесс, но в контролируемом масштабе. Пилот показывает, что реально ломается при росте.",
            },
          },
        ],
        quiz: [
          {
            question: {
              en: "What should a strong pitch show first and foremost?",
              ru: "Что должен показывать сильный питч в первую очередь?",
            },
            options: [
              {
                text: { en: "As many numbers and tables per slide as possible", ru: "Максимум цифр и таблиц на слайд" },
                isCorrect: false,
              },
              {
                text: { en: "A story: problem → solution → why you", ru: "Историю: проблема → решение → почему именно вы" },
                isCorrect: true,
              },
              {
                text: {
                  en: "A list of all the company's employees",
                  ru: "Список всех сотрудников компании",
                },
                isCorrect: false,
              },
            ],
          },
          {
            question: { en: "What convinces an investor the most?", ru: "Что убеждает инвестора сильнее всего?" },
            options: [
              { text: { en: "Beautiful presentation design", ru: "Красивый дизайн презентации" }, isCorrect: false },
              {
                text: { en: "Promises of big numbers with no data", ru: "Обещания больших чисел без данных" },
                isCorrect: false,
              },
              {
                text: {
                  en: "Real traction: sales, repeat purchases, growth",
                  ru: "Реальный тракшн: продажи, повторные покупки, рост",
                },
                isCorrect: true,
              },
            ],
          },
          {
            question: {
              en: "Why do you need a pilot before scaling?",
              ru: "Зачем нужен пилот перед масштабированием?",
            },
            options: [
              {
                text: {
                  en: "To check what breaks as you grow, at a controlled scale",
                  ru: "Проверить, что ломается при росте, в контролируемом масштабе",
                },
                isCorrect: true,
              },
              {
                text: { en: "To immediately enter the international market", ru: "Чтобы сразу выйти на международный рынок" },
                isCorrect: false,
              },
              {
                text: { en: "To delay the launch as long as possible", ru: "Чтобы отложить запуск как можно дольше" },
                isCorrect: false,
              },
            ],
          },
        ],
      },
    ],
  },
];

export const ALL_LESSONS: CourseLesson[] = COURSE_MODULES.flatMap((courseModule) => courseModule.lessons);

export function isLessonUnlocked(lessonId: string, completions: ChallengeCompletion[]): boolean {
  const index = ALL_LESSONS.findIndex((lesson) => lesson.id === lessonId);
  if (index <= 0) return true;

  const completedIds = new Set(completions.map((c) => c.challengeId));
  const previousLesson = ALL_LESSONS[index - 1];
  return completedIds.has(previousLesson.id);
}

export interface CourseProgress {
  totalLessons: number;
  completedLessons: number;
  percent: number;
  allDone: boolean;
  activeModuleTitle: string;
  currentLessonTitle: string;
}

export function getCourseProgress(completions: ChallengeCompletion[], locale: Locale | string): CourseProgress {
  const completedIds = new Set(completions.map((c) => c.challengeId));
  const totalLessons = ALL_LESSONS.length;
  const completedLessons = ALL_LESSONS.filter((lesson) => completedIds.has(lesson.id)).length;
  const percent = totalLessons === 0 ? 0 : Math.round((completedLessons / totalLessons) * 100);
  const allDone = completedLessons === totalLessons;

  const nextLesson = ALL_LESSONS.find((lesson) => !completedIds.has(lesson.id));
  const activeModule = nextLesson
    ? COURSE_MODULES.find((courseModule) => courseModule.id === nextLesson.moduleId)
    : COURSE_MODULES[COURSE_MODULES.length - 1];

  return {
    totalLessons,
    completedLessons,
    percent,
    allDone,
    activeModuleTitle: activeModule ? pick(activeModule.title, locale) : "",
    currentLessonTitle: allDone ? "" : nextLesson ? pick(nextLesson.title, locale) : "",
  };
}

// Pricing simulator math, shared between the UI and (if ever needed) server-side checks.
export function calcPricingDemand(price: number, config: PricingSimulationConfig): number {
  if (price >= config.demandFloorPrice) return 0;
  const range = config.demandFloorPrice - config.minPrice;
  const ratio = range <= 0 ? 0 : (config.demandFloorPrice - price) / range;
  return Math.max(0, config.maxDemandUnits * Math.min(1, ratio));
}

export function calcPricingOutcome(price: number, config: PricingSimulationConfig) {
  const demand = calcPricingDemand(price, config);
  const revenue = price * demand;
  const totalCost = config.fixedCost + config.unitCost * demand;
  const profit = revenue - totalCost;
  return { demand, revenue, totalCost, profit };
}

import type { ChallengeCompletion } from "@/lib/game-progress/GameProgressContext";

export interface CourseQuizOption {
  text: string;
  isCorrect: boolean;
}

export interface CourseQuizQuestion {
  question: string;
  options: CourseQuizOption[];
}

export interface TheorySlide {
  emoji: string;
  title: string;
  body: string;
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
  title: string;
  description: string;
  emoji: string;
  xpReward: number;
  /** Teacher-dashboard metadata. */
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
  title: string;
  description: string;
  lessons: CourseLesson[];
}

export const COURSE_MODULES: CourseModule[] = [
  {
    id: "module-launch-from-zero",
    title: "Запуск с нуля",
    description: "Первые шаги: от идеи в голове до первых денег в кармане.",
    lessons: [
      {
        id: "course-niche-search",
        moduleId: "module-launch-from-zero",
        title: "Поиск ниши",
        description: "Найди место на рынке, где тебя реально ждут.",
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
            title: "Ниша — это не идея, это дыра",
            body: "Ниша — узкая группа людей с конкретной болью, которую сейчас никто нормально не закрывает. Не пытайся понравиться всем — это самый быстрый способ не понравиться никому.",
          },
          {
            emoji: "🔍",
            title: "Ищи там, где уже платят",
            body: "Самый простой сигнал хорошей ниши — люди уже платят за кривое, дорогое или неудобное решение своей проблемы. Твоя задача — сделать так же, но лучше, а не изобретать спрос с нуля.",
          },
          {
            emoji: "🧩",
            title: "Уже + узко = сильно",
            body: "Пример: не «доставка еды», а «доставка еды для тех, кто на сушке и считает БЖУ». Чем уже ниша — тем громче в ней твой голос.",
          },
        ],
        quiz: [
          {
            question: "Что делает нишу хорошей?",
            options: [
              { text: "Узкая группа людей с конкретной, уже ощутимой болью", isCorrect: true },
              { text: "Она максимально широкая, чтобы охватить всех", isCorrect: false },
              { text: "Она никому пока не нужна", isCorrect: false },
            ],
          },
          {
            question: "Какой сигнал говорит, что рынок реальный?",
            options: [
              { text: "Об этом никто никогда не думал", isCorrect: false },
              { text: "Люди уже платят за плохое решение проблемы", isCorrect: true },
              { text: "У тебя красивый логотип", isCorrect: false },
            ],
          },
          {
            question: "Почему узкая ниша сильнее широкой?",
            options: [
              { text: "Потому что реклама там всегда бесплатная", isCorrect: false },
              { text: "Потому что там вообще нет конкурентов", isCorrect: false },
              { text: "Потому что в ней тебя слышно и ты решаешь конкретную боль", isCorrect: true },
            ],
          },
        ],
      },
      {
        id: "course-offer-formula",
        moduleId: "module-launch-from-zero",
        title: "Формулировка оффера",
        description: "Собери предложение, которое цепляет за 5 секунд.",
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
            title: "Оффер = обещание результата",
            body: "Люди не покупают продукт — они покупают результат, который он даёт. Не «курс по английскому», а «заговоришь на английском через 30 дней без зубрёжки».",
          },
          {
            emoji: "🧠",
            title: "Формула, которая работает",
            body: "Оффер = Результат + Срок + Без чего (без боли, усилий или риска). Собери свой в одну фразу и проверь, цепляет ли она за 5 секунд.",
          },
          {
            emoji: "🚫",
            title: "Убери воду",
            body: "Слова вроде «инновационный», «уникальный», «качественный» ничего не продают — это шум. Оставь только конкретику: что получит клиент и когда.",
          },
        ],
        quiz: [
          {
            question: "Что на самом деле покупают люди?",
            options: [
              { text: "Красивую упаковку", isCorrect: false },
              { text: "Результат, который даёт продукт", isCorrect: true },
              { text: "Название бренда", isCorrect: false },
            ],
          },
          {
            question: "Какая формула оффера рабочая?",
            options: [
              { text: "Цена + Скидка + Гарантия", isCorrect: false },
              { text: "Логотип + Слоган + Цвет", isCorrect: false },
              { text: "Результат + Срок + Без чего", isCorrect: true },
            ],
          },
          {
            question: "Что стоит убрать из оффера?",
            options: [
              { text: "Общие слова вроде «уникальный» и «качественный»", isCorrect: true },
              { text: "Конкретные цифры и сроки", isCorrect: false },
              { text: "Описание результата для клиента", isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-pricing-value",
    title: "Слайдер Цен и Ценность",
    description: "Почувствуй на своей шкуре, как цена решает: прибыль или банкротство.",
    lessons: [
      {
        id: "course-pricing-simulation",
        moduleId: "module-pricing-value",
        title: "Симулятор цены",
        description: "Двигай слайдер и найди цену с максимальной прибылью.",
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
            title: "Цена — это не расходы + процент",
            body: "Многие ставят цену «на глаз»: посчитали расходы, накинули 20% и продают. Но правильная цена завязана не на твоих затратах, а на том, сколько клиент готов заплатить за ценность, которую он получает.",
          },
          {
            emoji: "📉",
            title: "Чем выше цена — тем меньше покупателей",
            body: "Это не теория, а суровая реальность спроса: подними цену — часть клиентов уйдёт к конкуренту или откажется от покупки вообще. Твоя задача — найти цену, где прибыль максимальна, а не там, где цена просто «красивая».",
          },
          {
            emoji: "🎯",
            title: "Сейчас проверишь это на цифрах",
            body: "Ниже — мини-симулятор твоего продукта. Двигай слайдер цены и смотри, как меняются спрос, расходы и итоговая прибыль. Найди цену, при которой прибыль максимальна, и нажми «Тестировать гипотезу».",
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
    title: "Юнит-Экономика",
    description: "Разбираемся в цифрах, которые решают, выживет бизнес или нет.",
    lessons: [
      {
        id: "course-cac-ltv",
        moduleId: "module-unit-economics",
        title: "Считаем CAC и LTV",
        description: "Узнай, сколько стоит клиент и сколько он приносит.",
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
            title: "CAC — цена одного клиента",
            body: "CAC (Customer Acquisition Cost) — сколько денег ты тратишь на рекламу и маркетинг, чтобы получить одного платящего клиента.",
          },
          {
            emoji: "♻️",
            title: "LTV — сколько клиент принесёт всего",
            body: "LTV (Lifetime Value) — сколько денег клиент принесёт тебе за всё время, пока он с тобой, а не за одну первую покупку.",
          },
          {
            emoji: "⚖️",
            title: "Главное правило юнит-экономики",
            body: "Если LTV меньше CAC — ты платишь за то, чтобы терять деньги на каждом клиенте. Здоровое соотношение — LTV минимум в 3 раза больше CAC.",
          },
        ],
        quiz: [
          {
            question: "Что такое CAC?",
            options: [
              { text: "Общая прибыль компании", isCorrect: false },
              { text: "Название маркетинговой стратегии", isCorrect: false },
              { text: "Стоимость привлечения одного клиента", isCorrect: true },
            ],
          },
          {
            question: "Что показывает LTV?",
            options: [
              { text: "Сколько денег клиент принесёт за всё время, пока остаётся с продуктом", isCorrect: true },
              { text: "Сколько стоит один клик по рекламе", isCorrect: false },
              { text: "Сколько сотрудников нужно нанять", isCorrect: false },
            ],
          },
          {
            question: "Какое соотношение LTV к CAC считается здоровым?",
            options: [
              { text: "LTV должен быть равен CAC", isCorrect: false },
              { text: "LTV минимум в 3 раза больше CAC", isCorrect: true },
              { text: "CAC должен быть больше LTV", isCorrect: false },
            ],
          },
        ],
      },
      {
        id: "course-breakeven",
        moduleId: "module-unit-economics",
        title: "Точка безубыточности",
        description: "Пойми, сколько нужно продать, чтобы выйти в ноль.",
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
            title: "Точка безубыточности — это ноль",
            body: "Это момент, когда доходы наконец сравнялись с расходами — ты ещё не зарабатываешь, но уже не теряешь деньги.",
          },
          {
            emoji: "🧱",
            title: "Постоянные и переменные расходы — это разное",
            body: "Постоянные расходы (аренда, зарплата) не меняются от количества продаж. Переменные (сырьё, упаковка) растут с каждой продажей. Точку безубыточности считают именно от постоянных расходов и маржи с продажи.",
          },
          {
            emoji: "📐",
            title: "Как её посчитать просто",
            body: "Раздели постоянные расходы на маржу с одной продажи — получишь, сколько продаж нужно сделать, чтобы выйти в ноль.",
          },
          {
            emoji: "🚀",
            title: "После точки — только прибыль",
            body: "Каждая продажа после точки безубыточности — это уже чистая прибыль, потому что все постоянные расходы уже покрыты предыдущими продажами.",
          },
        ],
        quiz: [
          {
            question: "Что означает точка безубыточности?",
            options: [
              { text: "Доходы сравнялись с расходами, прибыли ещё нет", isCorrect: true },
              { text: "Бизнес уже приносит стабильную прибыль", isCorrect: false },
              { text: "Бизнес обанкротился", isCorrect: false },
            ],
          },
          {
            question: "Как посчитать точку безубыточности в продажах?",
            options: [
              { text: "Умножить цену на количество клиентов", isCorrect: false },
              { text: "Постоянные расходы разделить на маржу с одной продажи", isCorrect: true },
              { text: "Сложить все расходы и доходы", isCorrect: false },
            ],
          },
          {
            question: "Что происходит с продажами после точки безубыточности?",
            options: [
              { text: "Они всё ещё покрывают убытки", isCorrect: false },
              { text: "Они ничего не меняют в бизнесе", isCorrect: false },
              { text: "Они становятся чистой прибылью", isCorrect: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-custdev-interviews",
    title: "Кастдев и Интервью",
    description: "Научись слышать правду, а не вежливое «звучит интересно».",
    lessons: [
      {
        id: "course-custdev-interview",
        moduleId: "module-custdev-interviews",
        title: "Кастдев без иллюзий",
        description: "Отличи настоящий интерес клиента от вежливой лжи.",
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
            title: "Кастдев — это не питч, это допрос с пристрастием",
            body: "Цель интервью — не рассказать о своей идее, а вытащить из человека его реальный опыт, боли и деньги, которые он уже тратит на похожие проблемы. Говори меньше, слушай больше.",
          },
          {
            emoji: "🎭",
            title: "Ложная валидация — твой главный враг",
            body: "«Звучит круто, я бы точно купил» — самая опасная фраза в кастдеве. Люди из вежливости хвалят идеи, которые никогда не купят. Верь не словам, а прошлым действиям: что человек уже пробовал делать с этой проблемой?",
          },
          {
            emoji: "🔬",
            title: "Спрашивай про прошлое, а не про будущее",
            body: "Вопрос «купил бы ты это?» почти бесполезен — люди плохо предсказывают своё будущее поведение. Вопрос «как ты решаешь эту проблему сейчас и сколько на это тратишь?» даёт настоящие данные.",
          },
        ],
        quiz: [
          {
            question: "Какая фраза клиента — классический признак ложной валидации?",
            options: [
              { text: "«Я плачу за это конкуренту 500 рублей в месяц»", isCorrect: false },
              { text: "«Звучит круто, я бы точно купил»", isCorrect: true },
              { text: "«Я пробовал решить это сам и бросил через неделю»", isCorrect: false },
            ],
          },
          {
            question: "Какой вопрос даёт больше реальных данных в интервью?",
            options: [
              { text: "Купил бы ты мой продукт?", isCorrect: false },
              { text: "Нравится ли тебе моя идея?", isCorrect: false },
              { text: "Как ты решаешь эту проблему сейчас?", isCorrect: true },
            ],
          },
          {
            question: "Что должен делать интервьюер большую часть времени?",
            options: [
              { text: "Слушать", isCorrect: true },
              { text: "Презентовать свою идею", isCorrect: false },
              { text: "Спорить с возражениями", isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-micro-marketing",
    title: "Микро-Маркетинг & Трафик",
    description: "Первые клиенты не падают с неба — их приводят конкретные каналы и цифры.",
    lessons: [
      {
        id: "course-micro-marketing",
        moduleId: "module-micro-marketing",
        title: "Каналы, CTR и конверсия",
        description: "Пойми, куда именно утекает и где превращается в деньги твой трафик.",
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
            title: "Канал трафика — это не «реклама вообще»",
            body: "«Запущу рекламу» ничего не значит. Instagram Reels, поисковая реклама, партнёрства с блогерами, холодные письма — у каждого канала своя цена клиента и своя аудитория.",
          },
          {
            emoji: "👆",
            title: "CTR — это честность твоего объявления",
            body: "CTR (click-through rate) показывает, какой процент увидевших рекламу кликнул по ней. Низкий CTR почти всегда означает: не тот оффер, не та картинка или не та аудитория.",
          },
          {
            emoji: "🔁",
            title: "Конверсия решает больше, чем трафик",
            body: "Привести 1000 человек с конверсией 0.5% хуже, чем привести 100 человек с конверсией 10%. Прежде чем лить трафик, убедись, что твоя посадочная страница вообще способна превращать интерес в оплату.",
          },
        ],
        quiz: [
          {
            question: "Что показывает CTR?",
            options: [
              { text: "Общую прибыль от рекламы", isCorrect: false },
              { text: "Количество показов объявления", isCorrect: false },
              { text: "Долю увидевших рекламу, которые кликнули по ней", isCorrect: true },
            ],
          },
          {
            question: "Что важнее нарастить в первую очередь?",
            options: [
              { text: "Конверсию посадочной страницы, а не просто объём трафика", isCorrect: true },
              { text: "Любой ценой количество показов", isCorrect: false },
              { text: "Число подписчиков в соцсетях", isCorrect: false },
            ],
          },
          {
            question: "Почему «запущу рекламу» — плохой план?",
            options: [
              { text: "Потому что реклама всегда работает одинаково", isCorrect: false },
              { text: "Потому что не назван конкретный канал и аудитория", isCorrect: true },
              { text: "Потому что реклама запрещена для новых компаний", isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-nocode-mvp",
    title: "MVP без кода",
    description: "Проверь спрос за один вечер и ноль рублей бюджета.",
    lessons: [
      {
        id: "course-nocode-mvp",
        moduleId: "module-nocode-mvp",
        title: "Тестируем спрос без разработки",
        description: "Собери MVP из конструкторов и проверь идею деньгами, а не лайками.",
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
            title: "MVP — это эксперимент, а не продукт",
            body: "Задача MVP не впечатлить, а быстро и дёшево проверить: готовы ли люди платить за решение этой проблемы. Google-форма, лендинг на конструкторе или чат в мессенджере часто справляются лучше, чем месяцы разработки.",
          },
          {
            emoji: "🛠️",
            title: "Инструменты, которые заменяют разработчика",
            body: "Tilda и Notion для лендинга, Google Forms для сбора заявок, конструкторы Telegram-ботов для простого сервиса — всё это позволяет протестировать идею без единой строчки кода.",
          },
          {
            emoji: "💳",
            title: "Проверяй деньгами, а не лайками",
            body: "Лайки и «интересно, расскажи ещё» ничего не стоят. Настоящая проверка спроса — это предзаказ, депозит или подписка на лист ожидания с реальной картой. Деньги не врут.",
          },
        ],
        quiz: [
          {
            question: "Какая проверка спроса самая надёжная?",
            options: [
              { text: "Реальная оплата или предзаказ", isCorrect: true },
              { text: "Количество лайков под постом", isCorrect: false },
              { text: "Комментарии «звучит интересно»", isCorrect: false },
            ],
          },
          {
            question: "Зачем нужен MVP без кода?",
            options: [
              { text: "Заменить финальный продукт навсегда", isCorrect: false },
              { text: "Проверить спрос быстро и без бюджета на разработку", isCorrect: true },
              { text: "Произвести впечатление на инвесторов дизайном", isCorrect: false },
            ],
          },
          {
            question: "Какой инструмент подходит для MVP без кода?",
            options: [
              { text: "Написание собственного бэкенда с нуля", isCorrect: false },
              { text: "Найм команды из 5 разработчиков", isCorrect: false },
              { text: "Конструктор лендингов вроде Tilda", isCorrect: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-first-sales-scripts",
    title: "Первые Продажи & Скрипты",
    description: "От первого «нет» до первого «да» — с готовым скриптом в кармане.",
    lessons: [
      {
        id: "course-first-sales",
        moduleId: "module-first-sales-scripts",
        title: "Первые продажи",
        description: "Доберись до первого «да» от реального клиента.",
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
            title: "Первая продажа — это не про деньги",
            body: "Первая продажа доказывает, что твоя идея не просто нравится в теории, а реально нужна настолько, что за неё готовы платить. Это твой первый настоящий сигнал от рынка.",
          },
          {
            emoji: "📞",
            title: "Продавай руками, не рекламой",
            body: "На старте не нужен маркетинг-бюджет — нужны личные сообщения, звонки и десяток неловких разговоров. Первые 10 клиентов почти всегда приходят руками, а не алгоритмами.",
          },
          {
            emoji: "🔁",
            title: "Отказ — это данные, а не приговор",
            body: "Каждое «нет» говорит тебе, что поправить в оффере, цене или подаче. Считай отказы не поражением, а бесплатной обратной связью от рынка.",
          },
          {
            emoji: "⚔️",
            title: "B2C и B2B продаются по-разному",
            body: "В B2C ты убеждаешь одного человека здесь и сейчас — эмоцией и простотой. В B2B решение принимает несколько людей и не сразу — там важны цифры, доверие и снятие рисков для того, кто одобряет покупку.",
          },
        ],
        quiz: [
          {
            question: "Зачем нужна первая продажа?",
            options: [
              { text: "Чтобы окупить рекламный бюджет", isCorrect: false },
              { text: "Подтвердить, что за продукт реально готовы платить", isCorrect: true },
              { text: "Чтобы было что показать инвесторам для вида", isCorrect: false },
            ],
          },
          {
            question: "Как обычно приходят первые клиенты?",
            options: [
              { text: "Только через таргетированную рекламу", isCorrect: false },
              { text: "Сами находят тебя случайно", isCorrect: false },
              { text: "Через личные сообщения и разговоры", isCorrect: true },
            ],
          },
          {
            question: "Как правильно относиться к отказам на старте?",
            options: [
              { text: "Как к обратной связи, которая помогает улучшить оффер", isCorrect: true },
              { text: "Как к знаку, что нужно всё бросить", isCorrect: false },
              { text: "Как к личному оскорблению", isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-team-delegation",
    title: "Команда & Делегирование",
    description: "Собери первых людей, которые поверят в идею раньше, чем в деньги.",
    lessons: [
      {
        id: "course-team-hiring",
        moduleId: "module-team-delegation",
        title: "Первый найм",
        description: "Разберись, кого нанимать первым и как договариваться о доле.",
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
            title: "Первый найм — это не сотрудник, а со-основатель по духу",
            body: "На самой ранней стадии зарплата не главный аргумент — люди приходят за миссией, ролью и шансом вырасти вместе с проектом. Ищи тех, кому важен результат, а не только оклад.",
          },
          {
            emoji: "⚖️",
            title: "Доля или зарплата — выбирай осознанно",
            body: "Доля в компании мотивирует сильнее в долгую, но не кормит здесь и сейчас. Зарплата — наоборот. Ранним командам часто предлагают комбинацию: меньше денег сейчас, плюс небольшая доля за риск.",
          },
          {
            emoji: "📋",
            title: "Роль важнее должности",
            body: "На старте нет времени на расплывчатые обязанности. Чётко проговори: за что именно отвечает человек, как измеряется его успех и что произойдёт, если что-то не сработает.",
          },
        ],
        quiz: [
          {
            question: "Что чаще всего убеждает первых сотрудников присоединиться без больших денег?",
            options: [
              { text: "Обещание высокой зарплаты в будущем", isCorrect: false },
              { text: "Красивый офис", isCorrect: false },
              { text: "Миссия и роль, в которой можно вырасти", isCorrect: true },
            ],
          },
          {
            question: "В чём разница между долей и зарплатой?",
            options: [
              { text: "Доля мотивирует в долгую, зарплата закрывает текущие нужды", isCorrect: true },
              { text: "Это одно и то же", isCorrect: false },
              { text: "Доля всегда лучше зарплаты в любой ситуации", isCorrect: false },
            ],
          },
          {
            question: "Что важно чётко определить при первом найме?",
            options: [
              { text: "Только размер будущей премии", isCorrect: false },
              { text: "Конкретную роль и то, как измеряется успех", isCorrect: true },
              { text: "Дизайн визитки сотрудника", isCorrect: false },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-finance-pnl",
    title: "Финансы и P&L",
    description: "Следи за деньгами так, чтобы не узнать о банкротстве последним.",
    lessons: [
      {
        id: "course-cashflow-runway",
        moduleId: "module-finance-pnl",
        title: "Cashflow и runway",
        description: "Пойми разницу между прибылью на бумаге и деньгами на счету.",
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
            title: "Прибыль на бумаге — не деньги на счету",
            body: "Можно быть «прибыльным» по отчётам и обанкротиться из-за кассового разрыва: клиенты платят с задержкой, а зарплаты и аренду нужно платить сейчас. Cashflow — это про реальное движение денег, а не про красивые цифры в таблице.",
          },
          {
            emoji: "⏳",
            title: "Runway — это твой запас времени",
            body: "Runway показывает, сколько месяцев бизнес проживёт на текущие деньги при текущих тратах, если доходы вдруг остановятся. Чем короче runway, тем быстрее нужно либо зарабатывать, либо привлекать деньги.",
          },
          {
            emoji: "🚨",
            title: "Банкротят не убытки, а кончившиеся деньги",
            body: "Компания может годами работать в минус, если у неё есть деньги на счету. И наоборот — прибыльный на бумаге бизнес закрывается, если у него физически нет денег заплатить по счетам вовремя.",
          },
        ],
        quiz: [
          {
            question: "Почему прибыль на бумаге может не спасти от банкротства?",
            options: [
              { text: "Потому что деньги от клиентов могут приходить с задержкой, а платить нужно сейчас", isCorrect: true },
              { text: "Потому что прибыль никогда не бывает реальной", isCorrect: false },
              { text: "Потому что налоги отменяют всю прибыль", isCorrect: false },
            ],
          },
          {
            question: "Что такое runway?",
            options: [
              { text: "Общая выручка компании за год", isCorrect: false },
              { text: "Сколько месяцев бизнес проживёт на текущие деньги без новых поступлений", isCorrect: true },
              { text: "Скорость роста числа клиентов", isCorrect: false },
            ],
          },
          {
            question: "Что чаще всего реально убивает бизнес?",
            options: [
              { text: "Плохой логотип", isCorrect: false },
              { text: "Слишком высокая прибыль", isCorrect: false },
              { text: "Закончившиеся на счету деньги, а не сами убытки", isCorrect: true },
            ],
          },
        ],
      },
    ],
  },
  {
    id: "module-pitch-piloting",
    title: "Pitch Deck & Пилотирование",
    description: "Собери питч, который откроет дверь, и план пилота, который её не захлопнет.",
    lessons: [
      {
        id: "course-pitch-deck",
        moduleId: "module-pitch-piloting",
        title: "Питч и пилот",
        description: "Научись презентовать идею инвестору и проверять её на пилоте перед ростом.",
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
            title: "Питч — это история, а не список фактов",
            body: "Сильный питч ведёт инвестора по пути: проблема → почему это важно сейчас → твоё решение → почему именно ты. Слайд с одними цифрами без истории быстро забывается.",
          },
          {
            emoji: "📈",
            title: "Инвестора убеждает тракшн, а не обещания",
            body: "Первые продажи, растущий список ожидания, повторные покупки — это тракшн, который говорит громче любых красивых слов о потенциале рынка.",
          },
          {
            emoji: "🧭",
            title: "Пилот — это проверка перед масштабированием",
            body: "Прежде чем расти в 10 раз, проверь модель на небольшом пилоте: тот же продукт, тот же процесс, но в контролируемом масштабе. Пилот показывает, что реально ломается при росте.",
          },
        ],
        quiz: [
          {
            question: "Что должен показывать сильный питч в первую очередь?",
            options: [
              { text: "Максимум цифр и таблиц на слайд", isCorrect: false },
              { text: "Историю: проблема → решение → почему именно вы", isCorrect: true },
              { text: "Список всех сотрудников компании", isCorrect: false },
            ],
          },
          {
            question: "Что убеждает инвестора сильнее всего?",
            options: [
              { text: "Красивый дизайн презентации", isCorrect: false },
              { text: "Обещания больших чисел без данных", isCorrect: false },
              { text: "Реальный тракшн: продажи, повторные покупки, рост", isCorrect: true },
            ],
          },
          {
            question: "Зачем нужен пилот перед масштабированием?",
            options: [
              { text: "Проверить, что ломается при росте, в контролируемом масштабе", isCorrect: true },
              { text: "Чтобы сразу выйти на международный рынок", isCorrect: false },
              { text: "Чтобы отложить запуск как можно дольше", isCorrect: false },
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

export function getCourseProgress(completions: ChallengeCompletion[]): CourseProgress {
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
    activeModuleTitle: activeModule?.title ?? "",
    currentLessonTitle: allDone ? "Все уроки пройдены 🏆" : nextLesson?.title ?? "",
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

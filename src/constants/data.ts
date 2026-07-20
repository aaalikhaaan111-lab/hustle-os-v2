import type { Localized } from "@/i18n/content";

export interface VideoCourse {
  id: string;
  title: Localized;
  videoUrl: string;
  source: "en" | "ru";
  module: Localized;
  description: Localized;
  checklist: Localized<string[]>;
  takeaway: Localized;
}

export interface GlossaryTerm {
  id: string;
  name: Localized;
  definition: Localized;
  example: Localized;
}

export const VIDEOS: VideoCourse[] = [
  // --- EN: Y Combinator (Startup School, official YC channel) ---
  {
    id: "ideas-evaluation",
    title: {
      en: "How to Find and Evaluate Startup Ideas",
      ru: "Как находить и оценивать стартап-идеи",
    },
    videoUrl: "https://www.youtube.com/embed/Th8JoIan4dg",
    source: "en",
    module: { en: "Finding an Idea", ru: "Поиск идеи" },
    description: {
      en: "A YC breakdown of frameworks for evaluating startup ideas: how to tell a promising TAM from a nice-sounding but unworkable hypothesis.",
      ru: "YC-разбор фреймворков для оценки стартап-идей: как отличить перспективный TAM от красивой, но нежизнеспособной гипотезы.",
    },
    checklist: {
      en: [
        "Wrote down 3 problems I personally run into",
        "Estimated the market size for my top idea",
        "Figured out why now is the right time to launch",
      ],
      ru: [
        "Выписал 3 проблемы, с которыми сталкиваюсь лично",
        "Оценил размер рынка для своей топ-идеи",
        "Определил, почему именно сейчас лучшее время для запуска",
      ],
    },
    takeaway: {
      en: "What's the main problem your idea solves, and why are the existing solutions on the market bad?",
      ru: "Какую главную проблему решает твоя идея и почему существующие решения на рынке плохи?",
    },
  },
  {
    id: "co-founder",
    title: {
      en: "How to Find the Perfect Co-Founder",
      ru: "Как найти идеального сооснователя",
    },
    videoUrl: "https://www.youtube.com/embed/Fk9BCr5pLTU",
    source: "en",
    module: { en: "Team", ru: "Команда" },
    description: {
      en: "How to split equity, check compatibility with a co-founder, and where to find people who complement your technical or business skills.",
      ru: "Как распределить equity, проверить совместимость с сооснователем и где искать людей, которые дополнят твои технические или бизнес-навыки.",
    },
    checklist: {
      en: [
        "Wrote a profile of my ideal co-founder",
        "Identified my weak spots that a partner needs to cover",
        "Looked into how equity vesting works",
      ],
      ru: [
        "Составил профиль идеального сооснователя",
        "Определил свои слабые стороны, которые нужно закрыть партнером",
        "Ознакомился с механикой vesting долей",
      ],
    },
    takeaway: {
      en: "What key skills should your ideal co-founder have?",
      ru: "Какими ключевыми навыками должен обладать твой идеальный сооснователь?",
    },
  },
  {
    id: "talk-to-users",
    title: {
      en: "How to Actually Talk to Users",
      ru: "Как правильно разговаривать с пользователями",
    },
    videoUrl: "https://www.youtube.com/embed/z1iF1c8w5Lg",
    source: "en",
    module: { en: "Customer Discovery", ru: "Кастдев" },
    description: {
      en: "YC's rules for customer discovery interviews: how to ask about past experience instead of getting polite lies in return.",
      ru: "Правила CustDev-интервью от YC: как задавать вопросы о прошлом опыте, чтобы не получать вежливую ложь в ответ.",
    },
    checklist: {
      en: [
        "Wrote an interview script with no leading questions",
        "Found 3 potential customers to call",
        "Wrote down the key insights after the first conversation",
      ],
      ru: [
        "Написал скрипт интервью без наводящих вопросов",
        "Нашел 3 потенциальных клиентов для созвона",
        "Записал ключевые инсайты после первого диалога",
      ],
    },
    takeaway: {
      en: "What's the one key question you'd ask a user to uncover their real pain point?",
      ru: "Какой один главный вопрос ты задашь пользователю, чтобы понять его реальную боль?",
    },
  },
  {
    id: "mvp-build",
    title: { en: "How to Build an MVP", ru: "Как построить MVP" },
    videoUrl: "https://www.youtube.com/embed/QRZ_l7cVzzU",
    source: "en",
    module: { en: "MVP & Development", ru: "MVP и Разработка" },
    description: {
      en: "Michael Seibel explains how to cut an MVP down to one testable hypothesis and avoid overinvesting in extra features before product-market fit.",
      ru: "Michael Seibel объясняет, как урезать MVP до одной проверяемой гипотезы и не переинвестировать в лишние фичи до Product-Market Fit.",
    },
    checklist: {
      en: [
        "Picked one core feature for the first version",
        "Cut every non-essential section and setting",
        "Sketched a rough draft of the interface",
      ],
      ru: [
        "Выделил одну ключевую фичу для первой версии",
        "Убрал все второстепенные разделы и настройки",
        "Нарисовал черновой макет интерфейса",
      ],
    },
    takeaway: {
      en: "Describe your MVP in one sentence. What's the single job it does?",
      ru: "Опиши свой MVP в одном предложении. Какую единственную задачу он решает?",
    },
  },
  {
    id: "launch-startup",
    title: {
      en: "The Best Way to Launch a Startup",
      ru: "Лучший способ запустить стартап",
    },
    videoUrl: "https://www.youtube.com/embed/u36A-YTxiOw",
    source: "en",
    module: { en: "Launch", ru: "Запуск" },
    description: {
      en: "YC's step-by-step launch plan: how to use Product Hunt, social media, and communities to get your first traction.",
      ru: "Пошаговый план лонча от YC: как использовать Product Hunt, соцсети и комьюнити, чтобы привлечь первый traction.",
    },
    checklist: {
      en: [
        "Made a list of places to post the launch",
        "Wrote a short product description for Product Hunt",
        "Wrote a welcome message for the first users",
      ],
      ru: [
        "Составил список площадок для публикации",
        "Подготовил краткое описание продукта для Product Hunt",
        "Написал приветственное письмо для первых юзеров",
      ],
    },
    takeaway: {
      en: "Where exactly will you post the link to your product on launch day?",
      ru: "Где именно ты опубликуешь ссылку на свой продукт в первый день запуска?",
    },
  },
  {
    id: "first-customers",
    title: {
      en: "How to Find Your First Customers",
      ru: "Как найти первых клиентов",
    },
    videoUrl: "https://www.youtube.com/embed/hyYCn_kAngI",
    source: "en",
    module: { en: "Sales", ru: "Продажи" },
    description: {
      en: "Direct sales and unconventional acquisition channels in the early days — things that don't scale, but pay for themselves in early CAC.",
      ru: "Прямые продажи и нетипичные каналы привлечения на раннем этапе — вещи, которые не масштабируются, но окупают ранний CAC.",
    },
    checklist: {
      en: [
        "Built a list of 50 cold contacts",
        "Wrote a template for the first outreach message",
        "Sent the first 5 messages by hand",
      ],
      ru: [
        "Собрал базу из 50 холодных контактов",
        "Написал шаблон первого сообщения",
        "Сделал первые 5 рассылок вручную",
      ],
    },
    takeaway: {
      en: "What message would you send your first potential customer to get them interested?",
      ru: "Какое сообщение ты напишешь своему первому потенциальному клиенту, чтобы заинтересовать его?",
    },
  },
  {
    id: "first-10-customers",
    title: {
      en: "How to Get Your First 10 Paying Customers",
      ru: "Как получить первые 10 платящих клиентов",
    },
    videoUrl: "https://www.youtube.com/embed/_FBivfgOvuE",
    source: "en",
    module: { en: "Sales", ru: "Продажи" },
    description: {
      en: "Moving from free trials to real payments: how to prove your product's value and close your first deals.",
      ru: "Переход от бесплатных тестов к первым транзакциям: как доказать ценность продукта и закрыть первые сделки.",
    },
    checklist: {
      en: [
        "Set a price for the subscription/product",
        "Offered the MVP to early loyal testers for money",
        "Got the first feedback on pricing",
      ],
      ru: [
        "Определил стоимость подписки/продукта",
        "Предложил MVP первым лояльным тестировщикам за деньги",
        "Получил первый фидбек по цене",
      ],
    },
    takeaway: {
      en: "What price would you set for your product, and why would a customer agree to pay it?",
      ru: "Какую цену ты выставишь за свой продукт и почему клиент согласится её заплатить?",
    },
  },
  {
    id: "pricing-101",
    title: { en: "Startup Pricing 101", ru: "Ценообразование стартапа 101" },
    videoUrl: "https://www.youtube.com/embed/jwXlo9gy_k4",
    source: "en",
    module: { en: "Unit Economics", ru: "Юнит-экономика" },
    description: {
      en: "Kevin Hale on why guessing your price kills your gross margin, and how to find the price that maximizes profit.",
      ru: "Kevin Hale о том, почему цена «на глаз» убивает Gross Margin и как найти цену с максимальной прибылью.",
    },
    checklist: {
      en: [
        "Calculated the cost of one sale",
        "Tested the price on 5 real customers",
        "Wrote down the final price and why I picked it",
      ],
      ru: [
        "Посчитал себестоимость одной продажи",
        "Проверил цену на 5 реальных клиентах",
        "Записал итоговую цену и почему именно она",
      ],
    },
    takeaway: {
      en: "What price did you choose, and what made you settle on it?",
      ru: "Какую цену ты выбрал и что заставило тебя остановиться именно на ней?",
    },
  },
  {
    id: "b2b-pricing",
    title: { en: "Pricing for the B2B Segment", ru: "Ценообразование в B2B-сегменте" },
    videoUrl: "https://www.youtube.com/embed/4hjiRmgmHiU",
    source: "en",
    module: { en: "Unit Economics", ru: "Юнит-экономика" },
    description: {
      en: "How to estimate the economic impact for a business customer and charge a fair price for it in B2B deals.",
      ru: "Как оценивать экономический эффект для бизнеса-клиента и брать за это адекватные деньги в B2B-сделках.",
    },
    checklist: {
      en: [
        "Calculated how much money the software saves the client",
        "Put together 3 pricing tiers for business clients",
        "Removed the free tier for large companies",
      ],
      ru: [
        "Посчитал, сколько денег экономит софт клиенту",
        "Оформил 3 тарифных плана для юрлиц",
        "Убрал бесплатный тариф для крупных компаний",
      ],
    },
    takeaway: {
      en: "How does your product increase revenue or cut costs for a B2B client?",
      ru: "Как твой продукт увеличивает выручку или снижает косты B2B-клиенту?",
    },
  },
  {
    id: "business-models-pricing",
    title: {
      en: "Startup Business Models and Pricing",
      ru: "Бизнес-модели и ценообразование стартапов",
    },
    videoUrl: "https://www.youtube.com/embed/oWZbWzAyHAE",
    source: "en",
    module: { en: "Business Model", ru: "Бизнес-модель" },
    description: {
      en: "An overview of monetization models — SaaS, transaction-based, marketplace — and how to pick the right one for your market.",
      ru: "Обзор моделей монетизации: SaaS, транзакционная модель, маркетплейс — и как выбрать подходящую для своего рынка.",
    },
    checklist: {
      en: [
        "Picked a base monetization model",
        "Estimated a rough CAC",
        "Decided on a billing cadence (MRR/ARR)",
      ],
      ru: [
        "Выбрал базовую модель монетизации",
        "Рассчитал примерный CAC",
        "Определил периодичность платежей (MRR/ARR)",
      ],
    },
    takeaway: {
      en: "Which monetization model did you choose, and why does it fit your product?",
      ru: "Какую модель монетизации ты выбрал и почему она подходит твоему продукту?",
    },
  },
  {
    id: "b2b-metrics",
    title: { en: "Key Metrics for B2B Startups", ru: "Ключевые метрики B2B-стартапов" },
    videoUrl: "https://www.youtube.com/embed/_mKeVGSqQac",
    source: "en",
    module: { en: "Unit Economics", ru: "Юнит-экономика" },
    description: {
      en: "A breakdown of LTV, CAC, and churn rate for startups selling subscriptions to businesses.",
      ru: "Разбор метрик LTV, CAC и Churn Rate для стартапов, работающих по подписке с бизнесом.",
    },
    checklist: {
      en: [
        "Wrote down the churn rate formula",
        "Set a target LTV-to-CAC ratio",
        "Calculated the break-even point",
      ],
      ru: [
        "Выписал формулу расчета Churn Rate",
        "Определил целевое соотношение LTV к CAC",
        "Посчитал точку безубыточности",
      ],
    },
    takeaway: {
      en: "What churn rate would be critical for your business model?",
      ru: "Какой показатель оттока будет критичным для твоей бизнес-модели?",
    },
  },
  {
    id: "consumer-metrics",
    title: { en: "Metrics for Consumer Startups", ru: "Метрики потребительских стартапов" },
    videoUrl: "https://www.youtube.com/embed/fdD4y4Civp4",
    source: "en",
    module: { en: "Unit Economics", ru: "Юнит-экономика" },
    description: {
      en: "How to analyze everyday user behavior: cohort analysis, virality, and retention rate.",
      ru: "Как анализировать поведение обычных пользователей: когортный анализ, виральность и Retention Rate.",
    },
    checklist: {
      en: [
        "Built a cohort analysis grid in a spreadsheet",
        "Identified the key user action (the \"aha\" moment)",
        "Calculated organic growth",
      ],
      ru: [
        "Построил сетку когортного анализа в таблице",
        "Определил ключевое действие пользователя (Aha-момент)",
        "Рассчитал органический прирост",
      ],
    },
    takeaway: {
      en: "At what point does your user realize the real value of the product?",
      ru: "В какой момент твой пользователь понимает реальную ценность продукта?",
    },
  },
  {
    id: "enterprise-sales",
    title: { en: "Selling to Large Corporations", ru: "Продажи крупным корпорациям" },
    videoUrl: "https://www.youtube.com/embed/0fKYVl12VTA",
    source: "en",
    module: { en: "Sales", ru: "Продажи" },
    description: {
      en: "How the enterprise sales cycle works: finding the decision-maker and justifying a high LTV.",
      ru: "Как устроен цикл сделки в Enterprise-сегменте: поиск лица, принимающего решения, и обоснование высокого LTV.",
    },
    checklist: {
      en: [
        "Identified the decision-maker and buyer roles at the target company",
        "Prepared a product pitch for a large business",
        "Drafted the terms of a pilot project",
      ],
      ru: [
        "Определил роли ЛПР и закупщика в целевой компании",
        "Подготовил презентацию продукта для крупного бизнеса",
        "Сформулировал условия пилотного проекта",
      ],
    },
    takeaway: {
      en: "Who's the key decision-maker for buying your software at a large company?",
      ru: "Кто является главным лицом, принимающим решения о покупке твоего софта в крупной компании?",
    },
  },
  {
    id: "products-users-love",
    title: {
      en: "How to Build Products People Love",
      ru: "Как создавать продукты, которые обожают",
    },
    videoUrl: "https://www.youtube.com/embed/12D8zEdOPYo",
    source: "en",
    module: { en: "MVP & Product", ru: "MVP и Продукт" },
    description: {
      en: "Kevin Hale on design, usability, and onboarding — and how they drive retention and virality.",
      ru: "Kevin Hale о дизайне, юзабилити и онбординге — как эти факторы влияют на Retention Rate и виральность продукта.",
    },
    checklist: {
      en: [
        "Tested the product's onboarding on a friend",
        "Simplified the signup form to the bare minimum",
        "Set up a system for fast feedback",
      ],
      ru: [
        "Протестировал онбординг продукта на знакомом",
        "Упростил форму регистрации до минимума",
        "Настроил систему быстрой обратной связи",
      ],
    },
    takeaway: {
      en: "What detail in your interface could delight a first-time user?",
      ru: "Какая деталь твоего интерфейса может вызвать восторг у первого пользователя?",
    },
  },
  {
    id: "building-product",
    title: { en: "The Product Development Process", ru: "Процесс разработки продукта" },
    videoUrl: "https://www.youtube.com/embed/C27RVio2rOs",
    source: "en",
    module: { en: "MVP & Development", ru: "MVP и Разработка" },
    description: {
      en: "Michael Seibel on iterative development: why it matters to ship changes every day and gather feedback fast.",
      ru: "Michael Seibel об итеративной разработке: почему важно релизить изменения каждый день и быстро собирать фидбек.",
    },
    checklist: {
      en: [
        "Set up automatic deployment for the project",
        "Split one big feature into 3 small releases",
        "Defined success metrics for the new feature",
      ],
      ru: [
        "Настроил автоматический деплой проекта",
        "Разбил крупную фичу на 3 маленьких релиза",
        "Определил метрики успешности нового функционала",
      ],
    },
    takeaway: {
      en: "How often do you plan to ship updates to your users?",
      ru: "Как часто ты планируешь выкатывать обновления для своих пользователей?",
    },
  },
  {
    id: "start-dev-tools",
    title: {
      en: "Launching a Developer Tools Startup",
      ru: "Запуск стартапа в сфере DevTools",
    },
    videoUrl: "https://www.youtube.com/embed/z1aKRhRnVNk",
    source: "en",
    module: { en: "Niche", ru: "Ниша" },
    description: {
      en: "What's different about startups for developers: how to build trust in the open-source community without blowing up your CAC.",
      ru: "Особенности стартапов для разработчиков: как выстраивать доверие в open-source комьюнити без раздувания CAC.",
    },
    checklist: {
      en: [
        "Gauged whether developers would actually pay for your solution",
        "Analyzed the open-source alternatives",
        "Defined a distribution strategy for reaching developers",
      ],
      ru: [
        "Оценил готовность разработчиков платить за твое решение",
        "Проанализировал open-source альтернативы",
        "Определил стратегию дистрибуции среди девелоперов",
      ],
    },
    takeaway: {
      en: "Why would developers choose your tool over a free alternative?",
      ru: "Почему разработчики предпочтут твой инструмент бесплатному аналогу?",
    },
  },
  {
    id: "pitch-startup",
    title: { en: "The Art of Pitching to Investors", ru: "Искусство питча перед инвесторами" },
    videoUrl: "https://www.youtube.com/embed/17XZGUX_9iM",
    source: "en",
    module: { en: "Investment", ru: "Инвестиции" },
    description: {
      en: "Kevin Hale on the 10-slide pitch deck structure: how to communicate your solution's value and prove your CAC pays off.",
      ru: "Kevin Hale о структуре Pitch Deck из 10 слайдов: как донести ценность решения и доказать окупаемость CAC.",
    },
    checklist: {
      en: [
        "Built a problem slide and a solution slide",
        "Described current traction and the revenue growth chart",
        "Added a slide about the team's strengths",
      ],
      ru: [
        "Сформировал слайд с проблемой и слайд с решением",
        "Описал текущий traction и график роста выручки",
        "Добавил слайд про сильные стороны команды",
      ],
    },
    takeaway: {
      en: "What key number about your startup should an investor remember after the pitch?",
      ru: "Какую ключевую цифру твоего стартапа инвестор должен запомнить после питча?",
    },
  },
  {
    id: "spend-money",
    title: {
      en: "How to Spend a Startup's Budget Wisely",
      ru: "Как правильно расходовать бюджет стартапа",
    },
    videoUrl: "https://www.youtube.com/embed/IRROi-Q1V44",
    source: "en",
    module: { en: "Management", ru: "Управление" },
    description: {
      en: "Controlling burn rate and calculating runway — the budget-bloating mistakes startups make early on.",
      ru: "Контроль за Burn Rate и расчет Runway — ошибки раздувания бюджетов на ранней стадии стартапа.",
    },
    checklist: {
      en: [
        "Calculated the startup's monthly fixed costs",
        "Calculated the current runway in months",
        "Drafted a spending plan through the next funding round",
      ],
      ru: [
        "Посчитал ежемесячные фиксированные расходы стартапа",
        "Рассчитал текущий Runway в месяцах",
        "Составил план трат до следующего раунда",
      ],
    },
    takeaway: {
      en: "How many months would your current budget last with zero revenue?",
      ru: "На сколько месяцев работы хватит твоего текущего бюджета при нулевой выручке?",
    },
  },
  {
    id: "favorite-pivots",
    title: {
      en: "Pivot Stories from Successful Startups",
      ru: "Истории пивотов успешных стартапов",
    },
    videoUrl: "https://www.youtube.com/embed/DmehFuCMtvc",
    source: "en",
    module: { en: "Strategy", ru: "Стратегия" },
    description: {
      en: "Stories of big companies that pivoted and radically changed their product after their first hypothesis failed.",
      ru: "Истории крупных компаний, которые сделали Pivot и радикально поменяли продукт после провала первой гипотезы.",
    },
    checklist: {
      en: [
        "Analyzed which part of the product actually delivers value",
        "Identified the signals that suggest it's time to pivot",
        "Drafted an alternative growth hypothesis",
      ],
      ru: [
        "Проанализировал, какая часть продукта приносит ценность",
        "Определил маркеры, сигнализирующие о необходимости пивота",
        "Сформулировал альтернативную гипотезу развития",
      ],
    },
    takeaway: {
      en: "If your current idea doesn't work out, which direction would you pivot the product?",
      ru: "Если твоя текущая идея не сработает, в какую сторону ты развернешь продукт?",
    },
  },
  {
    id: "mom-test",
    title: {
      en: "How to Listen to Customers When Everyone's Lying to You",
      ru: "Как слушать клиентов, когда все вам врут",
    },
    videoUrl: "https://www.youtube.com/embed/0LwbFZkyRKk",
    source: "en",
    module: { en: "Customer Discovery", ru: "Кастдев" },
    description: {
      en: "Rob Fitzpatrick (author of The Mom Test) on why polite answers in customer discovery interviews are a trap for founders.",
      ru: "Rob Fitzpatrick (автор The Mom Test) о том, почему вежливые ответы в CustDev-интервью — это ловушка для фаундера.",
    },
    checklist: {
      en: [
        "Rewrote 3 \"do you like it\" questions into questions about the past",
        "Ran an interview without mentioning my idea until the end",
        "Separated compliments from real signals of interest",
      ],
      ru: [
        "Переформулировал 3 вопроса из «нравится ли вам» в вопросы о прошлом",
        "Провёл интервью и не упомянул свою идею до конца разговора",
        "Отделил комплименты от реальных сигналов интереса",
      ],
    },
    takeaway: {
      en: "What compliment from a customer did you almost mistake for validation?",
      ru: "Какой комплимент от клиента ты чуть не принял за подтверждение гипотезы?",
    },
  },

  // --- RU: русскоязычные эксперты ---
  {
    id: "niche-testing",
    title: {
      en: "How to Test a Niche for Your Startup",
      ru: "Как протестировать нишу для стартапа",
    },
    videoUrl: "https://www.youtube.com/embed/MxvcdjdrH7w",
    source: "ru",
    module: { en: "Finding an Idea", ru: "Поиск идеи" },
    description: {
      en: "How to tell a promising niche from a nice-sounding but unworkable hypothesis. A breakdown of criteria for quickly testing an idea before you start building.",
      ru: "Как отличить перспективную нишу от красивой, но нежизнеспособной гипотезы. Разбор критериев для быстрой проверки идеи до старта разработки.",
    },
    checklist: {
      en: [
        "Stated my niche hypothesis in one sentence",
        "Checked whether the niche has paying competitors",
        "Assessed whether the market is willing to pay for a solution",
      ],
      ru: [
        "Сформулировал гипотезу ниши в одном предложении",
        "Проверил, есть ли у ниши платящие конкуренты",
        "Оценил, готов ли рынок платить за решение",
      ],
    },
    takeaway: {
      en: "What niche are you testing, and what signs would tell you it works?",
      ru: "Какую нишу ты тестируешь и по каким признакам поймёшь, что она рабочая?",
    },
  },
  {
    id: "target-audience",
    title: {
      en: "How to Define Your Product's Target Audience",
      ru: "Как определить целевую аудиторию продукта",
    },
    videoUrl: "https://www.youtube.com/embed/teJE0yUXmNQ",
    source: "ru",
    module: { en: "Product", ru: "Продукт" },
    description: {
      en: "How to build a target-audience profile from data, not guesses. User segmentation and common mistakes when describing the \"ideal customer\".",
      ru: "Как собрать портрет целевой аудитории не из догадок, а из данных. Сегментация пользователей и типичные ошибки при описании «идеального клиента».",
    },
    checklist: {
      en: [
        "Described 2-3 segments of my audience",
        "Identified the segment with the sharpest pain point",
        "Defined how the segments differ in behavior",
      ],
      ru: [
        "Описал 2-3 сегмента своей аудитории",
        "Выделил сегмент с самой острой болью",
        "Сформулировал, чем сегменты отличаются в поведении",
      ],
    },
    takeaway: {
      en: "Which audience segment would bring you your first money the fastest?",
      ru: "Какой сегмент аудитории принесёт тебе первые деньги быстрее всего?",
    },
  },
  {
    id: "custdev-interviews",
    title: {
      en: "Customer Discovery: How to Run Problem Interviews",
      ru: "Кастдев: как проводить проблемные интервью",
    },
    videoUrl: "https://www.youtube.com/embed/8HOHOtJ4YiI",
    source: "ru",
    module: { en: "Customer Discovery", ru: "Кастдев" },
    description: {
      en: "A breakdown of the problem-interview structure: how to ask about past experience instead of a hypothetical future, without scaring off the respondent with leading questions.",
      ru: "Разбор структуры проблемного интервью: как задавать вопросы о прошлом опыте, а не о гипотетическом будущем, и не спугнуть респондента наводящими формулировками.",
    },
    checklist: {
      en: [
        "Wrote a list of questions with no leading wording",
        "Ran at least one interview and recorded it",
        "Identified a recurring pain point across several conversations",
      ],
      ru: [
        "Составил список вопросов без наводящих формулировок",
        "Провёл хотя бы одно интервью и записал его",
        "Выделил повторяющуюся боль из нескольких разговоров",
      ],
    },
    takeaway: {
      en: "What detail in the respondents' answers surprised you the most?",
      ru: "Какая деталь в ответах респондентов удивила тебя сильнее всего?",
    },
  },
  {
    id: "mvp-basics",
    title: { en: "What an MVP Is and Why You Need One", ru: "Что такое MVP и зачем он нужен" },
    videoUrl: "https://www.youtube.com/embed/-nRfKeokEsY",
    source: "ru",
    module: { en: "MVP & Development", ru: "MVP и Разработка" },
    description: {
      en: "The difference between an MVP, a prototype, and a full product. How no-code tools help you build a first version in days, not months.",
      ru: "Разница между MVP, прототипом и полноценным продуктом. Как No-Code инструменты помогают собрать первую версию продукта за дни, а не месяцы.",
    },
    checklist: {
      en: [
        "Picked one key hypothesis to test",
        "Chose a no-code tool for the first version",
        "Cut everything from the plan that doesn't test the hypothesis",
      ],
      ru: [
        "Выделил одну ключевую гипотезу для проверки",
        "Выбрал No-Code инструмент для первой версии",
        "Убрал из плана всё, что не проверяет гипотезу",
      ],
    },
    takeaway: {
      en: "What's the one hypothesis your MVP is testing?",
      ru: "Какую единственную гипотезу проверяет твой MVP?",
    },
  },
  {
    id: "co-founder-vesting",
    title: {
      en: "How to Find a Co-Founder and Agree on Vesting",
      ru: "Как найти сооснователя и договориться о вестинге",
    },
    videoUrl: "https://www.youtube.com/embed/-s1ZyqzL9bA",
    source: "ru",
    module: { en: "Team", ru: "Команда" },
    description: {
      en: "Where to find a partner who covers your weak spots, and why agreeing on equity vesting upfront protects both co-founders from conflict later.",
      ru: "Где искать партнёра, который закроет твои слабые стороны, и почему договорённость о вестинге долей на берегу защищает обоих сооснователей от конфликтов позже.",
    },
    checklist: {
      en: [
        "Wrote a profile of the skills missing from my team",
        "Learned the basic terms of equity vesting",
        "Discussed roles and responsibilities with a candidate",
      ],
      ru: [
        "Составил портрет недостающих компетенций в команде",
        "Изучил базовые условия вестинга долей",
        "Обсудил роли и зоны ответственности с кандидатом",
      ],
    },
    takeaway: {
      en: "Which role on your team are you most critically missing?",
      ru: "Какую роль в команде тебе критически не хватает закрыть?",
    },
  },
  {
    id: "unit-economics-cac-ltv",
    title: { en: "Startup Metrics: LTV and CAC", ru: "Метрики стартапа: LTV и CAC" },
    videoUrl: "https://www.youtube.com/embed/xkJd6EcZg0w",
    source: "ru",
    module: { en: "Unit Economics", ru: "Юнит-экономика" },
    description: {
      en: "How to calculate CAC — the cost of acquiring a customer — and compare it to LTV, the profit a customer brings over their whole time using the product.",
      ru: "Как посчитать CAC — стоимость привлечения клиента — и сравнить его с LTV, прибылью, которую клиент приносит за всё время использования продукта.",
    },
    checklist: {
      en: [
        "Calculated CAC for my acquisition channel",
        "Estimated the LTV of one customer",
        "Compared the LTV-to-CAC ratio",
      ],
      ru: [
        "Посчитал CAC для своего канала привлечения",
        "Оценил LTV одного клиента",
        "Сравнил соотношение LTV к CAC",
      ],
    },
    takeaway: {
      en: "What LTV-to-CAC ratio did you end up with?",
      ru: "Какое у тебя получилось соотношение LTV к CAC?",
    },
  },
  {
    id: "unit-economics-deep",
    title: { en: "Unit Economics in 45 Minutes", ru: "Юнит-экономика за 45 минут" },
    videoUrl: "https://www.youtube.com/embed/-RIyOrcPgcM",
    source: "ru",
    module: { en: "Unit Economics", ru: "Юнит-экономика" },
    description: {
      en: "A full breakdown of product metrics — MRR, ARPU, NPS — and how they connect. How these numbers add up to a single picture of business health.",
      ru: "Полный разбор метрик продукта: MRR, ARPU, NPS и их связь друг с другом. Как эти цифры складываются в единую картину здоровья бизнеса.",
    },
    checklist: {
      en: [
        "Wrote out the MRR and ARPU formulas for my product",
        "Calculated at least one metric with real numbers",
        "Identified which metric is currently the weakest",
      ],
      ru: [
        "Выписал формулы MRR и ARPU для своего продукта",
        "Посчитал хотя бы одну метрику на реальных цифрах",
        "Определил, какая метрика сейчас самая слабая",
      ],
    },
    takeaway: {
      en: "Which metric would best show your product's progress this month?",
      ru: "Какая метрика лучше всего покажет прогресс твоего продукта в этом месяце?",
    },
  },
  {
    id: "saas-model",
    title: {
      en: "Breaking Down a SaaS Startup's Financial Model",
      ru: "Разбор финансовой модели SaaS-стартапа",
    },
    videoUrl: "https://www.youtube.com/embed/aSioObzmfpw",
    source: "ru",
    module: { en: "Business Model", ru: "Бизнес-модель" },
    description: {
      en: "How a SaaS subscription model works from the inside: what determines a plan's price, how to calculate monthly revenue, and what to show an investor in the financial model.",
      ru: "Как устроена подписочная модель SaaS изнутри: от чего зависит цена тарифа, как считать выручку по месяцам и что показывать инвестору в финмодели.",
    },
    checklist: {
      en: [
        "Decided how many pricing tiers to start with",
        "Drafted a 6-month financial model",
        "Defined what's included in the free and paid tiers",
      ],
      ru: [
        "Выбрал количество тарифных планов для старта",
        "Составил черновик финмодели на 6 месяцев",
        "Определил, что входит в базовый и платный тариф",
      ],
    },
    takeaway: {
      en: "How many pricing tiers does your product have, and how do they differ?",
      ru: "Сколько тарифов у твоего продукта и чем они отличаются?",
    },
  },
  {
    id: "b2b-sales-mistakes",
    title: {
      en: "Mistakes and Strategies in B2B Sales",
      ru: "Ошибки и стратегии B2B-продаж",
    },
    videoUrl: "https://www.youtube.com/embed/C6zEWFS89j8",
    source: "ru",
    module: { en: "Sales", ru: "Продажи" },
    description: {
      en: "A podcast on selling IT solutions to corporations: the long deal cycle, finding the decision-maker, and the common mistakes on the way to a first B2B pilot.",
      ru: "Подкаст о том, как продавать IT-решения корпорациям: долгий цикл сделки, поиск лица, принимающего решение, и типичные ошибки на пути к первому B2B-пилоту.",
    },
    checklist: {
      en: [
        "Identified who at the company makes the purchase decision",
        "Drafted the terms for a pilot project",
        "Wrote down 3 common objections from corporate clients",
      ],
      ru: [
        "Определил, кто в компании принимает решение о покупке",
        "Составил условия пилотного проекта",
        "Выписал 3 частых возражения корпоративных клиентов",
      ],
    },
    takeaway: {
      en: "Which corporate client objection is hardest for you to overcome?",
      ru: "Какое возражение корпоративного клиента тебе сложнее всего закрыть?",
    },
  },
  {
    id: "b2b-sales-from-zero",
    title: {
      en: "How to Set Up B2B Sales from Scratch",
      ru: "Как организовать B2B-продажи с нуля",
    },
    videoUrl: "https://www.youtube.com/embed/f1M76bmwimc",
    source: "ru",
    module: { en: "Sales", ru: "Продажи" },
    description: {
      en: "A step-by-step guide to building a B2B sales process from zero: from the first cold contact to a steady deal pipeline.",
      ru: "Пошаговый разбор построения отдела продаж в B2B с нуля: от первого холодного контакта до регулярной воронки сделок.",
    },
    checklist: {
      en: [
        "Made a list of 20 potential B2B clients",
        "Wrote a template for the first email or message",
        "Planned the next step after the first contact",
      ],
      ru: [
        "Составил список из 20 потенциальных B2B-клиентов",
        "Написал шаблон первого письма или сообщения",
        "Спланировал следующий шаг после первого контакта",
      ],
    },
    takeaway: {
      en: "Who's first on your list of potential B2B clients, and why them?",
      ru: "Кто первый в твоём списке потенциальных B2B-клиентов и почему именно он?",
    },
  },
  {
    id: "retention-metric",
    title: {
      en: "Retention: Your Product's Most Important Metric",
      ru: "Retention: главная метрика продукта",
    },
    videoUrl: "https://www.youtube.com/embed/7LV6K95yG9s",
    source: "ru",
    module: { en: "Unit Economics", ru: "Юнит-экономика" },
    description: {
      en: "Why retention rate matters more than a one-time spike in installs. How to find the \"aha\" moment — the point after which a user sticks around long-term.",
      ru: "Почему Retention Rate важнее разового роста установок. Как найти Aha-момент — точку, после которой пользователь остаётся с продуктом надолго.",
    },
    checklist: {
      en: [
        "Built a simple weekly retention cohort",
        "Formed a hypothesis for my product's aha moment",
        "Checked how many users actually reach that point",
      ],
      ru: [
        "Построил простую когорту удержания за неделю",
        "Определил гипотезу своего Aha-момента",
        "Проверил, сколько пользователей доходят до этой точки",
      ],
    },
    takeaway: {
      en: "At what point does a user first get real value from the product?",
      ru: "В какой момент пользователь впервые получает реальную ценность от продукта?",
    },
  },
  {
    id: "churn-rate",
    title: { en: "How to Deal with Customer Churn", ru: "Как работать с оттоком клиентов" },
    videoUrl: "https://www.youtube.com/embed/cIHThudaI7I",
    source: "ru",
    module: { en: "Unit Economics", ru: "Юнит-экономика" },
    description: {
      en: "A breakdown of why customers churn and how to reduce it: from improving onboarding to proactive support before renewal.",
      ru: "Разбор причин оттока клиентов и способов его снижения: от улучшения онбординга до проактивной поддержки перед продлением подписки.",
    },
    checklist: {
      en: [
        "Calculated the current monthly churn rate",
        "Wrote down 3 likely reasons for churn",
        "Proposed one onboarding improvement",
      ],
      ru: [
        "Посчитал текущий Churn Rate за месяц",
        "Выписал 3 вероятные причины оттока",
        "Предложил одно улучшение онбординга",
      ],
    },
    takeaway: {
      en: "What's the single most common reason your customers churn right now?",
      ru: "Какая одна причина оттока клиентов у тебя сейчас самая частая?",
    },
  },
  {
    id: "pivot-strategy",
    title: { en: "How and When to Pivot a Startup", ru: "Как и когда делать пивот стартапа" },
    videoUrl: "https://www.youtube.com/embed/8j1C8LHYpMQ",
    source: "ru",
    module: { en: "Strategy", ru: "Стратегия" },
    description: {
      en: "Practical advice and case studies: what signals tell you it's time to pivot, and how to tell a temporary dip from a real product problem.",
      ru: "Практические советы и разбор кейсов: какие сигналы говорят, что пора делать Пивот, и как отличить временный спад от системной проблемы продукта.",
    },
    checklist: {
      en: [
        "Wrote down 3 signals that the current model isn't working",
        "Drafted one alternative hypothesis",
        "Set a deadline for deciding whether to pivot",
      ],
      ru: [
        "Выписал 3 сигнала, что текущая модель не работает",
        "Сформулировал одну альтернативную гипотезу",
        "Определил срок, в который примешь решение о пивоте",
      ],
    },
    takeaway: {
      en: "What signal would make you seriously consider a pivot?",
      ru: "Какой сигнал заставит тебя всерьёз рассмотреть пивот?",
    },
  },
  {
    id: "pitch-deck-slides",
    title: { en: "Pitch Deck: The 8 Key Slides", ru: "Pitch Deck: 8 главных слайдов" },
    videoUrl: "https://www.youtube.com/embed/8CQIaxJUCiA",
    source: "ru",
    module: { en: "Investment", ru: "Инвестиции" },
    description: {
      en: "A breakdown of real pitch decks from Airbnb, Uber, and Via.Delivery. Which 8 slides are essential, and in what order they win over an investor.",
      ru: "Разбор реальных питч-деков Airbnb, Uber и Via.Delivery. Какие 8 слайдов обязательны и в каком порядке они убеждают инвестора.",
    },
    checklist: {
      en: [
        "Built a problem slide and a solution slide",
        "Added a slide with current traction",
        "Cut everything beyond 10 slides from the deck",
      ],
      ru: [
        "Составил слайд с проблемой и слайд с решением",
        "Добавил слайд с текущим трекшном",
        "Убрал из презентации всё лишнее сверх 10 слайдов",
      ],
    },
    takeaway: {
      en: "Which slide in your deck is currently the weakest?",
      ru: "Какой слайд в твоей презентации сейчас самый слабый?",
    },
  },
  {
    id: "pitch-rules",
    title: {
      en: "Pitching and the Investor Deck: Presentation Rules",
      ru: "Питч и инвест-дек: правила презентации",
    },
    videoUrl: "https://www.youtube.com/embed/M9LprXSVtGM",
    source: "ru",
    module: { en: "Investment", ru: "Инвестиции" },
    description: {
      en: "The difference between a live pitch and a deck you send by email. How to adapt the same material for a live talk versus a cold email.",
      ru: "Разница между питчем на сцене и инвест-деком для рассылки. Как адаптировать один и тот же материал под живое выступление и под холодную отправку письмом.",
    },
    checklist: {
      en: [
        "Prepared a short 2-minute version of the pitch",
        "Put together a separate investor deck for emailing",
        "Tested the pitch on someone outside the industry",
      ],
      ru: [
        "Подготовил короткую версию питча на 2 минуты",
        "Собрал отдельный инвест-дек для рассылки",
        "Протестировал питч на человеке не из индустрии",
      ],
    },
    takeaway: {
      en: "Did an outsider understand the point of your project in 2 minutes?",
      ru: "Понял ли посторонний человек суть твоего проекта за 2 минуты?",
    },
  },
  {
    id: "product-market-fit",
    title: {
      en: "From Product-Market Fit to Scaling",
      ru: "От Product Market Fit до масштабирования",
    },
    videoUrl: "https://www.youtube.com/embed/MIqqjgIGx0c",
    source: "ru",
    module: { en: "Product", ru: "Продукт" },
    description: {
      en: "A step-by-step plan: how to tell your product has found product-market fit, and what to do to move from manual sales to scaling.",
      ru: "Пошаговый план от ФРИИ: как понять, что продукт нащупал Product-Market Fit, и какие шаги предпринять, чтобы перейти от ручных продаж к масштабированию.",
    },
    checklist: {
      en: [
        "Checked one of the signs of product-market fit",
        "Identified a channel for scaling",
        "Drafted a growth plan for the next quarter",
      ],
      ru: [
        "Проверил один из признаков наличия PMF у продукта",
        "Определил канал для масштабирования",
        "Составил план на ближайший квартал роста",
      ],
    },
    takeaway: {
      en: "What signs would tell you you've found product-market fit?",
      ru: "По каким признакам ты поймёшь, что нащупал Product-Market Fit?",
    },
  },
  {
    id: "first-sales",
    title: {
      en: "How to Sell and Land Your First Customers",
      ru: "Как продавать и получить первых клиентов",
    },
    videoUrl: "https://www.youtube.com/embed/xZUB7ZO455A",
    source: "ru",
    module: { en: "Sales", ru: "Продажи" },
    description: {
      en: "Why your first sales come from personal conversations, not ads. Practical tactics that help you close deals without a big marketing budget.",
      ru: "Почему первые продажи строятся на личных разговорах, а не на рекламе. Практические приёмы, которые помогают закрывать сделки без большого маркетингового бюджета.",
    },
    checklist: {
      en: [
        "Wrote a template for the first message to a customer",
        "Had 5 direct conversations with potential buyers",
        "Wrote down the main objection from those conversations",
      ],
      ru: [
        "Написал шаблон первого сообщения клиенту",
        "Провёл 5 прямых разговоров с потенциальными покупателями",
        "Зафиксировал главное возражение из разговоров",
      ],
    },
    takeaway: {
      en: "What objection do customers raise most often, and how would you respond to it?",
      ru: "Какое возражение клиенты называют чаще всего и как ты на него ответишь?",
    },
  },
  {
    id: "product-hypotheses",
    title: {
      en: "Product Hypotheses: Where to Find and Test Them",
      ru: "Продуктовые гипотезы: источники и проверка",
    },
    videoUrl: "https://www.youtube.com/embed/D1ie__sWT3s",
    source: "ru",
    module: { en: "Product", ru: "Продукт" },
    description: {
      en: "Where to find product hypotheses and how to test them fast, before spending your team's time building a full feature.",
      ru: "Где искать продуктовые гипотезы и как быстро их проверять до того, как тратить время команды на разработку полноценной фичи.",
    },
    checklist: {
      en: [
        "Gathered 5 sources for new hypotheses",
        "Framed one hypothesis in a measurable way",
        "Picked the cheapest way to test it",
      ],
      ru: [
        "Собрал 5 источников для новых гипотез",
        "Сформулировал одну гипотезу в измеримом виде",
        "Выбрал самый дешёвый способ её проверить",
      ],
    },
    takeaway: {
      en: "What hypothesis will you test this week, and how will you know it's confirmed?",
      ru: "Какую гипотезу ты проверишь на этой неделе и как поймёшь, что она подтвердилась?",
    },
  },
  {
    id: "growth-hacking",
    title: { en: "What Growth Hacking Is Made Of", ru: "Из чего состоит Growth Hacking" },
    videoUrl: "https://www.youtube.com/embed/oMVtxNvPBCs",
    source: "ru",
    module: { en: "Growth", ru: "Рост" },
    description: {
      en: "A breakdown of growth's building blocks: from fast experiments with acquisition channels to viral mechanics built into the product itself.",
      ru: "Разбор компонентов роста: от быстрых экспериментов с каналами привлечения до встроенных в продукт вирусных механик.",
    },
    checklist: {
      en: [
        "Picked one channel for a fast experiment",
        "Framed a growth hypothesis with an expected number",
        "Set a deadline for reviewing the experiment's results",
      ],
      ru: [
        "Выбрал один канал для быстрого эксперимента",
        "Сформулировал гипотезу роста с ожидаемой цифрой",
        "Запланировал срок подведения итогов эксперимента",
      ],
    },
    takeaway: {
      en: "What growth experiment would you run first, and why that one?",
      ru: "Какой growth-эксперимент ты запустишь первым и почему именно он?",
    },
  },
  {
    id: "burn-rate-runway",
    title: {
      en: "Runway and Burn Rate: How Fast Money Disappears",
      ru: "Runway и Burn Rate: как быстро сгорают деньги",
    },
    videoUrl: "https://www.youtube.com/embed/GJOrUvziqm8",
    source: "ru",
    module: { en: "Finance", ru: "Финансы" },
    description: {
      en: "How to calculate burn rate and runway, so you don't miss the moment your money runs out before the product breaks even.",
      ru: "Как считать Burn Rate и Runway, чтобы не проспать момент, когда деньги на счету заканчиваются раньше, чем продукт выходит на самоокупаемость.",
    },
    checklist: {
      en: [
        "Calculated the monthly burn rate",
        "Calculated the current runway in months",
        "Marked the date by which the money problem needs solving",
      ],
      ru: [
        "Посчитал ежемесячный Burn Rate",
        "Рассчитал текущий Runway в месяцах",
        "Отметил дату, к которой нужно решить вопрос с деньгами",
      ],
    },
    takeaway: {
      en: "How many months of runway do you have left at the current burn rate?",
      ru: "Сколько месяцев Runway у тебя осталось при текущем Burn Rate?",
    },
  },
];

export const GLOSSARY: GlossaryTerm[] = [
  {
    id: "MVP",
    name: { en: "MVP", ru: "MVP" },
    definition: {
      en: "Minimum Viable Product — a stripped-down version of a product built just to test a hypothesis.",
      ru: "Минимально жизнеспособный продукт — урезанная версия продукта для проверки гипотезы.",
    },
    example: {
      en: "A coffee cart instead of opening a huge café — that's the MVP of a coffee business.",
      ru: "Стойка с кофе вместо открытия огромной кофейни — это MVP кофейного бизнеса.",
    },
  },
  {
    id: "LTV",
    name: { en: "LTV", ru: "LTV" },
    definition: {
      en: "Lifetime Value — all the profit a customer brings in over their entire time using the product.",
      ru: "Пожизненная ценность клиента — вся прибыль, которую он приносит за время использования продукта.",
    },
    example: {
      en: "A customer pays $10/month and stays for a year — LTV = $120.",
      ru: "Клиент платит 10$/мес и остаётся на год — LTV = 120$.",
    },
  },
  {
    id: "CAC",
    name: { en: "CAC", ru: "CAC" },
    definition: {
      en: "The cost of acquiring one customer through ads or sales.",
      ru: "Стоимость привлечения одного клиента через рекламу или продажи.",
    },
    example: {
      en: "You spend $1,000 on ads and get 10 customers — CAC = $100.",
      ru: "Потратили 1000$ на рекламу, получили 10 клиентов — CAC = 100$.",
    },
  },
  {
    id: "BURN_RATE",
    name: { en: "Burn Rate", ru: "Burn Rate" },
    definition: {
      en: "The speed at which a startup spends money from its account each month.",
      ru: "Скорость, с которой стартап тратит деньги со счёта каждый месяц.",
    },
    example: {
      en: "Spending $6,000/month with zero revenue — Burn Rate = $6,000.",
      ru: "Расходы 500 000 руб/мес при нулевой выручке — Burn Rate = 500 000 руб.",
    },
  },
  {
    id: "CHURN_RATE",
    name: { en: "Churn Rate", ru: "Churn Rate" },
    definition: {
      en: "The share of customers who stopped using the product over a given period.",
      ru: "Доля клиентов, которые перестали пользоваться продуктом за период.",
    },
    example: {
      en: "You had 200 subscribers and lost 10 in a month — Churn Rate = 5%.",
      ru: "Было 200 подписчиков, ушло 10 за месяц — Churn Rate = 5%.",
    },
  },
  {
    id: "RUNWAY",
    name: { en: "Runway", ru: "Runway" },
    definition: {
      en: "How many months a business can survive on its current money at the current burn rate.",
      ru: "Сколько месяцев бизнес проживёт на текущие деньги при текущем Burn Rate.",
    },
    example: {
      en: "You have $7,000 in the bank and spend $1,000/month — Runway = 7 months.",
      ru: "На счету 600 000 руб, тратите 100 000 руб в месяц — Runway = 6 месяцев.",
    },
  },
  {
    id: "TAM",
    name: { en: "TAM", ru: "TAM" },
    definition: {
      en: "Total Addressable Market — the total size of the market if a product captured 100% of demand.",
      ru: "Total Addressable Market — общий объём рынка, если бы продукт занял 100% спроса.",
    },
    example: {
      en: "The food delivery market in a country is valued at $600 million — that's the TAM.",
      ru: "Рынок доставки еды в стране оценивается в 50 млрд руб — это TAM.",
    },
  },
  {
    id: "SAM",
    name: { en: "SAM", ru: "SAM" },
    definition: {
      en: "Serviceable Available Market — the part of the TAM your business model can realistically serve.",
      ru: "Serviceable Available Market — часть TAM, которую реально может обслужить твоя бизнес-модель.",
    },
    example: {
      en: "Out of the whole food delivery market, your SAM is just the big cities your logistics can reach.",
      ru: "Из всего рынка доставки еды твой SAM — это только крупные города с твоей логистикой.",
    },
  },
  {
    id: "SOM",
    name: { en: "SOM", ru: "SOM" },
    definition: {
      en: "Serviceable Obtainable Market — the realistic market share you can capture in 1–3 years.",
      ru: "Serviceable Obtainable Market — реалистичная доля рынка, которую можно занять за 1-3 года.",
    },
    example: {
      en: "With your current resources, your SOM is 2% of the SAM in the first year.",
      ru: "При текущих ресурсах твой SOM — это 2% от SAM в первый год.",
    },
  },
  {
    id: "COHORT_ANALYSIS",
    name: { en: "Cohort Analysis", ru: "Когортный анализ" },
    definition: {
      en: "A method for tracking the behavior of groups of users who joined during the same period.",
      ru: "Метод отслеживания поведения групп пользователей, пришедших в один и тот же период.",
    },
    example: {
      en: "Cohort analysis showed that users from the November cohort pay for longer than those from January.",
      ru: "Когортный анализ показал, что пользователи из ноябрьской когорты платят дольше, чем из январской.",
    },
  },
  {
    id: "UNIT_ECONOMICS",
    name: { en: "Unit Economics", ru: "Юнит-экономика" },
    definition: {
      en: "A way of calculating the profitability of a single unit of product or a single customer.",
      ru: "Метод расчёта прибыльности одной единицы товара или одного клиента.",
    },
    example: {
      en: "If one subscription leaves $4 in profit after all costs — that's healthy unit economics.",
      ru: "Если с одной подписки остаётся 300 руб прибыли после всех расходов — это здоровая юнит-экономика.",
    },
  },
  {
    id: "MRR",
    name: { en: "MRR", ru: "MRR" },
    definition: {
      en: "Monthly Recurring Revenue — the predictable monthly revenue from subscriptions.",
      ru: "Monthly Recurring Revenue — ежемесячная периодическая выручка от подписок.",
    },
    example: {
      en: "100 customers pay $10/month — MRR = $1,000.",
      ru: "100 клиентов платят по 1000 руб в месяц — MRR = 100 000 руб.",
    },
  },
  {
    id: "ARR",
    name: { en: "ARR", ru: "ARR" },
    definition: {
      en: "Annual Recurring Revenue — yearly recurring revenue, usually MRR × 12.",
      ru: "Annual Recurring Revenue — годовая периодическая выручка, обычно MRR × 12.",
    },
    example: {
      en: "With MRR of $1,000, annual ARR comes out to $12,000.",
      ru: "При MRR в 100 000 руб годовой ARR составит 1 200 000 руб.",
    },
  },
  {
    id: "ARPU",
    name: { en: "ARPU", ru: "ARPU" },
    definition: {
      en: "Average Revenue Per User — the average revenue from one user over a period.",
      ru: "Average Revenue Per User — средняя выручка с одного пользователя за период.",
    },
    example: {
      en: "Revenue of $5,000 with 1,000 active users — ARPU = $5.",
      ru: "Выручка 500 000 руб при 1000 активных пользователей — ARPU = 500 руб.",
    },
  },
  {
    id: "NPS",
    name: { en: "NPS", ru: "NPS" },
    definition: {
      en: "Net Promoter Score — an index of how willing customers are to recommend a product to others.",
      ru: "Net Promoter Score — индекс готовности клиентов рекомендовать продукт другим.",
    },
    example: {
      en: "An NPS above 50 is considered an excellent customer loyalty score.",
      ru: "NPS выше 50 считается отличным показателем лояльности клиентов.",
    },
  },
  {
    id: "RETENTION_RATE",
    name: { en: "Retention Rate", ru: "Retention Rate" },
    definition: {
      en: "The share of users who keep using a product over time.",
      ru: "Доля пользователей, которые продолжают пользоваться продуктом спустя время.",
    },
    example: {
      en: "A 40% Day-30 Retention Rate is considered a good score for a mobile app.",
      ru: "Retention Rate 40% на 30-й день считается хорошим показателем для мобильного приложения.",
    },
  },
  {
    id: "PMF",
    name: { en: "Product-Market Fit", ru: "Product-Market Fit" },
    definition: {
      en: "The state where a product truly solves a market problem and demand grows organically.",
      ru: "Состояние, когда продукт по-настоящему решает проблему рынка и спрос растёт органически.",
    },
    example: {
      en: "Product-Market Fit hit once customers started recommending the service to friends on their own.",
      ru: "Product-Market Fit наступил, когда клиенты сами начали рекомендовать сервис друзьям.",
    },
  },
  {
    id: "PIVOT",
    name: { en: "Pivot", ru: "Пивот" },
    definition: {
      en: "A sharp change in a startup's direction or business model.",
      ru: "Резкое изменение курса или бизнес-модели стартапа.",
    },
    example: {
      en: "A food delivery service for offices didn't take off — the team pivoted into home meal delivery.",
      ru: "Сервис доставки еды для офисов не взлетел — команда сделала пивот в доставку обедов на дом.",
    },
  },
  {
    id: "CUSTDEV",
    name: { en: "CustDev", ru: "CustDev" },
    definition: {
      en: "Customer Development — a methodology for testing hypotheses through interviews with real customers.",
      ru: "Customer Development — методология проверки гипотез через интервью с реальными клиентами.",
    },
    example: {
      en: "CustDev showed that users were willing to pay for automation, not analytics.",
      ru: "CustDev показал, что пользователи готовы платить за автоматизацию, а не за аналитику.",
    },
  },
  {
    id: "VESTING",
    name: { en: "Vesting", ru: "Вестинг" },
    definition: {
      en: "Gradually earning the rights to a company stake over an agreed period.",
      ru: "Постепенное получение прав на долю в компании в течение оговорённого срока.",
    },
    example: {
      en: "A 4-year vesting schedule with a 1-year cliff means a co-founder only gets their first shares after a year.",
      ru: "Вестинг на 4 года с cliff в 1 год означает, что первую долю сооснователь получит только через год.",
    },
  },
  {
    id: "CAP_TABLE",
    name: { en: "Cap Table", ru: "Cap Table" },
    definition: {
      en: "Capitalization table — a document showing who owns how much of the company.",
      ru: "Таблица капитализации — документ, показывающий, кому и сколько принадлежит в компании.",
    },
    example: {
      en: "The Cap Table lists both co-founders' shares and an option pool for future employees.",
      ru: "В Cap Table внесли доли обоих сооснователей и опционный пул для будущих сотрудников.",
    },
  },
  {
    id: "TERM_SHEET",
    name: { en: "Term Sheet", ru: "Term Sheet" },
    definition: {
      en: "A document with the key terms of an investment deal, before the final agreement is signed.",
      ru: "Документ с основными условиями инвестиционной сделки до подписания финального договора.",
    },
    example: {
      en: "The investor sent a Term Sheet valuing the company at $2 million.",
      ru: "Инвестор прислал Term Sheet с оценкой компании в 2 млн долларов.",
    },
  },
  {
    id: "SEED_ROUND",
    name: { en: "Seed Round", ru: "Посевной раунд" },
    definition: {
      en: "The first institutional funding round, used to test a hypothesis and hire the first team.",
      ru: "Первый институциональный раунд инвестиций для проверки гипотезы и найма первой команды.",
    },
    example: {
      en: "In the seed round, the startup raised $150,000 to build the MVP.",
      ru: "На посевном раунде стартап привлёк 150 000 долларов на разработку MVP.",
    },
  },
  {
    id: "SERIES_A",
    name: { en: "Series A", ru: "Раунд A" },
    definition: {
      en: "The first major funding round after confirmed product-market fit.",
      ru: "Первый крупный раунд инвестиций после подтверждённого Product-Market Fit.",
    },
    example: {
      en: "After tripling revenue in a year, the startup closed a $5 million Series A.",
      ru: "После роста выручки в 3 раза за год стартап закрыл Раунд A на 5 млн долларов.",
    },
  },
  {
    id: "BOOTSTRAPPING",
    name: { en: "Bootstrapping", ru: "Бутстрэппинг" },
    definition: {
      en: "Growing a business on your own money or revenue, with no outside investment.",
      ru: "Развитие бизнеса на собственные средства или выручку, без внешних инвестиций.",
    },
    example: {
      en: "The team bootstrapped for two years until the product started turning a profit on its own.",
      ru: "Команда работала по бутстрэппингу два года, пока продукт не начал приносить прибыль сам.",
    },
  },
  {
    id: "BREAKEVEN",
    name: { en: "Break-Even Point", ru: "Точка безубыточности" },
    definition: {
      en: "The sales volume at which revenue equals costs, with no profit yet.",
      ru: "Объём продаж, при котором доходы сравнялись с расходами, а прибыли ещё нет.",
    },
    example: {
      en: "Rent and salaries cost $2,000/month, margin per coffee is $2 — Break-Even Point is 1,000 cups.",
      ru: "Аренда и зарплаты стоят 100 000 руб в месяц, маржа с чашки кофе — 100 руб. Точка безубыточности — 1000 чашек.",
    },
  },
  {
    id: "GROSS_MARGIN",
    name: { en: "Gross Margin", ru: "Валовая маржа" },
    definition: {
      en: "The share of revenue left after subtracting the direct cost of producing a product or service.",
      ru: "Доля выручки, остающаяся после вычета прямых затрат на производство продукта или услуги.",
    },
    example: {
      en: "A product sells for $20, costs $6 to make — gross margin is 70%.",
      ru: "Продукт продаётся за 1000 руб, себестоимость — 300 руб, валовая маржа — 70%.",
    },
  },
  {
    id: "NET_MARGIN",
    name: { en: "Net Margin", ru: "Чистая маржа" },
    definition: {
      en: "The share of revenue left as profit after subtracting all of a business's expenses.",
      ru: "Доля выручки, остающаяся как прибыль после вычета всех расходов бизнеса.",
    },
    example: {
      en: "With $1 million in revenue and $100,000 in net profit, net margin is 10%.",
      ru: "При выручке 1 млн руб и чистой прибыли 100 000 руб чистая маржа равна 10%.",
    },
  },
  {
    id: "B2B",
    name: { en: "B2B", ru: "B2B" },
    definition: {
      en: "Business-to-Business — a sales model where the customer is another company.",
      ru: "Business-to-Business — модель продаж, где клиент — другая компания.",
    },
    example: {
      en: "A CRM system for sales teams is a classic B2B product.",
      ru: "CRM-система для отделов продаж — классический пример B2B-продукта.",
    },
  },
  {
    id: "B2C",
    name: { en: "B2C", ru: "B2C" },
    definition: {
      en: "Business-to-Consumer — a sales model where the customer is the end user.",
      ru: "Business-to-Consumer — модель продаж, где клиент — конечный потребитель.",
    },
    example: {
      en: "A food delivery app for individual users runs on a B2C model.",
      ru: "Приложение для доставки еды частным пользователям работает по модели B2C.",
    },
  },
  {
    id: "SAAS",
    name: { en: "SaaS", ru: "SaaS" },
    definition: {
      en: "Software as a Service — a model for selling software by subscription through the cloud.",
      ru: "Software as a Service — модель продажи софта по подписке через облако.",
    },
    example: {
      en: "A finance-tracking service you access by subscription in your browser is a typical SaaS.",
      ru: "Сервис для учёта финансов, доступный по подписке в браузере, — типичный SaaS.",
    },
  },
  {
    id: "CTR",
    name: { en: "CTR", ru: "CTR" },
    definition: {
      en: "Click-Through Rate — the share of people who saw an ad and clicked on it.",
      ru: "Click-Through Rate — доля увидевших рекламу, которые кликнули по ней.",
    },
    example: {
      en: "An ad was shown 1,000 times, 20 people clicked — CTR = 2%.",
      ru: "Объявление показали 1000 раз, кликнули 20 человек — CTR = 2%.",
    },
  },
  {
    id: "CPA",
    name: { en: "CPA", ru: "CPA" },
    definition: {
      en: "Cost Per Acquisition — the cost of one target action (a lead, a purchase) from an ad.",
      ru: "Cost Per Acquisition — стоимость одного целевого действия (заявки, покупки) от рекламы.",
    },
    example: {
      en: "You spend $50 on ads and get 25 leads — CPA = $2.",
      ru: "Потратили 5000 руб на рекламу, получили 25 заявок — CPA = 200 руб.",
    },
  },
  {
    id: "CPC",
    name: { en: "CPC", ru: "CPC" },
    definition: {
      en: "Cost Per Click — the cost of one click on an ad.",
      ru: "Cost Per Click — стоимость одного клика по рекламному объявлению.",
    },
    example: {
      en: "A $100 budget brought 500 clicks — CPC = $0.20.",
      ru: "Бюджет 10 000 руб принёс 500 кликов — CPC = 20 руб.",
    },
  },
  {
    id: "CPM",
    name: { en: "CPM", ru: "CPM" },
    definition: {
      en: "Cost Per Mille — the cost of 1,000 ad impressions.",
      ru: "Cost Per Mille — стоимость 1000 показов рекламного объявления.",
    },
    example: {
      en: "An ad with a $3 CPM for 10,000 impressions costs $30.",
      ru: "Реклама с CPM в 300 руб за 10 000 показов обойдётся в 3000 руб.",
    },
  },
  {
    id: "CONVERSION_RATE",
    name: { en: "Conversion Rate", ru: "Конверсия" },
    definition: {
      en: "The share of visitors who completed a target action, out of all visitors.",
      ru: "Доля пользователей, совершивших целевое действие, от всех посетителей.",
    },
    example: {
      en: "Out of 1,000 landing page visitors, 30 left a lead — conversion rate is 3%.",
      ru: "Из 1000 посетителей лендинга 30 оставили заявку — конверсия 3%.",
    },
  },
  {
    id: "FUNNEL",
    name: { en: "Sales Funnel", ru: "Воронка продаж" },
    definition: {
      en: "The sequence of steps a customer goes through from first contact to purchase.",
      ru: "Последовательность этапов, которые проходит клиент от первого контакта до покупки.",
    },
    example: {
      en: "Sales funnel: visited the site → left an email → got a demo → paid for a subscription.",
      ru: "Воронка продаж: посетил сайт → оставил email → получил демо → оплатил подписку.",
    },
  },
  {
    id: "ONBOARDING",
    name: { en: "Onboarding", ru: "Онбординг" },
    definition: {
      en: "The process of a user's first encounter with a product, guiding them to its first value.",
      ru: "Процесс первого знакомства пользователя с продуктом, ведущий его к первой ценности.",
    },
    example: {
      en: "Good onboarding gets a new user to the \"aha\" moment within the first 5 minutes.",
      ru: "Хороший онбординг доводит нового пользователя до Aha-момента за первые 5 минут.",
    },
  },
  {
    id: "AHA_MOMENT",
    name: { en: "Aha Moment", ru: "Aha-момент" },
    definition: {
      en: "The moment a user first feels the real value of a product.",
      ru: "Момент, в который пользователь впервые ощущает реальную ценность продукта.",
    },
    example: {
      en: "In a messaging app, the aha moment happens when a user sends their first message to a friend.",
      ru: "В мессенджере Aha-момент наступает, когда пользователь отправляет первое сообщение другу.",
    },
  },
  {
    id: "TRACTION",
    name: { en: "Traction", ru: "Тракшн" },
    definition: {
      en: "Measurable proof of growth: sales, repeat purchases, growing demand.",
      ru: "Измеримое доказательство роста: продажи, повторные покупки, растущий спрос.",
    },
    example: {
      en: "50 paying customers and 20% month-over-month growth — that's traction that convinces an investor.",
      ru: "50 платящих клиентов и рост на 20% в месяц — это тракшн, который убеждает инвестора.",
    },
  },
  {
    id: "PITCH_DECK",
    name: { en: "Pitch Deck", ru: "Питч-дек" },
    definition: {
      en: "A short project presentation for an investor, usually 10–12 slides.",
      ru: "Короткая презентация проекта для инвестора, обычно из 10-12 слайдов.",
    },
    example: {
      en: "In the pitch deck, the founder showed slides on the problem, the solution, the market, and the team.",
      ru: "В питч-деке фаундер показал слайды с проблемой, решением, рынком и командой.",
    },
  },
  {
    id: "ELEVATOR_PITCH",
    name: { en: "Elevator Pitch", ru: "Питч в лифте" },
    definition: {
      en: "The shortest possible presentation of a project's idea, in one or two sentences.",
      ru: "Максимально короткая, в одну-две фразы, презентация идеи проекта.",
    },
    example: {
      en: "Elevator pitch: \"We're Uber for delivering medicine in 30 minutes.\"",
      ru: "Питч в лифте: «Мы — Uber для доставки лекарств за 30 минут».",
    },
  },
  {
    id: "DUE_DILIGENCE",
    name: { en: "Due Diligence", ru: "Дью-дилидженс" },
    definition: {
      en: "An investor's review of a company before a deal: finances, legal risks, metrics.",
      ru: "Проверка компании инвестором перед сделкой: финансы, юридические риски, метрики.",
    },
    example: {
      en: "Before signing the Term Sheet, the investor requested documents for due diligence.",
      ru: "Перед подписанием Term Sheet инвестор запросил документы для дью-дилидженс.",
    },
  },
  {
    id: "EQUITY",
    name: { en: "Equity", ru: "Доля в компании" },
    definition: {
      en: "The part of a company owned by a specific person or investor.",
      ru: "Часть компании, принадлежащая конкретному человеку или инвестору.",
    },
    example: {
      en: "The co-founders split the company's equity evenly — 50% each.",
      ru: "Сооснователи разделили доли в компании поровну — по 50% каждому.",
    },
  },
  {
    id: "DILUTION",
    name: { en: "Dilution", ru: "Размытие доли" },
    definition: {
      en: "A decrease in ownership percentage after new investors come in.",
      ru: "Уменьшение процента владения компанией после привлечения новых инвесторов.",
    },
    example: {
      en: "After the Series A, the founder's equity was diluted from 60% to 45%.",
      ru: "После раунда A доля основателя размылась с 60% до 45%.",
    },
  },
  {
    id: "ANGEL_INVESTOR",
    name: { en: "Angel Investor", ru: "Бизнес-ангел" },
    definition: {
      en: "A private investor who puts their own money into early-stage startups.",
      ru: "Частный инвестор, вкладывающий личные деньги в стартапы на ранней стадии.",
    },
    example: {
      en: "An angel investor put in $20,000 in exchange for 5% of the company at the seed round.",
      ru: "Бизнес-ангел вложил 20 000 долларов в обмен на 5% компании на посевном раунде.",
    },
  },
  {
    id: "VENTURE_CAPITAL",
    name: { en: "Venture Capital", ru: "Венчурный капитал" },
    definition: {
      en: "Fund investments into companies with high growth potential and high risk.",
      ru: "Инвестиции фондов в компании с высоким потенциалом роста и риска.",
    },
    example: {
      en: "A venture capital fund invested in 20 startups, expecting only 2–3 of them to pay off.",
      ru: "Фонд венчурного капитала инвестировал в 20 стартапов, ожидая, что окупятся 2-3 из них.",
    },
  },
  {
    id: "ACCELERATOR",
    name: { en: "Accelerator", ru: "Акселератор" },
    definition: {
      en: "A startup support program with mentorship, training, and often small investments.",
      ru: "Программа поддержки стартапов с менторством, обучением и часто небольшими инвестициями.",
    },
    example: {
      en: "The startup went through a three-month accelerator program and got access to a network of investors.",
      ru: "Стартап прошёл трёхмесячную программу акселератора и получил доступ к сети инвесторов.",
    },
  },
  {
    id: "INCUBATOR",
    name: { en: "Incubator", ru: "Инкубатор" },
    definition: {
      en: "An organization that helps launch a startup from scratch: office space, mentorship, sometimes funding.",
      ru: "Организация, помогающая запустить стартап с нуля: офис, менторство, иногда финансирование.",
    },
    example: {
      en: "A university incubator gave the student team a workspace and their first mentors.",
      ru: "Инкубатор при университете предоставил студенческой команде рабочее место и первых менторов.",
    },
  },
  {
    id: "EXIT",
    name: { en: "Exit", ru: "Экзит" },
    definition: {
      en: "Selling a company or an investor cashing out of their stake — through an M&A or an IPO.",
      ru: "Продажа компании или выход инвестора из капитала — через M&A или IPO.",
    },
    example: {
      en: "The investor got their exit when the startup was acquired by a large corporation five years later.",
      ru: "Инвестор получил экзит, когда стартап был куплен крупной корпорацией через 5 лет.",
    },
  },
];

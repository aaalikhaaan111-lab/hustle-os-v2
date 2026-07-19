import type { Localized } from "@/i18n/content";

export interface QuizOption {
  text: Localized;
  isCorrect: boolean;
}

export type QuestDifficulty = "bronze" | "silver" | "gold" | "boss";

export type DifficultyLabelKey =
  | "difficultyBronze"
  | "difficultySilver"
  | "difficultyGold"
  | "difficultyBoss";

export const DIFFICULTY_META: Record<
  QuestDifficulty,
  { labelKey: DifficultyLabelKey; className: string }
> = {
  bronze: {
    labelKey: "difficultyBronze",
    className: "bg-orange-50 text-orange-700 ring-orange-100",
  },
  silver: {
    labelKey: "difficultySilver",
    className: "bg-zinc-100 text-zinc-700 ring-zinc-200",
  },
  gold: {
    labelKey: "difficultyGold",
    className: "bg-amber-50 text-amber-700 ring-amber-200",
  },
  boss: {
    labelKey: "difficultyBoss",
    className: "bg-red-50 text-red-700 ring-red-200",
  },
};

export const DIFFICULTY_ORDER: QuestDifficulty[] = ["bronze", "silver", "gold", "boss"];

export interface ChallengeDef {
  id: string;
  categoryId: string;
  difficulty: QuestDifficulty;
  emoji: string;
  questTitle: Localized;
  description: Localized;
  scenario: Localized;
  insight: Localized;
  quizQuestion: Localized;
  quizOptions: QuizOption[];
  correctAnswerHint: Localized;
  actionPrompt: Localized;
  markers: Localized<string[]>;
  xp: number;
}

export const CHALLENGE_CATALOG: ChallengeDef[] = [
  // ─── Entrepreneurship ───
  {
    id: "quest-custdev-pains",
    categoryId: "entrepreneurship",
    difficulty: "bronze",
    emoji: "🎯",
    questTitle: { en: "Quest: First Cry Into the Void", ru: "Квест: Первый крик в пустоту" },
    description: {
      en: "Find one real, live person and pull 3 genuine pain points out of them.",
      ru: "Найди одного живого человека и вытащи из него 3 настоящие боли.",
    },
    scenario: {
      en: "You're a solo founder with zero lines of code and zero customers. You have 24 hours to talk to at least one real person and get the truth out of them, not a polite \"sounds interesting.\"",
      ru: "Ты — соло-основатель без единой строчки кода и без единого клиента. У тебя есть 24 часа, чтобы поговорить хотя бы с одним живым человеком и вытащить из него правду, а не вежливое «звучит интересно».",
    },
    insight: {
      en: "Most startups don't die because the idea is bad — they die because nobody actually asked real people if it hurts in the first place. Customer discovery isn't a box-ticking survey, it's a hunt for the phrase \"man, I wish this already existed.\" One honest conversation is worth more than a hundred hypotheses stuck in your head.",
      ru: "Большинство стартапов умирают не потому, что идея плохая, а потому что никто не спросил у реальных людей, болит ли у них вообще. CustDev — это не опрос для галочки, это охота за фразой «блин, вот бы это уже существовало». Один честный разговор стоит больше сотни гипотез в голове.",
    },
    quizQuestion: {
      en: "What's the main goal of a first customer discovery interview?",
      ru: "Какая главная цель первого CustDev-интервью?",
    },
    quizOptions: [
      { text: { en: "Sell the product right now", ru: "Продать продукт прямо сейчас" }, isCorrect: false },
      { text: { en: "Find the customer's real pain points", ru: "Найти реальные боли клиента" }, isCorrect: true },
      { text: { en: "Find out their bank balance", ru: "Узнать баланс его карты" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Customer discovery isn't about selling or prying into money — it's about listening and finding real pain.",
      ru: "Задача CustDev — не продавать и не выведывать деньги, а слушать и находить настоящую боль.",
    },
    actionPrompt: {
      en: "Describe 3 pain points you heard from the person you talked to.",
      ru: "Опиши 3 боли, которые ты услышал от человека, с которым поговорил.",
    },
    markers: {
      en: ["customer", "problem", "pain", "interview", "why"],
      ru: ["клиент", "проблема", "боль", "интервью", "почему"],
    },
    xp: 100,
  },
  {
    id: "quest-smoke-test-offer",
    categoryId: "entrepreneurship",
    difficulty: "bronze",
    emoji: "💥",
    questTitle: { en: "Quest: An Offer That Lands", ru: "Квест: Оффер, который стреляет" },
    description: {
      en: "Put your product's value into one sentence that hooks people from the first words.",
      ru: "Сформулируй ценность продукта в одном предложении, которое цепляет с первых слов.",
    },
    scenario: {
      en: "An investor gives you exactly one elevator ride and 20 seconds. If they don't get your product's value from the first sentence, the doors close and the deal rides off with them.",
      ru: "Инвестор дал тебе ровно один лифт и 20 секунд. Если он не поймёт ценность твоего продукта с первой фразы — двери закроются, и сделка уедет вместе с ним.",
    },
    insight: {
      en: "If you can't explain why your product matters in 10 seconds, nobody's buying it in 10 minutes either. A smoke test is a way to check your offer before you spend months building. Compress the value down to one sentence that hits the pain point dead-on.",
      ru: "Если ты не можешь объяснить, зачем нужен твой продукт, за 10 секунд — его не купят и за 10 минут. Smoke test — способ проверить оффер до того, как ты потратишь месяцы на разработку. Сожми ценность до одной фразы, которая бьёт точно в боль.",
    },
    quizQuestion: { en: "Why run a smoke test on an offer?", ru: "Зачем нужен smoke test оффера?" },
    quizOptions: [
      { text: { en: "To start building right away", ru: "Чтобы сразу начать разработку" }, isCorrect: false },
      {
        text: { en: "To validate the value before spending months building", ru: "Чтобы проверить ценность до траты месяцев на разработку" },
        isCorrect: true,
      },
      { text: { en: "To check tomorrow's weather", ru: "Чтобы узнать погоду на завтра" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "A smoke test is a fast, cheap way to validate an idea before you've built anything at all.",
      ru: "Smoke test — это способ проверить идею быстро и дёшево, ещё до того, как ты начал что-то строить.",
    },
    actionPrompt: {
      en: "Write your offer in one sentence: what you're selling and why anyone should care.",
      ru: "Напиши свой оффер в одном предложении: что ты продаёшь и почему это должно волновать.",
    },
    markers: {
      en: ["product", "value", "customer", "price", "why"],
      ru: ["продукт", "ценность", "клиент", "цена", "почему"],
    },
    xp: 100,
  },
  {
    id: "quest-competitor-recon",
    categoryId: "entrepreneurship",
    difficulty: "silver",
    emoji: "🕵️",
    questTitle: { en: "Quest: The Competitor's Blind Spot", ru: "Квест: Слепая зона конкурента" },
    description: {
      en: "Find 2 weak spots in your niche's market leader.",
      ru: "Найди 2 слабых места у лидера рынка в своей нише.",
    },
    scenario: {
      en: "You're working as a market's secret agent. Mission: get inside the customer experience of the industry leader and find a crack in their armor before anyone else does.",
      ru: "Ты работаешь тайным агентом рынка. Задание: проникнуть в опыт клиента лидера отрасли и найти дыру в его броне раньше, чем это сделают другие.",
    },
    insight: {
      en: "Market leaders aren't perfect — they just claimed the territory first. Every giant has cracks: slow support, an outdated interface, an audience they're ignoring. Your job isn't to admire the competitor, it's to find their weak spot.",
      ru: "Лидеры рынка не идеальны — они просто первыми заняли территорию. У каждого гиганта есть трещины: медленная поддержка, устаревший интерфейс, аудитория, которую они игнорируют. Твоя задача не восхищаться конкурентом, а найти его слабое место.",
    },
    quizQuestion: {
      en: "What should you be looking for in the market leader in this quest?",
      ru: "Что нужно искать у лидера рынка в этом квесте?",
    },
    quizOptions: [
      { text: { en: "Their weak spots", ru: "Его слабые места" }, isCorrect: true },
      { text: { en: "A list of their employees", ru: "Список его сотрудников" }, isCorrect: false },
      { text: { en: "Their favorite color", ru: "Его любимый цвет" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Look specifically for cracks and weak spots in the competitor — that's where your opportunity is hiding.",
      ru: "Ищи именно трещины и слабые места конкурента — там прячется твой шанс.",
    },
    actionPrompt: {
      en: "Name the competitor and describe 2 weak spots you found.",
      ru: "Назови конкурента и опиши 2 его слабых места, которые ты нашёл.",
    },
    markers: {
      en: ["competitor", "weakness", "customer", "market", "review"],
      ru: ["конкурент", "слабость", "клиент", "рынок", "отзыв"],
    },
    xp: 150,
  },
  {
    id: "quest-cyber-cafe-2040",
    categoryId: "entrepreneurship",
    difficulty: "silver",
    emoji: "☕",
    questTitle: { en: "Quest: The Cyber Café of 2040", ru: "Квест: Кибер-Кофейня в 2040 году" },
    description: {
      en: "Save the shop from bankruptcy by rolling out 2 wild offers for Gen Z.",
      ru: "Спаси точку от банкротства, внедрив 2 безумных оффера для зумеров.",
    },
    scenario: {
      en: "It's 2040. Your coffee shop is on the edge of closing — Gen Z drinks coffee at home through neuro-capsules, and they see physical cafés as a vintage relic. You have 48 hours to come up with 2 wild offers that pull them back into the real world.",
      ru: "2040 год. Твоя кофейня на грани закрытия — зумеры пьют кофе дома через нейро-капсулы, а живые кофейни считают винтажным анахронизмом. У тебя есть 48 часов, чтобы придумать 2 безумных оффера, которые вернут их в реальный мир.",
    },
    insight: {
      en: "An offer saves a business not when it's logical, but when it hits the audience's cultural code. Gen Z isn't buying coffee — they're buying an experience, status, and a reason to post a story. A good offer in 2040 sounds bold, almost absurd, and that's exactly why it works.",
      ru: "Оффер спасает бизнес не тогда, когда он логичный, а когда он попадает в культурный код аудитории. Зумеры не покупают кофе — они покупают опыт, статус и повод для сторис. Хороший оффер в 2040 году звучит дерзко, почти абсурдно, и именно поэтому работает.",
    },
    quizQuestion: {
      en: "What happens to your margin if you cut the price of coffee while costs stay the same?",
      ru: "Что случится с маржинальностью, если ты снизишь цену на кофе, а расходы останутся прежними?",
    },
    quizOptions: [
      { text: { en: "The margin grows", ru: "Маржа вырастет" }, isCorrect: false },
      { text: { en: "The margin drops", ru: "Маржа упадёт" }, isCorrect: true },
      { text: { en: "The margin stays the same", ru: "Маржа не изменится" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Margin is the gap between price and costs. If the price drops and costs stay the same, the margin drops.",
      ru: "Маржа — это разница между ценой и расходами. Если цена падает, а расходы те же — маржа падает.",
    },
    actionPrompt: {
      en: "Describe 2 wild offers for Gen Z that would bring them back into your café.",
      ru: "Опиши 2 безумных оффера для зумеров, которые вернут их в твою кофейню.",
    },
    markers: {
      en: ["offer", "margin", "gen z", "price", "subscription"],
      ru: ["оффер", "маржа", "зумер", "цена", "подписка"],
    },
    xp: 150,
  },
  {
    id: "quest-mvp-broke",
    categoryId: "entrepreneurship",
    difficulty: "gold",
    emoji: "⚡",
    questTitle: { en: "Quest: An MVP on Your Last Dollar", ru: "Квест: MVP на последние деньги" },
    description: {
      en: "Describe how to launch a product with no code — today, with no budget.",
      ru: "Опиши, как запустить продукт без кода — уже сегодня, без бюджета.",
    },
    scenario: {
      en: "You have 15 minutes left and not a single dollar for development. In 15 minutes an investor is going to ask one question: \"Where's the product?\" — and your answer decides whether you get a second shot.",
      ru: "У тебя осталось 15 минут и ни рубля на разработку. Через 15 минут инвестор задаст один вопрос: «Где продукт?» — и от твоего ответа зависит, получишь ли ты второй шанс.",
    },
    insight: {
      en: "An MVP isn't a mini-version of your product — it's the fastest way to check if anyone needs it at all. A Google Form, a spreadsheet, or a chat in a messaging app can sometimes work better than six months of development. Forget the code — think about the speed of testing the hypothesis.",
      ru: "MVP — это не мини-версия продукта, это самый быстрый способ проверить, нужен ли он вообще. Google Форма, таблица и чат в мессенджере иногда работают лучше, чем полгода разработки. Забудь про код — думай про скорость проверки гипотезы.",
    },
    quizQuestion: { en: "What is an MVP, really?", ru: "Что такое MVP на самом деле?" },
    quizOptions: [
      { text: { en: "The perfect final version of the product", ru: "Идеальная финальная версия продукта" }, isCorrect: false },
      {
        text: { en: "The fastest way to check if the product is even needed", ru: "Самый быстрый способ проверить, нужен ли продукт" },
        isCorrect: true,
      },
      { text: { en: "The name of a sports award", ru: "Название спортивного приза" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "An MVP isn't about being perfect — it's about testing a hypothesis fast, without code.",
      ru: "MVP — это не про идеальность, а про скорость проверки гипотезы без кода.",
    },
    actionPrompt: {
      en: "Describe, step by step, how you'd launch your MVP with zero lines of code and zero budget.",
      ru: "Опиши шаг за шагом, как бы ты запустил свой MVP без единой строчки кода и без бюджета.",
    },
    markers: {
      en: ["mvp", "launch", "no code", "test", "hypothesis"],
      ru: ["mvp", "запуск", "без кода", "тест", "гипотеза"],
    },
    xp: 200,
  },
  {
    id: "quest-mammoth-hunt",
    categoryId: "entrepreneurship",
    difficulty: "boss",
    emoji: "🦣",
    questTitle: { en: "Quest: Hunting the Market's Mammoths", ru: "Квест: Охота на Мамонтов рынка" },
    description: {
      en: "Find a giant's critical weakness and propose a feature that steals 1% of its customers.",
      ru: "Найди критическую уязвимость гиганта и предложи фичу, которая отожмёт у него 1% клиентов.",
    },
    scenario: {
      en: "You're declaring war on a market giant — pick any leader you like. You have no budget, no team, no reach — just a sharp mind and the ability to find cracks where everyone else sees a monolith.",
      ru: "Ты объявляешь войну гиганту рынка — Додо Пицце, Самокату, любому лидеру, которого выберешь. У тебя нет бюджета, нет команды, нет медийности — только острый ум и умение находить трещины там, где другие видят монолит.",
    },
    insight: {
      en: "Even the biggest players in the market have blind spots: an audience segment they neglect, a process that annoys users, or a promise they don't fully deliver on. Unicorns aren't built by attacking a leader head-on — they're built by striking precisely at its weakest point.",
      ru: "Даже у самых крупных игроков рынка есть слепые зоны: сегмент аудитории, которым они пренебрегают, процесс, который бесит пользователей, или обещание, которое они не выполняют до конца. Единорогов не создают лобовой атакой на лидера — их создают точечным ударом в его самое слабое место.",
    },
    quizQuestion: {
      en: "How can a small player take market share from a giant?",
      ru: "Как небольшой игрок может отжать долю у рыночного гиганта?",
    },
    quizOptions: [
      { text: { en: "Copy the giant's product exactly", ru: "Скопировать продукт гиганта один в один" }, isCorrect: false },
      {
        text: { en: "Strike precisely at a weak spot the giant is ignoring", ru: "Ударить точечно в его слабое место, которое он игнорирует" },
        isCorrect: true,
      },
      { text: { en: "Cut the price to zero", ru: "Снизить цену до нуля" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "A head-on attack on a giant almost always loses. A precise strike at a specific weakness wins.",
      ru: "Лобовая атака на гиганта почти всегда проигрышна. Побеждает точечный удар в конкретную слабость.",
    },
    actionPrompt: {
      en: "Name the market giant, describe its critical weakness, and the feature that would steal 1% of its customers.",
      ru: "Назови гиганта рынка, опиши его критическую уязвимость и фичу, которая отожмёт у него 1% клиентов.",
    },
    markers: {
      en: ["weakness", "business model", "feature", "customer", "market share"],
      ru: ["уязвимость", "бизнес-модель", "фича", "клиент", "доля"],
    },
    xp: 300,
  },

  // ─── Personal finance ───
  {
    id: "quest-subscription-audit",
    categoryId: "personal-finance",
    difficulty: "bronze",
    emoji: "💰",
    questTitle: { en: "Quest: The Budget Leak", ru: "Квест: Утечка в бюджете" },
    description: {
      en: "Make a list of every active subscription and decide which ones you can drop today.",
      ru: "Собери список всех активных подписок и реши, от каких можно отказаться уже сегодня.",
    },
    scenario: {
      en: "Your bank balance is slowly melting away and you can't tell where the money's going. You have one evening to find the leak before it becomes a hole.",
      ru: "Твой банковский счёт медленно тает, а ты не можешь понять, куда уходят деньги. У тебя есть один вечер, чтобы найти течь до того, как она станет пробоиной.",
    },
    insight: {
      en: "Subscriptions are the quiet leeches of your budget: a few dollars here, a few there, and suddenly you're bleeding real money on services you haven't touched in months. One honest audit every quarter saves more than skipping your coffee ever will.",
      ru: "Подписки — это тихие пиявки твоего бюджета: 300 тут, 500 там, и вот уже тысячи утекают за сервисы, которыми ты не пользовался месяцами. Один честный аудит раз в квартал экономит больше, чем любая экономия на кофе.",
    },
    quizQuestion: { en: "Why audit your subscriptions?", ru: "Зачем делать аудит подписок?" },
    quizOptions: [
      {
        text: { en: "To find unnecessary charges and save money", ru: "Чтобы найти лишние списания и сэкономить" },
        isCorrect: true,
      },
      { text: { en: "To sign up for even more subscriptions", ru: "Чтобы оформить ещё больше подписок" }, isCorrect: false },
      { text: { en: "To change your email password", ru: "Чтобы поменять пароль от почты" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "The goal of the audit is to find subscriptions you haven't used in a while and cancel them.",
      ru: "Цель аудита — найти подписки, которыми ты давно не пользуешься, и отказаться от них.",
    },
    actionPrompt: {
      en: "List your subscriptions and write down which one you're ready to cancel right now.",
      ru: "Перечисли свои подписки и напиши, от какой ты готов отказаться прямо сейчас.",
    },
    markers: {
      en: ["subscription", "charge", "budget", "cancel", "money"],
      ru: ["подписка", "списание", "бюджет", "отказ", "деньги"],
    },
    xp: 100,
  },
  {
    id: "quest-hidden-expenses",
    categoryId: "personal-finance",
    difficulty: "bronze",
    emoji: "📉",
    questTitle: { en: "Quest: The Invisible Thief", ru: "Квест: Невидимый вор" },
    description: {
      en: "Look through last week's spending and find one expense that surprised you.",
      ru: "Просмотри траты за последнюю неделю и найди одну статью расходов, которая тебя удивила.",
    },
    scenario: {
      en: "Someone's been quietly picking your pocket a few dollars at a time — and that someone is actually you, you just haven't noticed. You have your transaction history and half an hour to catch the thief.",
      ru: "Кто-то методично обчищает твой кошелёк по 200-300 рублей за раз — и этот кто-то на самом деле ты сам, просто не замечаешь этого. У тебя есть история операций и полчаса, чтобы поймать вора.",
    },
    insight: {
      en: "Money doesn't just vanish — it leaks out in small, forgettable chunks you stop thinking about five minutes later. Individually it's nothing, but by the end of the month it's a whole line item. Awareness starts with just looking at the numbers.",
      ru: "Деньги не пропадают — они утекают маленькими незаметными траншами, о которых ты забываешь через пять минут. По отдельности мелочь, а по итогу месяца целая статья бюджета. Осознанность начинается с того, чтобы просто увидеть цифры.",
    },
    quizQuestion: { en: "What are we hunting for in this quest?", ru: "Что мы ищем в этом квесте?" },
    quizOptions: [
      { text: { en: "The biggest purchase of the month", ru: "Самую крупную покупку месяца" }, isCorrect: false },
      {
        text: { en: "A small, unnoticed expense that surprised you", ru: "Незаметную трату, которая удивила" },
        isCorrect: true,
      },
      { text: { en: "Today's exchange rate", ru: "Курс доллара на сегодня" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Look specifically for the small, invisible expenses — they're the ones quietly eating your budget.",
      ru: "Ищи именно мелкие, незаметные траты — они незаметно съедают бюджет.",
    },
    actionPrompt: {
      en: "Which expense from last week surprised you the most, and why?",
      ru: "Какая трата за последнюю неделю удивила тебя больше всего и почему?",
    },
    markers: {
      en: ["expense", "spending", "surprised", "week", "money"],
      ru: ["трата", "расход", "удивил", "неделя", "деньги"],
    },
    xp: 100,
  },
  {
    id: "quest-impulse-freeze",
    categoryId: "personal-finance",
    difficulty: "silver",
    emoji: "🧊",
    questTitle: { en: "Quest: 24 Hours Without an Impulse", ru: "Квест: 24 часа без импульса" },
    description: {
      en: "Don't buy anything off-list for 24 hours, and write down what you wanted to buy.",
      ru: "Не покупай ничего не по списку 24 часа и запиши, что хотелось купить.",
    },
    scenario: {
      en: "You just got shown the perfect ad at 11:47pm. Your finger is hovering over the \"Buy\" button. Hold out 24 hours without a single unplanned purchase — or lose to your own brain.",
      ru: "Тебе только что показали идеальную рекламу в 23:47. Палец завис над кнопкой «Купить». Продержись 24 часа без единой незапланированной покупки — или проиграешь собственному мозгу.",
    },
    insight: {
      en: "Most impulse purchases stop making sense within a day — your brain is chasing the dopamine hit of clicking \"Buy,\" not the thing itself. The 24-hour rule helps separate a real want from a split-second impulse.",
      ru: "Большинство импульсивных покупок теряют смысл уже через сутки — мозг просто ловит дофамин от кнопки «Купить», а не от самой вещи. Правило 24 часов помогает отделить настоящее желание от секундного импульса.",
    },
    quizQuestion: { en: "What's the point of the 24-hour rule?", ru: "В чём смысл правила 24 часов?" },
    quizOptions: [
      {
        text: { en: "Separate a real want from a split-second impulse", ru: "Отделить настоящее желание от секундного импульса" },
        isCorrect: true,
      },
      { text: { en: "Save money for exactly one day", ru: "Копить деньги ровно сутки" }, isCorrect: false },
      { text: { en: "Wait for a 24% discount", ru: "Ждать скидку 24%" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "The 24-hour rule helps you figure out whether you actually need the thing, or it was just an impulse.",
      ru: "Правило 24 часов помогает понять, действительно ли вещь нужна, или это был просто импульс.",
    },
    actionPrompt: {
      en: "What did you want to buy on impulse in the last 24 hours? Describe whether you still want it now.",
      ru: "Что тебе захотелось купить импульсивно за последние сутки? Опиши, актуально ли это желание сейчас.",
    },
    markers: {
      en: ["impulse", "purchase", "want", "24 hours", "decision"],
      ru: ["импульс", "покупка", "желание", "сутки", "решение"],
    },
    xp: 150,
  },
  {
    id: "quest-first-10k",
    categoryId: "personal-finance",
    difficulty: "silver",
    emoji: "🏁",
    questTitle: { en: "Quest: The First Milestone — $500", ru: "Квест: Первый рубеж — 10 000" },
    description: {
      en: "Write a concrete plan for saving your first $500 in a month.",
      ru: "Распиши конкретный план, как отложить первые 10 000 за месяц.",
    },
    scenario: {
      en: "You've set your first genuinely concrete financial goal: $500 in a month. Vague dreams about getting rich don't work here — you need a plan that survives contact with an actual calendar.",
      ru: "Ты поставил себе первую по-настоящему конкретную финансовую цель — 10 000 за месяц. Абстрактные мечты о богатстве здесь не работают: нужен план, который выдержит проверку календарём.",
    },
    insight: {
      en: "A vague \"I want to save\" never works — a specific number with a specific deadline does. $500 in a month is about $17 a day, and that's not scary anymore, it's doable.",
      ru: "Абстрактное «хочу копить» никогда не работает — работает конкретная цифра с конкретным сроком. 10 000 за месяц — это примерно 333 в день, а это уже не страшно, а решаемо.",
    },
    quizQuestion: {
      en: "Why does it matter to break a big financial goal into small steps?",
      ru: "Почему важно разбивать большую финансовую цель на маленькие шаги?",
    },
    quizOptions: [
      {
        text: { en: "So the goal stops being scary and becomes achievable", ru: "Чтобы цель не пугала и стала выполнимой" },
        isCorrect: true,
      },
      { text: { en: "To make it harder to reach", ru: "Чтобы было сложнее её достичь" }, isCorrect: false },
      { text: { en: "To pay more in taxes", ru: "Чтобы платить больше налогов" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Small daily steps make a big goal real instead of a scary abstraction.",
      ru: "Маленькие ежедневные шаги делают большую цель реальной, а не пугающей абстракцией.",
    },
    actionPrompt: {
      en: "Describe your plan: where will that $500 come from, and what will you stop buying to get there?",
      ru: "Опиши свой план: откуда возьмутся эти 10 000 и что ты перестанешь покупать ради этого.",
    },
    markers: {
      en: ["plan", "goal", "income", "expense", "month"],
      ru: ["план", "цель", "доход", "расход", "месяц"],
    },
    xp: 150,
  },
  {
    id: "quest-financial-twin",
    categoryId: "personal-finance",
    difficulty: "gold",
    emoji: "🪞",
    questTitle: { en: "Quest: Your Financial Twin", ru: "Квест: Финансовый двойник" },
    description: {
      en: "Write out a full monthly budget — income, expenses, and a plan for the unexpected.",
      ru: "Распиши полный бюджет месяца — доходы, расходы и план на непредвиденное.",
    },
    scenario: {
      en: "Imagine you have a financial twin who has to survive exactly one month on your current income, without going into debt or panicking. Your job is to write them a detailed survival guide.",
      ru: "Представь, что у тебя появился финансовый двойник, который должен прожить ровно месяц на твой текущий доход, не влезая в долги и не срываясь в панике. Твоя задача — написать ему подробную инструкцию по выживанию.",
    },
    insight: {
      en: "Most budgets don't fail because of a lack of money — they fail because of a lack of structure: people know their income but not where it's supposed to go. Breaking it into categories turns vague anxiety into a manageable plan.",
      ru: "Большинство бюджетов рушатся не из-за нехватки денег, а из-за отсутствия структуры: люди знают доход, но не знают, куда именно он должен идти. Разбивка на категории превращает абстрактную тревогу в управляемый план.",
    },
    quizQuestion: {
      en: "What should go into a monthly budget first?",
      ru: "Что в первую очередь должно попасть в бюджет месяца?",
    },
    quizOptions: [
      {
        text: { en: "Essential expenses and an emergency cushion", ru: "Обязательные расходы и подушка на форс-мажор" },
        isCorrect: true,
      },
      { text: { en: "Just entertainment", ru: "Только развлечения" }, isCorrect: false },
      { text: { en: "Nothing in advance — figure it out as you go", ru: "Ничего заранее — разберёмся по ходу" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Cover essential expenses and your safety cushion first — everything else comes out of what's left.",
      ru: "Сначала закрывай обязательные расходы и подушку безопасности — остальное распределяется из остатка.",
    },
    actionPrompt: {
      en: "Write out a monthly budget for your financial twin: income, essential expenses, an emergency cushion.",
      ru: "Распиши бюджет месяца для своего финансового двойника: доходы, обязательные расходы, подушка на форс-мажор.",
    },
    markers: {
      en: ["income", "expense", "budget", "month", "plan"],
      ru: ["доход", "расход", "бюджет", "месяц", "план"],
    },
    xp: 200,
  },
  {
    id: "quest-retire-at-35",
    categoryId: "personal-finance",
    difficulty: "boss",
    emoji: "🏝️",
    questTitle: { en: "Quest: Retiring at 35", ru: "Квест: Пенсия в 35" },
    description: {
      en: "Prove you have a real plan for early financial independence, not just a dream.",
      ru: "Докажи, что у тебя есть реальный план ранней финансовой независимости, а не просто мечта.",
    },
    scenario: {
      en: "You've told everyone you're retiring at 35. Financial advisors think you're crazy, your parents are worried. The only way to silence the skeptics is to show real numbers, not an enthusiastic speech.",
      ru: "Ты объявил всем, что уйдёшь на пенсию в 35 лет. Финансовые консультанты крутят у виска, родители переживают. Единственный способ заткнуть скептиков — показать реальные цифры, а не воодушевлённый монолог.",
    },
    insight: {
      en: "Early financial independence isn't built on one brilliant idea — it's built on boring, predictable math: your savings rate, investment returns, and time in the market. The more concrete your plan, the less it looks like fantasy.",
      ru: "Ранняя финансовая независимость строится не на одной гениальной идее, а на скучной, предсказуемой математике: норма сбережений, доходность инвестиций и время в рынке. Чем конкретнее твой план — тем меньше он похож на фантазию.",
    },
    quizQuestion: {
      en: "What matters most for whether you can actually retire early?",
      ru: "Что сильнее всего определяет, получится ли выйти на раннюю пенсию?",
    },
    quizOptions: [
      { text: { en: "One lucky investment", ru: "Одна удачная инвестиция" }, isCorrect: false },
      {
        text: { en: "A consistently high savings rate over time", ru: "Стабильно высокая норма сбережений на дистанции" },
        isCorrect: true,
      },
      { text: { en: "Luck on the stock market", ru: "Везение на бирже" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Early financial independence is almost always built on saving discipline, not one lucky bet.",
      ru: "Ранняя финансовая независимость почти всегда строится на дисциплине сбережений, а не на одной удачной ставке.",
    },
    actionPrompt: {
      en: "Describe your plan: how much you'll save each month, where you'll invest it, and how many years until it pays off.",
      ru: "Опиши свой план: сколько будешь откладывать в месяц, куда инвестировать и через сколько лет это даст результат.",
    },
    markers: {
      en: ["investment", "savings", "income", "risk", "plan"],
      ru: ["инвестиции", "накопления", "доход", "риск", "план"],
    },
    xp: 300,
  },

  // ─── Economics ───
  {
    id: "quest-economy-news",
    categoryId: "economics",
    difficulty: "bronze",
    emoji: "📈",
    questTitle: { en: "Quest: Decoding the News", ru: "Квест: Расшифровка новостей" },
    description: {
      en: "Find a recent economics news story and explain it in your own words in three sentences.",
      ru: "Найди свежую новость об экономике и объясни её своими словами в трёх предложениях.",
    },
    scenario: {
      en: "Economics news is written like the writers want nobody to understand it. Your mission: take one such story and decode it for someone who knows nothing about the topic.",
      ru: "Экономические новости пишут так, будто хотят, чтобы их никто не понял. Твоя миссия — взять одну такую новость и расшифровать её для человека, который вообще не разбирается в теме.",
    },
    insight: {
      en: "Economics news is deliberately written in complicated language to seem more important than it is. If you can explain a story to a ten-year-old, you actually understood it — not just skimmed the headline.",
      ru: "Экономические новости специально написаны сложным языком, чтобы казаться важнее, чем они есть. Если ты можешь объяснить новость десятилетнему — значит, ты реально её понял, а не просто прочитал заголовок.",
    },
    quizQuestion: {
      en: "How do you know you actually understood a news story?",
      ru: "Как понять, что ты реально разобрался в новости?",
    },
    quizOptions: [
      { text: { en: "You could retell it using complicated terms", ru: "Смог пересказать её сложными терминами" }, isCorrect: false },
      { text: { en: "You could explain it in simple words", ru: "Смог объяснить её простыми словами" }, isCorrect: true },
      { text: { en: "You memorized the publish date", ru: "Запомнил дату публикации" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "If you can explain the story in simple words, you actually understood it.",
      ru: "Если можешь объяснить новость простыми словами — значит, действительно понял её.",
    },
    actionPrompt: {
      en: "Retell the story in your own words in 3 sentences — simple enough for anyone with no economics background to get it.",
      ru: "Перескажи новость своими словами в 3 предложениях — так, чтобы понял любой человек без экономического образования.",
    },
    markers: {
      en: ["news", "economy", "reason", "impact", "simple"],
      ru: ["новость", "экономика", "причина", "влияние", "простыми"],
    },
    xp: 100,
  },
  {
    id: "quest-business-model-battle",
    categoryId: "economics",
    difficulty: "bronze",
    emoji: "🌍",
    questTitle: { en: "Quest: Battle of the Business Models", ru: "Квест: Битва бизнес-моделей" },
    description: {
      en: "Take two companies from the same niche and compare exactly how they make money.",
      ru: "Возьми две компании из одной ниши и сравни, как именно они зарабатывают деньги.",
    },
    scenario: {
      en: "Two companies sell almost the same thing — but one makes money on subscriptions, the other on ads. Figure out whose model is actually more solid.",
      ru: "Две компании продают почти одно и то же — но одна зарабатывает на подписке, другая на рекламе. Разберись, чья модель на самом деле прочнее.",
    },
    insight: {
      en: "Two companies can sell the exact same thing and make money in completely different ways: one on subscriptions, another on ads, a third on transaction fees. Find the difference, and you'll understand where the money actually comes from.",
      ru: "Две компании могут продавать одно и то же и при этом зарабатывать деньги совершенно по-разному: одна на подписке, другая на рекламе, третья на комиссии с транзакций. Найди отличие — и поймёшь, откуда на самом деле идут деньги.",
    },
    quizQuestion: {
      en: "What are we actually comparing in this quest?",
      ru: "Что мы на самом деле сравниваем в этом квесте?",
    },
    quizOptions: [
      { text: { en: "The companies' logos", ru: "Логотипы компаний" }, isCorrect: false },
      { text: { en: "How the companies make money", ru: "Как компании зарабатывают деньги" }, isCorrect: true },
      { text: { en: "Their headcount", ru: "Количество сотрудников" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Look specifically at the money source — subscription, ads, fees — not the company's surface-level details.",
      ru: "Смотри именно на источник денег: подписка, реклама, комиссия — а не на внешние атрибуты компании.",
    },
    actionPrompt: {
      en: "Name two companies and describe the difference in how each one makes money.",
      ru: "Назови две компании и опиши разницу в том, как каждая из них зарабатывает.",
    },
    markers: {
      en: ["model", "revenue", "subscription", "ads", "commission"],
      ru: ["модель", "доход", "подписка", "реклама", "комиссия"],
    },
    xp: 100,
  },
  {
    id: "quest-price-detective",
    categoryId: "economics",
    difficulty: "silver",
    emoji: "🏷️",
    questTitle: { en: "Quest: Price Detective", ru: "Квест: Ценовой детектив" },
    description: {
      en: "Find a product that got more expensive over the past year, and figure out why.",
      ru: "Найди товар, который подорожал за последний год, и разберись почему.",
    },
    scenario: {
      en: "The price of something you know well has gone up, and it's not a coincidence. Your job as a detective is to find the real reason, not settle for \"everything's getting more expensive.\"",
      ru: "Цена одного знакомого тебе товара выросла — и это не случайность. Твоя задача детектива — найти настоящую причину, а не отделаться фразой «всё дорожает».",
    },
    insight: {
      en: "Prices don't rise for no reason — behind every price hike is a story: inflation, shortage, demand, exchange rates, or someone's greed. Figuring out the cause means starting to see economics as a logical chain of events around you.",
      ru: "Цены не растут просто так — за каждым подорожанием стоит история: инфляция, дефицит, спрос, курс валюты или чья-то жадность. Разобраться в причине — значит начать видеть экономику как логичную цепочку событий вокруг тебя.",
    },
    quizQuestion: {
      en: "What's the most important thing to find in this quest?",
      ru: "Что важнее всего найти в этом квесте?",
    },
    quizOptions: [
      { text: { en: "The reason behind the price increase", ru: "Причину подорожания товара" }, isCorrect: true },
      { text: { en: "The store with the lowest price", ru: "Магазин с самой низкой ценой" }, isCorrect: false },
      { text: { en: "The product's barcode", ru: "Штрихкод товара" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Look specifically for the reason behind the price increase — inflation, shortage, demand, or exchange rates.",
      ru: "Ищи именно причину роста цены — инфляцию, дефицит, спрос или курс валюты.",
    },
    actionPrompt: {
      en: "What product got more expensive right in front of you over the past year, and what do you think caused it?",
      ru: "Какой товар подорожал у тебя на глазах за последний год и в чём, по-твоему, причина?",
    },
    markers: {
      en: ["price", "more expensive", "reason", "inflation", "demand"],
      ru: ["цена", "подорожал", "причина", "инфляция", "спрос"],
    },
    xp: 150,
  },
  {
    id: "quest-supply-demand",
    categoryId: "economics",
    difficulty: "silver",
    emoji: "🔁",
    questTitle: { en: "Quest: The Demand That Decides Everything", ru: "Квест: Спрос, который решает всё" },
    description: {
      en: "Find a real example from your own life where supply and demand played out.",
      ru: "Найди реальный пример из своей жизни, где сработал закон спроса и предложения.",
    },
    scenario: {
      en: "The law of supply and demand played out in your life this week — you just didn't notice. Find that moment and break it down.",
      ru: "Закон спроса и предложения работал в твоей жизни на этой неделе — ты просто не заметил. Найди этот момент и разложи его по полочкам.",
    },
    insight: {
      en: "Supply and demand isn't a boring formula from a textbook — it's a thing playing out around you every day: from surge taxi prices in the rain to sold-out concert tickets.",
      ru: "Закон спроса и предложения — не скучная формула из учебника, а штука, которая работает вокруг тебя каждый день: от цен на такси в дождь до распроданных билетов на концерт.",
    },
    quizQuestion: {
      en: "Where does the law of supply and demand usually show up?",
      ru: "Где чаще всего работает закон спроса и предложения?",
    },
    quizOptions: [
      { text: { en: "Only in economics textbooks", ru: "Только в учебниках экономики" }, isCorrect: false },
      {
        text: { en: "In everyday situations all around us", ru: "В повседневных ситуациях вокруг нас" },
        isCorrect: true,
      },
      { text: { en: "Only in TV news", ru: "Только в новостях по телевизору" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Supply and demand work in everyday life all the time — from taxis in the rain to concert tickets.",
      ru: "Спрос и предложение работают в обычной жизни каждый день — от такси в дождь до билетов на концерт.",
    },
    actionPrompt: {
      en: "Describe a situation from your own life where you noticed a price rise or drop because of supply and demand.",
      ru: "Опиши ситуацию из своей жизни, где ты заметил рост или падение цены из-за спроса и предложения.",
    },
    markers: {
      en: ["demand", "supply", "price", "example", "market"],
      ru: ["спрос", "предложение", "цена", "пример", "рынок"],
    },
    xp: 150,
  },
  {
    id: "quest-inflation-detective",
    categoryId: "economics",
    difficulty: "gold",
    emoji: "🕵️‍♀️",
    questTitle: { en: "Quest: The Inflation Detective", ru: "Квест: Инфляционный детектив" },
    description: {
      en: "Find a real gap between official inflation numbers and what your wallet actually feels.",
      ru: "Найди реальный разрыв между официальной инфляцией и тем, что чувствует твой кошелёк.",
    },
    scenario: {
      en: "The government reports one inflation number, but your wallet feels a completely different one. Your mission is to find a specific product or service where that gap is visible to the naked eye.",
      ru: "Правительство называет одну цифру инфляции, а твой кошелёк чувствует совсем другую. Твоя миссия — найти конкретный товар или услугу, где этот разрыв виден невооружённым глазом.",
    },
    insight: {
      en: "Official inflation is an average across the whole hospital ward: it's calculated from a huge basket of goods, while each person's personal inflation depends on what they actually buy. Understanding that gap means starting to see how the economy touches you personally.",
      ru: "Официальная инфляция — это средняя температура по больнице: она считается по большой корзине товаров, а личная инфляция каждого человека зависит от того, что именно он покупает. Разобраться в этом разрыве — значит начать понимать, как экономика касается лично тебя.",
    },
    quizQuestion: {
      en: "Why can a person's personal inflation differ from the official number?",
      ru: "Почему личная инфляция человека может отличаться от официальной?",
    },
    quizOptions: [
      { text: { en: "Official inflation is always a lie", ru: "Официальная инфляция всегда врёт" }, isCorrect: false },
      {
        text: { en: "It's calculated from an averaged basket, not your personal purchases", ru: "Она считается по усреднённой корзине, а не по личным покупкам" },
        isCorrect: true,
      },
      { text: { en: "Personal inflation doesn't exist", ru: "Личной инфляции не существует" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Official inflation is an average across a huge basket of goods, not your specific purchases.",
      ru: "Официальная инфляция — это среднее по большой корзине товаров, а не по твоим конкретным покупкам.",
    },
    actionPrompt: {
      en: "Name a product or service where the gap between official inflation and how it actually feels is especially noticeable, and explain why.",
      ru: "Назови товар или услугу, где разрыв между официальной инфляцией и твоими ощущениями особенно заметен, и объясни почему.",
    },
    markers: {
      en: ["inflation", "price", "year", "income", "reality"],
      ru: ["инфляция", "цена", "год", "доход", "реальность"],
    },
    xp: 200,
  },
  {
    id: "quest-factory-town",
    categoryId: "economics",
    difficulty: "boss",
    emoji: "🏭",
    questTitle: { en: "Quest: A Whole City's Economy", ru: "Квест: Экономика целого города" },
    description: {
      en: "Save the economy of a city that survives on one factory, 5 years before it closes.",
      ru: "Спаси экономику города, который живёт на одном заводе, за 5 лет до его закрытия.",
    },
    scenario: {
      en: "You've been handed data on a city whose entire economy runs on one factory. The factory closes in 5 years. The mayor is panicking, residents don't believe in the future. You have one idea to change everything.",
      ru: "Тебе дали данные о городе, вся экономика которого держится на одном заводе. Через 5 лет завод закроют. Мэр в панике, жители не верят в будущее. У тебя есть одна идея, чтобы всё изменить.",
    },
    insight: {
      en: "Cities built around one big employer are a classic economic trap. Saving them almost never comes down to finding a new savior factory — it's built on diversification: new industries, small businesses, attracting remote workers.",
      ru: "Города, завязанные на одном крупном работодателе, — классическая экономическая ловушка. Спасение таких городов почти никогда не сводится к поиску нового завода-спасителя — оно строится на диверсификации: новых отраслях, малом бизнесе, привлечении удалённых работников.",
    },
    quizQuestion: {
      en: "What strategy usually saves single-industry towns best?",
      ru: "Какая стратегия обычно спасает моногорода лучше всего?",
    },
    quizOptions: [
      { text: { en: "Find a second identical factory", ru: "Найти второй такой же завод" }, isCorrect: false },
      {
        text: { en: "Diversify the economy: new industries and small business", ru: "Диверсифицировать экономику: новые отрасли и малый бизнес" },
        isCorrect: true,
      },
      { text: { en: "Wait for the government to solve it", ru: "Ждать, пока государство решит проблему" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Cities dependent on one employer are saved by economic diversification, not finding a second identical factory.",
      ru: "Города, зависящие от одного работодателя, спасает диверсификация экономики, а не поиск второго такого же завода.",
    },
    actionPrompt: {
      en: "Describe your idea for diversifying the city's economy in the 5 years before the factory closes.",
      ru: "Опиши свою идею, как диверсифицировать экономику города за 5 лет до закрытия завода.",
    },
    markers: {
      en: ["city", "factory", "employment", "economy", "idea"],
      ru: ["город", "завод", "занятость", "экономика", "идея"],
    },
    xp: 300,
  },

  // ─── Business skills ───
  {
    id: "quest-60-second-pitch",
    categoryId: "business-skills",
    difficulty: "bronze",
    emoji: "🗣️",
    questTitle: { en: "Quest: A Pitch in One Breath", ru: "Квест: Питч за один вдох" },
    description: {
      en: "Write a pitch for your project that fits exactly in 60 seconds.",
      ru: "Запиши питч своего проекта, который укладывается ровно в 60 секунд.",
    },
    scenario: {
      en: "You have one breath before the elevator doors close and the person across from you is gone forever. Fit your whole idea into 60 seconds.",
      ru: "У тебя есть время на один вдох перед тем, как двери лифта закроются и человек напротив уйдёт навсегда. Уложи всю свою идею в 60 секунд.",
    },
    insight: {
      en: "If it takes you more than a minute to explain your idea, you probably don't fully understand it yourself yet. A 60-second pitch forces you to cut everything unnecessary and keep only the essence: the problem, the solution, and why it matters right now.",
      ru: "Если тебе нужно больше минуты, чтобы объяснить свою идею — скорее всего, ты сам её до конца не понимаешь. Питч за 60 секунд заставляет отбросить всё лишнее и оставить только суть: проблему, решение и почему это важно именно сейчас.",
    },
    quizQuestion: {
      en: "Why should a pitch fit in 60 seconds?",
      ru: "Почему питч должен укладываться в 60 секунд?",
    },
    quizOptions: [
      { text: { en: "Because talking longer is illegal", ru: "Потому что дольше говорить запрещено законом" }, isCorrect: false },
      {
        text: { en: "Because the listener decides whether to keep listening in the first few seconds", ru: "Потому что слушатель решает, дослушивать ли, в первые секунды" },
        isCorrect: true,
      },
      { text: { en: "Because it's shorter to type", ru: "Потому что так короче печатать" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "If it takes more than a minute to explain the idea, you probably don't fully understand it yourself.",
      ru: "Если тебе нужно больше минуты, чтобы объяснить идею — скорее всего, ты сам её до конца не понимаешь.",
    },
    actionPrompt: {
      en: "Write out the full text of your 60-second pitch.",
      ru: "Напиши текст своего 60-секундного питча целиком.",
    },
    markers: {
      en: ["pitch", "idea", "problem", "solution", "seconds"],
      ru: ["питч", "идея", "проблема", "решение", "секунд"],
    },
    xp: 100,
  },
  {
    id: "quest-five-tasks",
    categoryId: "business-skills",
    difficulty: "bronze",
    emoji: "📊",
    questTitle: { en: "Quest: Five Tasks That Solve Everything", ru: "Квест: Пять задач, которые решают всё" },
    description: {
      en: "Make a list of 5 tasks for the week and rank them by priority.",
      ru: "Заведи список из 5 задач на неделю и расставь приоритеты.",
    },
    scenario: {
      en: "You've got fifty unrelated things swirling in your head and the feeling that everything is on fire at once. Pick just 5 tasks for the week — the ones that actually move you forward.",
      ru: "У тебя в голове пятьдесят несвязанных дел и ощущение, что горит всё сразу. Отбери всего 5 задач на неделю — тех, что реально двигают тебя вперёд.",
    },
    insight: {
      en: "Chaos in your head isn't a sign you're busy — it's a sign you have no system. Five tasks a week with clear priorities beat fifty tasks with no order.",
      ru: "Хаос в голове — это не признак занятости, это признак отсутствия системы. Пять задач на неделю с чёткими приоритетами работают лучше, чем пятьдесят задач без порядка.",
    },
    quizQuestion: { en: "What matters more for productivity?", ru: "Что важнее для продуктивности?" },
    quizOptions: [
      { text: { en: "A list of 50 tasks with no order", ru: "Список из 50 задач без порядка" }, isCorrect: false },
      { text: { en: "5 tasks with clear priorities", ru: "5 задач с чёткими приоритетами" }, isCorrect: true },
      { text: { en: "A pretty notes app", ru: "Красивое приложение для заметок" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Productivity doesn't start with apps — it starts with a short list and clear priorities.",
      ru: "Продуктивность начинается не с приложений, а с короткого списка с понятными приоритетами.",
    },
    actionPrompt: {
      en: "List 5 tasks for the week in order of priority — from most important to least.",
      ru: "Перечисли 5 задач на неделю в порядке приоритета — от самой важной к наименее важной.",
    },
    markers: {
      en: ["task", "priority", "week", "plan", "important"],
      ru: ["задача", "приоритет", "неделя", "план", "важно"],
    },
    xp: 100,
  },
  {
    id: "quest-cold-email",
    categoryId: "business-skills",
    difficulty: "silver",
    emoji: "✉️",
    questTitle: { en: "Quest: The Email That Won't Get Deleted", ru: "Квест: Письмо, которое не удалят" },
    description: {
      en: "Write a 3-sentence cold email that people actually want to finish reading.",
      ru: "Напиши cold email на 3 предложения, который реально хочется дочитать.",
    },
    scenario: {
      en: "Your email is landing in the inbox of someone who gets 200 emails a day and deletes 95% of them in a second. You have 3 sentences to land in the remaining 5%.",
      ru: "Твоё письмо попадёт в почту человека, который получает 200 писем в день и удаляет 95% из них за секунду. У тебя есть 3 предложения, чтобы попасть в оставшиеся 5%.",
    },
    insight: {
      en: "Almost every cold email gets deleted in the first 3 seconds because it starts with \"Hi, my name is...\" — boring and predictable. An email that gets read hooks the reader in the first line with a specific benefit for them.",
      ru: "Почти все холодные письма удаляют в первые 3 секунды, потому что они начинаются с «Здравствуйте, меня зовут...» — скучно и предсказуемо. Письмо, которое читают, цепляет с первой строки конкретной пользой для получателя.",
    },
    quizQuestion: {
      en: "What's the best way to open a cold email so people finish reading it?",
      ru: "С чего лучше начинать cold email, чтобы его дочитали?",
    },
    quizOptions: [
      { text: { en: "\"Hi, my name is...\"", ru: "«Здравствуйте, меня зовут...»" }, isCorrect: false },
      { text: { en: "With a specific benefit for the reader", ru: "С конкретной пользы для получателя" }, isCorrect: true },
      { text: { en: "With a joke about the weather", ru: "С анекдота про погоду" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "An email people actually read hooks them with a benefit right away, not a long self-introduction.",
      ru: "Письмо, которое читают, сразу цепляет пользой для получателя, а не долгим представлением себя.",
    },
    actionPrompt: {
      en: "Write a 3-sentence cold email that you yourself would actually finish reading.",
      ru: "Напиши cold email из 3 предложений, который ты бы сам дочитал до конца.",
    },
    markers: {
      en: ["email", "benefit", "recipient", "short", "hooks"],
      ru: ["письмо", "польза", "получатель", "коротко", "цепляет"],
    },
    xp: 150,
  },
  {
    id: "quest-solve-a-complaint",
    categoryId: "business-skills",
    difficulty: "silver",
    emoji: "🧠",
    questTitle: { en: "Quest: Someone Else's Pain, Your Idea", ru: "Квест: Чужая боль — твоя идея" },
    description: {
      en: "Find a complaint post on social media and propose a concrete solution.",
      ru: "Найди пост с жалобой в соцсетях и предложи конкретное решение.",
    },
    scenario: {
      en: "Somewhere in the comments right now, someone's annoyed that \"there's no decent service for...\" Find that complaint and build an idea on it.",
      ru: "Где-то в комментариях прямо сейчас кто-то злится на то, что «нет нормального сервиса для...». Найди эту жалобу и построй на ней идею.",
    },
    insight: {
      en: "The best business ideas aren't born in a visionary's head — they're born in the comments under someone else's complaint. Practice seeing an opportunity in someone's problem instead of just noise.",
      ru: "Лучшие бизнес-идеи рождаются не в голове визионера, а в комментариях под чужими жалобами. Потренируйся видеть в чужой проблеме не нытьё, а возможность.",
    },
    quizQuestion: {
      en: "Where are the best business ideas usually born?",
      ru: "Где чаще всего рождаются лучшие бизнес-идеи?",
    },
    quizOptions: [
      {
        text: { en: "In the comments under other people's complaints", ru: "В комментариях под чужими жалобами" },
        isCorrect: true,
      },
      { text: { en: "Only in the head of a genius visionary", ru: "Только в голове гениального визионера" }, isCorrect: false },
      { text: { en: "In today's horoscope", ru: "В гороскопе на день" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Other people's complaints on social media are a ready-made spec for a product — most people just don't read them as an opportunity.",
      ru: "Чужие жалобы в соцсетях — это готовое ТЗ для продукта, просто его мало кто читает как возможность.",
    },
    actionPrompt: {
      en: "Describe the problem you found and your solution for it in 2-3 sentences.",
      ru: "Опиши проблему, которую ты нашёл, и своё решение для неё в 2-3 предложениях.",
    },
    markers: {
      en: ["complaint", "problem", "solution", "customer", "idea"],
      ru: ["жалоба", "проблема", "решение", "клиент", "идея"],
    },
    xp: 150,
  },
  {
    id: "quest-negotiation-edge",
    categoryId: "business-skills",
    difficulty: "gold",
    emoji: "🤝",
    questTitle: { en: "Quest: Negotiation on the Edge", ru: "Квест: Переговоры на грани срыва" },
    description: {
      en: "Save the deal when a customer demands a 50% discount and threatens to walk to a competitor.",
      ru: "Удержи сделку, когда клиент требует скидку 50% и грозится уйти к конкуренту.",
    },
    scenario: {
      en: "The customer on the other end of the call is demanding a 50% discount and hinting the competitor is cheaper. You have literally three lines to save the deal without wiping out your margin.",
      ru: "Клиент на другом конце звонка требует скидку 50% и намекает, что у конкурента дешевле. У тебя есть буквально три реплики, чтобы удержать сделку, не обнулив свою маржу.",
    },
    insight: {
      en: "Good negotiators don't argue about price — they shift the conversation to value. Caving on a discount almost always teaches the customer to push harder next time, while a counter-offer preserves both the deal and the margin.",
      ru: "Хорошие переговорщики не спорят о цене — они меняют предмет разговора на ценность. Скидка в лоб почти всегда учит клиента давить сильнее в следующий раз, а встречное предложение сохраняет и сделку, и маржу.",
    },
    quizQuestion: {
      en: "What usually works better than a flat 50% discount?",
      ru: "Что обычно работает лучше, чем прямая скидка 50%?",
    },
    quizOptions: [
      {
        text: { en: "Agreeing right away so you don't lose the customer", ru: "Сразу согласиться, чтобы не потерять клиента" },
        isCorrect: false,
      },
      {
        text: { en: "Offering a counter-proposal instead of a flat discount", ru: "Предложить встречные условия вместо прямой скидки" },
        isCorrect: true,
      },
      { text: { en: "Cutting off communication", ru: "Прекратить общение" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "A flat discount teaches the customer to push harder in the future. A counter-proposal preserves both the deal and the margin.",
      ru: "Прямая скидка учит клиента давить сильнее в будущем. Встречные условия сохраняют и сделку, и маржу.",
    },
    actionPrompt: {
      en: "Describe your 3 lines in this negotiation — how you'd save the deal without wiping out your margin.",
      ru: "Опиши свои 3 реплики в этих переговорах — как ты удержишь сделку без обнуления маржи.",
    },
    markers: {
      en: ["negotiation", "discount", "customer", "price", "argument"],
      ru: ["переговоры", "скидка", "клиент", "цена", "аргумент"],
    },
    xp: 200,
  },
  {
    id: "quest-dream-team",
    categoryId: "business-skills",
    difficulty: "boss",
    emoji: "👥",
    questTitle: { en: "Quest: Build Your Dream Team in an Hour", ru: "Квест: Собери команду мечты за час" },
    description: {
      en: "Hire your first 3 team members with a budget that barely covers snacks.",
      ru: "Найми первых 3 человек в команду с бюджетом, которого хватит разве что на йогурты.",
    },
    scenario: {
      en: "You have one hour and a budget that covers snacks, not salaries. Recruit your first three team members — people who believe in the idea before they believe in the money.",
      ru: "У тебя есть один час и бюджет, которого хватит на йогурты, а не на зарплаты. Собери первых трёх людей в команду, которые поверят в идею раньше, чем в деньги.",
    },
    insight: {
      en: "At the earliest stage, people don't join for a salary — they join for a mission, a role they can grow into, and the feeling of being part of the story from the start. Your first three hires shape the whole company's culture.",
      ru: "На самой ранней стадии люди присоединяются не за зарплату — они присоединяются за миссию, роль, в которой могут вырасти, и ощущение причастности к истории на старте. Первые три найма определяют культуру всей компании.",
    },
    quizQuestion: {
      en: "What most often convinces the first employees to join a startup with no money?",
      ru: "Что чаще всего убеждает первых сотрудников присоединиться к стартапу без денег?",
    },
    quizOptions: [
      { text: { en: "A promise of a high future salary", ru: "Обещание будущей высокой зарплаты" }, isCorrect: false },
      {
        text: { en: "A mission, a role, and a sense of being part of the story", ru: "Миссия, роль и ощущение причастности к истории" },
        isCorrect: true,
      },
      { text: { en: "A nice office", ru: "Красивый офис" }, isCorrect: false },
    ],
    correctAnswerHint: {
      en: "Early on, people aren't convinced by a future salary — they're convinced by a mission and a role they can grow into alongside the project.",
      ru: "На старте людей убеждает не будущая зарплата, а миссия и роль, в которой они могут вырасти вместе с проектом.",
    },
    actionPrompt: {
      en: "Describe who your first three hires would be, what role you'd give each of them, and why they'd say yes without money.",
      ru: "Опиши, кого ты наймёшь первыми тремя, какую роль каждому дашь и почему они согласятся без денег.",
    },
    markers: {
      en: ["team", "hire", "role", "budget", "motivation"],
      ru: ["команда", "найм", "роль", "бюджет", "мотивация"],
    },
    xp: 300,
  },
];

/**
 * Build intake: turn an idea into at most two decisions, then build.
 *
 * Ventrio is a builder. The old flow put a multi-turn interview between "I have
 * an idea" and anything existing, and the user had to end it by typing
 * "generate the site" — the conversation was the product, and the build was an
 * afterthought. This module is the replacement: infer what the person probably
 * wants, ask at most two structured questions, and start building on the last
 * answer.
 *
 * EVERYTHING HERE IS DETERMINISTIC. No model call decides the options. That is
 * a deliberate constraint, not a shortcut:
 *
 *   - the choices must appear instantly, before any generation is paid for;
 *   - the same idea must offer the same options on a refresh, or persistence
 *     and idempotency become meaningless;
 *   - an intake that cost a model call would make abandoning intake expensive,
 *     which is the opposite of what a fast intake is for.
 *
 * The cost is that inference is keyword-driven and will sometimes pick a
 * merely-plausible domain. That is acceptable: every step carries a defer
 * option, so a wrong guess costs one click, and the generation prompt still
 * receives the user's own words.
 */

/** Steps are ordered; `productType` may be skipped when the idea is explicit. */
export type IntakeStepId = "productType" | "designDirection";

export interface IntakeOption {
  /** Stable across releases — persisted, so renaming one invalidates a resume. */
  id: string;
  /** Key in the `build` message namespace. */
  labelKey: string;
  /** Optional one-line clarification, same namespace. */
  hintKey?: string;
}

export interface IntakeStep {
  id: IntakeStepId;
  titleKey: string;
  /** Label for the escape hatch: "Let Ventrio decide" / "Surprise me". */
  deferKey: string;
  options: IntakeOption[];
}

/**
 * Domains the idea can fall into.
 *
 * Coarse on purpose. These exist to pick a plausible triad of product types,
 * not to classify the idea correctly — a finer taxonomy would be more often
 * wrong in ways the user has to correct.
 */
export const INTAKE_DOMAINS = [
  "fandom",
  "portfolio",
  "localBusiness",
  "event",
  "tool",
  "community",
  "learning",
  "shop",
  "cause",
  "general",
] as const;
export type IntakeDomain = (typeof INTAKE_DOMAINS)[number];

/**
 * Keyword signals per domain, English and Russian.
 *
 * Matched on word-ish boundaries rather than bare `includes`, so "art" does not
 * fire on "start". Russian is matched by stem because the language inflects and
 * a full-form list would miss most real messages.
 */
const DOMAIN_SIGNALS: Record<Exclude<IntakeDomain, "general">, RegExp[]> = {
  fandom: [
    /\b(?:fan|fandom|anime|manga|comics?|marvel|mcu|star\s?wars|movies?|films?|series|lore|universe|franchise)\b/i,
    /(?:фанат|фэндом|аниме|манг|комикс|марвел|вселенн|фильм|сериал|лор)/i,
  ],
  portfolio: [
    /\b(?:portfolio|my\s+work|resume|cv|designer|photograph|illustrat|writer|freelance)\b/i,
    /(?:портфолио|резюме|мои\s+работ|дизайнер|фотограф|иллюстрат|фриланс)/i,
  ],
  localBusiness: [
    /\b(?:cafe|coffee|restaurant|bakery|salon|barber|studio|clinic|shop\s+in|local\s+business|service)\b/i,
    /(?:кафе|кофейн|ресторан|пекарн|салон|барбер|студи|клиник|мастерск|услуг)/i,
  ],
  event: [
    /\b(?:event|conference|meetup|festival|wedding|party|hackathon|concert|tournament)\b/i,
    /(?:мероприят|конференц|митап|фестивал|свадьб|вечеринк|хакатон|концерт|турнир)/i,
  ],
  tool: [
    /\b(?:app|tool|tracker|dashboard|saas|platform|automat|generator|calculator|utility)\b/i,
    /(?:приложен|инструмент|трекер|дашборд|платформ|автоматиз|генератор|калькулятор)/i,
  ],
  community: [
    /\b(?:community|club|forum|network|group|society|collective)\b/i,
    /(?:сообществ|клуб|форум|нетворк|объединен|коллектив)/i,
  ],
  learning: [
    /\b(?:course|tutorial|lesson|teach|learn|school|bootcamp|guide|curriculum)\b/i,
    /(?:курс|урок|обучен|препода|школ|учеб|методич|гайд)/i,
  ],
  shop: [
    /\b(?:shop|store|sell|selling|product\s+page|ecommerce|merch|catalog)\b/i,
    /(?:магазин|продаж|продава|товар|мерч|каталог|интернет-магазин)/i,
  ],
  cause: [
    /\b(?:charity|nonprofit|volunteer|donate|awareness|campaign|petition|foundation)\b/i,
    /(?:благотворит|некоммерч|волонтёр|волонтер|пожертвован|кампан|петиц|фонд)/i,
  ],
};

/** Detects the domain, or "general" when nothing matches. First match wins. */
export function inferDomain(idea: string): IntakeDomain {
  const value = idea.trim();
  if (!value) return "general";
  for (const domain of INTAKE_DOMAINS) {
    if (domain === "general") continue;
    const signals = DOMAIN_SIGNALS[domain];
    if (signals.some((pattern) => pattern.test(value))) return domain;
  }
  return "general";
}

/**
 * Product-type triads per domain.
 *
 * Three is the ceiling the brief sets and also the practical limit: a fourth
 * option turns a decision into a comparison. Every id is namespaced by domain
 * so two domains can offer a similarly-named shape without colliding in
 * persisted state.
 */
const PRODUCT_TYPES: Record<IntakeDomain, IntakeOption[]> = {
  fandom: [
    { id: "fandom.timeline", labelKey: "intakeTypeTimeline", hintKey: "intakeTypeTimelineHint" },
    { id: "fandom.archive", labelKey: "intakeTypeArchive", hintKey: "intakeTypeArchiveHint" },
    { id: "fandom.editorial", labelKey: "intakeTypeEditorial", hintKey: "intakeTypeEditorialHint" },
  ],
  portfolio: [
    { id: "portfolio.showcase", labelKey: "intakeTypeShowcase", hintKey: "intakeTypeShowcaseHint" },
    { id: "portfolio.caseStudies", labelKey: "intakeTypeCaseStudies", hintKey: "intakeTypeCaseStudiesHint" },
    { id: "portfolio.onePage", labelKey: "intakeTypeOnePage", hintKey: "intakeTypeOnePageHint" },
  ],
  localBusiness: [
    { id: "localBusiness.storefront", labelKey: "intakeTypeStorefront", hintKey: "intakeTypeStorefrontHint" },
    { id: "localBusiness.menu", labelKey: "intakeTypeMenu", hintKey: "intakeTypeMenuHint" },
    { id: "localBusiness.booking", labelKey: "intakeTypeBooking", hintKey: "intakeTypeBookingHint" },
  ],
  event: [
    { id: "event.landing", labelKey: "intakeTypeEventLanding", hintKey: "intakeTypeEventLandingHint" },
    { id: "event.programme", labelKey: "intakeTypeProgramme", hintKey: "intakeTypeProgrammeHint" },
    { id: "event.invite", labelKey: "intakeTypeInvite", hintKey: "intakeTypeInviteHint" },
  ],
  tool: [
    { id: "tool.productPage", labelKey: "intakeTypeProductPage", hintKey: "intakeTypeProductPageHint" },
    { id: "tool.explainer", labelKey: "intakeTypeExplainer", hintKey: "intakeTypeExplainerHint" },
    { id: "tool.waitlist", labelKey: "intakeTypeWaitlist", hintKey: "intakeTypeWaitlistHint" },
  ],
  community: [
    { id: "community.hub", labelKey: "intakeTypeHub", hintKey: "intakeTypeHubHint" },
    { id: "community.manifesto", labelKey: "intakeTypeManifesto", hintKey: "intakeTypeManifestoHint" },
    { id: "community.directory", labelKey: "intakeTypeDirectory", hintKey: "intakeTypeDirectoryHint" },
  ],
  learning: [
    { id: "learning.courseLanding", labelKey: "intakeTypeCourseLanding", hintKey: "intakeTypeCourseLandingHint" },
    { id: "learning.guide", labelKey: "intakeTypeGuide", hintKey: "intakeTypeGuideHint" },
    { id: "learning.syllabus", labelKey: "intakeTypeSyllabus", hintKey: "intakeTypeSyllabusHint" },
  ],
  shop: [
    { id: "shop.catalog", labelKey: "intakeTypeCatalog", hintKey: "intakeTypeCatalogHint" },
    { id: "shop.singleProduct", labelKey: "intakeTypeSingleProduct", hintKey: "intakeTypeSingleProductHint" },
    { id: "shop.lookbook", labelKey: "intakeTypeLookbook", hintKey: "intakeTypeLookbookHint" },
  ],
  cause: [
    { id: "cause.campaign", labelKey: "intakeTypeCampaign", hintKey: "intakeTypeCampaignHint" },
    { id: "cause.story", labelKey: "intakeTypeStory", hintKey: "intakeTypeStoryHint" },
    { id: "cause.report", labelKey: "intakeTypeReport", hintKey: "intakeTypeReportHint" },
  ],
  general: [
    { id: "general.landing", labelKey: "intakeTypeLanding", hintKey: "intakeTypeLandingHint" },
    { id: "general.story", labelKey: "intakeTypeNarrative", hintKey: "intakeTypeNarrativeHint" },
    { id: "general.showcase", labelKey: "intakeTypeGallery", hintKey: "intakeTypeGalleryHint" },
  ],
};

/**
 * Ideas that already name their shape.
 *
 * When someone writes "лендинг для кофейни" they have answered the product-type
 * question in the act of asking, and putting it to them again is the interview
 * behaviour this work exists to remove. Requires an explicit product noun —
 * a domain match alone is not enough, because "a site about the MCU" says
 * nothing about whether it should be a timeline or an archive.
 */
const EXPLICIT_SHAPE =
  /\b(?:landing(?:\s+page)?|portfolio|timeline|archive|catalog(?:ue)?|menu|blog|newsletter|resume|cv|one[-\s]?pager|lookbook|directory|waitlist)\b/i;
const EXPLICIT_SHAPE_RU =
  /(?:лендинг|портфолио|таймлайн|хронолог|архив|каталог|меню|блог|рассылк|резюме|одностраничн|лукбук|справочник|вейтлист)/i;

export function hasExplicitProductType(idea: string): boolean {
  const value = idea.trim();
  if (!value) return false;
  return EXPLICIT_SHAPE.test(value) || EXPLICIT_SHAPE_RU.test(value);
}

/* ── design directions ──────────────────────────────────────────────────── */

/**
 * Ventrio-owned visual directions.
 *
 * `preview` names a local fixture rendered in CSS by the choice component —
 * there is no image request, and the thumbnails are identical on every load.
 */
export interface DesignDirection extends IntakeOption {
  preview: DesignPreviewId;
}

export const DESIGN_PREVIEW_IDS = [
  "cinematic",
  "missionControl",
  "editorial",
  "softLight",
  "brutalist",
  "warmCraft",
] as const;
export type DesignPreviewId = (typeof DESIGN_PREVIEW_IDS)[number];

const DESIGN_DIRECTIONS: DesignDirection[] = [
  { id: "design.cinematic", labelKey: "intakeDesignCinematic", hintKey: "intakeDesignCinematicHint", preview: "cinematic" },
  { id: "design.missionControl", labelKey: "intakeDesignMissionControl", hintKey: "intakeDesignMissionControlHint", preview: "missionControl" },
  { id: "design.editorial", labelKey: "intakeDesignEditorial", hintKey: "intakeDesignEditorialHint", preview: "editorial" },
  { id: "design.softLight", labelKey: "intakeDesignSoftLight", hintKey: "intakeDesignSoftLightHint", preview: "softLight" },
  { id: "design.brutalist", labelKey: "intakeDesignBrutalist", hintKey: "intakeDesignBrutalistHint", preview: "brutalist" },
  { id: "design.warmCraft", labelKey: "intakeDesignWarmCraft", hintKey: "intakeDesignWarmCraftHint", preview: "warmCraft" },
];

/**
 * Three directions that suit the domain, in a stable order.
 *
 * Domain-led rather than random: a charity and a fan archive should not be
 * offered the same first option. The trailing fill keeps the list at three even
 * if a preference list is ever shortened.
 */
const DOMAIN_DESIGN_PREFERENCE: Record<IntakeDomain, DesignPreviewId[]> = {
  fandom: ["cinematic", "missionControl", "editorial"],
  portfolio: ["editorial", "softLight", "brutalist"],
  localBusiness: ["warmCraft", "softLight", "editorial"],
  event: ["cinematic", "brutalist", "softLight"],
  tool: ["missionControl", "softLight", "editorial"],
  community: ["warmCraft", "editorial", "brutalist"],
  learning: ["editorial", "softLight", "missionControl"],
  shop: ["softLight", "warmCraft", "editorial"],
  cause: ["editorial", "warmCraft", "cinematic"],
  general: ["editorial", "softLight", "cinematic"],
};

export function designDirectionsFor(domain: IntakeDomain): DesignDirection[] {
  const preferred = DOMAIN_DESIGN_PREFERENCE[domain] ?? DOMAIN_DESIGN_PREFERENCE.general;
  const chosen: DesignDirection[] = [];
  for (const previewId of preferred) {
    const found = DESIGN_DIRECTIONS.find((d) => d.preview === previewId);
    if (found && !chosen.includes(found)) chosen.push(found);
  }
  for (const direction of DESIGN_DIRECTIONS) {
    if (chosen.length >= 3) break;
    if (!chosen.includes(direction)) chosen.push(direction);
  }
  return chosen.slice(0, 3);
}

export function productTypesFor(domain: IntakeDomain): IntakeOption[] {
  return PRODUCT_TYPES[domain] ?? PRODUCT_TYPES.general;
}

/* ── the plan ───────────────────────────────────────────────────────────── */

export interface IntakePlan {
  domain: IntakeDomain;
  steps: IntakeStep[];
}

/**
 * Builds the question sequence for an idea: two steps, or one when the idea
 * already names its shape. Never zero — the visual direction is always asked,
 * because it is the decision that most changes the result and the one a person
 * is most able to answer instantly.
 */
export function planIntake(idea: string): IntakePlan {
  const domain = inferDomain(idea);
  const steps: IntakeStep[] = [];

  if (!hasExplicitProductType(idea)) {
    steps.push({
      id: "productType",
      titleKey: "intakeTypeTitle",
      deferKey: "intakeDeferType",
      options: productTypesFor(domain),
    });
  }

  steps.push({
    id: "designDirection",
    titleKey: "intakeDesignTitle",
    deferKey: "intakeDeferDesign",
    options: designDirectionsFor(domain),
  });

  return { domain, steps };
}

/* ── persisted answers ──────────────────────────────────────────────────── */

/** `null` means the user deferred; absent means not answered yet. */
export interface IntakeAnswers {
  productType?: string | null;
  designDirection?: string | null;
}

export const INTAKE_STORAGE_VERSION = 1;

export interface PersistedIntake {
  v: number;
  ideaHash: string;
  answers: IntakeAnswers;
  /** Set the moment generation is dispatched — the idempotency latch. */
  dispatched?: boolean;
}

/**
 * Cheap, stable hash of the idea text.
 *
 * Not a checksum — its only job is to notice that the saved answers belong to a
 * different idea than the one on screen, so a resumed session cannot apply a
 * previous project's choices. FNV-1a, base36.
 */
export function hashIdea(idea: string): string {
  let hash = 0x811c9dc5;
  const value = idea.trim().toLowerCase();
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36);
}

export function intakeStorageKey(projectId: string): string {
  return `ventrio.intake.${projectId}`;
}

/** The step to show, or null when every step is answered. */
export function nextStep(plan: IntakePlan, answers: IntakeAnswers): IntakeStep | null {
  for (const step of plan.steps) {
    if (!(step.id in answers)) return step;
  }
  return null;
}

export function isIntakeComplete(plan: IntakePlan, answers: IntakeAnswers): boolean {
  return nextStep(plan, answers) === null;
}

/**
 * The instruction appended to the generation request.
 *
 * Deferred answers contribute nothing rather than a placeholder: "let Ventrio
 * decide" must leave the generator as free as it would have been without the
 * question, not hand it the string "let Ventrio decide" to interpret.
 */
export function intakeDirective(answers: IntakeAnswers, labels: (key: string) => string): string {
  const parts: string[] = [];
  if (answers.productType) {
    const option = Object.values(PRODUCT_TYPES).flat().find((o) => o.id === answers.productType);
    if (option) parts.push(labels(option.labelKey));
  }
  if (answers.designDirection) {
    const option = DESIGN_DIRECTIONS.find((o) => o.id === answers.designDirection);
    if (option) parts.push(labels(option.labelKey));
  }
  return parts.join(" \u00b7 ");
}

/**
 * Canonical English descriptors for the generation payload.
 *
 * Deliberately not the localised label. The generator reads this as design
 * vocabulary, and "Кинематографичный архив" carries less for it than
 * "cinematic archive" does; the user still sees their own language on screen.
 * Absent ids resolve to nothing, so a deferred or unknown answer contributes
 * no instruction at all rather than a placeholder to interpret.
 */
const CANONICAL: Record<string, string> = {
  "fandom.timeline": "an interactive timeline",
  "fandom.archive": "a fan archive",
  "fandom.editorial": "an editorial experience",
  "portfolio.showcase": "a work showcase",
  "portfolio.caseStudies": "case studies",
  "portfolio.onePage": "a one-page portfolio",
  "localBusiness.storefront": "a storefront page",
  "localBusiness.menu": "a menu page",
  "localBusiness.booking": "a booking page",
  "event.landing": "an event landing page",
  "event.programme": "a programme page",
  "event.invite": "an invitation page",
  "tool.productPage": "a product page",
  "tool.explainer": "an explainer page",
  "tool.waitlist": "a waitlist page",
  "community.hub": "a community hub",
  "community.manifesto": "a manifesto page",
  "community.directory": "a directory",
  "learning.courseLanding": "a course landing page",
  "learning.guide": "a guide",
  "learning.syllabus": "a syllabus page",
  "shop.catalog": "a product catalogue",
  "shop.singleProduct": "a single-product page",
  "shop.lookbook": "a lookbook",
  "cause.campaign": "a campaign page",
  "cause.story": "a story page",
  "cause.report": "an impact report",
  "general.landing": "a landing page",
  "general.story": "a narrative page",
  "general.showcase": "a visual showcase",
  "design.cinematic": "cinematic: deep field, one dominant image, restrained warm accent",
  "design.missionControl": "mission-control: dense data grid, precise mono labels, dark instrumentation",
  "design.editorial": "editorial: narrow measure, strong type hierarchy, generous negative space",
  "design.softLight": "soft-light: airy light surfaces, rounded cards, gentle contrast",
  "design.brutalist": "brutalist: hard edges, heavy type, high contrast, no softness",
  "design.warmCraft": "warm-craft: warm paper tones, hand-made feel, generous margins",
};

/** The selection as the generator should read it, or null when fully deferred. */
export function intakeGenerationBrief(answers: IntakeAnswers): {
  productType?: string;
  designDirection?: string;
} | null {
  const productType = answers.productType ? CANONICAL[answers.productType] : undefined;
  const designDirection = answers.designDirection ? CANONICAL[answers.designDirection] : undefined;
  if (!productType && !designDirection) return null;
  return { ...(productType ? { productType } : {}), ...(designDirection ? { designDirection } : {}) };
}

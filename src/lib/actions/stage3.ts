"use server";

import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  buildStage3OutputJsonSchema,
  mergeStage3ProjectState,
  parseStage3ProjectState,
  sanitizeStage3Output,
  type Stage3ProjectOutput,
  type Stage3ProjectState,
} from "@/lib/build/stage3Types";
import { isFeedbackRequest, loadFeedbackConversationContext } from "@/lib/feedback/context";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{8,80}$/;

const OUTPUT_SCHEMA = buildStage3OutputJsonSchema();

const EDIT_SCHEMA = {
  type: "object",
  properties: { message: { type: "string" }, output: OUTPUT_SCHEMA },
  required: ["message", "output"],
  additionalProperties: false,
};

const DEEPEN_SCHEMA = {
  type: "object",
  properties: { text: { type: "string" } },
  required: ["text"],
  additionalProperties: false,
};

// Structured output (output_config.format) is deliberately not used for the
// Stage3 output schema below — its size trips Anthropic's "compiled grammar
// is too large" limit once quiz/explorer, theme, and hero-visual fields are
// all present together. The schema is instead embedded as text in the
// prompt (see OUTPUT FORMAT in outputPrompt) and enforced by sanitizeStage3Output
// instead. This strips an occasional stray ```json fence before parsing.
function parseJsonRelaxed(text: string): unknown {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(trimmed);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

function stableUuid(seed: string): string {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 32).split("");
  hex[12] = "5";
  hex[16] = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  const value = hex.join("");
  return `${value.slice(0, 8)}-${value.slice(8, 12)}-${value.slice(12, 16)}-${value.slice(16, 20)}-${value.slice(20)}`;
}

function outputPrompt(locale: string, edit = false, feedbackGrounded = false): string {
  const language = locale === "ru" ? "Russian" : "English";
  return `You are Ventrio's first-version engine. ${edit ? "Edit the existing website according to the user's latest request." : "Generate a complete, premium website for the chosen project idea."}

The output is a real product website — the kind of thing you'd expect from a well-funded startup's launch, not a generic SaaS template and not a mini-game. The visitor should feel "AI actually understood my idea and built something real for it" — not "this is another AI landing page template." Write finished, launch-ready copy in ${language}. Never mention that the user should research, validate, design, or build something later — this already exists.

BEFORE YOU WRITE ANYTHING, think like the best designer for this exact idea would — a real design director deciding what THIS idea needs, never a template picker matching it to an existing pattern (never output this reasoning, just let it steer the design):
1. What kind of real product/site does this idea actually need (a brand showcase, an education product, an impact/mission site, a tool, a community hub)?
2. What visual identity would the best designer alive choose for THIS idea — canvas, typography personality, layout rhythm? A "theme" (below) is only a starting direction, not a finished look — the industry, audience, emotional tone, product type, and intent of THIS idea must still shape mood, imagery, and content distinctly from any other idea that happens to share the same theme.
3. What is the hero's visual centerpiece — not just words, but the one image/mockup/number that makes the idea real in five seconds, before anyone reads a word?
4. What structure — which sections, in which order, how many — does this specific idea's story actually need? Not a habitual shape.
5. Does a hands-on interactive moment genuinely strengthen this specific idea, or would it just be a gimmick bolted on?
6. Why would a visitor want to come back or take the next step?

${edit ? "" : `
CREATIVE BRIEF
- The selected direction includes a creativeBrief. Treat it as the authoritative personalized context for the whole site.
- Preserve its starting material, motivation, first audience, and desired experience throughout the identity, copy, and every section.
- Treat assumptions as unconfirmed design guidance, never as facts, evidence, demand, or personal history.
- Do not replace specific user-grounded details with generic startup, business, course, or education language.
`}
ABSOLUTE RULES — never generate any of these:
- generic hero sections, mission statements, or empty explanations
- "a platform where users can..." framing
- feature lists with no substance behind them
- fake social proof, fake users, fake statistics about adoption/traction, fake testimonials
- a generic SaaS/Webflow-template structure that could belong to any product
- paragraphs that merely restate the idea instead of presenting a real product
- filler sections like "Our mission," "Our values," "Why choose us," or "Who we are" — unless this exact idea genuinely needs one to be understood (rare); prefer real examples, products, demonstrations, comparisons, process, and specific outcomes instead
- the same section order, mix, or phrasing pattern you'd use for a different idea — every site's structure should come from this idea, not a habit

THE WEBSITE (sections)
Generate 3-7 ordered sections that together form one coherent, premium website custom-built for this idea. Pick from these kinds, choosing whichever mix AND order genuinely fits — do not default to the same shape every time (e.g. do not treat "hero → story → showcase → stats → cta" as a template to reuse across ideas; let the idea's own narrative logic decide what comes first, what's skipped, and how many sections there are):
- "story": narrative section — brand story, positioning, the specific problem or moment this idea responds to. Concrete and specific, never a generic mission-statement paragraph, and only included when it earns its place (it should tell the visitor something a showcase or stats section couldn't).
- "showcase": a titled grid of 2-6 real items — a collection/product lineup, feature set, content pieces, portfolio pieces. Each item must be a real, specific thing (an actual product name and its detail, an actual capability and what it does), never a placeholder. Give each item a "visualPrompt": a specific, idea-grounded description of the image that would sit above it (e.g. "the Fjord Parka on a model in falling snow, three-quarter angle", not "a photo" or "product image") whenever a real photo/visual would strengthen that item; leave it as an empty string when the item doesn't need one (e.g. a plain feature-list item).
- "stats": a titled row of 2-6 number+label callouts. These describe the OFFERING itself (materials, methodology, scope, timeframe, coverage — e.g. "40% recycled cotton", "7-day plan", "3 core modules") — never adoption/traction numbers like user counts, downloads, or "trusted by," since those would be fabricated.
- "process": a titled sequence of 2-6 steps — how it works, the roadmap, the journey from request to delivery, a dashboard/what-you-get walkthrough.
- "compare": a two-column before/after or option-A-vs-option-B block (leftLabel/leftBody vs rightLabel/rightBody) — use when the idea's value is best shown as a contrast (old way vs new way, without vs with, this plan vs that plan), never invented statistics dressed up as a comparison.
- "interactive": OPTIONAL, at most one per site, and only when it clearly strengthens this specific idea — never a default addition. Good: an SAT platform gets a diagnostic quiz, a fragrance brand gets a scent-profile builder, a fitness product gets a personalization quiz. Bad: adding one to every website regardless of fit. The website is the product; the interactive moment is a magic layer on top of it, not a replacement for a section that should have been real content.

Before keeping any section, ask "why does this exist — does removing it reduce understanding or usefulness of this specific idea?" If not, cut it. Vary the section count (3-7), the mix of kinds, and their order across different ideas — two different projects should rarely produce the same shape. For example (illustrative starting points, not a formula to copy):
- A clothing brand: might open on showcase (the collection itself, with visualPrompts) before any story, then craft/materials, then how orders work — CTA is a waitlist/preorder ask.
- An SAT-prep platform: positioning + the plan/roadmap + optionally a diagnostic quiz + program scope stats — CTA is waitlist/request.
- A sustainability project: the specific problem + real impact figures about the approach + old way vs this approach + optionally a small calculator — CTA is join/follow.
- A restaurant/hospitality idea: atmosphere and the specific place/food + menu highlights or dishes (with visualPrompts) + location/how to book — CTA is request/contact.
- A startup/tool: might open straight on a demo-flow process section instead of a story, then feature set, optionally a calculator/assessment — CTA is waitlist/feedback.

INTERACTIVE SECTION CONTENT RULES (only when you include one)
- "quiz": 1-4 short steps (each a multiple-choice pick or a single number entry), leading to one of 2-4 personalized outcome reveals. Use this whenever the moment is "answer a few things about yourself/your situation -> get a personalized read." Example: an SAT-prep quiz's number step ("What was your last SAT score?") with breakpoints -> an outcome that reads like a real weakness map with a concrete next-7-day mission.
- "explorer": 3-8 pick-cards the visitor clicks through, each revealing real pre-written content (an explanation, a before/after transformation, a worked example).
- Every step prompt, option, outcome, and card must use concrete nouns from this specific idea/creativeBrief.
- quiz: write real option labels a person would actually pick (never "Option A"), give each option a "scores" array with one number per outcome (higher = stronger match to that outcome; use 0 for outcomes it doesn't support). For a "number" step, set numberMin/numberMax/numberStep/numberUnit/numberPlaceholder to sensible real values for this exact input, and numberBreakpoints must be sorted ascending by "max" and jointly cover the whole range. Every step object must still include the unused fields for its kind (empty options array for a "number" step; numberMin/numberMax/numberStep as 0, numberUnit/numberPlaceholder as "", numberBreakpoints as [] for a "choice" step) — never omit them.
- quiz outcomes must each read like a real personalized result: a specific title (never "Result 1"), a one-line summary, a detail paragraph, and 2-4 concrete actionItems.
- explorer cards must each contain real, specific content — never "check back soon." Only fill beforeLabel/beforeText/afterLabel/afterText when a genuine before/after transformation exists for that card; otherwise leave all four as empty strings.
- The interactive section's own "title"/"body" introduce it in one or two lines — not a mission statement.

HERO — never text-only, and never generic
- "hero" states this product's actual value and identity, not a generic tagline — headline/subheadline should make it obvious what this is and who it's for. The hero should communicate the idea in five seconds without reading the paragraph.
- The hero must also have a visual centerpiece. Choose "hero.visualKind" by what kind of idea this is:
  - Physical product (clothing, food, fragrance, any tangible good): "image" — product photography or a collection-preview feeling. Set "hero.visualPrompt" to a specific, idea-grounded photo description (e.g. "the Vale Overcoat on a Riga street in fog, waist-up" or "the three signature scent bottles arranged on dark stone"), never "a photo" or "hero image".
  - Software/tool/app: "mockup" — an interface or product-interaction preview. Set "hero.visualPrompt" to the one screen/state it should suggest (e.g. "today's digest: 4 updates, 1 blocker flagged").
  - Education/learning: "mockup" or "stat" — a learning-dashboard/progress feeling. Set "hero.visualPrompt" to the specific screen or metric (e.g. "a weekly progress ring at 68%, three modules listed below").
  - Community/social: "image" — an activity or people/storytelling visual specific to what the community actually does together, never an abstract "connect with others" image.
  - Personal brand/portfolio: "image" — an editorial visual identity built around this specific person's work or craft, not a generic headshot-and-tagline layout.
  - Outcome-forward ideas of any category may instead use "stat": one big number+label beside the hero text; set "hero.visualPrompt" to that number and its label as one short phrase (e.g. "1250 → 1420 average score gain").

VISUAL IDENTITY — a theme is a creative direction, not a finished template
Pick exactly one "visual.theme", based on what the best designer would choose for this specific idea:
- "editorial": fashion, lifestyle, luxury, craft brands, personal portfolios. Warm, refined, magazine-like.
- "atmospheric": restaurants, hospitality, place- or mission-driven ideas. Warm, immersive, image-led.
- "futuristic": education, dashboards, data- or progress-driven products. Cool, precise, structured.
- "product": startups, SaaS, tools, demos. Clean, confident, Linear/Stripe-like.
- "minimal": anything that genuinely doesn't fit the above (a personal tool, a small community, a simple utility) — a restrained neutral look, not a default to reach for out of laziness.
The theme is only where you start. Two ideas that land on the same theme must still look and feel different from each other — a fashion brand, a perfume brand, an architecture studio, and a personal portfolio might all reasonably pick "editorial," but their mood, imagery, pacing, and content must read as distinctly as those four real brands would, driven by THIS idea's industry, audience, emotional tone, product type, and intent. Never reuse the same mood/styleNotes phrasing, image-prompt style, or section rhythm across different ideas just because they share a theme.
Think like a product designer at Apple, Linear, Stripe, or a premium Framer/Webflow template within the chosen theme — strong typography hierarchy, generous spacing, intentional visual hierarchy, restraint, no filler. Every generated site should feel custom-made for this idea, not a reskinned template.
- "visual.mood" and "visual.styleNotes" should describe a specific, idea-appropriate feel consistent with the chosen theme (not generic "modern and clean") — a clothing brand and a sustainability project should read as visually distinct as their real-world counterparts would.

CONTENT SPECIFICITY — specific content is what makes an idea feel real
Every section's content should be as specific as the idea itself would be if it already existed. Generic descriptive copy reads as a placeholder; concrete, invented-but-plausible specifics read as a real product. For example:
- Bad: "Premium fragrance collection." Good: "Three signature scents: Morning Atelier — citrus, tea, clean woods. Midnight Archive — incense, leather, amber."
- Bad: "Improve your SAT score." Good: "A 14-day math recovery plan focused on algebra weaknesses."
Apply this same standard everywhere: showcase items need real names and real specifics, not category labels; process steps need what actually happens at each step, not "we handle it"; stats need the actual scope/methodology number, not a rounded-sounding placeholder.

THE NEXT-STEP ASK (cta + form)
- A focused closing ask after the sections — real and specific to this product, not generic.
- community_social: CTA action must be join; form is a real join/RSVP form asking what's actually needed to include this person.
- service: CTA action is request or contact; form fields capture what's actually needed to fulfill the specific offer, not generic name/email only.
- content_media: CTA action is follow or subscribe; form captures how they want to keep receiving this specific content.
- digital_product: CTA action is waitlist or feedback; prefer feedback ("try this and tell us") whenever the site already gave them something real to react to.

FINAL QUALITY TEST — before returning output, check all five honestly:
1. Does this look custom-built for this exact idea, not a reskinned template?
2. Would a real founder be proud to show this to someone?
3. Does the first screen create curiosity in five seconds, without reading the paragraph?
4. Is there a genuine reason a visitor would want to interact with something on this page?
5. Is the value proposition clear?
If any answer is no, improve the section mix, hero, or copy before returning it — not just polish the wording.

GENERATION PRIORITY — never reverse this order: (1) understand the idea, (2) decide what kind of real product/site it needs and what structure its story requires, (3) generate the complete section structure in the order and mix this idea calls for, (4) add a relevant interactive element only if it fits, (5) premium design and copy throughout.

SAFETY AND QUALITY
- Return only the requested JSON. Never output HTML, JavaScript, Markdown, URLs, or executable content.
- Use exactly three #RRGGBB palette colors.
- Keep the preset unchanged during edits. Preserve strong existing content unless the request requires changing it.
- Never invent or imply traction that doesn't exist: no fake testimonials, reviews, member counts, download numbers, "trusted by," or "as seen in."
- The identity name must be short and specific, never Untitled, New project, or a translated placeholder.

OUTPUT FORMAT
Return ONLY raw JSON — no markdown code fences, no commentary before or after — that validates exactly against this JSON Schema (every property listed as "required" must be present; use "" / [] as the empty value for any optional-feeling field that doesn't apply, never omit it):
${JSON.stringify(edit ? EDIT_SCHEMA : OUTPUT_SCHEMA)}
${feedbackGrounded ? `
FEEDBACK-GROUNDED EDIT
- The request refers to real visitor feedback. Use only the supplied feedbackContext as evidence.
- Never invent respondents, trends, demand, validation, complaints, percentages, or quotes.
- If totalResponseCount is 0, say the edit cannot be based on feedback and preserve the output.
- If there are only 1-2 responses, treat them as early individual signals, not a reliable pattern.
- Contact fields have been deliberately removed. Do not infer or expose identities.` : ""}`;
}

function deepenPrompt(locale: string): string {
  const language = locale === "ru" ? "Russian" : "English";
  return `You are Ventrio's project mentor. The visitor already went through this project's interactive quiz and landed on a pre-written result. Write one short, genuinely personalized paragraph (2-4 sentences) that reads their actual answers and goes one layer deeper than the pre-written outcome — reference their specific answers by name, don't just restate the outcome summary.

Rules:
- Ground every sentence in the supplied answers and outcome; never invent facts, traction, or claims about the person.
- Never promise revenue, users, investment, or success.
- No HTML, Markdown, URLs, or executable content.
- Write in ${language}.

Return only the requested JSON.`;
}

function logUsage(
  operation: "first_version_generation" | "project_output_edit" | "deepen_experience_result",
  projectId: string,
  startedAt: number,
  response: Anthropic.Message,
) {
  console.info("[ventrio-ai-usage]", JSON.stringify({
    operation,
    projectId,
    model: response.model,
    durationMs: Date.now() - startedAt,
    inputTokens: response.usage.input_tokens,
    outputTokens: response.usage.output_tokens,
  }));
}

type Stage3Result = { error: string | null; output: Stage3ProjectOutput | null; reply: string | null; durationMs?: number };

async function ownedProject(projectId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, project: null, stage3: null };
  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  return { supabase, user, project, stage3: parseStage3ProjectState(project?.snapshot_fields) };
}

export async function generateFirstVersionAction(projectId: string): Promise<Stage3Result> {
  const t = await getTranslations("stage3");
  if (!UUID_PATTERN.test(projectId)) return { error: t("errorInvalid"), output: null, reply: null };
  const { supabase, user, project, stage3 } = await ownedProject(projectId);
  if (!user) return { error: t("errorSession"), output: null, reply: null };
  if (!project || !stage3 || !stage3.direction) return { error: t("errorDirection"), output: null, reply: null };
  const locale = project.locale;
  if (stage3.output) return { error: null, output: stage3.output, reply: t("alreadyReady"), durationMs: 0 };
  if (!process.env.ANTHROPIC_API_KEY) return { error: t("unavailable"), output: null, reply: null };

  try {
    const startedAt = Date.now();
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      // "high" effort measured ~35-55% of the output-token budget going to an
      // internal "thinking" block the app never reads or stores, roughly
      // doubling latency for no visible-quality gain — the prompt already
      // spells out the design reasoning explicitly (BEFORE YOU WRITE ANYTHING
      // above), so "medium" has plenty of budget to follow it.
      output_config: { effort: "medium" },
      system: outputPrompt(locale),
      messages: [{ role: "user", content: JSON.stringify({ direction: stage3.direction, projectLocale: locale }) }],
    });
    logUsage("first_version_generation", projectId, startedAt, response);
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: t("unavailable"), output: null, reply: null };
    const output = sanitizeStage3Output(parseJsonRelaxed(textBlock.text), stage3.direction.projectType);
    if (!output) return { error: t("unavailable"), output: null, reply: null };
    const nextState: Stage3ProjectState = { ...stage3, status: "first_version_ready", output };
    const snapshot = mergeStage3ProjectState(project.snapshot_fields, nextState);
    snapshot.solution = output.identity.description;
    snapshot.audience = output.targetUser;
    snapshot.first_version = output.primaryValue;
    const { error } = await supabase.from("projects").update({
      name: output.identity.name,
      target_audience: output.targetUser,
      snapshot_fields: snapshot,
    }).eq("id", projectId).eq("user_id", user.id);
    if (error) return { error: t("errorSave"), output: null, reply: null };
    const reply = t("generationReply", { name: output.identity.name });
    await supabase.from("project_ai_messages").insert({
      id: stableUuid(`${stage3.conversationId}:first-version-ready`),
      conversation_id: stage3.conversationId,
      project_id: projectId,
      user_id: user.id,
      role: "assistant",
      content: reply,
    });
    await supabase.from("project_ai_conversations").update({ title: output.identity.name.slice(0, 60) }).eq("id", stage3.conversationId).eq("user_id", user.id);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { error: null, output, reply, durationMs: Date.now() - startedAt };
  } catch (error) {
    console.error("[ventrio-ai-error]", JSON.stringify({ operation: "first_version_generation", projectId, message: error instanceof Error ? error.message : "unknown" }));
    return { error: t("unavailable"), output: null, reply: null };
  }
}

export async function editProjectOutputAction(
  projectId: string,
  conversationId: string,
  requestId: string,
  instruction: string,
): Promise<Stage3Result> {
  const t = await getTranslations("stage3");
  if (!UUID_PATTERN.test(projectId) || !UUID_PATTERN.test(conversationId) || !TOKEN_PATTERN.test(requestId)) {
    return { error: t("errorInvalid"), output: null, reply: null };
  }
  const message = instruction.trim().slice(0, 2000);
  if (!message) return { error: t("errorInvalid"), output: null, reply: null };
  const { supabase, user, project, stage3 } = await ownedProject(projectId);
  if (!user) return { error: t("errorSession"), output: null, reply: null };
  if (!project || !stage3 || !stage3.output || stage3.conversationId !== conversationId) {
    return { error: t("errorDirection"), output: null, reply: null };
  }
  const locale = project.locale;
  const { data: conversation } = await supabase
    .from("project_ai_conversations")
    .select("id")
    .eq("id", conversationId)
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!conversation) return { error: t("errorDirection"), output: null, reply: null };

  const requestMarker = `edit:${requestId}`;
  const assistantMessageId = stableUuid(`${conversationId}:stage3-assistant:${requestId}`);
  if (stage3.lastRequestId === requestMarker) {
    const { data: existingReply } = await supabase.from("project_ai_messages").select("content").eq("id", assistantMessageId).eq("user_id", user.id).maybeSingle();
    return { error: null, output: stage3.output, reply: existingReply?.content ?? t("editReply"), durationMs: 0 };
  }
  const { data: latestRows } = await supabase
    .from("project_ai_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1);
  const pendingMessageAlreadySaved = latestRows?.[0]?.role === "user" && latestRows[0].content === message;
  if (!pendingMessageAlreadySaved) {
    const { error: userMessageError } = await supabase.from("project_ai_messages").insert({
      id: stableUuid(`${conversationId}:stage3-user:${requestId}`),
      conversation_id: conversationId,
      project_id: projectId,
      user_id: user.id,
      role: "user",
      content: message,
    });
    if (userMessageError && userMessageError.code !== "23505") return { error: t("errorSave"), output: null, reply: null };
  }
  if (!process.env.ANTHROPIC_API_KEY) return { error: t("unavailable"), output: null, reply: null };

  try {
    const startedAt = Date.now();
    const feedbackContext = isFeedbackRequest(message)
      ? await loadFeedbackConversationContext(supabase, projectId, user.id, stage3.output.preset)
      : null;
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 16000,
      output_config: { effort: "medium" },
      system: outputPrompt(locale, true, feedbackContext !== null),
      messages: [{ role: "user", content: JSON.stringify({
        currentOutput: stage3.output,
        requestedEdit: message,
        projectLocale: locale,
        feedbackContext,
      }) }],
    });
    logUsage("project_output_edit", projectId, startedAt, response);
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: t("unavailable"), output: null, reply: null };
    const parsed = parseJsonRelaxed(textBlock.text) as Record<string, unknown>;
    const output = sanitizeStage3Output(parsed.output, stage3.output.preset);
    const reply = typeof parsed.message === "string" ? parsed.message.trim().slice(0, 500) : "";
    if (!output || !reply) return { error: t("unavailable"), output: null, reply: null };
    const nextState: Stage3ProjectState = { ...stage3, status: "first_version_ready", lastRequestId: requestMarker, output };
    const snapshot = mergeStage3ProjectState(project.snapshot_fields, nextState);
    snapshot.solution = output.identity.description;
    snapshot.audience = output.targetUser;
    snapshot.first_version = output.primaryValue;
    const { error } = await supabase.from("projects").update({
      name: output.identity.name,
      target_audience: output.targetUser,
      snapshot_fields: snapshot,
    }).eq("id", projectId).eq("user_id", user.id);
    if (error) return { error: t("errorSave"), output: null, reply: null };
    await supabase.from("project_ai_messages").insert({
      id: assistantMessageId,
      conversation_id: conversationId,
      project_id: projectId,
      user_id: user.id,
      role: "assistant",
      content: reply,
    });
    await supabase.from("project_ai_conversations").update({ title: output.identity.name.slice(0, 60) }).eq("id", conversationId).eq("user_id", user.id);
    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    return { error: null, output, reply, durationMs: Date.now() - startedAt };
  } catch (error) {
    console.error("[ventrio-ai-error]", JSON.stringify({ operation: "project_output_edit", projectId, message: error instanceof Error ? error.message : "unknown" }));
    return { error: t("unavailable"), output: null, reply: null };
  }
}

// ============================================================================
// "Go deeper" — the hybrid live-AI piece of the interactive prototype.
// Owner-only (never called from the public page): the visitor's actual quiz
// answers are sent for one small, un-schema'd text generation that reads
// deeper into their specific answers than the pre-computed outcome can.
// Nothing here is persisted; it's a transient enrichment of the preview.
// ============================================================================

export interface DeepenAnswer { question: string; answer: string }
export type DeepenResult = { error: string | null; text: string | null };

export async function deepenQuizResultAction(
  projectId: string,
  answers: DeepenAnswer[],
  outcomeTitle: string,
): Promise<DeepenResult> {
  const t = await getTranslations("stage3");
  if (!UUID_PATTERN.test(projectId)) return { error: t("errorInvalid"), text: null };
  const { user, project, stage3 } = await ownedProject(projectId);
  if (!user) return { error: t("errorSession"), text: null };
  const interactiveSection = stage3?.output?.sections.find((section) => section.kind === "interactive");
  if (!project || !stage3?.output || !interactiveSection || interactiveSection.experience.kind !== "quiz") {
    return { error: t("errorInvalid"), text: null };
  }
  const cleanOutcomeTitle = outcomeTitle.trim().slice(0, 80);
  const validOutcome = interactiveSection.experience.outcomes.some((outcome) => outcome.title === cleanOutcomeTitle);
  const cleanAnswers = answers
    .slice(0, 6)
    .map((entry) => ({ question: entry.question.trim().slice(0, 140), answer: entry.answer.trim().slice(0, 160) }))
    .filter((entry) => entry.question && entry.answer);
  if (!validOutcome || cleanAnswers.length === 0) return { error: t("errorInvalid"), text: null };
  if (!process.env.ANTHROPIC_API_KEY) return { error: t("unavailable"), text: null };

  try {
    const startedAt = Date.now();
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 500,
      output_config: { effort: "low", format: { type: "json_schema", schema: DEEPEN_SCHEMA } },
      system: deepenPrompt(project.locale),
      messages: [{ role: "user", content: JSON.stringify({
        projectName: stage3.output.identity.name,
        niche: stage3.direction?.niche ?? "",
        answers: cleanAnswers,
        outcomeTitle: cleanOutcomeTitle,
      }) }],
    });
    logUsage("deepen_experience_result", projectId, startedAt, response);
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return { error: t("unavailable"), text: null };
    const parsed = JSON.parse(textBlock.text) as { text?: unknown };
    const text = typeof parsed.text === "string" ? parsed.text.trim().slice(0, 800) : "";
    if (!text) return { error: t("unavailable"), text: null };
    return { error: null, text };
  } catch (error) {
    console.error("[ventrio-ai-error]", JSON.stringify({ operation: "deepen_experience_result", projectId, message: error instanceof Error ? error.message : "unknown" }));
    return { error: t("unavailable"), text: null };
  }
}

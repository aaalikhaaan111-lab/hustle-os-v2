"use server";

import Anthropic from "@anthropic-ai/sdk";
import type { Locale } from "@/i18n/locale";
import { STRUCTURED_FIELDS, isStructuredField, type StructuredField } from "@/lib/build/snapshot";

const PROPOSAL_VALUE_MAX_LENGTH = 800;

// ============================================================================
// Project assistant (chat)
// ============================================================================
// A project-scoped mentor. It answers using ONLY the current project's context
// and stays focused on building/validating/launching/pitching that project.
// Chat-only: it never writes to project data — so "must not change project
// data without confirmation" holds by construction.

export interface AssistantContext {
  projectName: string;
  projectType: string;
  niche: string;
  intendedOutcome: string;
  targetAudience: string | null;
  timeAvailability: string;
  currentStage: string | null;
  currentTaskTitle: string | null;
  snapshot: { label: string; value: string }[];
  pitchSummary: string | null;
  memorySummary: string | null;
  feedbackContext: unknown | null;
}

export interface AssistantTurn {
  role: "user" | "assistant";
  content: string;
}

// A structured result the assistant has extracted from the conversation and
// offers the user to save. Never applied without explicit confirmation.
export interface AssistantProposal {
  field: StructuredField;
  value: string;
  /** Short human label for the field, in the project's language. */
  label: string;
}

export interface AssistantReply {
  text: string;
  proposal: AssistantProposal | null;
}

// The assistant answers in natural language (`reply`) and MAY, at most once per
// turn, surface a structured proposal for one allowlisted field. The flat,
// fully-required shape matches the strict json_schema mode used elsewhere; when
// there's nothing to propose the model sets hasProposal=false / field="none".
const ASSISTANT_SCHEMA = {
  type: "object",
  properties: {
    reply: { type: "string" },
    hasProposal: { type: "boolean" },
    proposalField: { type: "string", enum: [...STRUCTURED_FIELDS, "none"] },
    proposalValue: { type: "string" },
    proposalLabel: { type: "string" },
  },
  required: ["reply", "hasProposal", "proposalField", "proposalValue", "proposalLabel"],
  additionalProperties: false,
};

function assistantSystemPrompt(context: AssistantContext, locale: Locale | string): string {
  const language = locale === "ru" ? "Russian" : "English";
  const redirect =
    locale === "ru"
      ? "Я помогаю именно с этим проектом. Спроси меня об идее, аудитории, проверке, следующих шагах, запуске или питче."
      : "I'm here to help with this project. Ask me about its idea, audience, validation, next steps, launch or pitch.";

  const snapshotLines =
    context.snapshot.length > 0
      ? context.snapshot.map((s) => `- ${s.label}: ${s.value}`).join("\n")
      : "- (nothing saved yet)";

  return `You are the project assistant inside Ventrio, an AI product builder. You help ONE specific project and nothing else. Ventrio BUILDS the first version of a person's product with them — that is the core promise of the app, and you are part of it.

WHEN THE USER ASKS YOU TO BUILD, GENERATE OR CREATE the site / product / first version, that request is legitimate and you must help. Never tell the user that they have to build it themselves, that you do not create sites or products, or that it is "their project to make". Those refusals contradict what Ventrio is. If you have enough context, confirm briefly and positively that the first version is being created. If something essential is genuinely missing, ask the ONE question you actually need — never a list, never a lecture, never a validation interview in place of building.

NEVER GATE BUILDING ON A STAGE. The "Current stage" line below is internal bookkeeping inherited from a retired flow. It is not a gate, not a curriculum, and not something the user chose. Never tell the user what stage the project is "at", never say a first version cannot exist yet because of it, and never use it as a reason to keep asking questions instead of building. Ventrio creates first and improves through conversation, so an imperfect first version always beats another round of discovery.

STAY ON THIS PROJECT. Allowed topics: the project idea, problem, audience, niche, competitors, value proposition, validation, interview questions, research, planning, first version/prototype, relevant tools, testing, launch, feedback, risks, business model, pitch, presentation, next actions, clarifying the current Build task, and entrepreneurship concepts directly connected to THIS project. A design / coding / marketing / research question IS allowed when it clearly helps this project. If a message is unrelated to the project (homework, trivia, other businesses, general chatting), do NOT answer it — reply briefly with exactly: "${redirect}"

BEHAVE LIKE A PRACTICAL BUILDING PARTNER: remember earlier decisions, don't re-ask what's already answered, refer back to the saved context, ask ONE useful clarifying question only when needed, challenge weak assumptions respectfully, separate evidence from guesses, give specific next actions and say why they matter, be concise by default and go deeper only when asked.

NEVER: fabricate market data, interviews, competitors, users, traction, or research; claim work was done that wasn't; change their saved project without confirmation; make financial/legal guarantees; or promise users, income, investment or success. When you give an example, label it clearly as an example, not as their real evidence.

SAVING STRUCTURED RESULTS: You can offer to save ONE structured result to the project's live state, and only these fields: problem, audience, solution, evidence, first_version, test_results. Offer a proposal (set hasProposal=true, proposalField to the field, proposalValue to a concise 1-3 sentence value, proposalLabel to a short name for it in ${language}) ONLY when the user has, in their own words, given you enough to state that field clearly — you are tightening THEIR words, not inventing content. Never propose evidence, first_version, or test_results unless the user actually reported that work; never propose more than one field per turn; never propose a field the user hasn't effectively provided. In every other case set hasProposal=false, proposalField="none", and leave proposalValue/proposalLabel as empty strings. Saving always requires the user's explicit confirmation — describe the proposal briefly in your reply, but never assume it's saved.

LANGUAGE: Write ALL text (reply and any proposalValue/proposalLabel) in ${language}. This is the language of the user's own most recent message, and it overrides the interface language, the language of earlier turns, and the language of any project data you are shown. If the user writes to you in a different language from now on, answer in that language instead — follow the person, never the stored setting. Write the natural-language answer in the "reply" field. Keep replies short and plain.

── THIS PROJECT ──
Name: ${context.projectName}
Type: ${context.projectType} | Niche: ${context.niche} | Goal: ${context.intendedOutcome}
Audience: ${context.targetAudience ?? "not specified yet"}
Weekly time: ${context.timeAvailability}
Current stage: ${context.currentStage ?? "just starting"}${context.currentTaskTitle ? ` | Current task: ${context.currentTaskTitle}` : ""}

Saved work so far (the user's real, confirmed inputs — treat as facts):
${snapshotLines}
${context.pitchSummary ? `\nPitch so far: ${context.pitchSummary}` : ""}
${context.memorySummary ? `\nEarlier in this project's conversations: ${context.memorySummary}` : ""}
${context.feedbackContext ? `

PRIVATE RESPONSE EVIDENCE
The user is asking about real project feedback. Use ONLY the redacted context below for claims about respondents. Never infer identities, expose contact details, invent trends, or claim validation. With 1-2 responses, describe only early individual signals. If totalResponseCount is 0, say there is no response evidence yet.
${JSON.stringify(context.feedbackContext)}` : ""}`;
}

/**
 * Best-effort assistant reply. Returns null when AI is unavailable or fails —
 * the caller then shows a temporary "assistant unavailable" note WITHOUT
 * persisting a fake assistant message or memory. May include a structured
 * proposal the user can choose to save (never applied without confirmation).
 */
export async function generateAssistantReply(
  context: AssistantContext,
  history: AssistantTurn[],
  locale: Locale | string
): Promise<AssistantReply | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (history.length === 0) return null;

  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 1024,
      output_config: {
        effort: "low",
        format: { type: "json_schema", schema: ASSISTANT_SCHEMA },
      },
      system: assistantSystemPrompt(context, locale),
      messages: history.map((turn) => ({ role: turn.role, content: turn.content })),
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    const parsed = JSON.parse(textBlock.text) as {
      reply?: unknown;
      hasProposal?: unknown;
      proposalField?: unknown;
      proposalValue?: unknown;
      proposalLabel?: unknown;
    };

    const text = typeof parsed.reply === "string" ? parsed.reply.trim() : "";
    if (text.length === 0) return null;

    let proposal: AssistantProposal | null = null;
    if (
      parsed.hasProposal === true &&
      isStructuredField(parsed.proposalField) &&
      typeof parsed.proposalValue === "string" &&
      parsed.proposalValue.trim().length > 0
    ) {
      proposal = {
        field: parsed.proposalField,
        value: parsed.proposalValue.trim().slice(0, PROPOSAL_VALUE_MAX_LENGTH),
        label:
          typeof parsed.proposalLabel === "string" && parsed.proposalLabel.trim().length > 0
            ? parsed.proposalLabel.trim().slice(0, 80)
            : parsed.proposalField,
      };
    }

    return { text, proposal };
  } catch {
    return null;
  }
}

/**
 * Compresses older conversation turns into a short structured memory summary.
 * Best-effort — returns null on any failure and the caller keeps the previous
 * summary rather than inventing memory.
 */
export async function summarizeProjectMemory(
  previousSummary: string | null,
  olderTurns: AssistantTurn[],
  locale: Locale | string
): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (olderTurns.length === 0) return null;

  const language = locale === "ru" ? "Russian" : "English";
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      output_config: { effort: "low" },
      system: `You maintain a compact memory of a teenager's project mentoring conversation. Update the running summary with anything important from the new messages: decisions the user confirmed, facts they gave, assumptions still to validate, risks identified, and current priorities/next actions. Keep it under ~120 words, factual, and clearly separate confirmed facts from open questions. Do NOT invent anything. Write in ${language}. Return only the updated summary text.`,
      messages: [
        {
          role: "user",
          content: JSON.stringify({
            previousSummary: previousSummary ?? "(none yet)",
            newMessages: olderTurns.map((t) => `${t.role}: ${t.content}`),
          }),
        },
      ],
    });
    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;
    const text = textBlock.text.trim();
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}

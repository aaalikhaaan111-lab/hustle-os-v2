"use server";

import Anthropic from "@anthropic-ai/sdk";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ResearchReport } from "@/types/venture";

export interface ActivateResearchResult {
  error: string | null;
  report?: ResearchReport;
}

const RESEARCH_REPORT_SCHEMA = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    opportunities: { type: "array", items: { type: "string" } },
    risks: { type: "array", items: { type: "string" } },
    questions: { type: "array", items: { type: "string" } },
    assumptions: { type: "array", items: { type: "string" } },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    confidenceRationale: { type: "string" },
  },
  required: [
    "executiveSummary",
    "opportunities",
    "risks",
    "questions",
    "assumptions",
    "confidence",
    "confidenceRationale",
  ],
  additionalProperties: false,
};

const SYSTEM_PROMPT = `You are the Research department inside Ventrio, a venture operating system for first-time founders. You analyze a founder's mission and produce a grounded, honest early-stage research report.

Be specific to the mission described — ground every point in the realities of this particular venture, not generic startup advice. Ask the questions a sharp early-stage investor or co-founder would ask. Name assumptions you had to make because the founder didn't specify them. Give an honest confidence rating: most early-stage ideas without market validation should be "low" or "medium", not "high". Do not repeat the mission back verbatim.`;

interface VentureForResearch {
  mission: string;
  budget: string | null;
  deadline: string | null;
  location: string | null;
  resources: string | null;
}

function buildUserPrompt(venture: VentureForResearch): string {
  const lines = [
    `Mission: ${venture.mission}`,
    venture.budget ? `Budget: ${venture.budget}` : null,
    venture.deadline ? `Deadline: ${venture.deadline}` : null,
    venture.location ? `Location: ${venture.location}` : null,
    venture.resources ? `Available resources: ${venture.resources}` : null,
  ].filter((line): line is string => Boolean(line));

  return `Analyze this venture and produce a research report.\n\n${lines.join("\n")}`;
}

export async function activateResearchAction(
  ventureId: string
): Promise<ActivateResearchResult> {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Your session has expired. Please log in again." };
  }

  const { data: venture, error: fetchError } = await supabase
    .from("ventures")
    .select("id, mission, budget, deadline, location, resources")
    .eq("id", ventureId)
    .single();

  if (fetchError || !venture) {
    return { error: "Venture not found." };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      error: "The Research department isn't connected yet — no AI provider is configured.",
    };
  }

  let report: ResearchReport;
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 8192,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "high",
        format: { type: "json_schema", schema: RESEARCH_REPORT_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: buildUserPrompt(venture) }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return { error: "The Research department didn't return a usable report. Please try again." };
    }
    report = JSON.parse(textBlock.text) as ResearchReport;
  } catch {
    return { error: "The Research department couldn't complete its analysis. Please try again." };
  }

  const { error: saveError } = await supabase
    .from("ventures")
    .update({
      research_report: report,
      research_completed_at: new Date().toISOString(),
    })
    .eq("id", ventureId);

  if (saveError) {
    return { error: "Analysis complete, but saving it failed. Please try again." };
  }

  revalidatePath(`/ventures/${ventureId}`);
  return { error: null, report };
}

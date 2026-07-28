import { buildStage3OutputJsonSchema } from "@/lib/build/stage3Types";
import { FEEDBACK_CONFIDENCES, FEEDBACK_PRIORITIES, FEEDBACK_TARGETS } from "@/lib/feedback/types";

export const FEEDBACK_ANALYSIS_SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string" },
    signals: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string" },
          evidence: { type: "string" },
          responseCount: { type: "integer" },
          confidence: { type: "string", enum: [...FEEDBACK_CONFIDENCES] },
          implication: { type: "string" },
        },
        required: ["title", "evidence", "responseCount", "confidence", "implication"],
        additionalProperties: false,
      },
    },
    uncertainties: { type: "array", items: { type: "string" } },
    recommendedChanges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          reason: { type: "string" },
          target: { type: "string", enum: [...FEEDBACK_TARGETS] },
          priority: { type: "string", enum: [...FEEDBACK_PRIORITIES] },
        },
        required: ["id", "title", "reason", "target", "priority"],
        additionalProperties: false,
      },
    },
  },
  required: ["summary", "signals", "uncertainties", "recommendedChanges"],
  additionalProperties: false,
};

const STAGE3_OUTPUT_SCHEMA = buildStage3OutputJsonSchema();

export const FEEDBACK_IMPROVEMENT_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string" },
    current: { type: "string" },
    proposed: { type: "string" },
    output: STAGE3_OUTPUT_SCHEMA,
  },
  required: ["title", "current", "proposed", "output"],
  additionalProperties: false,
};

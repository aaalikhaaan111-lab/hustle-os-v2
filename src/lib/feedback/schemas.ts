import { V1_PRESETS } from "@/lib/build/creationTypes";
import {
  OUTPUT_CTA_ACTIONS,
  OUTPUT_FIELD_TYPES,
  OUTPUT_SECTION_TYPES,
} from "@/lib/build/stage3Types";
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

const STAGE3_OUTPUT_SCHEMA = {
  type: "object",
  properties: {
    version: { type: "integer", enum: [1] },
    preset: { type: "string", enum: [...V1_PRESETS] },
    identity: {
      type: "object",
      properties: {
        name: { type: "string" },
        tagline: { type: "string" },
        description: { type: "string" },
      },
      required: ["name", "tagline", "description"],
      additionalProperties: false,
    },
    targetUser: { type: "string" },
    primaryValue: { type: "string" },
    visual: {
      type: "object",
      properties: {
        mood: { type: "string" },
        palette: { type: "array", items: { type: "string" } },
        styleNotes: { type: "string" },
      },
      required: ["mood", "palette", "styleNotes"],
      additionalProperties: false,
    },
    hero: {
      type: "object",
      properties: {
        eyebrow: { type: "string" },
        headline: { type: "string" },
        subheadline: { type: "string" },
      },
      required: ["eyebrow", "headline", "subheadline"],
      additionalProperties: false,
    },
    sections: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: [...OUTPUT_SECTION_TYPES] },
          title: { type: "string" },
          body: { type: "string" },
          items: {
            type: "array",
            items: {
              type: "object",
              properties: { title: { type: "string" }, body: { type: "string" } },
              required: ["title", "body"],
              additionalProperties: false,
            },
          },
        },
        required: ["type", "title", "body", "items"],
        additionalProperties: false,
      },
    },
    cta: {
      type: "object",
      properties: {
        label: { type: "string" },
        action: { type: "string", enum: [...OUTPUT_CTA_ACTIONS] },
        supportingText: { type: "string" },
      },
      required: ["label", "action", "supportingText"],
      additionalProperties: false,
    },
    form: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        submitLabel: { type: "string" },
        fields: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              label: { type: "string" },
              type: { type: "string", enum: [...OUTPUT_FIELD_TYPES] },
              required: { type: "boolean" },
              options: { type: "array", items: { type: "string" } },
            },
            required: ["id", "label", "type", "required", "options"],
            additionalProperties: false,
          },
        },
      },
      required: ["title", "description", "submitLabel", "fields"],
      additionalProperties: false,
    },
    launchCopy: {
      type: "object",
      properties: {
        headline: { type: "string" },
        body: { type: "string" },
        shortPost: { type: "string" },
      },
      required: ["headline", "body", "shortPost"],
      additionalProperties: false,
    },
  },
  required: [
    "version", "preset", "identity", "targetUser", "primaryValue",
    "visual", "hero", "sections", "cta", "form", "launchCopy",
  ],
  additionalProperties: false,
};

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

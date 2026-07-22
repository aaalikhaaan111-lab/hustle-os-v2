import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

export function validatePublicResponse(
  output: Stage3ProjectOutput,
  value: unknown,
): Record<string, string> | null {
  const raw = record(value);
  if (!raw || Object.keys(raw).length > output.form.fields.length) return null;
  const allowedIds = new Set(output.form.fields.map((field) => field.id));
  if (Object.keys(raw).some((key) => !allowedIds.has(key))) return null;

  const clean: Record<string, string> = {};
  for (const field of output.form.fields) {
    const supplied = raw[field.id];
    if (supplied === undefined) {
      if (field.required) return null;
      continue;
    }
    if (typeof supplied !== "string") return null;

    let text = supplied.trim();
    const maximum = field.type === "textarea" ? 2000
      : field.type === "email" ? 254
        : field.type === "select" ? 80
          : 320;
    if (text.length > maximum || (field.required && text.length === 0)) return null;
    if (field.type === "email" && text) {
      text = text.toLocaleLowerCase();
      if (!EMAIL_PATTERN.test(text)) return null;
    }
    if (field.type === "select" && text && !field.options.includes(text)) return null;
    clean[field.id] = text;
  }

  return Object.values(clean).some(Boolean) ? clean : null;
}

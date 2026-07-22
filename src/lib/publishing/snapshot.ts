import type { Stage3ProjectOutput } from "@/lib/build/stage3Types";

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

export function publicationMatchesDraft(
  publication: Stage3ProjectOutput,
  draft: Stage3ProjectOutput,
): boolean {
  return JSON.stringify(canonicalize(publication)) === JSON.stringify(canonicalize(draft));
}

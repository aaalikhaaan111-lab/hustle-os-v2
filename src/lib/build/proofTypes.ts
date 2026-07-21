// Shared proof-of-work types + validation, used by both the server actions and
// the client UI.

export type ProofType = "url" | "image" | "file" | "note";

export const PROOF_TYPES: readonly ProofType[] = ["url", "image", "file", "note"] as const;

export function isProofType(value: unknown): value is ProofType {
  return typeof value === "string" && (PROOF_TYPES as readonly string[]).includes(value);
}

export const PROOF_TITLE_MAX = 120;
export const PROOF_DESCRIPTION_MAX = 500;
export const PROOF_URL_MAX = 2000;

// Upload limits. Kept deliberately tight — this is lightweight evidence, not a
// file host. MIME allowlists block executables and other risky types.
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024; // 5 MB
export const FILE_MAX_BYTES = 10 * 1024 * 1024; // 10 MB

export const IMAGE_MIME_ALLOWLIST: readonly string[] = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];

export const FILE_MIME_ALLOWLIST: readonly string[] = [
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

export interface ProofItem {
  id: string;
  type: ProofType;
  title: string;
  description: string | null;
  taskId: string | null;
  stage: string | null;
  createdAt: string;
  /** External link (type "url"). */
  linkUrl: string | null;
  /** Short-lived signed URL for an uploaded image/file (never a public URL). */
  fileUrl: string | null;
}

/** Only http(s) links are accepted; everything else is rejected. */
export function isSafeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

// Strips any path components and unsafe characters from an uploaded file's
// name, preserving a short, recognisable, storage-safe basename.
export function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  const cleaned = base
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_+/g, "_")
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : "file";
}

import { CREATION_LIMITS, isStartingPoint, type CreationStartingPoint } from "@/lib/build/creationTypes";

// A "seed" is the visitor's very first creation message, captured on the public
// homepage before they have a draft (and, when logged out, before they even
// have an account). It is carried into /create through sessionStorage — never a
// URL, so the message stays private — and consumed exactly once there.
//
// sessionStorage (not localStorage) keeps it tab-scoped and short-lived: it
// survives the same-tab redirect through signup, and disappears when the tab
// closes. A timestamp guards against a stale seed being replayed much later.

const SEED_KEY = "ventrio:create-seed";
const MAX_AGE_MS = 30 * 60 * 1000; // 30 minutes

export interface CreationSeed {
  message: string;
  startingPoint: CreationStartingPoint | null;
  ts: number;
}

export function writeSeed(message: string, startingPoint: CreationStartingPoint | null): void {
  const trimmed = message.trim().slice(0, CREATION_LIMITS.message);
  if (!trimmed) return;
  try {
    window.sessionStorage.setItem(
      SEED_KEY,
      JSON.stringify({ message: trimmed, startingPoint, ts: Date.now() } satisfies CreationSeed)
    );
  } catch {
    // Private mode / storage disabled: the seed is simply not carried. The user
    // lands on /create and types again — never a duplicate, just less seamless.
  }
}

// Reads and removes the seed in one step (consume-once). Returns null when
// absent, malformed, or older than the freshness window.
export function takeSeed(): CreationSeed | null {
  let raw: string | null = null;
  try {
    raw = window.sessionStorage.getItem(SEED_KEY);
    if (raw) window.sessionStorage.removeItem(SEED_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<CreationSeed>;
    const message = typeof parsed.message === "string" ? parsed.message.trim().slice(0, CREATION_LIMITS.message) : "";
    const ts = typeof parsed.ts === "number" ? parsed.ts : 0;
    if (!message || Date.now() - ts > MAX_AGE_MS) return null;
    return {
      message,
      startingPoint: isStartingPoint(parsed.startingPoint) ? parsed.startingPoint : null,
      ts,
    };
  } catch {
    return null;
  }
}

export function clearSeed(): void {
  try {
    window.sessionStorage.removeItem(SEED_KEY);
  } catch {
    // no-op
  }
}

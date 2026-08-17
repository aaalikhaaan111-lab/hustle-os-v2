import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * The standard shadcn `cn`.
 *
 * This was a hand-rolled joiner that flattened arrays and dropped falsy values.
 * It was correct for the call sites that existed, and wrong for the component
 * set now installed, in two ways that both fail silently:
 *
 *   - clsx's OBJECT form (`{ "h-2.5 w-2.5": cond }`) is what upstream shadcn
 *     components use for conditional classes. The old signature rejected it,
 *     which is what surfaced this;
 *   - `tailwind-merge` is what makes a `className` prop actually override a
 *     component's own class. Without it, passing `h-10` to something built on
 *     `h-9` produces `"h-9 h-10"` and the winner is decided by stylesheet
 *     order rather than by the caller. Every shadcn component's API assumes
 *     the caller wins.
 *
 * Existing call sites pass strings, arrays and falsy values, all of which clsx
 * handles identically — so this is a widening, not a behaviour change.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

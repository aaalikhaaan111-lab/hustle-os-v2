import type { Json } from "@/types/supabase";

/**
 * Hands a domain object to a `jsonb` column.
 *
 * The generated `Json` type is a structural union — objects must carry an index
 * signature to match it. Our domain interfaces deliberately do not: they are
 * precise shapes with named fields, and adding `[key: string]: Json` to each
 * one would let any typo through and defeat the reason they exist.
 *
 * So the widening happens here, once, instead of at a dozen call sites. The
 * cast is real and this is the honest place to look at it: what it asserts is
 * that the value is plain JSON-serialisable data — no Date, no Map, no class
 * instance, no function, no `undefined` where the column expects a value.
 * Everything passed through it is built by our own parsers and validators from
 * data that arrived as JSON in the first place, which is what makes that
 * assertion true rather than hopeful.
 *
 * If you reach for this with something you did not construct yourself, validate
 * it first — this widens types, it does not check them.
 */
export function toJson(value: object): Json {
  return value as unknown as Json;
}

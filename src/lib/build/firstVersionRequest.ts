/**
 * The body of the first-version model call.
 *
 * Pure and dependency-free on purpose. It lives outside the server action so a
 * test can assert on the actual request the model receives, rather than on a
 * client-side object that merely resembles it — "the value was in the payload
 * the component built" says nothing about whether it survived to the request.
 * The action has no other way to construct a body.
 */

export interface FirstVersionIntake {
  productType?: string;
  designDirection?: string;
}

export function buildFirstVersionUserContent(
  direction: unknown,
  locale: string,
  intake?: FirstVersionIntake | null,
): string {
  // A fully-deferred intake omits the key entirely rather than sending nulls,
  // so the model sees exactly the input it would have seen before this feature
  // existed — deferring costs the generation nothing, not even a field to
  // interpret.
  const hasIntake = !!intake && (!!intake.productType || !!intake.designDirection);
  return JSON.stringify({
    direction,
    projectLocale: locale,
    ...(hasIntake ? { intake } : {}),
  });
}

import type { RelativeAge } from "./present";

/**
 * Turns the unit-and-count `presentProject` returns into words.
 *
 * Kept separate from `present.ts` because that module runs on the server and
 * has no translator, and separate from the screens because both the overview
 * and the projects list show the same ages and must not drift apart. The
 * translator is taken as a parameter rather than imported so this stays usable
 * from a server component too.
 */
type AgeKey = "timeUnknown" | "timeToday" | "timeYesterday" | "timeDays" | "timeMonths" | "timeYears";

type Translate = (key: AgeKey, values?: { count: number }) => string;

export function formatAge(t: Translate, age: RelativeAge): string {
  switch (age.unit) {
    case "today":
      return t("timeToday");
    case "yesterday":
      return t("timeYesterday");
    case "days":
      return t("timeDays", { count: age.value });
    case "months":
      return t("timeMonths", { count: age.value });
    case "years":
      return t("timeYears", { count: age.value });
    default:
      return t("timeUnknown");
  }
}

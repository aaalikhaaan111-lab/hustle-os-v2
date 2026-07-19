// The tour runs in three phases: an intro card that states the user's goal,
// the nav-spotlight steps, and a closing offer to start the first challenge.
export type TourStage = "intro" | "steps" | "offer";

export interface TourState {
  active: boolean;
  completed: boolean;
  step: number;
  stage: TourStage;
}

const DEFAULT_STATE: TourState = { active: false, completed: false, step: 0, stage: "steps" };

function storageKey(userId: string): string {
  return `hustle:tour:${userId}`;
}

export function readTourState(userId: string): TourState {
  if (typeof window === "undefined") return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<TourState>;
    return {
      active: parsed.active ?? false,
      completed: parsed.completed ?? false,
      step: parsed.step ?? 0,
      // Records written before the intro/offer phases existed have no stage;
      // treating them as "steps" keeps any in-flight legacy tour working.
      stage: parsed.stage ?? "steps",
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function writeTourState(userId: string, state: TourState): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

// Called right after onboarding completes, before the user is routed to
// /dashboard — ProductTour (mounted globally) picks this up on its own next
// render and starts the tour at the intro (goal) card.
export function startTour(userId: string): void {
  writeTourState(userId, { active: true, completed: false, step: 0, stage: "intro" });
}

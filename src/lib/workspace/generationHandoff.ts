"use client";

/**
 * The handoff from "the generation finished" to "you are looking at it".
 *
 * THE BUG THIS EXISTS FOR. On a real iPhone a generation completed and the
 * workspace did not show the result. The person had to go to Projects, open the
 * project again, and only then did the preview appear. That is the core product
 * loop failing at its most important moment.
 *
 * WHY A MARKER RATHER THAN STATE. The two halves of the transition live in
 * different components, and the swap between them is the transition: while a
 * generation runs, `WorkspaceView` renders `PreOutputWorkspace`; once a version
 * exists it renders `BuildScreen` instead. `PreOutputWorkspace` is the half that
 * sees the job succeed, and it is unmounted by the very refresh that makes the
 * result available — so it cannot hand anything down, and `BuildScreen` mounts
 * with no idea that anything just happened.
 *
 * `sessionStorage` is what survives that swap, and survives the `router.refresh`
 * in between. It is scoped to the tab, cleared on read, and keyed by project, so
 * the panel opens exactly once for the generation that just finished and never
 * again on a later visit.
 *
 * Deliberately not `localStorage`: a marker that outlived the tab would open the
 * preview on some unrelated future visit, which is a different wrong behaviour
 * from the one being fixed.
 */

const KEY_PREFIX = "ventrio:generation-arrived:";

function key(projectId: string): string {
  return `${KEY_PREFIX}${projectId}`;
}

/**
 * Called when a job is observed to have succeeded, before the refresh that
 * replaces this screen.
 */
export function markGenerationArrived(projectId: string): void {
  try {
    window.sessionStorage.setItem(key(projectId), "1");
  } catch {
    // A browser refusing storage loses the automatic open, not the result: the
    // preview is still one tap away on the toolbar.
  }
}

/**
 * True exactly once per finished generation. Reading consumes it, so a
 * re-render, a second mount or a later navigation does not re-trigger.
 */
function consumeGenerationArrived(projectId: string): boolean {
  try {
    const found = window.sessionStorage.getItem(key(projectId)) === "1";
    if (found) window.sessionStorage.removeItem(key(projectId));
    return found;
  } catch {
    return false;
  }
}

/**
 * The same answer, in a shape `useSyncExternalStore` can read.
 *
 * The consume has to happen exactly once, but a snapshot function must be pure
 * and must return a stable value for as long as nothing changed — React calls
 * it during render, more than once, and twice per render under StrictMode. So
 * the first call consumes and every later call returns what it decided.
 *
 * A store rather than an effect because `setState` inside an effect is a
 * cascading render, and because the panel's other stored preference is read the
 * same way in `BuildScreen`. The server snapshot is always false: session
 * storage does not exist there, and a generation that just arrived is by
 * definition something this tab witnessed.
 */
const decided = new Map<string, boolean>();

export function generationArrivedSnapshot(projectId: string): boolean {
  const known = decided.get(projectId);
  if (known !== undefined) return known;
  const found = consumeGenerationArrived(projectId);
  decided.set(projectId, found);
  return found;
}

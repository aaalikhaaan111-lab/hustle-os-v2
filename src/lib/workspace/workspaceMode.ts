"use client";

/**
 * Which half of the workspace the person is looking at: the conversation, or
 * the thing it produced.
 *
 * WHY THIS IS A STORE AND NOT COMPONENT STATE. The two halves of the workspace
 * are different components and the swap between them is the moment that matters:
 * while a generation runs, `WorkspaceView` renders `PreOutputWorkspace`; once a
 * version exists it renders `BuildScreen` instead. The screen that watches the
 * job succeed is unmounted by the very refresh that makes the result available,
 * so it cannot hand anything down. A module-level store survives that swap
 * because `router.refresh()` is a soft refresh, not a page load.
 *
 * WHY IT NOTIFIES, which is the whole point. The previous attempt at this used
 * `useSyncExternalStore` with a `subscribe` that never fired and a snapshot that
 * cached its answer — a cache added to satisfy the purity rule, because reading
 * consumed a `sessionStorage` marker. `BuildScreen` is rendered from the first
 * render by `PreOutputWorkspace`, so the snapshot ran before any generation had
 * finished, cached `false`, and returned that forever. The generation then
 * completed, wrote its marker, and nothing re-read it: the preview never opened
 * and the person had to reopen the project from Projects. The tests asserted the
 * shape of that code and passed.
 *
 * So: a real subscription, a value that changes, and no consume-on-read.
 */

export type WorkspaceMode = "chat" | "preview";

/** An explicit choice, per project. Absent means "no one has decided yet". */
const chosen = new Map<string, WorkspaceMode>();
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

export function subscribeWorkspaceMode(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => { listeners.delete(onChange); };
}

/** The explicit choice for this project, or null when there is none. */
export function chosenWorkspaceMode(projectId: string): WorkspaceMode | null {
  return chosen.get(projectId) ?? null;
}

/** A deliberate switch — the segmented control, or closing the panel. */
export function chooseWorkspaceMode(projectId: string, mode: WorkspaceMode): void {
  if (chosen.get(projectId) === mode) return;
  chosen.set(projectId, mode);
  emit();
}

/**
 * A generation just landed: show it.
 *
 * Overrides an earlier "chat" choice on purpose. Someone who closed the preview
 * ten minutes ago did not thereby ask to be kept away from the result they then
 * waited three minutes for — and on a phone closing it is simply how you get
 * back to the conversation, so a stale preference there means almost nothing.
 * Chat remains one tap away.
 */
export function showGeneratedResult(projectId: string): void {
  chooseWorkspaceMode(projectId, "preview");
}

/** Test seam: forget every choice. */
export function resetWorkspaceModes(): void {
  chosen.clear();
  emit();
}

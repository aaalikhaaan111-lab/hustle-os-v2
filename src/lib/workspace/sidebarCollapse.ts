/**
 * Whether the desktop sidebar is collapsed.
 *
 * A module-level store rather than component state, for the reason every other
 * persisted preference in this workspace uses one: the value has to be readable
 * during render (so there is no flash of the wrong width), writable from an
 * event handler, and identical on the server and on the first client render (so
 * hydration does not mismatch).
 *
 * `useSyncExternalStore` gives all three. The SERVER snapshot is always
 * `false` — the server cannot know a browser preference, and claiming one would
 * render an expanded sidebar into HTML that the client immediately collapses.
 * The stored value is picked up on the first client read instead.
 *
 * Reading `localStorage` lazily and caching it keeps `getSnapshot` referentially
 * stable, which `useSyncExternalStore` requires: returning a fresh value on
 * every call makes React re-render forever.
 */
const KEY = "ventrio:sidebar-collapsed";

let cached: boolean | null = null;
const listeners = new Set<() => void>();

function read(): boolean {
  if (cached !== null) return cached;
  try {
    cached = window.localStorage.getItem(KEY) === "1";
  } catch {
    // A browser refusing storage still gets a working toggle for the session.
    cached = false;
  }
  return cached;
}

export function subscribeSidebarCollapsed(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

export function sidebarCollapsed(): boolean {
  return read();
}

/** The server, and the first render on the client, agree on this. */
export function sidebarCollapsedServer(): boolean {
  return false;
}

export function toggleSidebarCollapsed(): void {
  const next = !read();
  cached = next;
  try {
    window.localStorage.setItem(KEY, next ? "1" : "0");
  } catch {
    // ignore
  }
  for (const listener of listeners) listener();
}

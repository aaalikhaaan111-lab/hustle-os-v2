/**
 * Keeping project pictures up to date, one small batch per idle tick.
 *
 * WHY IT IS NOT PART OF THE GENERATION PATH. A screenshot is worth nothing next
 * to a generation, and the job path carries the quota accounting — a browser
 * that hangs or an upload that fails must not be able to delay a claim, a
 * refund or a heartbeat. So this runs only when `processOne` found nothing to
 * do, takes a couple of projects, and stops.
 *
 * That also makes the trigger fall out for free rather than needing to be
 * wired: a project becomes due the moment its `updated_at` moves past its
 * `thumbnail_captured_at`, which covers a first generation, a regeneration, an
 * edit and a publish without any of them having to call anything.
 */

import { createServiceClient } from "../src/lib/supabase/public";
import { readAppState } from "../src/lib/v2/app/projectState";
import { captureAppThumbnail } from "./thumbnail";

const BUCKET = "project-thumbnails";

/** Small: this is background work that must never crowd out a generation. */
const BATCH = Number(process.env.VENTRIO_THUMBNAIL_BATCH ?? 2);

type Log = (event: string, fields?: Record<string, unknown>) => void;

/**
 * Captures pictures for up to `BATCH` projects that need one.
 *
 * Returns how many were written, so the loop can tell "did work" from "idle".
 */
export async function captureDueThumbnails(log: Log): Promise<number> {
  const supabase = createServiceClient();

  /**
   * Candidates, oldest first.
   *
   * The staleness rule lives in the `projects_needing_thumbnail` view, because
   * PostgREST filters compare a column to a VALUE and never to another column —
   * `thumbnail_captured_at < updated_at` is not expressible as a query
   * parameter. Whether a project has a generated APP is decided in JavaScript
   * below, because the state is inside `snapshot_fields` and validating it is
   * `readAppState`'s job, not a JSON path expression's.
   */
  const { data, error } = await supabase
    .from("projects_needing_thumbnail")
    .select("id, updated_at, snapshot_fields")
    .order("updated_at", { ascending: false })
    .limit(BATCH * 6);

  if (error || !data) {
    log("thumbnail_query_failed", { error: error?.message.slice(0, 160) });
    return 0;
  }

  let written = 0;

  for (const row of data) {
    if (written >= BATCH) break;

    const state = readAppState(row.snapshot_fields);
    // No generated app: nothing to photograph. The gallery draws these from
    // their own content instead, which is already a real picture of them.
    if (!state) continue;

    const startedAt = Date.now();
    const png = await captureAppThumbnail(state.app);

    if (!png) {
      /**
       * STAMP THE ATTEMPT ANYWAY.
       *
       * Without this, a project that cannot be captured — one that no longer
       * compiles, say — stays permanently at the front of the queue and the
       * worker retries it on every idle tick forever, never reaching the
       * projects behind it. Recording the attempt moves it out of the candidate
       * set until something about the project changes, which is exactly when it
       * is worth trying again.
       */
      await supabase
        .from("projects")
        .update({ thumbnail_captured_at: new Date().toISOString() })
        .eq("id", row.id);
      log("thumbnail_skipped", { projectId: row.id, durationMs: Date.now() - startedAt });
      continue;
    }

    /**
     * ONE OBJECT PER PROJECT, OVERWRITTEN.
     *
     * A new path per capture would leave an orphan behind on every
     * regeneration, and nothing ever deletes them. The URL carries the capture
     * time as a query parameter instead, so a browser holding the old image
     * still fetches the new one.
     */
    const path = `${row.id}.png`;
    const upload = await supabase.storage.from(BUCKET).upload(path, png, {
      contentType: "image/png",
      upsert: true,
      cacheControl: "31536000",
    });

    if (upload.error) {
      log("thumbnail_upload_failed", {
        projectId: row.id,
        error: upload.error.message.slice(0, 160),
      });
      continue;
    }

    const capturedAt = new Date().toISOString();
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const url = `${pub.publicUrl}?v=${Date.parse(capturedAt)}`;

    const { error: writeError } = await supabase
      .from("projects")
      .update({ thumbnail_url: url, thumbnail_captured_at: capturedAt })
      .eq("id", row.id);

    if (writeError) {
      log("thumbnail_write_failed", { projectId: row.id, error: writeError.message.slice(0, 160) });
      continue;
    }

    written += 1;
    log("thumbnail_captured", {
      projectId: row.id,
      bytes: png.byteLength,
      durationMs: Date.now() - startedAt,
    });
  }

  return written;
}

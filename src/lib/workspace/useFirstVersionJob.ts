"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { getFirstVersionJobAction } from "@/lib/actions/stage3";
import { MAX_FIRST_VERSION_ATTEMPTS, type FirstVersionJobView } from "@/lib/jobs/firstVersion";
import type { JobErrorCode, JobStage } from "@/lib/jobs/generationJobs";

/**
 * Watches the first-version generation job.
 *
 * The interface state is derived from the database row rather than from the
 * promise the click returned, which is what lets a refresh mid-generation pick
 * the progress back up. `creating_job` is the one state that is purely local —
 * it exists so the button reacts on the very first frame instead of waiting a
 * round trip to find out a row was written.
 *
 * Polling, not realtime: there is no realtime subscription in the product
 * today, and one connection per open Build screen is a lot of moving parts to
 * introduce for a single row that changes maybe four times in ninety seconds.
 */

export type FirstVersionPhase =
  | "idle"
  | "creating_job"
  | "queued"
  | "running"
  | "succeeded"
  | "failed"
  | "retrying"
  | "stale";

const POLL_MS = 2000;

export interface FirstVersionJobState {
  phase: FirstVersionPhase;
  stage: JobStage | null;
  errorCode: JobErrorCode | null;
  attemptsRemaining: number;
  /** True while a job is genuinely in flight — drives the disabled state. */
  active: boolean;
  /**
   * True once the job row has actually been read.
   *
   * Before the first poll returns there is no view, so `phase` reads "idle" —
   * indistinguishable from a project that has never generated. Anything that
   * must not appear over a running job has to wait for this, or it renders in
   * the gap and then disappears, which is how the build question came back
   * after a generation had already finished.
   */
  loaded: boolean;
  canRetry: boolean;
  /** Call the moment the button is pressed, before any await. */
  markStarting: (retry?: boolean) => void;
  /** Call when the generation action settles, whatever the outcome. */
  settle: () => void;
  refresh: () => void;
}

export function useFirstVersionJob(projectId: string, hasOutput: boolean): FirstVersionJobState {
  const [view, setView] = useState<FirstVersionJobView | null>(null);
  const [local, setLocal] = useState<"creating_job" | "retrying" | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const refresh = useCallback(() => {
    void getFirstVersionJobAction(projectId).then((next) => {
      if (!mounted.current) return;
      setView(next);
      // The row has caught up with the click; stop showing the local state.
      if (next.job && (next.job.status === "running" || next.job.status === "queued")) setLocal(null);
    });
  }, [projectId]);

  // Read once on mount so a refresh during generation recovers the progress,
  // then keep polling only while something is actually in flight.
  useEffect(() => {
    if (hasOutput) return;
    refresh();
  }, [hasOutput, refresh]);

  const job = view?.job ?? null;
  const inFlight = !hasOutput && (local !== null || job?.status === "running" || job?.status === "queued");

  useEffect(() => {
    if (!inFlight) return;
    const id = window.setInterval(refresh, POLL_MS);
    return () => window.clearInterval(id);
  }, [inFlight, refresh]);

  /**
   * Catch up the moment the tab comes back, because on a phone it will have left.
   *
   * A generation takes two to four minutes and nobody watches a progress bar for
   * that long — they switch apps. iOS then throttles the timer to nothing and
   * may suspend the page outright, so the interval above is not a promise that
   * anything is being polled. It can also restore the page from the back/forward
   * cache, where effects do not re-run and `setInterval` resumes having missed
   * the entire generation.
   *
   * This is what makes the mobile flow recover: on returning to the tab, ask
   * once, immediately, rather than waiting for a timer that may never fire.
   * `pageshow` is listed separately because `visibilitychange` does not fire for
   * a bfcache restore.
   *
   * Not gated on `inFlight`: the whole point is that this tab's idea of what is
   * in flight may be minutes stale.
   */
  useEffect(() => {
    if (hasOutput) return;
    const catchUp = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", catchUp);
    window.addEventListener("pageshow", catchUp);
    window.addEventListener("focus", catchUp);
    return () => {
      document.removeEventListener("visibilitychange", catchUp);
      window.removeEventListener("pageshow", catchUp);
      window.removeEventListener("focus", catchUp);
    };
  }, [hasOutput, refresh]);

  const markStarting = useCallback((retry = false) => {
    setLocal(retry ? "retrying" : "creating_job");
  }, []);

  /**
   * The generation call has returned — reconcile with the row it created.
   *
   * THE RETRY BUG THIS FIXES. `setLocal(null)` fired immediately and `refresh()`
   * resolved a round trip later. In that gap the optimistic "retrying" phase was
   * already gone while `view` still held the FAILED row from before the click,
   * so the screen fell straight back to the error and its Try again button — the
   * exact state the person had just left. Worse, `inFlight` is derived from the
   * same pair, so the poller tore down in that gap too: if the refresh then
   * landed on a row the worker had not yet claimed, nothing was left running to
   * ask again, and the failure stayed on screen until the browser was reloaded
   * by hand. That is the reported "retry does not recover without a refresh".
   *
   * Clearing the local phase only once the authoritative row is in hand puts
   * both writes in one commit, so there is no frame where the UI is describing a
   * job that has been superseded. If the retry genuinely failed the row says so
   * and the error returns honestly; if it was accepted the row is queued or
   * running and the poller keeps going without ever having stopped.
   */
  const settle = useCallback(() => {
    void getFirstVersionJobAction(projectId).then((next) => {
      if (!mounted.current) return;
      setView(next);
      setLocal(null);
    });
  }, [projectId]);

  const attemptsRemaining = view?.attemptsRemaining ?? MAX_FIRST_VERSION_ATTEMPTS;

  let phase: FirstVersionPhase = "idle";
  if (hasOutput || job?.status === "succeeded") phase = "succeeded";
  else if (local) phase = local;
  else if (job?.status === "running") phase = "running";
  else if (job?.status === "queued") phase = "queued";
  else if (job?.status === "failed") phase = job.errorCode === "stale" ? "stale" : "failed";

  return {
    phase,
    loaded: view !== null,
    stage: job?.progressStage ?? null,
    errorCode: job?.errorCode ?? null,
    attemptsRemaining,
    active: inFlight,
    canRetry: (phase === "failed" || phase === "stale") && attemptsRemaining > 0 && !hasOutput,
    markStarting,
    settle,
    refresh,
  };
}

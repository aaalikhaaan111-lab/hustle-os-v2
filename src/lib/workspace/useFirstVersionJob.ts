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

  const markStarting = useCallback((retry = false) => {
    setLocal(retry ? "retrying" : "creating_job");
  }, []);

  const settle = useCallback(() => {
    setLocal(null);
    refresh();
  }, [refresh]);

  const attemptsRemaining = view?.attemptsRemaining ?? MAX_FIRST_VERSION_ATTEMPTS;

  let phase: FirstVersionPhase = "idle";
  if (hasOutput || job?.status === "succeeded") phase = "succeeded";
  else if (local) phase = local;
  else if (job?.status === "running") phase = "running";
  else if (job?.status === "queued") phase = "queued";
  else if (job?.status === "failed") phase = job.errorCode === "stale" ? "stale" : "failed";

  return {
    phase,
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

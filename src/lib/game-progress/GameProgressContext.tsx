"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { syncGameProgressAction } from "@/lib/actions/game-progress";
import type { ValidationScore } from "@/lib/challengeValidator";

export interface ChallengeCompletion {
  challengeId: string;
  title: string;
  emoji: string;
  categoryLabel: string;
  xp: number;
  answer: string;
  score?: ValidationScore;
  completedAt: string;
}

interface StoredProgress {
  xp: number;
  streakDays: number;
  lastActivityAt: string | null;
  completions: ChallengeCompletion[];
}

interface GameProgressContextValue {
  userId: string | null;
  xp: number;
  streakDays: number;
  completions: ChallengeCompletion[];
  isReady: boolean;
  isChallengeCompleted: (challengeId: string) => boolean;
  completeChallenge: (input: Omit<ChallengeCompletion, "completedAt">) => void;
}

const GameProgressContext = createContext<GameProgressContextValue | null>(null);

function storageKey(userId: string) {
  return `hustle:game-progress:${userId}`;
}

function todayStamp() {
  return new Date().toISOString().slice(0, 10);
}

function computeStreak(previousStamp: string | null, previousStreak: number): number {
  const today = todayStamp();
  if (!previousStamp) return 1;
  if (previousStamp === today) return previousStreak || 1;

  const prev = new Date(`${previousStamp}T00:00:00`);
  const now = new Date(`${today}T00:00:00`);
  const diffDays = Math.round((now.getTime() - prev.getTime()) / 86_400_000);

  return diffDays === 1 ? (previousStreak || 0) + 1 : 1;
}

export function GameProgressProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [userId, setUserId] = useState<string | null>(null);
  const [xp, setXp] = useState(0);
  const [streakDays, setStreakDays] = useState(0);
  const [completions, setCompletions] = useState<ChallengeCompletion[]>([]);
  const [isReady, setIsReady] = useState(false);
  const lastActivityRef = useRef<string | null>(null);
  const initializedForUserIdRef = useRef<string | null>(null);

  const loadForUser = useCallback(async (user: { id: string }) => {
    if (initializedForUserIdRef.current === user.id) return;
    initializedForUserIdRef.current = user.id;

    const supabase = createClient();
    const key = storageKey(user.id);
    const stored = typeof window !== "undefined" ? window.localStorage.getItem(key) : null;

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredProgress;
        setUserId(user.id);
        setXp(parsed.xp ?? 0);
        setStreakDays(parsed.streakDays ?? 0);
        setCompletions(parsed.completions ?? []);
        lastActivityRef.current = parsed.lastActivityAt ?? null;
        setIsReady(true);
        return;
      } catch {
        // fall through to a fresh remote fetch
      }
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("xp, streak_days, last_activity_at")
      .eq("id", user.id)
      .maybeSingle();

    const seedXp = profile?.xp ?? 0;
    const seedStreak = profile?.streak_days ?? 0;
    const seedLastActivity = profile?.last_activity_at
      ? String(profile.last_activity_at).slice(0, 10)
      : null;

    setUserId(user.id);
    setXp(seedXp);
    setStreakDays(seedStreak);
    lastActivityRef.current = seedLastActivity;
    window.localStorage.setItem(
      key,
      JSON.stringify({
        xp: seedXp,
        streakDays: seedStreak,
        lastActivityAt: seedLastActivity,
        completions: [],
      } satisfies StoredProgress)
    );
    setIsReady(true);
  }, []);

  const clearUser = useCallback(() => {
    initializedForUserIdRef.current = null;
    setUserId(null);
    setXp(0);
    setStreakDays(0);
    setCompletions([]);
    lastActivityRef.current = null;
    setIsReady(true);
  }, []);

  useEffect(() => {
    const supabase = createClient();

    // GameProgressProvider is mounted once in the root layout and persists
    // across client-side (soft) navigations. onAuthStateChange fires
    // immediately with whatever session exists at mount time, and again on
    // every subsequent sign-in/sign-out the BROWSER Supabase client itself
    // initiates (e.g. the Google OAuth flow, or calling supabase.auth.* from
    // client code) — but not for a session change made purely server-side.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        loadForUser(session.user);
      } else {
        clearUser();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadForUser, clearUser]);

  // Email/password login, signup, and dev-login all authenticate via a
  // Server Action that sets the session cookie and calls redirect() — a soft
  // client-side navigation. The browser Supabase client's onAuthStateChange
  // above only fires for auth actions *it* initiates, so it never learns
  // about a session a Server Action just established or cleared: without
  // this, userId stays stuck at whatever it was when this provider first
  // mounted (e.g. null while briefly logged out) until a hard page reload.
  // Re-checking on every pathname change — the same idiom ProductTour uses
  // to pick up a just-written localStorage record — is what actually catches
  // that login/logout. getSession() reads the cookie-backed session the
  // @supabase/ssr browser client already keeps in sync, with no network
  // round trip, so this stays cheap even on every navigation — unlike
  // getUser(), which re-validates against the Auth server every call and
  // would mean a request per page change.
  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session?.user) {
        loadForUser(data.session.user);
      } else if (initializedForUserIdRef.current !== null) {
        clearUser();
      }
    });

    return () => {
      cancelled = true;
    };
  }, [pathname, loadForUser, clearUser]);

  const persist = useCallback(
    (nextXp: number, nextStreak: number, nextLastActivity: string, nextCompletions: ChallengeCompletion[]) => {
      if (!userId) return;
      window.localStorage.setItem(
        storageKey(userId),
        JSON.stringify({
          xp: nextXp,
          streakDays: nextStreak,
          lastActivityAt: nextLastActivity,
          completions: nextCompletions,
        } satisfies StoredProgress)
      );
      syncGameProgressAction(nextXp, nextStreak, nextLastActivity).catch((error) => {
        console.error("Failed to sync game progress", error);
      });
    },
    [userId]
  );

  const isChallengeCompleted = useCallback(
    (challengeId: string) => completions.some((c) => c.challengeId === challengeId),
    [completions]
  );

  const completeChallenge = useCallback(
    (input: Omit<ChallengeCompletion, "completedAt">) => {
      if (!userId) return;
      if (completions.some((c) => c.challengeId === input.challengeId)) return;

      const nextXp = xp + input.xp;
      const nextStreak = computeStreak(lastActivityRef.current, streakDays);
      const today = todayStamp();
      const nextCompletions = [
        ...completions,
        { ...input, completedAt: new Date().toISOString() },
      ];

      lastActivityRef.current = today;
      setXp(nextXp);
      setStreakDays(nextStreak);
      setCompletions(nextCompletions);
      persist(nextXp, nextStreak, today, nextCompletions);
    },
    [userId, xp, streakDays, completions, persist]
  );

  const value = useMemo(
    () => ({ userId, xp, streakDays, completions, isReady, isChallengeCompleted, completeChallenge }),
    [userId, xp, streakDays, completions, isReady, isChallengeCompleted, completeChallenge]
  );

  return (
    <GameProgressContext.Provider value={value}>{children}</GameProgressContext.Provider>
  );
}

export function useGameProgress(): GameProgressContextValue {
  const ctx = useContext(GameProgressContext);
  if (!ctx) {
    throw new Error("useGameProgress must be used within GameProgressProvider");
  }
  return ctx;
}

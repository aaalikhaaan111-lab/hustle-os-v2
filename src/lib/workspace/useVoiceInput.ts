"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Dictation into the composer, and nothing more.
 *
 * Two browser APIs are involved and they do different jobs. `getUserMedia` is
 * what raises Chrome's native permission prompt, and it only does so when it is
 * called synchronously from a real user gesture — so `start()` must be invoked
 * straight out of the click handler, never from an effect, a timer or a resolved
 * promise. `SpeechRecognition` is what turns the audio into text.
 *
 * The stream opened for the permission check is released immediately: its only
 * purpose is to ask. Recognition then runs entirely in the browser — no audio is
 * uploaded, nothing is recorded, and the result lands in the composer as
 * ordinary editable text the person reads and sends themselves.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

type RecognitionConstructor = new () => SpeechRecognitionLike;

function getRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function hasMediaDevices(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

/**
 * Why dictation cannot run, when it cannot.
 *
 * "unsupported" and "insecure" are different facts and deserve different
 * sentences. `navigator.mediaDevices` is undefined outside a secure context, so
 * a page served over plain http used to report "not supported in this browser"
 * — untrue, and it sends the person looking for a fix in the wrong place.
 */
export type VoiceAvailability = "available" | "insecure" | "unsupported";

/**
 * THESE TWO MUST BE MODULE-LEVEL, and that is the whole bug.
 *
 * They used to be inline arrows — `() => () => {}` and `() => "unsupported"` —
 * so every render handed `useSyncExternalStore` a brand-new `subscribe`
 * identity. React tears down and re-subscribes whenever that reference
 * changes, and the post-hydration reconciliation that promotes the CLIENT
 * snapshot over the server one never settled. The value stayed at the server
 * snapshot, `"unsupported"`, permanently.
 *
 * The visible result was the reported bug: on a browser with
 * `SpeechRecognition`, `getUserMedia` and a secure context — all three verified
 * present at runtime — the microphone button rendered disabled, labelled "voice
 * input is not supported in this browser". The capability check was correct;
 * its answer just never reached the component.
 *
 * There is nothing to subscribe TO here: whether the browser has the API does
 * not change during a session. The subscription is a stable no-op, and being
 * stable is the entire point.
 */
const subscribeCapability = (onStoreChange: () => void) => {
  // ONE NOTIFICATION, right after mount.
  //
  // The server cannot know what the browser supports, so `getServerSnapshot`
  // answers "unsupported" and the markup ships with the button disabled. A
  // store that never notifies gives React no reason to go back and read the
  // client snapshot, so that placeholder answer is the one that stays on
  // screen — which is why a browser with full dictation support rendered
  // "voice input is not supported in this browser".
  //
  // Capability genuinely never changes during a session, so this fires once
  // and then goes quiet.
  const id = requestAnimationFrame(onStoreChange);
  return () => cancelAnimationFrame(id);
};
const readServerAvailability = (): VoiceAvailability => "unsupported";

function readAvailability(): VoiceAvailability {
  if (typeof window === "undefined") return "unsupported";
  if (!window.isSecureContext) return "insecure";
  return getRecognitionConstructor() !== null && hasMediaDevices() ? "available" : "unsupported";
}

/**
 * What the origin's stored microphone decision is, if the browser will say.
 *
 * getUserMedia reports a dismissed prompt and a standing block with the same
 * NotAllowedError, and those need opposite messages: one is "press it again and
 * choose Allow", the other is "this is turned off in your browser settings".
 * The Permissions API separates them. Firefox does not implement the
 * "microphone" descriptor, hence "unknown" and the fallback at the call site.
 */
async function readPermission(): Promise<"granted" | "denied" | "prompt" | "unknown"> {
  try {
    const status = await navigator.permissions?.query({
      name: "microphone" as PermissionName,
    });
    return status?.state ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** Every state the control can be in, so the UI never has to infer one. */
export type VoiceState =
  | "unsupported"
  | "insecure"
  | "idle"
  | "requesting"
  | "listening"
  | "processing"
  | "denied"
  | "error";

/**
 * `permission-dismissed` means the prompt was closed without an answer — the
 * microphone can still be granted, so the fix is to press the button again.
 * `permission-blocked` means the origin is denied and no prompt will appear, so
 * that is the only case that may send someone to browser settings.
 */
export type VoiceInputError =
  | "permission-dismissed"
  | "permission-blocked"
  | "no-speech"
  | "failed"
  | "insecure"
  | "unsupported"
  | "no-microphone"
  | null;

/**
 * The `build` message key for a dictation failure.
 *
 * Four surfaces render this message, and they used to each map the error
 * themselves — which is how two of them ended up sending people to browser
 * settings for a prompt that had merely been dismissed. Only
 * `permission-blocked` may say "settings".
 */
export function voiceErrorKey(error: VoiceInputError): string | null {
  switch (error) {
    case "permission-blocked":
      return "voiceBlocked";
    case "permission-dismissed":
      return "voiceDismissed";
    case "no-speech":
      return "voiceNoSpeech";
    case "insecure":
      return "voiceInsecure";
    case "unsupported":
      return "voiceUnsupported";
    case "no-microphone":
      return "voiceNoDevice";
    case "failed":
      return "voiceFailed";
    default:
      return null;
  }
}

export interface VoiceInput {
  /** False when the browser has neither the Speech API nor mic access. */
  supported: boolean;
  /** Why it is unavailable, so the UI never has to guess at a reason. */
  availability: VoiceAvailability;
  state: VoiceState;
  listening: boolean;
  error: VoiceInputError;
  /** Must be called directly from a click — that is what allows the prompt. */
  start: () => void;
  stop: () => void;
}

interface UseVoiceInputOptions {
  /** BCP-47 tag so dictation matches the interface language. */
  lang: string;
  /** Receives the transcript to append; the caller owns composer state. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
}

export function useVoiceInput({ lang, onTranscript, disabled }: UseVoiceInputOptions): VoiceInput {
  // Whether the browser can do this at all is a fact to read, not state to
  // synchronise: useSyncExternalStore gives the client answer after hydration
  // and a stable `false` on the server, with no effect and no extra render.
  const availability = useSyncExternalStore(
    subscribeCapability,
    readAvailability,
    readServerAvailability
  );
  const supported = availability === "available";

  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<VoiceInputError>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
  // Consecutive permission refusals, used only where the browser will not say
  // whether the origin is blocked. Reset by a successful grant.
  const permissionFailuresRef = useRef(0);
  const transcriptRef = useRef(onTranscript);
  useEffect(() => {
    transcriptRef.current = onTranscript;
  });

  /** Releases the microphone. Every exit path goes through here. */
  const release = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const recognition = recognitionRef.current;
    if (recognition) {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.abort();
      } catch {
        // Already finished; nothing to abort.
      }
    }
    recognitionRef.current = null;
    activeRef.current = false;
  }, []);

  // Whatever happens — unmount, route change, fast refresh — the microphone is
  // released and no listener outlives the component.
  useEffect(() => release, [release]);

  const stop = useCallback(() => {
    const recognition = recognitionRef.current;
    if (recognition) {
      try {
        recognition.stop();
      } catch {
        // Fall through to release below.
      }
    }
    release();
    setState((current) => (current === "denied" || current === "error" ? current : "idle"));
  }, [release]);

  const beginRecognition = useCallback(() => {
    const Recognition = getRecognitionConstructor();
    if (!Recognition) {
      setState("unsupported");
      return;
    }

    const recognition = new Recognition();
    recognition.lang = lang;
    // One utterance, final results only: the composer should receive settled
    // text, not a field that rewrites itself while being read.
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) text += result[0].transcript;
      }
      const trimmed = text.trim();
      setState("processing");
      // The transcript is appended as editable text. Nothing is submitted.
      if (trimmed) transcriptRef.current(trimmed);
    };

    recognition.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        // Permission was already granted for the getUserMedia call that got us
        // here, so a refusal at this point is a standing block on speech
        // recognition rather than an unanswered prompt.
        setError("permission-blocked");
        setState("denied");
      } else if (event.error === "no-speech") {
        setError("no-speech");
        setState("idle");
      } else if (event.error !== "aborted") {
        setError("failed");
        setState("error");
      }
      release();
    };

    recognition.onend = () => {
      release();
      setState((current) => (current === "denied" || current === "error" ? current : "idle"));
    };

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setState("listening");
    } catch {
      setError("failed");
      setState("error");
      release();
    }
  }, [lang, release]);

  const start = useCallback(() => {
    if (disabled || activeRef.current) return;
    const available = readAvailability();
    if (available === "insecure") {
      setError("insecure");
      setState("insecure");
      return;
    }
    if (available === "unsupported") {
      // Said out loud rather than left as a disabled button. The capability
      // probe runs before the browser has necessarily finished exposing the
      // API, so a pre-emptively dead control can be wrong; a control that
      // tries and then explains cannot be.
      setError("unsupported");
      setState("unsupported");
      return;
    }

    activeRef.current = true;
    setError(null);
    setState("requesting");

    // Called synchronously inside the click. This is the call that makes Chrome
    // show its native prompt when the origin has no stored decision; if the user
    // has already denied, the browser rejects immediately and shows nothing,
    // which is why the denied state below explains how to undo it.
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        if (!activeRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        // Access was granted, so any earlier refusal is history.
        permissionFailuresRef.current = 0;
        // The stream existed only to ask for permission; recognition opens its
        // own. Holding this one would leave the recording indicator on.
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        beginRecognition();
      })
      .catch((cause: unknown) => {
        const name = cause instanceof Error ? cause.name : "";
        if (name === "NotAllowedError" || name === "SecurityError") {
          // NotAllowedError covers both "the prompt was dismissed" and "this
          // origin is blocked", and those need opposite advice. Sending someone
          // to browser settings because they closed the very first prompt is
          // the reported defect, so the two are separated here rather than
          // collapsed into one message.
          setState("denied");
          permissionFailuresRef.current += 1;
          const attempt = permissionFailuresRef.current;
          void readPermission().then((permission) => {
            if (permission === "denied") {
              setError("permission-blocked");
              return;
            }
            if (permission === "prompt") {
              setError("permission-dismissed");
              return;
            }
            // Firefox will not answer for "microphone". A dismissed prompt
            // reappears on the next click, while a block fails instantly again,
            // so the second consecutive refusal is the one that has earned the
            // settings instructions.
            setError(attempt > 1 ? "permission-blocked" : "permission-dismissed");
          });
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          // No capture device at all. Telling someone dictation "stopped
          // unexpectedly, try again" when the machine has no microphone sends
          // them round a loop that cannot end — this is the generic error the
          // brief asked to stop showing.
          setError("no-microphone");
          setState("error");
        } else {
          setError("failed");
          setState("error");
        }
        release();
      });
  }, [beginRecognition, disabled, release]);

  return {
    supported,
    availability,
    state,
    listening: state === "listening",
    error,
    start,
    stop,
  };
}

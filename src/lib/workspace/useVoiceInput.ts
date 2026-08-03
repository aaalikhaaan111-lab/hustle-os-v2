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

/** Every state the control can be in, so the UI never has to infer one. */
export type VoiceState =
  | "unsupported"
  | "idle"
  | "requesting"
  | "listening"
  | "processing"
  | "denied"
  | "error";

export type VoiceInputError = "permission" | "no-speech" | "failed" | null;

export interface VoiceInput {
  /** False when the browser has neither the Speech API nor mic access. */
  supported: boolean;
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
  const supported = useSyncExternalStore(
    () => () => {},
    () => getRecognitionConstructor() !== null && hasMediaDevices(),
    () => false
  );

  const [state, setState] = useState<VoiceState>("idle");
  const [error, setError] = useState<VoiceInputError>(null);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const activeRef = useRef(false);
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
        setError("permission");
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
    if (!getRecognitionConstructor() || !hasMediaDevices()) {
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
        // The stream existed only to ask for permission; recognition opens its
        // own. Holding this one would leave the recording indicator on.
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        beginRecognition();
      })
      .catch((cause: unknown) => {
        const name = cause instanceof Error ? cause.name : "";
        // NotAllowedError covers both "user dismissed" and "already blocked";
        // the browser does not distinguish them, so neither does the message.
        if (name === "NotAllowedError" || name === "SecurityError") {
          setError("permission");
          setState("denied");
        } else if (name === "NotFoundError" || name === "OverconstrainedError") {
          setError("failed");
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
    state,
    listening: state === "listening",
    error,
    start,
    stop,
  };
}

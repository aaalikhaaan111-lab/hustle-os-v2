"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import styles from "./AiComposer.module.css";

export interface AiComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  sendLabel: string;
  /** Accessible name for the textarea. Falls back to placeholder when omitted. */
  ariaLabel?: string;
  /** Disables typing and sending (busy, unavailable, etc). */
  disabled?: boolean;
  /** Shows a spinner in place of the send arrow — a request is in flight. */
  sending?: boolean;
  maxLength?: number;
  /** Autosize cap in px. Every surface has grown its own by hand; keep one default. */
  maxHeight?: number;
  textareaId?: string;
  className?: string;
  /** Optional dictation control. Callers that omit it render exactly as before —
   *  the landing hero and closing composer are unchanged. */
  voice?: {
    /** False in browsers without speech recognition: shown, disabled, explained. */
    supported: boolean;
    listening: boolean;
    onToggle: () => void;
    /** Accessible name, and the title when dictation is unavailable. */
    label: string;
    unsupportedLabel: string;
  };
}

// The one AI composer, used everywhere Ventrio asks "what do you want to
// create / say next": the landing hero and final CTA, the /create flow, and
// the project workspace chat (both the pre-first-version and ongoing
// variants). Every one of those previously hand-rolled its own <form
// className="ventrio-composer"> with near-duplicate markup; this replaces
// all of them with a single component. It reads its colors entirely from
// --color-* custom properties, so it renders as a dark glass card on the
// landing page (which scopes those tokens to a dark palette) and as a
// lighter accent-tinted glass card inside the app's real (light) surfaces —
// no per-surface theme branching needed.
export const AiComposer = forwardRef<HTMLTextAreaElement, AiComposerProps>(function AiComposer(
  { value, onChange, onSend, placeholder, sendLabel, ariaLabel, disabled, sending, maxLength = 2000, maxHeight = 150, textareaId, className, voice },
  forwardedRef
) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  useImperativeHandle(forwardedRef, () => innerRef.current as HTMLTextAreaElement);

  useEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight]);

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div className={cn(styles.shell, className)} data-focused={isFocused}>
      <span className={styles.glow} aria-hidden />
      <span className={styles.edge} aria-hidden />
      <form
        className={styles.form}
        onSubmit={(event) => {
          event.preventDefault();
          onSend();
        }}
      >
        <textarea
          id={textareaId}
          ref={innerRef}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          disabled={disabled}
          rows={1}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-label={ariaLabel ?? placeholder}
          className={styles.textarea}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSend();
            }
          }}
        />
        {voice && (
          <button
            type="button"
            onClick={voice.supported ? voice.onToggle : undefined}
            disabled={disabled || !voice.supported}
            aria-label={voice.supported ? voice.label : voice.unsupportedLabel}
            aria-pressed={voice.supported ? voice.listening : undefined}
            title={voice.supported ? undefined : voice.unsupportedLabel}
            className={styles.mic}
            data-listening={voice.listening || undefined}
          >
            <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" aria-hidden>
              <rect x="7.4" y="2.6" width="5.2" height="9" rx="2.6" stroke="currentColor" strokeWidth="1.6" />
              <path d="M4.6 9.4a5.4 5.4 0 0 0 10.8 0M10 14.8v2.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        )}
        <button
          type="submit"
          aria-label={sendLabel}
          disabled={!canSend}
          className={styles.send}
        >
          <AnimatePresence mode="wait" initial={false}>
            {sending ? (
              <motion.svg
                key="loading"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
                aria-hidden
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1, rotate: 360 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ rotate: { duration: 0.8, repeat: Infinity, ease: "linear" }, opacity: { duration: 0.15 }, scale: { duration: 0.15 } }}
              >
                <circle cx="10" cy="10" r="6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeDasharray="26 14" />
              </motion.svg>
            ) : (
              <motion.svg
                key="arrow"
                viewBox="0 0 20 20"
                fill="none"
                className="h-4 w-4"
                aria-hidden
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                transition={{ duration: 0.15 }}
              >
                <path d="M10 15.5v-11m0 0L5.5 9M10 4.5 14.5 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            )}
          </AnimatePresence>
        </button>
      </form>
    </div>
  );
});

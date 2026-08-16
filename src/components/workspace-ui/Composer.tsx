"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { IconMic, IconSend } from "./parts";
import type { VoiceState } from "@/lib/workspace/useVoiceInput";

export interface WorkspaceComposerProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder: string;
  sendLabel: string;
  ariaLabel?: string;
  /** Blocks typing and sending — a request is in flight, or the assistant is down. */
  disabled?: boolean;
  /** A request is in flight: the send control shows it rather than the input. */
  sending?: boolean;
  maxLength?: number;
  maxHeight?: number;
  /** Controls that belong to the composer rather than to the message. */
  settings?: ReactNode;
  /** Replaces the hint while dictation is running. */
  listeningLabel: string;
  keyboardHint?: string;
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  voice?: {
    supported: boolean;
    listening: boolean;
    state: VoiceState;
    onToggle: () => void;
    label: string;
    unsupportedLabel: string;
    requestingLabel: string;
    listeningLabel: string;
  };
  /** True while the model is producing something. */
  generating?: boolean;
}

/**
 * The composer.
 *
 * WHAT IT WAS. A white rounded box with a 1px border, a drop shadow, a
 * near-opaque fill over a 20px saturating backdrop blur, and — around all of
 * it — a conic-gradient pseudo-element masked to a 1px ring, animating its
 * angle forever at four different speeds depending on state. On focus it lifted
 * a pixel, dropped its border, and grew two stacked accent rings and a 46px
 * coloured shadow. Seven effects, on the one surface a person needs to be able
 * to think next to.
 *
 * WHAT IT IS. A field on the floor of the room. One tone lighter than the
 * canvas, one hairline, and a top edge that runs the full width so it reads as
 * the bottom of the conversation rather than as an object floating in front of
 * it. Focus changes the hairline to the accent. That is the whole treatment.
 *
 * The send key is the only accented thing, and it only becomes accented once
 * there is something to send — so the brightest pixel on the screen is always
 * the next action.
 */
export function WorkspaceComposer({
  value,
  onChange,
  onSend,
  placeholder,
  sendLabel,
  ariaLabel,
  disabled,
  sending,
  maxLength = 2000,
  maxHeight = 200,
  settings,
  listeningLabel,
  keyboardHint,
  textareaRef,
  voice,
  generating,
}: WorkspaceComposerProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? innerRef;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight, ref]);

  const canSend = !disabled && value.trim().length > 0;

  return (
    <form
      className="s-composer"
      data-state={disabled ? "disabled" : voice?.listening ? "listening" : generating ? "generating" : undefined}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSend) onSend();
      }}
    >
      <textarea
        ref={ref}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        disabled={disabled}
        rows={1}
        maxLength={maxLength}
        placeholder={placeholder}
        aria-label={ariaLabel ?? placeholder}
        aria-keyshortcuts="Enter"
        /* 16px on every screen. Below it iOS zooms the page on focus, and this
           input sits inside a frame that is exactly the viewport tall, so the
           zoom leaves the composer half off-screen with no way back. */
        className="w-full resize-none bg-transparent px-1 pt-1 text-[16px] leading-[1.5] outline-none disabled:opacity-60"
        style={{ color: "var(--color-ink)" }}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (canSend) onSend();
          }
        }}
      />

      <div className="flex items-center gap-1 pt-1">
        {voice && (
          <button
            type="button"
            disabled={disabled || !voice.supported}
            onClick={voice.supported ? voice.onToggle : undefined}
            aria-label={voice.supported ? voice.label : voice.unsupportedLabel}
            aria-pressed={voice.listening}
            className="s-btn s-btn--ghost s-btn--icon h-9 w-9"
            style={voice.listening ? { color: "var(--color-accent)" } : undefined}
          >
            <IconMic className="h-[18px] w-[18px]" />
          </button>
        )}

        {settings}

        {voice?.listening && (
          <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--color-accent)" }}>
            <span className="s-thinking flex items-center gap-1" aria-hidden>
              <span />
              <span />
              <span />
            </span>
            {listeningLabel}
          </span>
        )}

        <button
          type="submit"
          disabled={!canSend}
          aria-label={sendLabel}
          title={keyboardHint ? `${sendLabel} · ${keyboardHint}` : sendLabel}
          className="s-btn s-btn--primary s-btn--icon ml-auto h-9 w-9 rounded-[var(--r-sm)]"
        >
          {sending ? (
            <span
              className="block h-[16px] w-[16px] animate-spin rounded-full border-2 border-current border-t-transparent opacity-70"
              aria-hidden
            />
          ) : (
            <IconSend className="h-[17px] w-[17px]" />
          )}
        </button>
      </div>
    </form>
  );
}

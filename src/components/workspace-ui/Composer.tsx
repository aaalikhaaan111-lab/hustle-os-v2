"use client";

import { useEffect, useRef, type ReactNode, type RefObject } from "react";
import { IconMic, IconSend } from "./parts";
import type { VoiceState } from "@/lib/workspace/useVoiceInput";
import { VentrioButton } from "@/components/ui/VentrioButton";

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
  /**
   * Controls that belong to the composer rather than to the message — the usage
   * menu lives here. Limits are no longer printed under every input; they are
   * one click away instead.
   */
  settings?: ReactNode;
  /** Replaces the hint while dictation is running. */
  listeningLabel: string;
  /**
   * Shown only in the send control's tooltip. The keyboard behaviour is real;
   * printing it permanently beside the input is what made the composer read as
   * a developer tool rather than a place to write.
   */
  keyboardHint?: string;
  /** Lets the caller focus the input — /create focuses it when refining. */
  textareaRef?: RefObject<HTMLTextAreaElement | null>;
  voice?: {
    supported: boolean;
    listening: boolean;
    /** Drives the composer edge and the inline message; see useVoiceInput. */
    state: VoiceState;
    onToggle: () => void;
    label: string;
    unsupportedLabel: string;
    requestingLabel: string;
    listeningLabel: string;
  };
  /** True while the model is producing something, so the edge can react. */
  generating?: boolean;
}

/**
 * The workspace composer.
 *
 * It owns no submission logic of its own — the surface that renders it already
 * knows how to talk to the assistant, and duplicating that here is how two
 * chat implementations start to drift apart. This is the input, the dictation
 * control, one quiet line of status, and the send key.
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
  maxHeight = 180,
  settings,
  listeningLabel,
  keyboardHint,
  textareaRef,
  voice,
  generating,
}: WorkspaceComposerProps) {
  const innerRef = useRef<HTMLTextAreaElement>(null);
  const ref = textareaRef ?? innerRef;

  // Grows with what is being written, up to a cap, so a long thought is
  // readable without the composer eating the conversation.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [value, maxHeight, ref]);

  const canSend = !disabled && value.trim().length > 0;
  // /create has neither dictation nor a usage menu, so a full control row there
  // would be an empty strip with one button in it. Without tools the send key
  // sits inside the input instead.
  const hasTools = Boolean(voice || settings);

  return (
    <div className="ws-composer-shell">
      <form
        className="ws-composer ws-edge"
        data-state={
          disabled ? "disabled" : voice?.listening ? "listening" : generating ? "generating" : undefined
        }
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
          className={`w-full resize-none bg-transparent pt-3.5 text-[15px] leading-[1.6] outline-none placeholder:text-[var(--ink-3)] disabled:opacity-60 ${
            hasTools ? "px-4 pb-1" : "py-3.5 pl-4 pr-14"
          }`}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              if (canSend) onSend();
            }
          }}
        />

        <div className={hasTools ? "flex h-11 items-center gap-1 px-2.5 pb-1.5" : "contents"}>
          {voice && (
            <VentrioButton
              variant="composer"
              size="md"
              on={voice.listening}
              disabled={disabled || !voice.supported}
              onClick={voice.supported ? voice.onToggle : undefined}
              label={voice.supported ? voice.label : voice.unsupportedLabel}
            >
              <IconMic className="h-[18px] w-[18px]" />
            </VentrioButton>
          )}

          {settings}

          {voice?.listening && (
            <span className="flex items-center gap-1.5 text-[13px] font-medium" style={{ color: "var(--accent-ink)" }}>
              <span className="ai-pending h-1.5 w-1.5 rounded-full" style={{ background: "var(--accent)" }} />
              {listeningLabel}
            </span>
          )}

          <VentrioButton
            variant="primary"
            size="md"
            shape="circle"
            type="submit"
            disabled={!canSend}
            className={hasTools ? "ml-auto" : undefined}
            style={hasTools ? undefined : { position: "absolute", right: 10, bottom: 10 }}
            label={sendLabel}
            title={keyboardHint ? `${sendLabel} · ${keyboardHint}` : sendLabel}
          >
            {sending ? (
              <span
                className="block h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/35 border-t-white"
                aria-hidden
              />
            ) : (
              <IconSend className="h-[18px] w-[18px]" />
            )}
          </VentrioButton>
        </div>
      </form>
    </div>
  );
}

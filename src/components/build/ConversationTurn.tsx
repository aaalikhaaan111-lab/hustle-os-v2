import type { ReactNode } from "react";
import { VentrioMark } from "@/components/workspace-ui/parts";

/**
 * One conversation rhythm, for every surface that holds a conversation.
 *
 * FOUR RENDERERS, ONE COMPONENT. The project assistant's workspace variant, its
 * creator variant, `PreOutputWorkspace` and `/create` each had their own idea of
 * what a message looked like. They all use this.
 *
 * WHY IT READS AS A CONVERSATION NOW. The previous version set the person's turn
 * as muted prose behind a left hairline and the reply as slightly larger prose —
 * two paragraphs in one column differing by a couple of pixels and a grey.
 * Nothing said "somebody spoke, and something answered"; you had to read both to
 * work out who was talking.
 *
 * They are different KINDS of object now, which is what every chat interface
 * people already use does:
 *
 *   - the person's turn is CONTAINED and right-aligned — a bubble on a filled
 *     surface, capped at 34rem so a long paste is not a slab;
 *   - Ventrio's reply is UNCONTAINED prose at the full measure, behind a small
 *     speaker mark.
 *
 * Containment and alignment do the work rather than colour: the bubble is
 * `--secondary`, a barely-there neutral from the token set, so the conversation
 * stays quiet while being unmistakably two-sided.
 *
 * The mark is on the reply only. A person does not need to be told which turn is
 * theirs — they wrote it — and a badge on both sides is twice the furniture for
 * the same information.
 */
export function UserTurn({ children }: { children: ReactNode }) {
  return (
    <div className="s-enter s-turn-user">
      <div>{children}</div>
    </div>
  );
}

export function AssistantTurn({ children }: { children: ReactNode }) {
  return (
    <div className="s-enter s-turn-assistant">
      <span className="s-turn-mark" aria-hidden>
        <VentrioMark size={14} />
      </span>
      <div>{children}</div>
    </div>
  );
}

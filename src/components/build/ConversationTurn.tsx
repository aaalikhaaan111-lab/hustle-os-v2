import type { ReactNode } from "react";

/**
 * One conversation rhythm, for every surface that holds a conversation.
 *
 * THE PROBLEM THIS SOLVES. There were four chat renderers — the project
 * assistant's workspace variant, its creator variant, `PreOutputWorkspace` and
 * `/create` — and between them THREE different treatments for the same thing a
 * person just said: a grey capsule at 80% width with a 16px radius, a grey
 * capsule at 86% width, and a solid violet capsule at 85% with white text and
 * one squared corner. Same product, same conversation, three answers. That is
 * the "different generations of the product" complaint in miniature, and no
 * amount of restyling one of them would have fixed it.
 *
 * THE RHYTHM. Both speakers used to be typographically identical — 15px, the
 * same colour, the same measure — distinguished only by a bubble pushed to the
 * right. Alignment is a weak signal and a bubble is a texting metaphor, and
 * neither says which of the two is the substance.
 *
 * The assistant IS the substance, so it gets the reading size and the full
 * measure. The person's turn is set smaller and quieter behind a hairline —
 * visibly a prompt rather than a reply, and closer to a margin note than to a
 * message in a thread. It also means a long paste no longer becomes a huge
 * grey slab shoved against one edge of the screen.
 */
export function UserTurn({ children }: { children: ReactNode }) {
  return (
    <div className="s-enter border-l-2 pl-4" style={{ borderColor: "var(--color-border-strong)" }}>
      <p className="whitespace-pre-wrap text-[15px] leading-[1.55]" style={{ color: "var(--color-ink-muted)" }}>
        {children}
      </p>
    </div>
  );
}

export function AssistantTurn({ children }: { children: ReactNode }) {
  return (
    <div
      className="s-enter whitespace-pre-wrap text-[16.5px] leading-[1.68]"
      style={{ color: "var(--color-ink)" }}
    >
      {children}
    </div>
  );
}

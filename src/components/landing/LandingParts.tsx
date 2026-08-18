"use client";

import { useState } from "react";

/**
 * The four cards.
 *
 * The header, the chip button and the FAQ accordion used to live here too. They
 * are shared public chrome now — `@/components/public/PublicHeader` and
 * `@/components/public/Faq` — because every one of them appears on pages other
 * than this one. What is left is the piece that belongs to the homepage alone.
 */

/**
 * A HOVER ACCORDION, TEXT ONLY.
 *
 * The version this replaces put a small drawing inside each card and revealed
 * it under the pointer. Four illustrations competing with four sentences is a
 * section that is harder to read than the plain list it was meant to improve,
 * and reserving their space forced a permanent gap into the resting state, so
 * the calm default was not calm.
 *
 * This restores the earlier behaviour: one card widens under the pointer while
 * its neighbours narrow, and the widened one opens its explanation. Nothing is
 * behind an image, and the section is the same four sentences it always was.
 *
 * `onMouseMove`, NOT `onMouseEnter`. Opening a card reflows the row, and a
 * reflow that slides a different card under a stationary cursor fires
 * `mouseenter` on it — with `onMouseEnter` the last card was literally
 * unselectable, because reaching it re-flowed the row and whatever landed under
 * the pointer took the selection straight back. `mousemove` only fires when the
 * pointer actually moves, so the reflow cannot steal anything.
 *
 * `onFocus` gives the keyboard the identical path, and `onClick` covers a touch
 * device that reports a pointer. Where there is genuinely no hover the
 * stylesheet opens every card, so no copy is behind an interaction the device
 * cannot perform.
 */
export interface CardCopy {
  n: number;
  title: string;
  body: string;
}

export function CardDeck({ cards }: { cards: CardCopy[] }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="lp-deck">
      {cards.map((card, index) => (
        <button
          key={card.n}
          type="button"
          className="lp-card"
          data-open={index === open ? "true" : undefined}
          aria-expanded={index === open}
          onMouseMove={() => setOpen(index)}
          onFocus={() => setOpen(index)}
          onClick={() => setOpen(index)}
        >
          <span className="lp-card-n" aria-hidden>
            {String(card.n).padStart(2, "0")}
          </span>
          <span className="lp-card-text">
            <span className="lp-card-title">{card.title}</span>
            <span className="lp-card-body">
              <span>{card.body}</span>
            </span>
          </span>
        </button>
      ))}
    </div>
  );
}

"use client";

import { useState } from "react";

/**
 * The FAQ accordion, shared by the homepage's questions band and the /faq page.
 *
 * It was six static question-and-answer blocks with every answer always open —
 * a wall of text rather than a list of questions — and /faq had a *second*,
 * differently-styled copy of the same idea. One control now: the whole row is
 * the button, one answer is open at a time, and the height animates on
 * `grid-template-rows: 0fr -> 1fr` so nothing has to be measured in JavaScript.
 *
 * SINGLE-OPEN, deliberately: with six short answers, letting several stand open
 * recreates the wall this replaces. `initialOpen` is null on /faq, where the
 * page is nothing but questions and opening one for the visitor would be an
 * arbitrary choice.
 */
export function Faq({
  items,
  initialOpen = 0,
}: {
  items: { q: string; a: string }[];
  initialOpen?: number | null;
}) {
  const [open, setOpen] = useState<number | null>(initialOpen);

  return (
    <div className="lp-faq">
      {items.map((item, index) => {
        const isOpen = index === open;
        return (
          <div key={item.q} className="lp-faq-item" data-open={isOpen ? "true" : undefined}>
            <button
              type="button"
              className="lp-faq-q"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : index)}
            >
              <span>{item.q}</span>
              <span className="lp-faq-mark" aria-hidden />
            </button>
            <div className="lp-faq-a">
              <div>
                <p>{item.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

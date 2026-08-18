/**
 * The four cards.
 *
 * The header, the chip button and the FAQ accordion used to live here too. They
 * are shared public chrome now — `@/components/public/PublicHeader` and
 * `@/components/public/Faq` — because every one of them appears on pages other
 * than this one. What is left is the piece that belongs to the homepage alone.
 */

/**
 * THE FIGURES ARE DRAWINGS OF THE PRODUCT, NOT DECORATION.
 *
 * They were three rounded bars of varying width, repeated in all four cards with
 * the widths shuffled. That is a skeleton loader, not an illustration: it said
 * "some content goes here" four times and explained none of the four sentences
 * it sat above.
 *
 * Each card now draws the specific thing its sentence claims:
 *
 *   01  a stack of versions with the newest in front — version one is the
 *       bottom of a pile, not the end of one;
 *   02  a sentence you could actually say, and the one value on the page that
 *       changed because you said it — no panel, no form, no settings screen;
 *   03  the project, with the things Ventrio is holding onto about it;
 *   04  the conversation and the running product side by side, which is the
 *       literal shape of the workspace.
 *
 * They are built from bordered surfaces, bubbles and a real numeral rather than
 * grey bars, so they read as small pictures of the product. Everything is CSS —
 * no images to go stale, nothing to load.
 *
 * The words inside them are TRANSLATED and passed in. An illustration with
 * "make the price bigger" hard-coded in English is an English illustration, and
 * half of Ventrio's visitors do not read English.
 */
export interface CardCopy {
  n: number;
  title: string;
  body: string;
}

export interface FigureCopy {
  /** The instruction someone speaks in card 02. */
  say: string;
  /** The value on the page that changed because they said it. */
  price: string;
  /** What Ventrio is holding about the project, in card 03. */
  memory: string[];
}

export function CardDeck({
  cards,
  figures,
}: {
  cards: CardCopy[];
  figures: FigureCopy;
}) {
  return (
    <div className="lp-deck">
      {cards.map((card) => (
        <article key={card.n} className="lp-card" tabIndex={0}>
          <span className="lp-card-n" aria-hidden>
            {String(card.n).padStart(2, "0")}
          </span>

          <span className={`lp-figure lp-figure--${card.n}`} aria-hidden>
            <CardFigure n={card.n} figures={figures} />
          </span>

          <span className="lp-card-text">
            <span className="lp-card-title">{card.title}</span>
            <span className="lp-card-body">{card.body}</span>
          </span>
        </article>
      ))}
    </div>
  );
}

function CardFigure({ n, figures }: { n: number; figures: FigureCopy }) {
  /* 01 — a pile of versions, newest in front. */
  if (n === 1) {
    return (
      <span className="lp-fig lp-fig--versions">
        <span className="lp-fig-sheet lp-fig-sheet--back" />
        <span className="lp-fig-sheet lp-fig-sheet--mid" />
        <span className="lp-fig-sheet lp-fig-sheet--front">
          <span className="lp-fig-bar lp-fig-bar--title" />
          <span className="lp-fig-bar" />
          <span className="lp-fig-bar lp-fig-bar--short" />
        </span>
        <span className="lp-fig-tag">v3</span>
      </span>
    );
  }

  /* 02 — you say it, and one thing on the page is different. */
  if (n === 2) {
    return (
      <span className="lp-fig lp-fig--say">
        <span className="lp-fig-bubble">{figures.say}</span>
        <span className="lp-fig-page">
          <span className="lp-fig-bar lp-fig-bar--title" />
          <span className="lp-fig-price">{figures.price}</span>
          <span className="lp-fig-bar lp-fig-bar--short" />
        </span>
      </span>
    );
  }

  /* 03 — the project, and what is being held about it. */
  if (n === 3) {
    return (
      <span className="lp-fig lp-fig--memory">
        <span className="lp-fig-proj">
          <span className="lp-fig-dot" />
          <span className="lp-fig-bar lp-fig-bar--title" />
        </span>
        <span className="lp-fig-chips">
          {figures.memory.map((chip) => (
            <span key={chip}>{chip}</span>
          ))}
        </span>
      </span>
    );
  }

  /* 04 — the conversation and the running product, side by side. */
  return (
    <span className="lp-fig lp-fig--split">
      <span className="lp-fig-chat">
        <span className="lp-fig-msg" />
        <span className="lp-fig-msg lp-fig-msg--me" />
        <span className="lp-fig-msg" />
      </span>
      <span className="lp-fig-pane">
        <span className="lp-fig-bar lp-fig-bar--title" />
        <span className="lp-fig-bar" />
        <span className="lp-fig-bar lp-fig-bar--short" />
      </span>
    </span>
  );
}

"use client";

// The surface primitives come from the first motion's stylesheet on purpose:
// section two must look like the same generated project, and sharing the
// definitions is the only way that stays true. Editing those classes moves
// both motions — extract them into a neutral sheet once this one is approved.
import surface from "./ProductFlowMotion.module.css";
import styles from "./ProductEvolutionMotion.module.css";
import { easeInOut, easeOut, mix, seg, swell, type MotionPhase } from "./timing";

export const EVOLUTION_DURATION = 15;

/** The seam the section's three steps read from. Adjustable in one place. */
export const EVOLUTION_PHASES: readonly MotionPhase[] = [
  { label: "Publish something useful", start: 0, end: 4 },
  { label: "Learn from real use", start: 4, end: 9 },
  { label: "Evolve with approval", start: 9, end: 15 },
];

/**
 * Three visits, one after another, all landing on the same block. They never
 * overlap: the repetition is the whole point, and simultaneous arrivals would
 * read as traffic rather than as the same thing happening again.
 */
const VISITS = [
  { enter: [16, 104], start: 4.3, end: 5.5 },
  { enter: [86, 101], start: 5.6, end: 6.8 },
  { enter: [30, 106], start: 6.9, end: 8.1 },
] as const;

/** Where every visit lands — the block that earns the improvement. */
const TARGET = { x: 50, y: 77 };

export function ProductEvolutionMotion({ time, className }: { time: number; className?: string }) {
  // ── Phase 1 — publish is the only thing happening ─────────────────────────
  const enter = easeOut(seg(time, 0, 0.5));
  const exit = easeInOut(seg(time, 14.6, 15));
  // Dim in, then back out once the press lands.
  const dim = easeInOut(seg(time, 1.0, 1.5)) - easeInOut(seg(time, 2.9, 3.4));
  const publishIn = easeOut(seg(time, 1.5, 2.0)) - easeOut(seg(time, 3.0, 3.4));
  const press = swell(seg(time, 2.5, 2.9));
  const emit = seg(time, 2.55, 3.15);
  const emitOn = emit > 0 && emit < 1;
  // One element: arrives centred, then settles beside the product and stays.
  const liveIn = easeOut(seg(time, 3.1, 3.6));
  const liveSettle = easeInOut(seg(time, 3.6, 4.1));

  // ── Phase 2 — one region, visited three times ─────────────────────────────
  // Each visit leaves the region a little brighter than the last, so the
  // emphasis accumulates instead of resetting.
  const visitCount = VISITS.reduce((total, visit) => total + easeOut(seg(time, visit.end - 0.5, visit.end)), 0);
  const regionLit = Math.min(1, visitCount / 3) * (1 - easeInOut(seg(time, 11.4, 12.0)));
  const signalIn = easeOut(seg(time, 8.5, 9.1));
  const signalOut = easeInOut(seg(time, 10.6, 11.2));
  const signalOpacity = signalIn * (1 - signalOut);

  // ── Phase 3 — one coordinated improvement, then the owner decides ─────────
  const outline = swell(seg(time, 9.3, 10.5));
  const reorg = easeInOut(seg(time, 9.9, 11.4));
  const newBlock = easeOut(seg(time, 11.0, 11.6));
  const settleDim = easeInOut(seg(time, 12.2, 12.7));
  const readyIn = easeOut(seg(time, 12.6, 13.1));
  const approveIn = easeOut(seg(time, 12.9, 13.4));

  // The product never disappears behind an overlay — it recedes.
  const productOpacity = mix(1, 0.44, dim) * mix(1, 0.58, settleDim) * mix(1, 0.9, outline * 0.5);
  const overlay = mix(0, 0.52, dim) + mix(0, 0.38, settleDim);
  const blur = mix(0, 1.6, dim);

  // Before → after. The action climbs into a clearer slot and grows; the two
  // competing blocks resolve into one promoted row plus a quieter pair.
  const heroHeight = mix(28, 22, reorg);
  const headlineTops = [mix(44, 38, reorg), mix(50.5, 44, reorg)];
  const ctaTop = mix(58, 50, reorg);
  const promoted = { top: mix(71, 62, reorg), left: mix(35.25, 6, reorg), width: mix(29.5, 88, reorg) };
  const pairTop = mix(71, 76, reorg);

  return (
    <div className={`${surface.frame} ${className ?? ""}`} data-testid="product-evolution-frame">
      {/* Layer 2–4: the product and everything that belongs to it. Dims as one
          group, which is why no centred control may live in here. */}
      <div
        className={styles.productLayer}
        style={{ opacity: enter * (1 - exit) * productOpacity, filter: blur > 0.02 ? `blur(${blur}px)` : undefined }}
      >
        <div className={surface.canvas}>
          <div className={surface.nav}>
            {[0, 1, 2].map((index) => (
              <span key={index} className={surface.navChip} />
            ))}
          </div>

          <div className={surface.hero} style={{ height: `${heroHeight}%` }} />

          {headlineTops.map((top, index) => (
            <span key={index} className={surface.headline} style={{ top: `${top}%`, width: `${[62, 44][index]}%` }} />
          ))}

          <span
            className={surface.cta}
            style={{
              top: `${ctaTop}%`,
              width: `${mix(26, 34, reorg)}%`,
              height: `${mix(6.5, 8, reorg)}%`,
              // Hands the accent over as the approval takes focus: at the last
              // frame the owner's decision is the only saturated thing on
              // screen, so nothing competes with it.
              background: `color-mix(in srgb, var(--flow-accent) ${mix(100, 22, settleDim)}%, var(--flow-skeleton))`,
            }}
          />

          {/* The one region every visit lands on, lit brighter each time */}
          <span
            className={styles.region}
            style={{
              top: `${promoted.top - 1.6}%`,
              left: `${promoted.left - 2}%`,
              width: `${promoted.width + 4}%`,
              height: `${mix(12, 11, reorg) + 3.2}%`,
              opacity: regionLit,
            }}
          />

          <span
            className={surface.card}
            style={{
              top: `${promoted.top}%`,
              left: `${promoted.left}%`,
              width: `${promoted.width}%`,
              height: `${mix(12, 11, reorg)}%`,
            }}
          />
          {[0, 1].map((index) => (
            <span
              key={index}
              className={surface.card}
              style={{
                top: `${pairTop}%`,
                left: `${[mix(3, 6, reorg), mix(67.5, 53, reorg)][index]}%`,
                width: `${mix(29.5, 41, reorg)}%`,
                height: `${mix(12, 8, reorg)}%`,
              }}
            />
          ))}

          <span className={styles.newBlock} style={{ opacity: newBlock, transform: `translateY(${mix(5, 0, newBlock)}px)` }} />

          <span className={surface.support} style={{ bottom: `${mix(5.5, 2.5, reorg)}%`, height: `${mix(5, 4.5, reorg)}%` }} />

          {/* One outline over the zone about to change, so the before and the
              after are comparable rather than merely different. */}
          <span
            className={styles.changeOutline}
            style={{ top: `${ctaTop - 3}%`, height: `${mix(30, 38, reorg)}%`, opacity: outline * 0.8 }}
          />
        </div>

        {/* Layer 3: visits. A mark travels in, presses once, and leaves. */}
        {VISITS.map((visit, index) => {
          const travel = easeOut(seg(time, visit.start, visit.start + 0.55));
          const leave = easeInOut(seg(time, visit.end - 0.25, visit.end));
          const pressPulse = swell(seg(time, visit.start + 0.5, visit.start + 1.0));
          const x = mix(visit.enter[0], TARGET.x, travel);
          const y = mix(visit.enter[1], TARGET.y, travel);
          return (
            <span
              key={index}
              className={styles.visit}
              style={{ left: `${mix(27, 73, x / 100)}%`, top: `${mix(9, 91, y / 100)}%`, opacity: travel * (1 - leave) }}
            >
              <span className={styles.visitPulse} style={{ opacity: pressPulse * 0.45, transform: `scale(${mix(1, 3.6, pressPulse)})` }} />
            </span>
          );
        })}

        {/* Layer 4: the signal, touching the region that produced it. */}
        <span
          className={styles.signal}
          style={
            { opacity: signalOpacity, transform: `translateY(-50%) scale(${mix(0.97, 1, signalIn)})`, "--tie": signalIn } as React.CSSProperties
          }
        >
          <span className={styles.signalBar} />
        </span>
      </div>

      {/* Layer 5: the dimming overlay */}
      <div className={styles.overlay} style={{ opacity: overlay * (1 - exit) }} aria-hidden />

      {/* Layer 6: centred controls. Siblings of the product layer, never
          children of it, so they keep full brightness while it recedes. */}
      <span
        className={styles.publish}
        style={{ opacity: publishIn * (1 - exit), transform: `translate(-50%, -50%) scale(${mix(1, 0.972, press)})` }}
      >
        Publish
        {emitOn && (
          <span className={styles.emit} style={{ opacity: (1 - emit) * 0.5, transform: `translate(-50%, -50%) scale(${mix(0.9, 2.5, emit)})` }} />
        )}
      </span>

      <span
        className={styles.live}
        style={{
          opacity: liveIn * (1 - exit) * (liveSettle > 0 ? mix(1, productOpacity, liveSettle) : 1),
          left: `${mix(50, 33.5, liveSettle)}%`,
          top: `${mix(50, 13.2, liveSettle)}%`,
          fontSize: `${mix(2.1, 1.25, liveSettle)}cqw`,
          padding: `${mix(0.7, 0.3, liveSettle)}cqw ${mix(1.7, 0.9, liveSettle)}cqw`,
        }}
      >
        Live
      </span>

      <div className={styles.approval} style={{ opacity: (1 - exit) }}>
        <span className={styles.ready} style={{ opacity: readyIn }}>
          Next version ready
        </span>
        <span className={styles.approve} style={{ opacity: approveIn, transform: `translateY(${mix(5, 0, approveIn)}px)` }}>
          Approve and publish
        </span>
      </div>
    </div>
  );
}

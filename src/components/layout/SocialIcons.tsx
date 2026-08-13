/**
 * The three social marks, drawn rather than imported.
 *
 * An icon package would be a dependency and a bundle for three glyphs. These
 * follow the same conventions as `workspace-ui/parts`: a 24-unit viewBox,
 * `currentColor`, and no fixed size, so they inherit the colour and hover
 * transition of the link that wraps them.
 */

type IconProps = { className?: string };

const stroke = {
  viewBox: "0 0 24 24",
  fill: "none" as const,
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const IconInstagram = ({ className }: IconProps) => (
  <svg {...stroke} className={className}>
    <rect x="3" y="3" width="18" height="18" rx="5" />
    <circle cx="12" cy="12" r="4" />
    <circle cx="17.2" cy="6.8" r="1" fill="currentColor" stroke="none" />
  </svg>
);

/** The Threads "@" loop, simplified to the stroke weight of its neighbours. */
export const IconThreads = ({ className }: IconProps) => (
  <svg {...stroke} className={className}>
    <path d="M16.4 11.3c-.2-2.2-1.6-3.4-3.9-3.4-1.9 0-3.2.8-3.7 2.3" />
    <path d="M12.2 13.2c2.1-.2 3.4.5 3.4 1.8 0 1.2-1 2-2.4 2-1.7 0-2.6-1-2.6-2.3 0-2 1.9-3.2 4.8-3.2 2.6 0 4 1.4 4 3.9 0 3.2-2.4 5.3-6.2 5.3C8.6 20.7 6 17.9 6 12.6 6 7.2 8.7 4.3 13.2 4.3c2.9 0 5 1.2 6 3.3" />
  </svg>
);

export const IconTikTok = ({ className }: IconProps) => (
  <svg {...stroke} className={className}>
    <path d="M14.2 3.5v10.8a3.6 3.6 0 1 1-3.1-3.6" />
    <path d="M14.2 3.5c.3 2.3 1.8 3.8 4.3 4v2.6c-1.8 0-3.2-.5-4.3-1.5" />
  </svg>
);

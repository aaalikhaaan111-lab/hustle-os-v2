"use client";

import Link from "next/link";
import { forwardRef, type ButtonHTMLAttributes, type CSSProperties, type ReactNode } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import "./VentrioButton.css";

/* ─────────────────────────────────────────────────────────────────────────────
 * VentrioButton — the one button.
 *
 * Every clickable control routes through this component: primary actions,
 * secondary actions, quiet ghost actions, bare icon buttons, the composer's
 * round controls and destructive links. Nothing styles a <button> by hand any
 * more, so the interaction contract — pointer cursor, hover colour, hover lift,
 * press, focus ring, disabled — cannot drift between screens. It is written
 * once, in VentrioButton.css, with token fallbacks so the same component works
 * inside the workspace and on the auth and error pages.
 *
 * ── SWAP POINT ──────────────────────────────────────────────────────────────
 * To adopt the supplied GlassButton across the product, change the rendering in
 * THIS FILE ONLY — no call site needs to move. GlassButton already lives at
 * `src/components/ui/glass-button.tsx` (with `glass-button.css`), and its
 * `size` prop maps onto this component's as:
 *
 *     sm → "sm" · md → "default" · lg → "lg" · variant icon/composer → "icon"
 *
 * Two things to handle when swapping: GlassButton renders a wrapping <div>, so
 * `className` positioning props (`ml-auto`, `mt-6`) belong on that wrapper; and
 * it has no link form, so `VentrioLinkButton` would need an <a> variant adding
 * to GlassButton before the href call sites can move over.
 * ──────────────────────────────────────────────────────────────────────────── */

const button = cva("vbtn", {
  variants: {
    variant: {
      primary: "vbtn--primary",
      secondary: "vbtn--secondary",
      ghost: "vbtn--ghost",
      icon: "vbtn--icon vbtn--square",
      composer: "vbtn--composer vbtn--square",
      generative: "vbtn--generative ws-edge",
      danger: "vbtn--danger",
    },
    size: { sm: "vbtn--sm", md: "vbtn--md", lg: "vbtn--lg" },
    shape: { default: "vbtn--default", pill: "vbtn--pill", circle: "vbtn--circle" },
    on: { true: "is-on", false: "" },
  },
  defaultVariants: { variant: "secondary", size: "md", on: false },
});

type Variants = VariantProps<typeof button>;

interface CommonProps extends Omit<Variants, "shape"> {
  shape?: "default" | "pill" | "circle";
  /**
   * The stylesheet is unlayered (see VentrioButton.css), so `justify-*`,
   * `font-*` and `absolute` utilities cannot beat it. These express the same
   * intent as props and are applied inline, which always wins.
   */
  align?: "center" | "start";
  weight?: "semibold" | "medium" | "normal";
  style?: CSSProperties;
  children?: ReactNode;
  className?: string;
  /** Accessible name for icon-only buttons; also drives the hover tooltip. */
  label?: string;
  /** Side the CSS tooltip opens on. Omit for a plain title attribute instead. */
  tipSide?: "left" | "right";
  title?: string;
}

export interface VentrioButtonProps
  extends CommonProps,
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "children" | "color" | "style"> {
  href?: undefined;
}

export interface VentrioLinkButtonProps extends CommonProps {
  /** Renders a Next link that looks and reacts exactly like the button. */
  href: string;
  target?: string;
  rel?: string;
  onClick?: () => void;
  "aria-current"?: "page" | "true";
}

/** Square controls default to a circle; text controls to the 10px radius. */
function resolveShape(variant: CommonProps["variant"], shape: CommonProps["shape"]) {
  if (shape) return shape;
  return variant === "composer" ? "circle" : "default";
}

function classesFor({ variant, size, shape, on, className }: CommonProps) {
  return cn(button({ variant, size, shape: resolveShape(variant, shape), on }), className);
}

const WEIGHT = { semibold: 600, medium: 500, normal: 400 } as const;

function styleFor({ align, weight, style }: CommonProps): CSSProperties | undefined {
  if (!align && !weight && !style) return undefined;
  return {
    ...(align === "start" ? { justifyContent: "flex-start" } : null),
    ...(weight ? { fontWeight: WEIGHT[weight] } : null),
    ...style,
  };
}

export const VentrioButton = forwardRef<HTMLButtonElement, VentrioButtonProps>(function VentrioButton(
  { variant, size, shape, on, className, children, label, tipSide, title, align, weight, style, ...rest },
  ref
) {
  const isIconOnly = variant === "icon" || variant === "composer";
  return (
    <button
      ref={ref}
      {...rest}
      style={styleFor({ align, weight, style })}
      type={rest.type ?? "button"}
      aria-label={rest["aria-label"] ?? (isIconOnly ? label : undefined)}
      title={title ?? (tipSide ? undefined : isIconOnly ? label : undefined)}
      {...(tipSide && label ? { "data-tip": label, "data-tip-side": tipSide } : {})}
      className={cn(tipSide && label && "tip", classesFor({ variant, size, shape, on, className }))}
    >
      {children}
    </button>
  );
});

/** The same button, as a link. Used wherever an action is really a destination. */
export function VentrioLinkButton({
  href,
  target,
  rel,
  onClick,
  variant,
  size,
  shape,
  on,
  className,
  children,
  label,
  tipSide,
  title,
  align,
  weight,
  style,
  ...rest
}: VentrioLinkButtonProps) {
  const isIconOnly = variant === "icon" || variant === "composer";
  return (
    <Link
      href={href}
      style={styleFor({ align, weight, style })}
      target={target}
      rel={rel}
      onClick={onClick}
      aria-label={isIconOnly ? label : undefined}
      title={title ?? (tipSide ? undefined : isIconOnly ? label : undefined)}
      {...(tipSide && label ? { "data-tip": label, "data-tip-side": tipSide } : {})}
      {...rest}
      className={cn(tipSide && label && "tip", classesFor({ variant, size, shape, on, className }))}
    >
      {children}
    </Link>
  );
}

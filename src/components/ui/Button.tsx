import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 ease-out hover:scale-[1.02] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:pointer-events-none disabled:opacity-50 disabled:hover:scale-100";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-accent text-accent-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_8px_28px_-8px_rgba(93,107,255,0.6)] hover:bg-accent-hover hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.22),0_12px_32px_-8px_rgba(93,107,255,0.7)]",
  secondary:
    "bg-surface-elevated text-ink border border-border hover:bg-surface-hover hover:border-border-strong",
  outline: "bg-transparent text-ink border border-border hover:bg-surface-hover",
  ghost: "bg-transparent text-ink-secondary hover:text-ink hover:bg-surface-hover",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-10 px-4 text-sm",
  md: "h-11 px-6 text-sm",
  lg: "h-14 px-8 text-base",
};

interface BaseButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children?: ReactNode;
  disabled?: boolean;
}

interface ButtonAsButtonProps extends BaseButtonProps {
  href?: undefined;
  type?: "button" | "submit" | "reset";
  onClick?: ButtonHTMLAttributes<HTMLButtonElement>["onClick"];
}

interface ButtonAsLinkProps extends BaseButtonProps {
  href: string;
  target?: string;
  rel?: string;
}

export type ButtonProps = ButtonAsButtonProps | ButtonAsLinkProps;

export function Button(props: ButtonProps) {
  const { variant = "primary", size = "md", className, children, disabled } =
    props;
  const classes = cn(baseStyles, variantStyles[variant], sizeStyles[size], className);

  if (props.href) {
    return (
      <Link
        href={props.href}
        target={props.target}
        rel={props.rel}
        className={classes}
        aria-disabled={disabled}
      >
        {children}
      </Link>
    );
  }

  const buttonProps = props as ButtonAsButtonProps;

  return (
    <button
      type={buttonProps.type ?? "button"}
      onClick={buttonProps.onClick}
      disabled={disabled}
      className={classes}
    >
      {children}
    </button>
  );
}

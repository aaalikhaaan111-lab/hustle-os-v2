import Link from "next/link";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

const baseStyles =
  "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:ring-offset-2 focus-visible:ring-offset-base disabled:pointer-events-none disabled:opacity-50";

const variantStyles: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-foreground hover:bg-accent-hover",
  secondary:
    "bg-surface text-ink border border-border-strong hover:bg-surface-hover",
  outline: "bg-transparent text-ink border border-border hover:bg-surface",
  ghost: "bg-transparent text-ink-secondary hover:text-ink hover:bg-surface",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-9 px-4 text-sm",
  lg: "h-11 px-6 text-base",
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

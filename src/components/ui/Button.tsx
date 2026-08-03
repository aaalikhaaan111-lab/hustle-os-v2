import type { ButtonHTMLAttributes, ReactNode } from "react";
import { VentrioButton, VentrioLinkButton } from "@/components/ui/VentrioButton";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

/**
 * The original app button, kept as an adapter over VentrioButton.
 *
 * Auth, error and not-found pages still call this with their own vocabulary, so
 * the props stay exactly as they were; the rendering is now the one button
 * system. `outline` maps onto `secondary` — they were the same thing wearing
 * two names. These surfaces keep their pill shape, which is what they have
 * always had.
 */
const VARIANT: Record<ButtonVariant, "primary" | "secondary" | "ghost"> = {
  primary: "primary",
  secondary: "secondary",
  outline: "secondary",
  ghost: "ghost",
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
  const { variant = "primary", size = "md", className, children, disabled } = props;
  const mapped = VARIANT[variant];

  if (props.href) {
    return (
      <VentrioLinkButton
        href={props.href}
        target={props.target}
        rel={props.rel}
        variant={mapped}
        size={size}
        shape="pill"
        className={className}
      >
        {children}
      </VentrioLinkButton>
    );
  }

  const buttonProps = props as ButtonAsButtonProps;

  return (
    <VentrioButton
      type={buttonProps.type ?? "button"}
      onClick={buttonProps.onClick}
      disabled={disabled}
      variant={mapped}
      size={size}
      shape="pill"
      className={className}
    >
      {children}
    </VentrioButton>
  );
}

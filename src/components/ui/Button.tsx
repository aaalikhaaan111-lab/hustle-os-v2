import type { ButtonHTMLAttributes, ReactNode } from "react";
import { VentrioButton, VentrioLinkButton } from "@/components/ui/VentrioButton";
import { Spinner } from "@/components/ui/shadcn/spinner";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

/**
 * The original app button, kept as an adapter over VentrioButton.
 *
 * Auth, error and not-found pages still call this with their own vocabulary, so
 * the props stay exactly as they were; the rendering is the one button system.
 * `outline` maps onto `secondary` — they were the same thing wearing two names.
 *
 * THE PILL IS GONE. These surfaces kept `shape="pill"` because they always had
 * it, which meant every button on sign-in, sign-up, profile and settings was a
 * capsule while every button in the workspace beside them was a 9px rectangle.
 * A capsule reads as a tag or a filter; most of these are commands. They now
 * take the default shape, like everything else.
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
  /**
   * Work is in flight.
   *
   * Disabling alone tells somebody the control stopped responding, not that it
   * is doing something — and swapping the label to "Saving…" moves the text
   * under the cursor. This disables AND shows a spinner beside the label the
   * button already had, so the control keeps its width and its meaning.
   *
   * It implies `disabled`, so a second click cannot submit the same form twice.
   */
  pending?: boolean;
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
  const { variant = "primary", size = "md", className, children, disabled, pending } = props;
  const mapped = VARIANT[variant];

  if (props.href) {
    return (
      <VentrioLinkButton
        href={props.href}
        target={props.target}
        rel={props.rel}
        variant={mapped}
        size={size}
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
      /* Pending implies disabled: the guard against a double submit is the
         same state that draws the spinner, so the two cannot disagree. */
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      variant={mapped}
      size={size}
      className={className}
    >
      {pending && <Spinner className="size-4" />}
      {children}
    </VentrioButton>
  );
}

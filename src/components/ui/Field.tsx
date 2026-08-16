import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
  className?: string;
}

/**
 * A labelled control, with its message actually attached to it.
 *
 * The message used to be a loose `<p>` sitting after the input. Sighted people
 * read it because it is directly underneath; a screen reader announced the
 * label and the input and then stopped, so "Enter a valid email address" was
 * unavailable to exactly the person who most needed it read aloud. The message
 * now carries an id and is wired to the control through `aria-describedby`.
 *
 * Done by cloning the child rather than by asking every caller to pass the id,
 * because the id has to agree at both ends and a caller that forgets produces a
 * field that looks completely correct. If the child is not a single element the
 * clone is skipped and the field still renders — degraded, not broken.
 */
export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  children,
  className,
}: FieldProps) {
  const message = error ?? hint;
  const messageId = message ? `${htmlFor}-message` : undefined;

  const child = Children.only(children);
  const described =
    messageId && isValidElement(child)
      ? cloneElement(child as ReactElement<{ "aria-describedby"?: string }>, {
          // Appended rather than replaced: a caller may already describe the
          // control with something of its own.
          "aria-describedby":
            [(child.props as { "aria-describedby"?: string })["aria-describedby"], messageId]
              .filter(Boolean)
              .join(" ") || undefined,
        })
      : child;

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <label htmlFor={htmlFor} className="text-[0.9375rem] font-medium leading-tight text-ink">
        {label}
        {required && (
          <span className="text-accent" aria-hidden>
            {" *"}
          </span>
        )}
        {/* The asterisk is decoration; `required` on the control is the fact.
            Spelling it out keeps the two from disagreeing for a screen reader. */}
        {required && <span className="sr-only"> (required)</span>}
      </label>
      {described}
      {message && (
        <p
          id={messageId}
          // Only a validation failure is urgent enough to interrupt. A hint is
          // static help text, and announcing it on every render is noise.
          role={error ? "alert" : undefined}
          className={cn("text-[0.8125rem] leading-snug", error ? "text-danger" : "text-ink-muted")}
        >
          {message}
        </p>
      )}
    </div>
  );
}

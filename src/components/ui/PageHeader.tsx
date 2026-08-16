import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  /** Accepted and ignored: the uppercase accent eyebrow was retired with the
   *  marketing masthead. Kept in the type so callers need not change. */
  eyebrow?: string;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    /* An application header, not a marketing one.
       This was a 36px bold title under an uppercase letter-spaced accent
       eyebrow, above a rule. That is a landing-page masthead, and it was the
       loudest thing on every screen that used it — which is why Pricing read as
       a different product from the workspace. It now uses the shared scale, has
       no eyebrow and no rule, and lets the content below it be the subject. */
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="v-display">{title}</h1>
        {description && <p className="v-body mt-1.5 max-w-2xl">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

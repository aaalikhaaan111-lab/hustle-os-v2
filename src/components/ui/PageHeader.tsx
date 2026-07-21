import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  eyebrow?: string;
}

export function PageHeader({ title, description, actions, eyebrow }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-4 border-b border-border/50 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow && (
          <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-accent">
            {eyebrow}
          </p>
        )}
        <h1 className="text-[1.75rem] font-bold leading-[1.1] tracking-[-0.03em] text-ink sm:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-2xl text-[15px] leading-relaxed tracking-tight text-ink-secondary">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-3">{actions}</div>}
    </div>
  );
}

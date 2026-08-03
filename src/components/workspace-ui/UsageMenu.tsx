"use client";

import { useEffect, useRef, useState } from "react";
import { IconSliders } from "./parts";
import { VentrioButton } from "@/components/ui/VentrioButton";
import type { WorkspaceUsage } from "@/lib/workspace/usage";

export interface UsageLabels {
  trigger: string;
  title: string;
  aiChanges: string;
  projectBuilds: string;
  evolutionCredits: string;
  trackedSessions: string;
  unavailable: string;
  note: string;
}

/**
 * What is left of the allowance, on request.
 *
 * Counters used to sit permanently under the composer, which meant the first
 * thing a person read before writing was a limit. They live behind this control
 * instead: still one click away, still the real ledger, no longer part of the
 * furniture.
 */
export function UsageMenu({ usage, labels }: { usage: WorkspaceUsage; labels: UsageLabels }) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (!wrap.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const rows = [
    { label: labels.aiChanges, counter: usage.aiChanges },
    { label: labels.projectBuilds, counter: usage.projectBuilds },
    { label: labels.evolutionCredits, counter: usage.evolutionCredits },
    { label: labels.trackedSessions, counter: usage.trackedSessions },
  ];

  return (
    <div ref={wrap} className="relative">
      <VentrioButton
        variant="composer"
        size="md"
        on={open}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        label={labels.trigger}
      >
        <IconSliders className="h-[18px] w-[18px]" />
      </VentrioButton>

      {open && (
        <div
          className="pop lift-3 absolute bottom-[calc(100%+10px)] left-0 z-40 w-[264px] rounded-[var(--r-md)] border p-4"
          style={{ borderColor: "var(--line)", background: "var(--surface)", ["--pop-origin" as string]: "bottom left" }}
        >
          <p className="text-[13px] font-semibold">{labels.title}</p>
          <ul className="mt-3 flex flex-col gap-3">
            {rows.map(({ label, counter }) => (
              <li key={label}>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px]" style={{ color: "var(--ink-2)" }}>
                    {label}
                  </span>
                  <span className="text-[13px] font-medium tabular-nums" style={{ color: "var(--ink-3)" }}>
                    {counter.available ? `${counter.used}/${counter.limit}` : labels.unavailable}
                  </span>
                </div>
                {counter.available && (
                  <div className="mt-1.5 h-1 overflow-hidden rounded-full" style={{ background: "var(--sunken)" }}>
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (counter.used / Math.max(1, counter.limit)) * 100)}%`,
                        background: "var(--accent-grad)",
                      }}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-3.5 text-[12px] leading-relaxed" style={{ color: "var(--ink-3)" }}>
            {labels.note}
          </p>
        </div>
      )}
    </div>
  );
}

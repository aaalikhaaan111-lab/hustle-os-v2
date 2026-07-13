"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { AlertIcon, CheckIcon, InfoIcon, LaunchIcon, QuestionIcon, ResearchIcon } from "@/components/ui/icons";
import { cn } from "@/lib/utils";
import { activateResearchAction } from "@/lib/actions/research";
import type { ResearchReport } from "@/types/venture";

const STAGES = [
  "Booting Research Department",
  "Connecting model",
  "Reading mission",
  "Understanding business",
  "Finding risks",
  "Finding opportunities",
  "Preparing report",
] as const;

const STAGE_INTERVAL_MS = 1200;

type Phase = "idle" | "running" | "completed";

interface ResearchDepartmentCardProps {
  ventureId: string;
  description: string;
  initialReport: ResearchReport | null;
}

export function ResearchDepartmentCard({
  ventureId,
  description,
  initialReport,
}: ResearchDepartmentCardProps) {
  const [phase, setPhase] = useState<Phase>(initialReport ? "completed" : "idle");
  const [report, setReport] = useState<ResearchReport | null>(initialReport);
  const [expanded, setExpanded] = useState(false);
  const [stageIndex, setStageIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (phase !== "running") return;
    const id = setInterval(() => {
      setStageIndex((prev) => Math.min(prev + 1, STAGES.length - 1));
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, [phase]);

  function handleActivate() {
    setError(null);
    setStageIndex(0);
    setPhase("running");
    startTransition(async () => {
      const result = await activateResearchAction(ventureId);
      if (result.error || !result.report) {
        setError(result.error ?? "Something went wrong. Please try again.");
        setPhase("idle");
        return;
      }
      setReport(result.report);
      setPhase("completed");
      setExpanded(true);
    });
  }

  if (phase === "running") {
    return (
      <Card className="sm:col-span-2 lg:col-span-3">
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover text-ink-secondary">
                <ResearchIcon className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-ink">Research</h3>
                <p className="text-xs text-ink-muted">Analyzing your venture...</p>
              </div>
            </div>
            <Badge variant="accent" className="gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-accent animate-pulse-soft" />
              Running
            </Badge>
          </div>
          <ol className="flex flex-col gap-2.5 pl-1">
            {STAGES.map((stage, i) => {
              const state = i < stageIndex ? "done" : i === stageIndex ? "active" : "pending";
              return (
                <li key={stage} className="flex items-center gap-2.5 text-sm">
                  <span
                    className={cn(
                      "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors duration-150",
                      state === "done" && "border-accent bg-accent text-accent-foreground",
                      state === "active" && "border-accent animate-pulse-soft",
                      state === "pending" && "border-border-strong"
                    )}
                  >
                    {state === "done" && <CheckIcon className="h-2.5 w-2.5" />}
                  </span>
                  <span
                    className={cn(
                      state === "pending"
                        ? "text-ink-muted"
                        : state === "active"
                          ? "text-ink"
                          : "text-ink-secondary"
                    )}
                  >
                    {stage}
                  </span>
                </li>
              );
            })}
          </ol>
        </CardContent>
      </Card>
    );
  }

  if (phase === "completed" && report) {
    return (
      <Card className={cn(expanded && "sm:col-span-2 lg:col-span-3")}>
        <CardContent className="flex flex-col gap-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover text-ink-secondary">
              <ResearchIcon className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-ink">Research</h3>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-success">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Completed
              </p>
            </div>
          </div>
          <p className="text-sm text-ink-secondary">Generated: findings, opportunities, risks.</p>
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="self-start text-sm font-medium text-accent transition-colors duration-150 hover:text-accent-hover"
          >
            {expanded ? "Collapse report" : "Open report"} →
          </button>

          {expanded && (
            <div className="animate-field-in flex flex-col gap-4 border-t border-border pt-4">
              <ReportSection title="Executive summary" icon={<InfoIcon className="h-4 w-4" />}>
                <p className="text-sm text-ink-secondary">{report.executiveSummary}</p>
              </ReportSection>
              <div className="grid gap-4 sm:grid-cols-2">
                <ReportSection
                  title="Opportunities"
                  icon={<LaunchIcon className="h-4 w-4" />}
                  items={report.opportunities}
                />
                <ReportSection
                  title="Risks"
                  icon={<AlertIcon className="h-4 w-4" />}
                  items={report.risks}
                />
                <ReportSection
                  title="Questions"
                  icon={<QuestionIcon className="h-4 w-4" />}
                  items={report.questions}
                />
                <ReportSection
                  title="Assumptions"
                  icon={<InfoIcon className="h-4 w-4" />}
                  items={report.assumptions}
                />
              </div>
              <ReportSection title="Confidence" icon={<InfoIcon className="h-4 w-4" />}>
                <Badge variant={report.confidence === "high" ? "accent" : "muted"} className="capitalize">
                  {report.confidence}
                </Badge>
                <p className="mt-2 text-sm text-ink-secondary">{report.confidenceRationale}</p>
              </ReportSection>
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-4 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface-hover text-ink-secondary">
          <ResearchIcon className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-ink">Research</h3>
          <p className="mt-1.5 text-sm text-ink-secondary">{description}</p>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <Button size="sm" variant="secondary" onClick={handleActivate}>
          Activate Research
        </Button>
      </CardContent>
    </Card>
  );
}

interface ReportSectionProps {
  title: string;
  icon: ReactNode;
  items?: string[];
  children?: ReactNode;
}

function ReportSection({ title, icon, items, children }: ReportSectionProps) {
  return (
    <div className="rounded-lg bg-surface-hover/40 p-4">
      <div className="flex items-center gap-2 text-ink-secondary">
        {icon}
        <h4 className="text-xs font-semibold uppercase tracking-wider">{title}</h4>
      </div>
      <div className="mt-2.5">
        {items ? (
          <ul className="flex flex-col gap-1.5">
            {items.map((item) => (
              <li key={item} className="flex gap-2 text-sm text-ink-secondary">
                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-ink-muted" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

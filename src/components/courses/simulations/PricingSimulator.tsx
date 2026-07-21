"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { calcPricingOutcome, type PricingSimulationConfig } from "@/constants/courses";

type TestOutcome = "no-demand" | "loss" | "suboptimal" | "success";

interface TestResult {
  outcome: TestOutcome;
}

function classifyOutcome(price: number, profit: number, demand: number, config: PricingSimulationConfig): TestResult {
  if (demand <= 0) {
    return { outcome: "no-demand" };
  }
  if (profit < 0) {
    return { outcome: "loss" };
  }
  if (price >= config.sweetSpotMin && price <= config.sweetSpotMax) {
    return { outcome: "success" };
  }
  return { outcome: "suboptimal" };
}

interface PricingSimulatorProps {
  config: PricingSimulationConfig;
  onSweetSpotFound: () => void;
}

export function PricingSimulator({ config, onSweetSpotFound }: PricingSimulatorProps) {
  const t = useTranslations("courses");
  const OUTCOME_MESSAGES: Record<TestOutcome, string> = {
    "no-demand": t("pricingNoDemand"),
    loss: t("pricingLoss"),
    success: t("pricingSuccess"),
    suboptimal: t("pricingSuboptimal"),
  };
  const [price, setPrice] = useState(config.defaultPrice);
  const [result, setResult] = useState<TestResult | null>(null);

  const { demand, totalCost, profit } = useMemo(() => calcPricingOutcome(price, config), [price, config]);

  function handleTest() {
    const outcome = classifyOutcome(price, profit, demand, config);
    setResult(outcome);
    if (outcome.outcome === "success") {
      onSweetSpotFound();
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 rounded-2xl bg-accent-soft px-5 py-4 ring-1 ring-inset ring-accent/20">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-ink">{t("pricingSetPrice")}</span>
          <span className="text-lg font-black text-ink">${price}</span>
        </div>
        <input
          type="range"
          min={config.minPrice}
          max={config.maxPrice}
          step={1}
          value={price}
          onChange={(event) => {
            setPrice(Number(event.target.value));
            setResult(null);
          }}
          className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-900/[0.08] accent-indigo-600"
        />
        <div className="flex justify-between text-[11px] font-medium text-ink-muted">
          <span>${config.minPrice}</span>
          <span>${config.maxPrice}</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-1 rounded-2xl bg-surface/60 px-3 py-3 text-center ring-1 ring-inset ring-accent/20">
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{t("pricingDemand")}</span>
          <span className="text-lg font-black text-ink">{Math.round(demand)}</span>
        </div>
        <div className="flex flex-col gap-1 rounded-2xl bg-surface/60 px-3 py-3 text-center ring-1 ring-inset ring-accent/20">
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{t("pricingCosts")}</span>
          <span className="text-lg font-black text-ink">${Math.round(totalCost)}</span>
        </div>
        <div
          className={cn(
            "flex flex-col gap-1 rounded-2xl px-3 py-3 text-center ring-1 ring-inset",
            profit >= 0 ? "bg-success-soft ring-success/30" : "bg-danger-soft ring-danger/30"
          )}
        >
          <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{t("pricingProfit")}</span>
          <span className={cn("text-lg font-black", profit >= 0 ? "text-success" : "text-danger")}>
            ${Math.round(profit)}
          </span>
        </div>
      </div>

      {result && (
        <p
          className={cn(
            "animate-pop-in rounded-2xl px-4 py-3 text-sm font-semibold",
            result.outcome === "success" && "bg-success-soft text-success",
            (result.outcome === "loss" || result.outcome === "no-demand") && "bg-danger-soft text-danger",
            result.outcome === "suboptimal" && "bg-warning-soft text-warning"
          )}
        >
          {OUTCOME_MESSAGES[result.outcome]}
        </p>
      )}

      <Button size="lg" onClick={handleTest} className="w-full">
        {t("pricingTestButton")}
      </Button>
    </div>
  );
}

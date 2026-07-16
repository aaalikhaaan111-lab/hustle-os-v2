"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";

interface SliderFieldProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (value: number) => void;
}

function SliderField({ label, value, min, max, step, unit, onChange }: SliderFieldProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-ink">{label}</span>
        <span className="text-sm font-black text-ink">
          {value}
          {unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-2 w-full cursor-pointer appearance-none rounded-full bg-zinc-900/[0.08] accent-indigo-600"
      />
      <div className="flex justify-between text-[11px] font-medium text-ink-muted">
        <span>
          {min}
          {unit}
        </span>
        <span>
          {max}
          {unit}
        </span>
      </div>
    </div>
  );
}

function ResultTile({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-2xl px-4 py-3 text-center ring-1 ring-inset",
        tone === "success" && "bg-success-soft ring-success/30",
        tone === "danger" && "bg-danger-soft ring-danger/30",
        !tone && "bg-white/70 ring-indigo-100"
      )}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide text-ink-muted">{label}</span>
      <span
        className={cn(
          "text-lg font-black",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
          !tone && "text-ink"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function UnitEconomicsSimulator() {
  const t = useTranslations("workshops");
  const [price, setPrice] = useState(1500);
  const [cac, setCac] = useState(400);
  const [cogs, setCogs] = useState(600);
  const [conversionRate, setConversionRate] = useState(2);

  const { grossMarginPerUnit, grossMarginPercent, profitPerUnit, visitorsNeededPerSale, isProfitable } =
    useMemo(() => {
      const grossMargin = price - cogs;
      const marginPercent = price > 0 ? (grossMargin / price) * 100 : 0;
      const profit = grossMargin - cac;
      const visitors = conversionRate > 0 ? Math.round(100 / conversionRate) : Infinity;
      return {
        grossMarginPerUnit: grossMargin,
        grossMarginPercent: marginPercent,
        profitPerUnit: profit,
        visitorsNeededPerSale: visitors,
        isProfitable: profit > 0,
      };
    }, [price, cac, cogs, conversionRate]);

  return (
    <Card>
      <CardContent className="flex flex-col gap-6 py-8">
        <div className="flex items-center gap-3">
          <span className="text-3xl" role="img" aria-hidden>
            🧮
          </span>
          <div className="flex flex-col gap-1">
            <span className="inline-flex w-fit items-center rounded-full bg-gradient-to-tr from-indigo-50 to-pink-50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-indigo-600 ring-1 ring-inset ring-indigo-100">
              {t("simulatorBadge")}
            </span>
            <h3 className="text-xl font-extrabold tracking-[-0.02em] text-ink">
              {t("simulatorTitle")}
            </h3>
          </div>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <SliderField label={t("priceLabel")} value={price} min={100} max={5000} step={50} unit="₽" onChange={setPrice} />
          <SliderField
            label={t("cacLabel")}
            value={cac}
            min={0}
            max={2000}
            step={10}
            unit="₽"
            onChange={setCac}
          />
          <SliderField
            label={t("cogsLabel")}
            value={cogs}
            min={0}
            max={3000}
            step={10}
            unit="₽"
            onChange={setCogs}
          />
          <SliderField
            label={t("conversionLabel")}
            value={conversionRate}
            min={0.5}
            max={10}
            step={0.5}
            unit="%"
            onChange={setConversionRate}
          />
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResultTile label={t("marginPerUnit")} value={`${grossMarginPerUnit}₽`} />
          <ResultTile label={t("marginPercent")} value={`${grossMarginPercent.toFixed(0)}%`} />
          <ResultTile
            label={t("profitPerUnit")}
            value={`${profitPerUnit}₽`}
            tone={isProfitable ? "success" : "danger"}
          />
          <ResultTile
            label={t("visitorsPerSale")}
            value={Number.isFinite(visitorsNeededPerSale) ? `${visitorsNeededPerSale}` : "—"}
          />
        </div>

        <div
          className={cn(
            "flex items-center gap-3 rounded-2xl px-5 py-4 text-sm font-bold",
            isProfitable ? "bg-success-soft text-success" : "bg-danger-soft text-danger"
          )}
        >
          <span className="text-xl" role="img" aria-hidden>
            {isProfitable ? "✅" : "⚠️"}
          </span>
          {isProfitable
            ? t("profitableModel", { profit: profitPerUnit })
            : t("unprofitableModel", { loss: Math.abs(profitPerUnit) })}
        </div>
      </CardContent>
    </Card>
  );
}

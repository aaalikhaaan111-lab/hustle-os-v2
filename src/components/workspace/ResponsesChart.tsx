"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/shadcn/chart";

/**
 * Responses over time.
 *
 * This is a REAL series, not a decoration. `loadProjectAnalytics` already
 * fetched every response row with its `created_at` and then reduced them to
 * four scalars; the dates were being discarded. The chart plots what the
 * database actually holds, including the days with nothing on them — a series
 * that omits empty days draws "four responses over four days" and "four
 * responses over three weeks" as the same picture.
 *
 * It is only rendered when there is more than one day of data. One point is not
 * a trend, and drawing it as one would be the kind of invented insight the
 * analytics page was rewritten to remove.
 */
export function ResponsesChart({
  data,
  label,
}: {
  data: Array<{ date: string; responses: number }>;
  label: string;
}) {
  const config = { responses: { label, color: "var(--chart-3)" } } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="h-[180px] w-full">
      <AreaChart data={data} margin={{ left: 4, right: 4, top: 8, bottom: 0 }}>
        <CartesianGrid vertical={false} stroke="var(--border)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          minTickGap={28}
          tickFormatter={(value: string) => value.slice(5)}
        />
        <YAxis
          allowDecimals={false}
          width={28}
          tickLine={false}
          axisLine={false}
          tickMargin={4}
        />
        <ChartTooltip content={<ChartTooltipContent />} />
        <Area
          dataKey="responses"
          type="monotone"
          stroke="var(--color-responses)"
          fill="var(--color-responses)"
          fillOpacity={0.15}
          strokeWidth={2}
        />
      </AreaChart>
    </ChartContainer>
  );
}

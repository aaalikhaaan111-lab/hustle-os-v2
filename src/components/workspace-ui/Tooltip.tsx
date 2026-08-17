"use client";

import type { ReactNode } from "react";
import {
  Tooltip as ShadTooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/shadcn/tooltip";

/**
 * The product's tooltip, over the one primitive.
 *
 * WHAT THIS USED TO BE. A hand-rolled portal: a ref on a wrapper span, a
 * timer, a `getBoundingClientRect` read, manual viewport clamping, and
 * listeners for leave, blur, scroll and Escape — about 130 lines. It was
 * written because the collapsed rail sets `overflow: hidden`, so a tooltip
 * drawn inside it is invisible by construction.
 *
 * The rail is shadcn's Sidebar now, and its collapsed labels come from Radix's
 * tooltip — which portals, flips, clamps to the viewport and handles the delay
 * and the dismiss keys already. Keeping a second implementation meant the two
 * tooltips in this product looked and behaved differently depending on which
 * corner you were in.
 *
 * The ergonomic `label` / `side` API is kept, because it is better than three
 * nested elements at every call site, and because it is what the toolbar
 * already passes. Only the machinery underneath changed.
 */
export function Tooltip({
  label,
  side = "right",
  delay = 320,
  children,
}: {
  label: string;
  side?: "right" | "left" | "bottom" | "top";
  /** Sweeping the pointer along a toolbar should not flash every label. */
  delay?: number;
  children: ReactNode;
}) {
  return (
    <TooltipProvider delayDuration={delay}>
      <ShadTooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} sideOffset={6}>
          {label}
        </TooltipContent>
      </ShadTooltip>
    </TooltipProvider>
  );
}

"use client";

import type { SimulationConfig } from "@/constants/courses";
import { PricingSimulator } from "@/components/courses/simulations/PricingSimulator";

interface InteractiveSimulationProps {
  config: SimulationConfig;
  onComplete: () => void;
}

// Dispatches to the right simulator by `kind`. Add new cases here as new interactive
// formats (trade-off matrix, budget allocation bars, ...) get real content.
export function InteractiveSimulation({ config, onComplete }: InteractiveSimulationProps) {
  switch (config.kind) {
    case "pricing":
      return <PricingSimulator config={config} onSweetSpotFound={onComplete} />;
    default:
      return null;
  }
}

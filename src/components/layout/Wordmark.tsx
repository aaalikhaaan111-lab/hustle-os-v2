import { cn } from "@/lib/utils";

// public/ventrio-mark.png is the brand mark trimmed to its own bounds and
// re-centred on a square transparent canvas, derived from the original
// public/ventrio-logo.png export — which was RGB with no alpha, a baked-in
// white backdrop, and the mark sitting off-centre and taller than it was wide.
// Because the asset's intrinsic bounds are now correct, this just draws: no
// upscaling trick, no clipping, nothing to crop.
export function Wordmark({ className }: { className?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a fixed 24px local mark; next/image adds nothing here
    <img
      src="/ventrio-mark.png"
      alt="Ventrio"
      width={24}
      height={24}
      className={cn("block h-6 w-6 select-none", className)}
    />
  );
}

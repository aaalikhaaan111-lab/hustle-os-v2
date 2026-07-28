import { cn } from "@/lib/utils";

// The source file (public/ventrio-logo.png) is a square canvas where the mark
// itself only fills its middle ~42%/52% (width/height) — the rest is baked-in
// whitespace we can't crop in the file itself. This wrapper clips to a tight
// box and scales the image up around its (near-)center so the mark reads at
// the intended size instead of shrinking to fit all that surrounding padding.
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block h-6 w-6 overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- local asset sized/cropped purely by CSS; next/image would force a guessed intrinsic aspect ratio */}
      <img
        src="/ventrio-logo.png"
        alt="Ventrio"
        className="absolute left-1/2 top-1/2 h-[185%] w-[185%] max-w-none -translate-x-1/2 -translate-y-1/2"
      />
    </span>
  );
}

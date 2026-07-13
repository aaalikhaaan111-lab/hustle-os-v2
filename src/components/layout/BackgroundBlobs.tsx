export function BackgroundBlobs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      <div className="absolute -top-40 -right-32 h-[520px] w-[520px] rounded-full bg-indigo-200 opacity-20 blur-[130px]" />
      <div className="absolute top-1/3 -left-48 h-[560px] w-[560px] rounded-full bg-pink-200 opacity-[0.18] blur-[140px]" />
      <div className="absolute -bottom-48 right-1/4 h-[480px] w-[480px] rounded-full bg-purple-200 opacity-[0.16] blur-[130px]" />
    </div>
  );
}

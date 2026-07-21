export function BackgroundBlobs() {
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden select-none"
    >
      <div className="absolute -top-48 -right-40 h-[560px] w-[560px] rounded-full bg-indigo-200 opacity-[0.10] blur-[150px]" />
      <div className="absolute bottom-0 -left-56 h-[600px] w-[600px] rounded-full bg-violet-200 opacity-[0.08] blur-[160px]" />
    </div>
  );
}

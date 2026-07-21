// App-wide aurora atmosphere: a few large, very soft indigo/teal gradients that
// give the dark canvas a sense of place without ever competing with content.
// The slow drift respects prefers-reduced-motion (handled globally).
export function BackgroundBlobs() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 select-none overflow-hidden">
      <div className="absolute -top-1/4 left-1/4 h-[620px] w-[620px] animate-aurora rounded-full bg-[#5d6bff] opacity-[0.14] blur-[150px]" />
      <div className="absolute top-1/3 -right-32 h-[560px] w-[560px] animate-aurora rounded-full bg-[#2dd4bf] opacity-[0.08] blur-[160px] [animation-delay:-8s]" />
      <div className="absolute -bottom-40 -left-32 h-[560px] w-[560px] animate-aurora rounded-full bg-[#7c86ff] opacity-[0.10] blur-[150px] [animation-delay:-14s]" />
    </div>
  );
}

import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-white/[0.07] bg-surface/70 shadow-[inset_0_1px_0_rgba(255,255,255,0.05),0_24px_48px_-28px_rgba(0,0,0,0.75)] backdrop-blur-xl transition-all duration-300 ease-out hover:border-white/[0.11] hover:bg-surface/90",
        className
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-2 px-5 pt-6 sm:px-8 sm:pt-8", className)} {...props} />
  );
}

export function CardTitle({
  className,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn("text-lg font-extrabold tracking-tight text-ink", className)}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-ink-secondary", className)} {...props} />;
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 sm:px-8", className)} {...props} />;
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex items-center px-5 pb-6 sm:px-8 sm:pb-8", className)} {...props} />
  );
}

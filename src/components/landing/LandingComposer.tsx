"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { writeSeed } from "@/lib/create/seed";
import { AiComposer } from "@/components/ui/AiComposer";
import { cn } from "@/lib/utils";

interface LandingComposerProps {
  isAuthenticated: boolean;
  variant: "hero" | "final";
  textareaId?: string;
}

// The public entry into creation. It never talks to the AI: it captures the
// visitor's first message as a seed and routes into the existing Create flow
// (or to signup first when logged out), which consumes the seed and continues
// the conversation. Top and bottom instances are identical by construction.
export function LandingComposer({ isAuthenticated, variant, textareaId }: LandingComposerProps) {
  const t = useTranslations("landing");
  const router = useRouter();

  const [value, setValue] = useState("");
  const [routing, setRouting] = useState(false);

  // The closing composer asks for the same thing in the closing section's own
  // words; the hero keeps the placeholder it was approved with.
  const placeholderKey = variant === "final" ? "composerPlaceholderFinal" : "composerPlaceholder";

  function go() {
    const trimmed = value.trim();
    if (!trimmed || routing) return;
    writeSeed(trimmed, null);
    setRouting(true);
    // Logged out, the destination has to survive the round trip through the
    // auth provider, or the visitor lands on Overview with their idea still
    // sitting unread in sessionStorage. Signing up with email already ended at
    // /create because the server action hardcodes it; signing up with Google
    // did not, because nothing put `next` on the URL for the callback to read.
    // Every step of that chain already understood `next` — only this one never
    // set it.
    router.push(isAuthenticated ? "/create" : `/signup?next=${encodeURIComponent("/create")}`);
  }

  return (
    <div className={cn("mx-auto w-full", variant === "hero" ? "max-w-[420px]" : "max-w-[380px]")}>
      <AiComposer
        value={value}
        onChange={setValue}
        onSend={go}
        disabled={routing}
        sending={routing}
        placeholder={t(placeholderKey)}
        ariaLabel={t("composerLabel")}
        sendLabel={t("composerSend")}
        textareaId={textareaId}
      />
    </div>
  );
}

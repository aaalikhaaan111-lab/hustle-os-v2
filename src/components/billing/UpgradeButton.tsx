"use client";

import Script from "next/script";
import { useState } from "react";

/**
 * Opens Paddle's overlay checkout for Ventrio Pro.
 *
 * Paddle.js is loaded from their CDN rather than through an npm package: the
 * published package is a thin loader around this same script, and skipping it
 * keeps a payments dependency out of the tree. `next/script` gives the tag the
 * page's CSP nonce, and `'strict-dynamic'` lets a nonced script pull its own
 * resources — which is why no `script-src` host had to be added.
 *
 * THIS BUTTON GRANTS NOTHING. It opens a checkout. The plan changes only when
 * Paddle's signed webhook says a payment happened, so a visitor who calls this
 * from a console, closes the overlay early, or fakes a success callback ends up
 * exactly where they started. `customData.user_id` is the linkage Paddle echoes
 * back on every subsequent event.
 */
declare global {
  interface Window {
    Paddle?: {
      Environment: { set(environment: string): void };
      Initialize(options: { token: string }): void;
      Checkout: {
        open(options: {
          items: Array<{ priceId: string; quantity: number }>;
          customData?: Record<string, string>;
          customer?: { email: string };
          settings?: Record<string, unknown>;
        }): void;
      };
    };
  }
}

export interface UpgradeButtonProps {
  clientToken: string;
  environment: "sandbox" | "production";
  priceId: string;
  userId: string;
  email?: string;
  label: string;
  className?: string;
}

export function UpgradeButton({
  clientToken,
  environment,
  priceId,
  userId,
  email,
  label,
  className,
}: UpgradeButtonProps) {
  const [ready, setReady] = useState(false);
  const [opening, setOpening] = useState(false);

  function open() {
    const paddle = window.Paddle;
    if (!paddle) return;
    setOpening(true);
    try {
      paddle.Checkout.open({
        items: [{ priceId, quantity: 1 }],
        customData: { user_id: userId },
        ...(email ? { customer: { email } } : {}),
      });
    } finally {
      // The overlay owns the flow from here; this only re-enables the button
      // behind it so a closed overlay is not a dead end.
      setOpening(false);
    }
  }

  return (
    <>
      <Script
        src="https://cdn.paddle.com/paddle/v2/paddle.js"
        strategy="afterInteractive"
        onReady={() => {
          const paddle = window.Paddle;
          if (!paddle) return;
          if (environment === "sandbox") paddle.Environment.set("sandbox");
          paddle.Initialize({ token: clientToken });
          setReady(true);
        }}
      />
      <button type="button" onClick={open} disabled={!ready || opening} className={className}>
        {label}
      </button>
    </>
  );
}

import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
  Lora,
  Playfair_Display,
  Unbounded,
  Oswald,
  Cormorant_Garamond,
  JetBrains_Mono,
  Manrope,
} from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { AppShell } from "@/components/layout/AppShell";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

// A premium editorial serif, used only by generated-project themes
// ("editorial"/"atmospheric") for a genuinely different typographic voice
// from the app's own Geist Sans UI — see .output-theme-* in globals.css.
const lora = Lora({
  variable: "--font-editorial",
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
});

/**
 * The type registry generated projects choose from.
 *
 * Before this there were three faces in the whole product — Geist, Geist Mono
 * and Lora — so every generated site was set in the same type whatever its
 * "design strategy" said. Different sizes of the same typeface is not different
 * typography, which is the single biggest reason the outputs read as one
 * template family.
 *
 * Each of these is a genuinely different voice, not a near-neighbour: a
 * high-contrast editorial serif, an expressive geometric display, a condensed
 * poster face, a luxury old-style serif, a technical monospace, and a soft
 * geometric sans.
 *
 * Every one declares the Cyrillic subset. Russian is a first-class output
 * language here, and a display face that silently falls back to a system font
 * for Cyrillic would undo the art direction exactly where it matters most.
 * next/font self-hosts these at build time, so there is no runtime request to
 * a third party and no new dependency — next/font is already part of Next.
 */
const playfair = Playfair_Display({
  variable: "--font-display-editorial",
  subsets: ["latin", "cyrillic"],
  style: ["normal", "italic"],
});

const unbounded = Unbounded({
  variable: "--font-display-expressive",
  subsets: ["latin", "cyrillic"],
});

const oswald = Oswald({
  variable: "--font-display-condensed",
  subsets: ["latin", "cyrillic"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-display-luxury",
  subsets: ["latin", "cyrillic"],
  weight: ["300", "400", "500", "600", "700"],
  style: ["normal", "italic"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-display-technical",
  subsets: ["latin", "cyrillic"],
});

const manrope = Manrope({
  variable: "--font-body-geometric",
  subsets: ["latin", "cyrillic"],
});

// viewport-fit=cover is what makes the env(safe-area-inset-*) padding used
// across the shell (mobile header, bottom nav, page content) actually resolve
// to non-zero values on notched devices — without it those insets are always 0
// and content can sit under the notch or home indicator.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadata");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const requestHeaders = await headers();
  if (requestHeaders.get("x-ventrio-public-route") === "1") {
    return (
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${playfair.variable} ${unbounded.variable} ${oswald.variable} ${cormorant.variable} ${jetbrains.variable} ${manrope.variable} h-full antialiased`}>
        <body className="min-h-full">{children}</body>
      </html>
    );
  }

  const locale = await getLocale();
  const messages = await getMessages();
  // Middleware forwards the authenticated user's id on live routes; the drawer
  // uses it to show the right auth controls.
  const isAuthenticated = Boolean(requestHeaders.get("x-user-id"));

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${playfair.variable} ${unbounded.variable} ${oswald.variable} ${cormorant.variable} ${jetbrains.variable} ${manrope.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppShell isAuthenticated={isAuthenticated}>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

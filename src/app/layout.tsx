import type { Metadata, Viewport } from "next";
import { Figtree, Geist, Geist_Mono, Lora } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { headers } from "next/headers";
import { AppShell } from "@/components/layout/AppShell";
import { clientMessages } from "@/i18n/clientMessages";
import "./globals.css";
import "./studio.css";

/**
 * The platform UI face.
 *
 * ONE CONSTRAINT WORTH STATING: Figtree ships latin and latin-ext only — it has
 * no Cyrillic. Ventrio runs in Russian, so Figtree alone would leave half the
 * product falling back to whatever the OS picks, differently on every machine.
 *
 * Geist is therefore kept and declared immediately after Figtree in the stack.
 * Font matching is per GLYPH, not per string: latin renders in Figtree, Cyrillic
 * falls through to Geist. Both are geometric humanist sans at similar widths, so
 * the seam is not visible in normal use — but it is a seam, and it is here
 * because the alternative is worse.
 *
 * The editorial serif is gone with the direction that asked for it.
 */
const figtree = Figtree({
  variable: "--font-ui",
  subsets: ["latin", "latin-ext"],
});

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
      <html lang="en" className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${figtree.variable} h-full antialiased`}>
        <body className="min-h-full">{children}</body>
      </html>
    );
  }

  const locale = await getLocale();
  const messages = clientMessages(await getMessages());
  /**
   * Which auth controls the drawer and the landing nav show.
   *
   * Two sources, and the difference matters. `x-user-id` is set only after the
   * proxy's network-validated `getUser()`, and it is what `getCurrentUser`
   * treats as identity — so it is the authoritative one. On public content
   * routes the proxy skips that call (it is a ~400 ms round trip for a page
   * that needs no session) and instead reports whether a Supabase auth cookie
   * is present, which is enough to pick between "Log in" and "Projects".
   *
   * The hint is deliberately a separate header rather than a forged
   * `x-user-id`: it names no user, nothing authorises against it, and the worst
   * a spoofed value can do is show a signed-out visitor a link that redirects
   * them to /login. Every protected route is still gated by the proxy and by
   * the identity check inside the page.
   */
  const isAuthenticated =
    Boolean(requestHeaders.get("x-user-id")) || requestHeaders.get("x-ventrio-session-hint") === "1";

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${lora.variable} ${figtree.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AppShell isAuthenticated={isAuthenticated}>{children}</AppShell>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

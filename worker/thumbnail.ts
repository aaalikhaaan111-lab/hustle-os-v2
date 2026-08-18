/**
 * Pictures of generated projects, taken once and stored.
 *
 * WHY IN THE WORKER. Capturing a generated app means running it, and running
 * model-written code needs a real browser engine. Vercel functions have neither
 * the binary nor the wall clock for it; this process already exists, already has
 * the service role, and already imports the pipeline that builds the document.
 *
 * WHY NO HTTP. The obvious design is "screenshot the published URL", which needs
 * a deployed origin, a public route, and — for the unpublished majority — an
 * authenticated one, which would mean inventing a worker-only auth surface.
 * `buildGeneratedApp` returns the whole document as a string, so the browser is
 * handed the bytes directly with `setContent`. No URL, no route, no token, and
 * it works for projects that were never published.
 *
 * WHAT IS DONE ABOUT RUNNING UNTRUSTED CODE. This is the same code that already
 * runs in visitors' browsers, but it runs here with the service role in the same
 * process, so the page is given nothing to reach:
 *
 *   - every network request is aborted at the browser, so the document cannot
 *     fetch, beacon or exfiltrate even if its own `connect-src 'none'` were
 *     circumvented;
 *   - it runs in its own context which is closed on every path out;
 *   - the whole capture is behind a hard timeout, so a page that spins forever
 *     costs one screenshot rather than the worker.
 *
 * A FAILED CAPTURE IS NOT A FAILED ANYTHING ELSE. Every error is swallowed into
 * a null return. The gallery already has a fallback for a project without a
 * picture, and no screenshot is worth interfering with generation accounting.
 */

import { chromium, type Browser } from "playwright-core";
import { buildGeneratedApp } from "../src/lib/v2/app/pipeline";

/** The card is 16:10; capture at 2x so it stays sharp on a retina display. */
const WIDTH = 1280;
const HEIGHT = 800;
const SCALE = 2;

/** A page that will not settle costs this much and no more. */
const CAPTURE_TIMEOUT_MS = Number(process.env.VENTRIO_THUMBNAIL_TIMEOUT_MS ?? 20_000);

/**
 * Where Chromium is.
 *
 * `playwright-core` deliberately ships no browser — that is why it is the
 * dependency rather than `playwright`, which downloads ~150 MB on every install
 * including Vercel's, where nothing uses it. The worker's host installs the
 * browser and points at it. If it is not there, capture stays off and says so
 * once; it does not crash a process whose actual job is generation.
 */
function executablePath(): string | undefined {
  return process.env.VENTRIO_CHROMIUM_PATH?.trim() || undefined;
}

let browser: Browser | null = null;
let unavailable = false;

async function getBrowser(): Promise<Browser | null> {
  if (unavailable) return null;
  if (browser?.isConnected()) return browser;
  try {
    browser = await chromium.launch({
      executablePath: executablePath(),
      headless: true,
      args: ["--no-sandbox", "--disable-dev-shm-usage"],
    });
    return browser;
  } catch (error) {
    unavailable = true;
    browser = null;
    console.log(
      "[ventrio-worker]",
      JSON.stringify({
        event: "thumbnail_unavailable",
        at: new Date().toISOString(),
        hint: "set VENTRIO_CHROMIUM_PATH, or run: npx playwright install chromium",
        error: error instanceof Error ? `${error.name}: ${error.message.slice(0, 160)}` : "unknown",
      }),
    );
    return null;
  }
}

/** Lets the loop shut the browser down with everything else. */
export async function closeThumbnailBrowser(): Promise<void> {
  if (!browser) return;
  const current = browser;
  browser = null;
  await current.close().catch(() => {});
}

/**
 * Renders a stored app and returns a PNG, or null if it could not be done.
 *
 * `value` is the raw `app` from the project's snapshot — the same thing the
 * published route validates and builds.
 */
export async function captureAppThumbnail(value: unknown): Promise<Buffer | null> {
  const built = await buildGeneratedApp(value);
  // A project that no longer compiles has no picture, exactly as the published
  // route has no page for it.
  if (!built.ok) return null;

  const engine = await getBrowser();
  if (!engine) return null;

  const context = await engine.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: SCALE,
    // The document is a standalone app, not a Ventrio page; give it nothing of
    // ours — no storage, no service worker, no credentials.
    javaScriptEnabled: true,
  });

  try {
    const page = await context.newPage();

    // Nothing this page asks for is served. `setContent` needs no network, and
    // the app's own assets are inlined by the compiler.
    await page.route("**/*", (route) => route.abort());

    await page.setContent(built.document, {
      waitUntil: "load",
      timeout: CAPTURE_TIMEOUT_MS,
    });

    /**
     * The app mounts on its own after load. There is no signal to wait for that
     * a generated app is guaranteed to emit, so this waits for the frame to stop
     * changing size — cheap, and true of an app that has rendered — and then
     * settles for a beat. A fixed sleep is honest here: inventing a readiness
     * protocol the generator does not implement would be worse.
     */
    await page.waitForTimeout(1_200);

    return await page.screenshot({
      type: "png",
      clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT },
      timeout: CAPTURE_TIMEOUT_MS,
    });
  } catch {
    // Deliberately quiet: the caller logs the outcome, and a project without a
    // picture is a state the gallery already renders.
    return null;
  } finally {
    await context.close().catch(() => {});
  }
}

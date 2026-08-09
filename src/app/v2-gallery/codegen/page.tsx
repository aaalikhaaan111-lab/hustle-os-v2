import { notFound } from "next/navigation";
import Link from "next/link";
import { isGeminiConfigured } from "@/lib/v2/gemini/config";
import { compileCodegenBundle } from "@/lib/v2/codegen/compile";
import { BENIGN_BUNDLE } from "@/lib/v2/codegen/benign";
import { RELAY_CONTENT } from "@/lib/v2/codegen/contentPacks";
import { CodegenHarness } from "./CodegenHarness";
import type { CompiledRoute } from "@/lib/v2/codegen/compile";

/**
 * Development-only visual-codegen prototype.
 *
 * `notFound()` in production is one of two independent gates. The other is the
 * CSP: `frame-src 'self'` is added for this exact pathname and only outside
 * production (see src/lib/security/csp.ts), so even a production build that
 * somehow reached this route could not frame a same-origin document. Neither
 * gate is allowed to depend on the other holding.
 *
 * Nothing here touches V1, Supabase, publishing or user projects, and the
 * parent document never receives generated markup — it exists only inside the
 * `srcdoc` string of a fully sandboxed frame.
 *
 * The reference bundle is compiled here, on the server, through the same chain
 * a generated bundle goes through. If the gate ever refuses it the page says so
 * rather than rendering something that skipped a check.
 */
export const dynamic = "force-dynamic";

/**
 * Reloads the most recent captured run, if there is one.
 *
 * A generation costs a request and over a minute, and it used to live only in
 * client state — so a refresh discarded work already paid for. Reading the
 * capture back means the last result survives a reload, a restart, and an
 * edit to this file.
 */
async function loadLastRun(): Promise<{ routes: CompiledRoute[]; at: string } | null> {
  const dir = process.env.CODEGEN_CAPTURE_DIR;
  if (!dir) return null;
  try {
    const { readdir, readFile } = await import("node:fs/promises");
    const names = (await readdir(dir)).filter((n) => n.startsWith("codegen-run-") && n.endsWith(".json")).sort();
    const latest = names.at(-1);
    if (!latest) return null;
    const parsed = JSON.parse(await readFile(`${dir}/${latest}`, "utf8")) as { ok?: boolean; routes?: CompiledRoute[] };
    if (!parsed.ok || !Array.isArray(parsed.routes) || parsed.routes.length === 0) return null;
    return { routes: parsed.routes, at: latest.replace(/\D/g, "") };
  } catch {
    return null;
  }
}

export default async function CodegenPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const reference = compileCodegenBundle(BENIGN_BUNDLE, { content: RELAY_CONTENT });
  const lastRun = await loadLastRun();

  return (
    <main style={{ maxWidth: 1180, margin: "0 auto", padding: "48px 20px", fontFamily: "ui-sans-serif, system-ui" }}>
      <p style={{ margin: "0 0 12px", fontSize: 13 }}>
        <Link href="/v2-gallery" style={{ color: "#4a5568" }}>← fixture gallery</Link>
      </p>
      <h1 style={{ fontSize: 28, margin: "0 0 8px", letterSpacing: "-0.02em" }}>Visual codegen — prototype</h1>
      <p style={{ margin: "0 0 10px", color: "#5a6270", fontSize: 15, lineHeight: 1.6, maxWidth: "68ch" }}>
        The model writes a stylesheet and body markup against an owned JSON envelope. Ventrio owns
        the document shell, supplies every word through content tokens, and refuses the bundle
        outright if it breaks the element allowlist, the CSS rules or any budget. Nothing here is
        sanitised — refused bundles are discarded, not repaired — and the preview is contained by a
        sandboxed frame carrying its own <code>default-src &apos;none&apos;</code> policy.
      </p>
      <p style={{ margin: "0 0 24px", color: "#8a6d2f", fontSize: 13, lineHeight: 1.6, maxWidth: "68ch" }}>
        Prototype only. The reject pass is string scanning, not parsing; promoting this beyond this
        development route requires declared parser dependencies (parse5 and css-tree, or equivalent).
      </p>

      {reference.ok ? (
        <CodegenHarness configured={isGeminiConfigured()} benign={reference.routes} lastRun={lastRun?.routes ?? null} />
      ) : (
        <div style={{ border: "1px solid #f0c9c4", background: "#fdf4f3", borderRadius: 10, padding: 16, fontSize: 13, color: "#7d2820" }}>
          <strong>The reference bundle was refused at the &quot;{reference.stage}&quot; stage.</strong>
          <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontFamily: "ui-monospace, monospace", fontSize: 12 }}>
            {reference.issues.map((issue, index) => (
              <li key={index}>{issue.path}: {issue.code} — {issue.detail}</li>
            ))}
          </ul>
        </div>
      )}
    </main>
  );
}

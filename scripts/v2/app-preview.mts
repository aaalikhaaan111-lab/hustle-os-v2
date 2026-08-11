/**
 * Wraps a generated document in the preview page Ventrio will serve.
 *
 *   npx tsx --conditions=react-server scripts/v2/app-preview.mts <document.html> <out.html>
 *
 * This is the nesting that matters: a Ventrio-origin page containing the
 * generated application in a sandboxed frame. The sandbox attribute is imported
 * from `sandbox.ts` rather than written here, so the harness cannot accidentally
 * prove the security of a frame that is not the one production renders.
 *
 * The message handler applies the same four checks as `parsePreviewMessage` —
 * source, origin, shape, type — because a harness that believes any message it
 * receives would report a mounted app whether or not one mounted.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { SANDBOX_ATTRIBUTE } from "../../src/lib/v2/app/sandbox";
import { OPAQUE_ORIGIN, PREVIEW_PROTOCOL_VERSION, PREVIEW_SOURCE } from "../../src/lib/v2/app/protocol";

const [documentPath, outPath] = process.argv.slice(2);
if (!documentPath || !outPath) {
  console.error("usage: app-preview.mts <document.html> <out.html>");
  process.exit(1);
}

const generated = readFileSync(documentPath, "utf8");
/** Embedded as JSON with `<` escaped, so nothing inside can close the script. */
const encoded = JSON.stringify(generated).replace(/</g, "\\u003c");

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ventrio preview</title>
<style>
  :root { color-scheme: light dark; }
  html, body { margin: 0; padding: 0; background: #fff; }
  #frame { display: block; width: 100%; border: 0; height: 100vh; }
</style>
</head>
<body>
<iframe id="frame" sandbox="${SANDBOX_ATTRIBUTE}" title="Generated application"></iframe>
<script>
  const DOC = ${encoded};
  const state = { ready: false, height: 0, errors: [], rejected: 0 };
  window.__preview = state;

  const frame = document.getElementById("frame");

  window.addEventListener("message", (event) => {
    // 1. source — any page with a handle on this tab can post to it.
    if (event.source !== frame.contentWindow) { state.rejected++; return; }
    // 2. origin — an opaque origin serialises as the string "null".
    if (event.origin !== ${JSON.stringify(OPAQUE_ORIGIN)}) { state.rejected++; return; }
    // 3. shape
    const data = event.data;
    if (!data || typeof data !== "object" || Array.isArray(data)) { state.rejected++; return; }
    if (data.source !== ${JSON.stringify(PREVIEW_SOURCE)}) { state.rejected++; return; }
    if (data.version !== ${PREVIEW_PROTOCOL_VERSION}) { state.rejected++; return; }
    const payload = data.payload;
    if (!payload || typeof payload !== "object") { state.rejected++; return; }
    // 4. type — a closed set.
    switch (data.type) {
      case "ready":
        state.ready = true;
        break;
      case "size":
        if (typeof payload.height === "number" && payload.height > 0 && payload.height <= 200000) {
          state.height = Math.round(payload.height);
          // Grow the frame to its content so a full-page screenshot captures
          // the whole application rather than one viewport of it.
          frame.style.height = state.height + "px";
        }
        break;
      case "runtime-error":
        if (typeof payload.message === "string") {
          state.errors.push({
            kind: typeof payload.kind === "string" ? payload.kind : "error",
            message: payload.message.slice(0, 2000),
            stack: typeof payload.stack === "string" ? payload.stack.slice(0, 4000) : "",
          });
        }
        break;
      default:
        state.rejected++;
    }
  });

  frame.srcdoc = DOC;
</script>
</body>
</html>
`;

writeFileSync(outPath, page, "utf8");
console.log(`preview → ${outPath}  (sandbox="${SANDBOX_ATTRIBUTE}", ${(generated.length / 1000).toFixed(0)} kB document)`);

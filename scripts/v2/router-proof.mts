/**
 * A browser proof that runs INSIDE the sandbox.
 *
 * The extension can click the frame, but nothing outside an opaque origin can
 * read what happened in it. So the driver is injected into the sandbox document
 * itself, where it can click a Link and inspect the DOM, and it posts the
 * verdict back out through the same protocol the product uses.
 *
 *   npx tsx --conditions=react-server scripts/v2/router-proof.mts <out.html>
 */
import { writeFileSync } from "node:fs";
import { getRuntimeBundle } from "../../src/lib/v2/app/runtimeBundle";
import { buildSandboxDocument, SANDBOX_ATTRIBUTE } from "../../src/lib/v2/app/sandbox";

const out = process.argv[2];
if (!out) { console.error("usage: proof.mts <out.html>"); process.exit(1); }

const SPECS = ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react-router-dom"];
const bundle = await getRuntimeBundle(SPECS);

/**
 * The driver, as the app module. Plain JS, no JSX — it is a probe, not an app.
 */
const driver = `
import * as RR from "react-router-dom";
import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";

const results = {};
function record(name, ok, detail) { results[name] = { ok: !!ok, detail: String(detail == null ? "" : detail) }; }

/* ---- 1. the URL shim ---------------------------------------------------- */
const urlCases = [
  ["bare relative, no base", () => new URL("/")],
  ["relative against about:srcdoc", () => new URL("/", document.baseURI)],
  ["relative against location.href", () => new URL("/dashboard", location.href)],
  ["relative against opaque origin", () => new URL("/settings", location.origin)],
  ["relative against window.origin", () => new URL("/x", window.origin)],
  ["relative against empty string", () => new URL("/y", "")],
  ["hash route", () => new URL("#/detail", location.href)],
  ["dot-relative", () => new URL("./asset.png", location.href)],
];
for (const [name, run] of urlCases) {
  try { record("url: " + name, true, run().href); }
  catch (e) { record("url: " + name, false, e && e.message); }
}
// Absolute URLs must be untouched, and a real base must still win.
try { record("url: absolute untouched", new URL("https://example.com/a?b#c").host === "example.com", new URL("https://example.com/a").href); }
catch (e) { record("url: absolute untouched", false, e && e.message); }
try { record("url: real base still wins", new URL("/z", "https://real.example/deep").href === "https://real.example/z"); }
catch (e) { record("url: real base still wins", false, e && e.message); }
// A genuinely malformed URL must still throw. A shim that swallows everything
// would hide real bugs in generated code.
try { new URL("http://"); record("url: garbage still throws", false, "did not throw"); }
catch (e) { record("url: garbage still throws", true, e && e.name); }
// The statics the import-map shim depends on.
record("url: createObjectURL survives", typeof URL.createObjectURL === "function");
record("url: revokeObjectURL survives", typeof URL.revokeObjectURL === "function");
record("url: instanceof survives", new URL("/") instanceof URL);

/* ---- 2. the router substitution ----------------------------------------- */
record("router: BrowserRouter is MemoryRouter", RR.BrowserRouter === RR.MemoryRouter);
record("router: HashRouter is MemoryRouter", RR.HashRouter === RR.MemoryRouter);
record("router: createBrowserRouter is createMemoryRouter", RR.createBrowserRouter === RR.createMemoryRouter);
record("router: createHashRouter is createMemoryRouter", RR.createHashRouter === RR.createMemoryRouter);
record("router: MemoryRouter still exists", typeof RR.MemoryRouter === "function");
// forwardRef, so an object rather than a function. The point of these two is
// that the override left the exports it was not aiming at alone.
record("router: Link still exists", RR.Link != null);
record("router: useNavigate still exists", typeof RR.useNavigate === "function");
record("router: useSearchParams still exists", typeof RR.useSearchParams === "function");

/* ---- 3. a real routed app, rendered and navigated ------------------------ */
function Home() {
  const nav = RR.useNavigate();
  return h("div", null,
    h("h1", { id: "page" }, "home"),
    h(RR.Link, { id: "to-settings", to: "/settings" }, "settings"),
    h(RR.Link, { id: "to-root", to: "/" }, "root"),
    h("button", { id: "nav-root", onClick: () => nav("/") }, "nav root"),
    h("button", { id: "nav-deep", onClick: () => nav("/settings") }, "nav deep"),
  );
}
function Settings() {
  return h("div", null, h("h1", { id: "page" }, "settings"), h(RR.Link, { id: "to-root", to: "/" }, "root"));
}
function App() {
  return h(RR.BrowserRouter, null,
    h(RR.Routes, null,
      h(RR.Route, { path: "/", element: h(Home) }),
      h(RR.Route, { path: "/settings", element: h(Settings) }),
    ));
}

const host = document.getElementById("root");
let mounted = false;
try { createRoot(host).render(h(App)); mounted = true; } catch (e) { record("app: mounts", false, e && e.message); }

function page() { const el = document.getElementById("page"); return el ? el.textContent : "(none)"; }
function click(id) { const el = document.getElementById(id); if (!el) throw new Error("missing #" + id); el.click(); }

setTimeout(() => {
  try {
    record("app: mounts", mounted && page() === "home", page());
    // The href a Link renders. This is what used to throw during render.
    const link = document.getElementById("to-root");
    record("app: Link to '/' renders an href", link && link.getAttribute("href") === "/", link && link.getAttribute("href"));

    click("to-settings");
    setTimeout(() => {
      record("app: Link navigates to /settings", page() === "settings", page());
      click("to-root");
      setTimeout(() => {
        record("app: Link back to '/' works", page() === "home", page());
        click("nav-deep");
        setTimeout(() => {
          record("app: useNavigate('/settings') works", page() === "settings", page());
          history.length; // touching history must not be needed, but must not throw
          click("to-root");
          setTimeout(() => {
            click("nav-root");
            setTimeout(() => {
              record("app: useNavigate('/') works", page() === "home", page());
              parent.postMessage({ source: "ventrio-proof", results }, "*");
            }, 60);
          }, 60);
        }, 60);
      }, 60);
    }, 60);
  } catch (e) {
    record("app: driver completed", false, e && e.message);
    parent.postMessage({ source: "ventrio-proof", results }, "*");
  }
}, 400);
`;

const doc = buildSandboxDocument({
  code: driver,
  runtimeCore: bundle.core,
  runtimeNames: bundle.names,
  lang: "en",
  title: "proof",
});

const encoded = JSON.stringify(doc).replace(/</g, "\\u003c");
writeFileSync(out, `<!doctype html><html><head><meta charset="utf-8"><title>proof</title></head><body>
<iframe id="f" sandbox="${SANDBOX_ATTRIBUTE}" style="width:100%;height:70vh;border:1px solid #ccc"></iframe>
<pre id="out" style="font:12px ui-monospace,monospace;white-space:pre-wrap">running…</pre>
<script>
window.__proof = null;
addEventListener("message", (e) => {
  if (!e.data || e.data.source !== "ventrio-proof") return;
  window.__proof = e.data.results;
  const rows = Object.entries(e.data.results).map(([k, v]) => (v.ok ? "PASS  " : "FAIL  ") + k + (v.detail ? "   [" + v.detail + "]" : ""));
  const failed = Object.values(e.data.results).filter((v) => !v.ok).length;
  document.getElementById("out").textContent = rows.join("\\n") + "\\n\\n" + (failed ? failed + " FAILED" : "ALL PASSED");
});
document.getElementById("f").srcdoc = ${encoded};
</script></body></html>`, "utf8");
console.log("proof →", out);

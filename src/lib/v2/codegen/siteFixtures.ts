import type { CodegenBundleV1 } from "./envelope";

/**
 * Six sites written to the codegen contract, by hand.
 *
 * These stand in for model output so the architecture can be judged before a
 * paid request is spent. Every one is a legal bundle: body markup only, one
 * stylesheet, all user-facing words as `{{ventrio:text:*}}` tokens, media only
 * as `data-ventrio-media` spans naming registry ids, no script, no inline
 * style, no external URL. They go through `compileCodegenBundle` unmodified,
 * so nothing here exercises a path production would not.
 *
 * The point is what they contain, not merely that they differ. The fixed
 * renderer could produce a hero, a few titled prose blocks, a form and a
 * footer, and nothing else — its section vocabulary was a closed enum. These
 * carry a real navigation bar, a bento grid, a pricing table, a comparison
 * table, a gallery, a testimonial, an FAQ and a key-facts row. None of those
 * existed as a concept in the old schema, and no amount of CSS would have
 * added one.
 *
 * Copy is the same content pack in all six, deliberately. Holding the words
 * constant means every difference a reader sees is structure and design rather
 * than different writing.
 *
 * A media span carries its own class, which the compiler merges onto the
 * `v-media` figure it expands into; the `<img>` inside is always
 * `.v-media-img`. So the stylesheets below target those two classes and never
 * write an `img` selector of their own — `img` is not an allowed element and a
 * bundle cannot place one directly.
 */

const t = (key: string) => `{{ventrio:text:${key}}}`;

/* ── 1. Cinematic: full-bleed media, almost no chrome, a stats band ─────── */
const CINEMATIC: CodegenBundleV1 = {
  version: "codegen-1",
  css: `
:root{--ink:#f2efe9;--dim:rgba(242,239,233,.62);--line:rgba(242,239,233,.18);--bg:#08090c}
body{background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,sans-serif}
.wrap{max-width:1240px;margin:0 auto;padding:0 24px}
.top{padding:28px 0;font-size:12px;letter-spacing:.24em;text-transform:uppercase}
.top .wrap{display:flex;justify-content:space-between;align-items:center}
.stage{position:relative;min-height:86vh;display:grid;align-items:end;padding-bottom:80px;overflow:hidden}
.shot{position:absolute;inset:0}
.shot .v-media-img{width:100%;height:100%;object-fit:cover;opacity:.5}
.veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,9,12,.3),rgba(8,9,12,.94))}
.copy{position:relative}
h1{font-size:clamp(2.6rem,6.4vw,5.4rem);line-height:.92;letter-spacing:-.04em;margin:0 0 22px;font-weight:800;max-width:15ch}
.lede{font-size:clamp(1rem,1.4vw,1.2rem);color:var(--dim);max-width:48ch;line-height:1.65}
.cta{display:inline-block;margin-top:34px;border:1px solid var(--ink);padding:15px 34px;font-size:12px;letter-spacing:.2em;text-transform:uppercase;transition:background .25s ease,color .25s ease}
.cta:hover{background:var(--ink);color:var(--bg)}
.band{border-top:1px solid var(--line);border-bottom:1px solid var(--line);display:grid;grid-template-columns:repeat(3,1fr)}
.band>div{padding:56px 28px;border-right:1px solid var(--line)}
.band>div:last-child{border-right:0}
.band b{display:block;font-size:clamp(1.6rem,3.4vw,2.6rem);font-weight:800;letter-spacing:-.03em;margin-bottom:10px}
.band span{color:var(--dim);font-size:13px;line-height:1.5}
.close{padding:140px 0;text-align:center}
.close h2{font-size:clamp(2rem,5vw,3.4rem);margin:0 0 18px;letter-spacing:-.035em}
.close .lede{margin:0 auto}
.foot{border-top:1px solid var(--line);padding:34px 0;color:var(--dim);font-size:13px}
@media(max-width:760px){.band{grid-template-columns:1fr}.band>div{border-right:0;border-bottom:1px solid var(--line)}.stage{min-height:70vh}.close{padding:88px 0}}
`,
  routes: [
    {
      path: "/",
      title: t("page.home.title"),
      bodyHtml: `
<header class="top"><div class="wrap"><span>${t("brand.name")}</span><span>${t("nav.pricing")}</span></div></header>
<section class="stage">
<span class="shot" data-ventrio-media="bench.surface"></span>
<div class="veil"></div>
<div class="wrap"><div class="copy"><h1>${t("hero.title")}</h1><p class="lede">${t("hero.body")}</p><a class="cta" href="#next">${t("hero.cta")}</a></div></div>
</section>
<section class="band">
<div><b>${t("pricing.price")}</b><span>${t("pricing.plan")}</span></div>
<div><b>${t("detail.point2")}</b><span>${t("how.step1.body")}</span></div>
<div><b>${t("detail.point3")}</b><span>${t("how.step3.body")}</span></div>
</section>
<section class="close" id="next"><div class="wrap"><h2>${t("cta.title")}</h2><p class="lede">${t("cta.body")}</p><a class="cta" href="/pricing">${t("cta.button")}</a></div></section>
<footer class="foot"><div class="wrap">${t("footer.note")}</div></footer>`,
    },
  ],
};

/* ── 2. Editorial: asymmetric columns, pull quote, hairlines, FAQ list ──── */
const EDITORIAL: CodegenBundleV1 = {
  version: "codegen-1",
  css: `
:root{--ink:#1b1815;--dim:rgba(27,24,21,.64);--line:rgba(27,24,21,.16);--bg:#faf6ef}
body{background:var(--bg);color:var(--ink);font-family:Georgia,'Times New Roman',serif}
.wrap{max-width:1140px;margin:0 auto;padding:0 28px}
nav{display:flex;gap:26px;align-items:baseline;padding:24px 0;border-bottom:1px solid var(--ink);flex-wrap:wrap}
nav b{font-size:14px;letter-spacing:.22em;text-transform:uppercase;margin-right:auto}
nav a{font-size:12px;letter-spacing:.16em;text-transform:uppercase;border-bottom:1px solid transparent;padding-bottom:2px}
nav a:hover{border-bottom-color:var(--ink)}
.masthead{padding:72px 0 44px;border-bottom:1px solid var(--line)}
h1{font-size:clamp(2.6rem,7vw,5.6rem);line-height:.98;margin:0;letter-spacing:-.02em;max-width:16ch;font-weight:400}
.deck{display:grid;grid-template-columns:1fr 1.9fr;gap:48px;padding:44px 0;border-bottom:1px solid var(--line)}
.kicker{font-size:11px;letter-spacing:.26em;text-transform:uppercase;color:var(--dim);margin:0}
.deck .read{font-size:1.24rem;line-height:1.6;margin:0}
.plate{margin:0}
.plate .v-media-img{width:100%;height:440px;object-fit:cover;filter:saturate(.85) contrast(1.05)}
.body{display:grid;grid-template-columns:1fr 1.9fr;gap:48px;padding:52px 0;border-bottom:1px solid var(--line)}
.body p{margin:0 0 18px;line-height:1.75;max-width:62ch}
blockquote{margin:36px 0;font-size:clamp(1.4rem,2.8vw,2.2rem);line-height:1.28;border-left:2px solid var(--ink);padding-left:26px;font-style:italic;max-width:26ch}
.faq{display:grid;grid-template-columns:1fr 1.9fr;gap:48px;padding:52px 0}
.faq h2{font-weight:400;font-size:1.5rem;margin:0}
dt{font-weight:700;margin-top:24px;font-size:1.05rem}
dd{margin:8px 0 0;color:var(--dim);line-height:1.7;max-width:64ch}
.foot{border-top:1px solid var(--ink);padding:30px 0;font-size:12px;letter-spacing:.1em;text-transform:uppercase;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
@media(max-width:820px){.deck,.body,.faq{grid-template-columns:1fr;gap:18px}.plate .v-media-img{height:240px}}
`,
  routes: [
    {
      path: "/",
      title: t("page.home.title"),
      bodyHtml: `
<div class="wrap">
<nav><b>${t("brand.name")}</b><a href="/">${t("nav.home")}</a><a href="#faq">${t("faq.title")}</a><a href="/pricing">${t("nav.pricing")}</a></nav>
<header class="masthead"><h1>${t("hero.title")}</h1></header>
<section class="deck"><p class="kicker">${t("hero.eyebrow")}</p><p class="read">${t("hero.body")}</p></section>
</div>
<span class="plate" data-ventrio-media="log.schematic"></span>
<div class="wrap">
<section class="body"><p class="kicker">${t("problem.title")}</p><div><p>${t("problem.body")}</p><blockquote>${t("problem.point1.title")}</blockquote><p>${t("problem.point2.body")}</p><p>${t("problem.point3.body")}</p><p>${t("detail.body")}</p></div></section>
<section class="faq" id="faq"><h2>${t("faq.title")}</h2><dl><dt>${t("faq.q1")}</dt><dd>${t("faq.a1")}</dd><dt>${t("faq.q2")}</dt><dd>${t("faq.a2")}</dd><dt>${t("faq.q3")}</dt><dd>${t("faq.a3")}</dd></dl></section>
<footer class="foot"><span>${t("footer.note")}</span><span>${t("footer.contact")}</span></footer>
</div>`,
    },
  ],
};

/* ── 3. SaaS product: real nav, bento grid, pricing table, FAQ ──────────── */
const SAAS: CodegenBundleV1 = {
  version: "codegen-1",
  css: `
:root{--ink:#0d1117;--dim:#5b6675;--line:#e3e8ef;--accent:#2f5bff;--bg:#fff;--soft:#f5f7fb}
body{background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,sans-serif}
.wrap{max-width:1160px;margin:0 auto;padding:0 24px}
nav{display:flex;align-items:center;gap:24px;padding:16px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
nav b{margin-right:auto;font-weight:800;letter-spacing:-.02em;font-size:1.05rem}
nav a{color:var(--dim);font-size:14px}
nav a:hover{color:var(--ink)}
.btn{display:inline-block;background:var(--accent);color:#fff;padding:12px 20px;border-radius:10px;font-weight:650;font-size:14px;transition:transform .18s ease,box-shadow .18s ease}
.btn:hover{transform:translateY(-1px);box-shadow:0 8px 24px rgba(47,91,255,.28)}
nav .btn{padding:9px 15px;color:#fff}
.btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line);box-shadow:none}
.hero{padding:76px 0 52px;display:grid;grid-template-columns:1.05fr .95fr;gap:52px;align-items:center}
h1{font-size:clamp(2.3rem,4.8vw,3.6rem);line-height:1.05;letter-spacing:-.035em;margin:0 0 18px}
.eyebrow{color:var(--accent);font-weight:650;font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:0 0 14px}
.sub{color:var(--dim);font-size:1.05rem;line-height:1.65;max-width:48ch;margin:0 0 26px}
.row{display:flex;gap:12px;flex-wrap:wrap}
.frame{margin:0;border-radius:16px;overflow:hidden;border:1px solid var(--line);box-shadow:0 24px 60px rgba(13,17,23,.1)}
.frame .v-media-img{width:100%;height:340px;object-fit:cover}
h2{font-size:clamp(1.6rem,3vw,2.2rem);letter-spacing:-.03em;margin:0 0 10px}
.bento{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));grid-auto-rows:176px;gap:16px;padding:20px 0 76px}
.cell{border:1px solid var(--line);border-radius:16px;padding:22px;background:var(--soft);display:flex;flex-direction:column;justify-content:flex-end}
.cell.big{grid-column:span 2;grid-row:span 2;background:var(--ink);color:#fff}
.cell.wide{grid-column:span 2}
.cell h3{margin:0 0 8px;font-size:1.02rem;letter-spacing:-.01em}
.cell p{margin:0;color:var(--dim);font-size:14px;line-height:1.55}
.cell.big h3{font-size:1.5rem}
.cell.big p{color:rgba(255,255,255,.74);font-size:15px}
.plans{padding:0 0 72px}
.scroller{overflow-x:auto;margin:20px 0 0}
table{min-width:660px;font-size:14px}
th,td{border:1px solid var(--line);padding:15px 16px;text-align:left;vertical-align:top}
th{background:var(--soft);font-weight:650;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--dim)}
.price{font-size:1.9rem;font-weight:800;letter-spacing:-.03em;display:block;color:var(--ink);margin-bottom:6px}
.faq{padding:0 0 76px;max-width:760px}
details{border-bottom:1px solid var(--line);padding:16px 0}
summary{font-weight:650;cursor:pointer}
details p{color:var(--dim);margin:10px 0 0;line-height:1.65}
.foot{border-top:1px solid var(--line);padding:28px 0;color:var(--dim);font-size:14px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
@media(max-width:900px){.hero{grid-template-columns:1fr;gap:32px}.bento{grid-template-columns:repeat(2,minmax(0,1fr))}.cell.big{grid-column:span 2;grid-row:span 1}}
@media(max-width:600px){.bento{grid-template-columns:1fr;grid-auto-rows:auto}.cell,.cell.big,.cell.wide{grid-column:span 1;grid-row:span 1;min-height:140px}}
`,
  routes: [
    {
      path: "/",
      title: t("page.home.title"),
      bodyHtml: `
<div class="wrap">
<nav><b>${t("brand.name")}</b><a href="/">${t("nav.home")}</a><a href="#features">${t("how.title")}</a><a href="#plans">${t("nav.pricing")}</a><a href="#faq">${t("faq.title")}</a><a class="btn" href="#plans">${t("hero.cta")}</a></nav>
<section class="hero">
<div><p class="eyebrow">${t("hero.eyebrow")}</p><h1>${t("hero.title")}</h1><p class="sub">${t("hero.body")}</p><div class="row"><a class="btn" href="#plans">${t("hero.cta")}</a><a class="btn ghost" href="#features">${t("hero.secondary")}</a></div></div>
<span class="frame" data-ventrio-media="parts.tray"></span>
</section>
<section id="features"><h2>${t("how.title")}</h2><p class="sub">${t("problem.body")}</p></section>
<section class="bento">
<div class="cell big"><h3>${t("problem.point1.title")}</h3><p>${t("problem.point1.body")}</p></div>
<div class="cell"><h3>${t("problem.point2.title")}</h3><p>${t("problem.point2.body")}</p></div>
<div class="cell"><h3>${t("problem.point3.title")}</h3><p>${t("problem.point3.body")}</p></div>
<div class="cell wide"><h3>${t("how.step1.title")}</h3><p>${t("how.step1.body")}</p></div>
<div class="cell"><h3>${t("how.step2.title")}</h3><p>${t("how.step2.body")}</p></div>
<div class="cell"><h3>${t("how.step3.title")}</h3><p>${t("how.step3.body")}</p></div>
</section>
<section class="plans" id="plans"><h2>${t("pricing.title")}</h2><p class="sub">${t("pricing.body")}</p>
<div class="scroller"><table>
<thead><tr><th scope="col">${t("pricing.plan")}</th><th scope="col">${t("detail.point1")}</th><th scope="col">${t("detail.point2")}</th><th scope="col">${t("detail.point3")}</th></tr></thead>
<tbody>
<tr><td><span class="price">${t("pricing.price")}</span>${t("pricing.note")}</td><td>${t("how.step1.body")}</td><td>${t("how.step2.body")}</td><td>${t("how.step3.body")}</td></tr>
<tr><td>${t("detail.point4")}</td><td>${t("faq.a1")}</td><td>${t("faq.a2")}</td><td>${t("faq.a3")}</td></tr>
</tbody></table></div></section>
<section class="faq" id="faq"><h2>${t("faq.title")}</h2>
<details open><summary>${t("faq.q1")}</summary><p>${t("faq.a1")}</p></details>
<details><summary>${t("faq.q2")}</summary><p>${t("faq.a2")}</p></details>
<details><summary>${t("faq.q3")}</summary><p>${t("faq.a3")}</p></details>
</section>
<footer class="foot"><span>${t("footer.note")}</span><span>${t("footer.contact")}</span></footer>
</div>`,
    },
  ],
};

/* ── 4. Catalogue: gallery grid, filter chips, key-facts row, testimonial ─ */
const CATALOGUE: CodegenBundleV1 = {
  version: "codegen-1",
  css: `
:root{--ink:#17201a;--dim:#5d6b60;--line:#dde6df;--accent:#1f7a4d;--bg:#fbfdfb}
body{background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,sans-serif}
.wrap{max-width:1220px;margin:0 auto;padding:0 24px}
nav{display:flex;align-items:center;gap:20px;padding:18px 0;flex-wrap:wrap}
nav b{margin-right:auto;font-weight:800;font-size:1.05rem;letter-spacing:-.02em}
nav a{color:var(--dim);font-size:14px}
.pill{background:var(--accent);color:#fff;padding:11px 20px;border-radius:999px;font-size:14px;font-weight:650}
.head{padding:32px 0 26px;display:flex;align-items:flex-end;justify-content:space-between;gap:32px;flex-wrap:wrap}
h1{font-size:clamp(2.1rem,4.4vw,3.2rem);letter-spacing:-.032em;line-height:1.06;margin:0 0 12px;max-width:18ch}
.sub{color:var(--dim);line-height:1.6;margin:0;max-width:46ch}
.filters{display:flex;gap:8px;flex-wrap:wrap}
.chip{border:1px solid var(--line);border-radius:999px;padding:8px 15px;font-size:13px;color:var(--dim);background:#fff}
.chip.on{background:var(--ink);color:#fff;border-color:var(--ink)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:22px;padding:14px 0 68px}
.card{border:1px solid var(--line);border-radius:18px;overflow:hidden;background:#fff;transition:box-shadow .22s ease,transform .22s ease}
.card:hover{transform:translateY(-3px);box-shadow:0 18px 40px rgba(23,32,26,.1)}
.card .v-media-img{width:100%;height:200px;object-fit:cover}
.meta{padding:18px}
.meta h3{margin:0 0 6px;font-size:1.02rem}
.meta p{margin:0 0 12px;color:var(--dim);font-size:14px;line-height:1.55}
.tag{font-size:12px;font-weight:700;color:var(--accent);letter-spacing:.04em}
.facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:24px;padding:40px 0;border-top:1px solid var(--line);border-bottom:1px solid var(--line)}
.facts b{display:block;font-size:1.02rem;margin-bottom:8px;line-height:1.35}
.facts .lead{font-size:clamp(1.6rem,2.8vw,2.2rem);letter-spacing:-.035em;line-height:1.1}
.facts span{color:var(--dim);font-size:13px;line-height:1.55}
.quote{padding:80px 0;max-width:60ch}
blockquote{margin:0;font-size:clamp(1.25rem,2.5vw,1.9rem);line-height:1.38;letter-spacing:-.015em}
cite{display:block;margin-top:18px;color:var(--dim);font-style:normal;font-size:14px}
.foot{border-top:1px solid var(--line);padding:26px 0;color:var(--dim);font-size:14px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap}
@media(max-width:900px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}.stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:620px){.grid{grid-template-columns:1fr}}
`,
  routes: [
    {
      path: "/",
      title: t("page.home.title"),
      bodyHtml: `
<div class="wrap">
<nav><b>${t("brand.name")}</b><a href="/">${t("nav.home")}</a><a href="/pricing">${t("nav.pricing")}</a><a class="pill" href="/pricing">${t("hero.cta")}</a></nav>
<header class="head"><div><h1>${t("hero.title")}</h1><p class="sub">${t("hero.body")}</p></div>
<div class="filters"><span class="chip on">${t("nav.home")}</span><span class="chip">${t("how.step1.title")}</span><span class="chip">${t("how.step2.title")}</span><span class="chip">${t("how.step3.title")}</span></div></header>
<section class="grid">
<article class="card"><span data-ventrio-media="bench.surface"></span><div class="meta"><h3>${t("problem.point1.title")}</h3><p>${t("problem.point1.body")}</p><span class="tag">${t("detail.point1")}</span></div></article>
<article class="card"><span data-ventrio-media="log.schematic"></span><div class="meta"><h3>${t("problem.point2.title")}</h3><p>${t("problem.point2.body")}</p><span class="tag">${t("detail.point2")}</span></div></article>
<article class="card"><span data-ventrio-media="parts.tray"></span><div class="meta"><h3>${t("problem.point3.title")}</h3><p>${t("problem.point3.body")}</p><span class="tag">${t("detail.point3")}</span></div></article>
</section>
<section class="facts">
<div><b class="lead">${t("pricing.price")}</b><span>${t("pricing.plan")}</span></div>
<div><b>${t("detail.point1")}</b><span>${t("how.step1.body")}</span></div>
<div><b>${t("detail.point2")}</b><span>${t("how.step2.body")}</span></div>
<div><b>${t("detail.point4")}</b><span>${t("how.step3.body")}</span></div>
</section>
<section class="quote"><blockquote>${t("detail.body")}</blockquote><cite>${t("footer.contact")}</cite></section>
<footer class="foot"><span>${t("footer.note")}</span><span>${t("pricing.note")}</span></footer>
</div>`,
    },
  ],
};

/* ── 5. Luxury: sparse, centred, framed plate, wide letter-spacing ──────── */
const LUXURY: CodegenBundleV1 = {
  version: "codegen-1",
  css: `
:root{--ink:#241f1b;--dim:rgba(36,31,27,.58);--line:rgba(36,31,27,.2);--bg:#f6f3ee}
body{background:var(--bg);color:var(--ink);font-family:Georgia,'Times New Roman',serif;text-align:center}
.wrap{max-width:900px;margin:0 auto;padding:0 28px}
.top{padding:40px 0;font-size:10px;letter-spacing:.5em;text-transform:uppercase}
h1{font-weight:400;font-size:clamp(2.1rem,5.2vw,4rem);line-height:1.14;margin:72px auto 30px;max-width:17ch}
.lede{color:var(--dim);max-width:42ch;margin:0 auto;line-height:1.95;font-size:1.02rem}
.cta{display:inline-block;margin-top:46px;border:1px solid var(--line);padding:17px 46px;font-size:10px;letter-spacing:.38em;text-transform:uppercase;transition:border-color .3s ease,letter-spacing .3s ease}
.cta:hover{border-color:var(--ink);letter-spacing:.46em}
.plate{margin:104px auto;max-width:560px;padding:20px;border:1px solid var(--line)}
.plate .v-media-img{width:100%;height:540px;object-fit:cover}
.pane{padding:104px 0;border-top:1px solid var(--line)}
h2{font-weight:400;font-size:clamp(1.4rem,2.8vw,2.2rem);margin:0 auto 22px;max-width:22ch;letter-spacing:.01em}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:64px;text-align:left;padding:104px 0;border-top:1px solid var(--line)}
.pair h3{font-weight:400;font-size:1rem;margin:0 0 12px;letter-spacing:.16em;text-transform:uppercase}
.pair p{color:var(--dim);line-height:1.9;margin:0;font-size:.98rem}
.rule{width:40px;height:1px;background:var(--line);margin:0 auto 40px;border:0}
.foot{padding:64px 0;color:var(--dim);font-size:10px;letter-spacing:.32em;text-transform:uppercase}
@media(max-width:760px){.plate .v-media-img{height:300px}.plate{margin:64px auto}.pair{grid-template-columns:1fr;gap:40px;padding:64px 0}.pane{padding:64px 0}h1{margin-top:40px}}
`,
  routes: [
    {
      path: "/",
      title: t("page.home.title"),
      bodyHtml: `
<div class="wrap">
<header class="top">${t("brand.name")}</header>
<h1>${t("hero.title")}</h1>
<p class="lede">${t("hero.body")}</p>
<a class="cta" href="/pricing">${t("hero.cta")}</a>
<span class="plate" data-ventrio-media="parts.tray"></span>
<section class="pane"><hr class="rule"><h2>${t("detail.title")}</h2><p class="lede">${t("detail.body")}</p></section>
<div class="pair">
<div><h3>${t("how.step1.title")}</h3><p>${t("how.step1.body")}</p></div>
<div><h3>${t("how.step3.title")}</h3><p>${t("how.step3.body")}</p></div>
</div>
<section class="pane"><hr class="rule"><h2>${t("cta.title")}</h2><p class="lede">${t("cta.body")}</p><a class="cta" href="/pricing">${t("cta.button")}</a></section>
<footer class="foot">${t("footer.note")}</footer>
</div>`,
    },
  ],
};

/* ── 6. Brutalist: hard bands, heavy rules, comparison table ────────────── */
const BRUTALIST: CodegenBundleV1 = {
  version: "codegen-1",
  css: `
:root{--ink:#0a0a0a;--bg:#fff;--hot:#ff4a1c}
body{background:var(--bg);color:var(--ink);font-family:ui-sans-serif,system-ui,sans-serif}
h1{font-size:clamp(2.6rem,11.5vw,8.5rem);line-height:.84;letter-spacing:-.055em;text-transform:uppercase;margin:0;font-weight:900}
.band{padding:44px 26px;border-bottom:5px solid var(--ink)}
.band.inv{background:var(--ink);color:var(--bg)}
.band.hot{background:var(--hot);color:var(--ink)}
.kick{font-size:11px;letter-spacing:.34em;text-transform:uppercase;margin:0 0 18px;font-weight:700}
.lede{font-size:1.02rem;line-height:1.5;max-width:56ch;margin:22px 0 0}
.cta{display:inline-block;margin-top:26px;background:var(--ink);color:var(--bg);padding:17px 30px;font-weight:900;text-transform:uppercase;letter-spacing:.07em;font-size:14px}
.band.inv .cta,.band.hot .cta{background:var(--bg);color:var(--ink)}
.band.inv .cta:hover,.band.hot .cta:hover{background:var(--hot);color:var(--ink)}
h2{margin:0 0 14px;text-transform:uppercase;font-size:clamp(1.2rem,3vw,2.1rem);letter-spacing:-.02em;font-weight:900}
.two{display:grid;grid-template-columns:1fr 1fr;border-bottom:5px solid var(--ink)}
.two>div{padding:44px 26px;border-right:5px solid var(--ink)}
.two>div:last-child{border-right:0}
.three{display:grid;grid-template-columns:repeat(3,1fr);border-bottom:5px solid var(--ink)}
.three>div{padding:34px 26px;border-right:5px solid var(--ink)}
.three>div:last-child{border-right:0}
.three b{display:block;font-size:clamp(1.3rem,3.2vw,2.2rem);font-weight:900;letter-spacing:-.03em;margin-bottom:8px;line-height:1.1}
.three span{font-size:13px;line-height:1.45}
.scroller{overflow-x:auto}
table{min-width:640px}
th,td{border:4px solid var(--ink);padding:15px;text-align:left;font-size:14px;vertical-align:top}
th{text-transform:uppercase;letter-spacing:.08em;font-size:11px;font-weight:900}
.band.inv th,.band.inv td{border-color:var(--bg)}
.slab{margin:0;border-bottom:5px solid var(--ink)}
.slab .v-media-img{width:100%;height:360px;object-fit:cover;filter:grayscale(1) contrast(1.35)}
.foot{padding:30px 26px;text-transform:uppercase;font-size:11px;letter-spacing:.24em;font-weight:700}
@media(max-width:760px){.two,.three{grid-template-columns:1fr}.two>div,.three>div{border-right:0;border-bottom:5px solid var(--ink)}.slab .v-media-img{height:220px}}
`,
  routes: [
    {
      path: "/",
      title: t("page.home.title"),
      bodyHtml: `
<section class="band"><p class="kick">${t("brand.name")}</p><h1>${t("hero.title")}</h1><p class="lede">${t("hero.body")}</p><a class="cta" href="#plans">${t("hero.cta")}</a></section>
<span class="slab" data-ventrio-media="log.schematic"></span>
<div class="two">
<div><h2>${t("problem.point1.title")}</h2><p class="lede">${t("problem.point1.body")}</p></div>
<div><h2>${t("problem.point2.title")}</h2><p class="lede">${t("problem.point2.body")}</p></div>
</div>
<section class="band hot"><p class="kick">${t("problem.title")}</p><h2>${t("problem.point3.title")}</h2><p class="lede">${t("problem.point3.body")}</p></section>
<div class="three">
<div><b>${t("pricing.price")}</b><span>${t("pricing.plan")}</span></div>
<div><b>${t("detail.point2")}</b><span>${t("how.step2.body")}</span></div>
<div><b>${t("detail.point3")}</b><span>${t("how.step3.body")}</span></div>
</div>
<section class="band inv" id="plans"><p class="kick">${t("pricing.title")}</p>
<div class="scroller"><table>
<thead><tr><th scope="col">${t("pricing.plan")}</th><th scope="col">${t("detail.point1")}</th><th scope="col">${t("detail.point2")}</th><th scope="col">${t("detail.point4")}</th></tr></thead>
<tbody>
<tr><td>${t("pricing.price")}</td><td>${t("how.step1.title")}</td><td>${t("how.step2.title")}</td><td>${t("how.step3.title")}</td></tr>
<tr><td>${t("pricing.note")}</td><td>${t("faq.a1")}</td><td>${t("faq.a2")}</td><td>${t("faq.a3")}</td></tr>
</tbody></table></div>
<a class="cta" href="/pricing">${t("cta.button")}</a></section>
<footer class="foot">${t("footer.note")}</footer>`,
    },
  ],
};

export const SITE_FIXTURES = {
  cinematic: CINEMATIC,
  editorial: EDITORIAL,
  saas: SAAS,
  catalogue: CATALOGUE,
  luxury: LUXURY,
  brutalist: BRUTALIST,
} as const;

export type SiteFixtureId = keyof typeof SITE_FIXTURES;
export const SITE_FIXTURE_IDS = Object.keys(SITE_FIXTURES) as SiteFixtureId[];

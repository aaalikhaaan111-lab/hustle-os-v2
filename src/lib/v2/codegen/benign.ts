/**
 * A hand-authored bundle that must compile.
 *
 * Without it the corpus would only prove the gate says no, which any gate that
 * rejects everything also proves. This is the control: it exercises the
 * allowlisted tag set, tokens in both body and title, multiple routes, and a
 * stylesheet that uses the constructs a real design needs — custom properties,
 * grid, clamp(), media queries, gradients — none of which may trip the CSS
 * scanner.
 *
 * It is written the way the prompt asks the model to write, so if a prompt
 * change makes conforming output impossible, this fixture fails first and
 * offline, rather than being discovered by a paid request.
 */

import { CODEGEN_ENVELOPE_VERSION, type CodegenBundleV1 } from "./envelope";

const CSS = `:root{
  --ink:#12161c;--ink-soft:#5b6472;--canvas:#fbfaf7;--surface:#ffffff;
  --accent:#1f4f3f;--accent-ink:#ffffff;--line:#e3e0d8;
  --measure:66ch;--gutter:clamp(20px,5vw,64px);
}
body{background:var(--canvas);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,sans-serif;font-size:17px;line-height:1.6}
.wrap{max-width:1180px;margin:0 auto;padding-inline:var(--gutter)}
.band{padding-block:clamp(56px,9vw,132px);border-bottom:1px solid var(--line)}
.eyebrow{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--accent);font-weight:650}
h1{font-size:clamp(38px,6.4vw,74px);line-height:1.02;letter-spacing:-.03em;font-weight:680;max-width:15ch;margin-block:18px 22px}
h2{font-size:clamp(27px,3.4vw,42px);line-height:1.1;letter-spacing:-.02em;font-weight:660;max-width:20ch}
h3{font-size:19px;line-height:1.3;font-weight:640;letter-spacing:-.01em}
p{max-width:var(--measure);color:var(--ink-soft)}
.lede{font-size:clamp(18px,2vw,21px);color:var(--ink-soft);max-width:56ch}
.hero{background:linear-gradient(168deg,#fbfaf7 0%,#f2efe7 74%,#ece8dd 100%)}
.actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:30px}
.btn{display:inline-block;padding:13px 22px;border-radius:8px;background:var(--accent);color:var(--accent-ink);font-weight:620;font-size:15px}
.btn-ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
.cols{display:grid;gap:30px;margin-top:44px}
.card{background:var(--surface);border:1px solid var(--line);border-radius:14px;padding:26px}
.card h3{margin-bottom:9px}
.card p{font-size:15px;max-width:none}
.steps{counter-reset:s;display:grid;gap:26px;margin-top:40px}
.step{padding-left:52px;position:relative}
.step::before{counter-increment:s;content:counter(s);position:absolute;left:0;top:-2px;width:34px;height:34px;border-radius:50%;background:var(--accent);color:var(--accent-ink);display:grid;place-items:center;font-size:14px;font-weight:670}
.ticks{margin-top:26px;display:grid;gap:11px}
.ticks li{padding-left:26px;position:relative;color:var(--ink-soft);font-size:15px}
.ticks li::before{content:"";position:absolute;left:2px;top:8px;width:9px;height:9px;border-radius:2px;background:var(--accent)}
.price{display:flex;flex-wrap:wrap;align-items:baseline;gap:12px;margin-block:16px 6px}
.price strong{font-size:40px;letter-spacing:-.02em}
.faq{display:grid;gap:22px;margin-top:36px;max-width:var(--measure)}
.faq dt{font-weight:640;margin-bottom:5px}
.faq dd{color:var(--ink-soft);font-size:15px}
.panel{background:rgba(255,255,255,.92);padding:clamp(20px,3vw,36px);border-radius:14px}
.tail{background:var(--accent);color:var(--accent-ink);border-bottom:0}
.tail h2,.tail p{color:var(--accent-ink)}
.tail .btn{background:var(--accent-ink);color:var(--accent)}
.nav{display:flex;justify-content:space-between;align-items:center;padding-block:20px;font-size:14px;font-weight:600}
.nav a{color:var(--ink-soft)}
footer{padding-block:38px;font-size:13px;color:var(--ink-soft)}
@media(min-width:768px){
  .cols{grid-template-columns:repeat(3,1fr)}
  .steps{grid-template-columns:repeat(3,1fr);gap:34px}
}
`;

const NAV = `<nav class="nav wrap"><a href="/">{{ventrio:text:brand.name}}</a><a href="/pricing">{{ventrio:text:nav.pricing}}</a></nav>`;

const FOOTER = `<footer class="wrap"><p>{{ventrio:text:footer.note}} — {{ventrio:text:footer.contact}}</p></footer>`;

const HOME = `${NAV}
<header class="band hero">
  <div class="wrap" data-ventrio-layout="split">
    <div>
      <p class="eyebrow">{{ventrio:text:hero.eyebrow}}</p>
      <h1>{{ventrio:text:hero.title}}</h1>
      <p class="lede">{{ventrio:text:hero.body}}</p>
      <div class="actions">
        <a class="btn" href="/pricing">{{ventrio:text:hero.cta}}</a>
        <a class="btn btn-ghost" href="#how">{{ventrio:text:hero.secondary}}</a>
      </div>
    </div>
    <span data-ventrio-media="bench.surface"></span>
  </div>
</header>
<section class="band"><div class="wrap">
  <h2>{{ventrio:text:problem.title}}</h2>
  <p class="lede">{{ventrio:text:problem.body}}</p>
  <div class="cols">
    <article class="card"><h3>{{ventrio:text:problem.point1.title}}</h3><p>{{ventrio:text:problem.point1.body}}</p></article>
    <article class="card"><h3>{{ventrio:text:problem.point2.title}}</h3><p>{{ventrio:text:problem.point2.body}}</p></article>
    <article class="card"><h3>{{ventrio:text:problem.point3.title}}</h3><p>{{ventrio:text:problem.point3.body}}</p></article>
  </div>
</div></section>
<section class="band" id="how"><div class="wrap" data-ventrio-layout="rail">
  <h2>{{ventrio:text:how.title}}</h2>
  <div class="steps">
    <div class="step"><h3>{{ventrio:text:how.step1.title}}</h3><p>{{ventrio:text:how.step1.body}}</p></div>
    <div class="step"><h3>{{ventrio:text:how.step2.title}}</h3><p>{{ventrio:text:how.step2.body}}</p></div>
    <div class="step"><h3>{{ventrio:text:how.step3.title}}</h3><p>{{ventrio:text:how.step3.body}}</p></div>
  </div>
</div></section>
<section class="band"><div class="wrap" data-ventrio-layout="overlap">
  <span data-ventrio-media="log.schematic"></span>
  <div class="panel">
  <h2>{{ventrio:text:detail.title}}</h2>
  <p class="lede">{{ventrio:text:detail.body}}</p>
  <ul class="ticks">
    <li>{{ventrio:text:detail.point1}}</li>
    <li>{{ventrio:text:detail.point2}}</li>
    <li>{{ventrio:text:detail.point3}}</li>
    <li>{{ventrio:text:detail.point4}}</li>
  </ul>
  </div>
</div></section>
<section class="band tail"><div class="wrap" data-ventrio-layout="stack">
  <h2>{{ventrio:text:cta.title}}</h2>
  <p>{{ventrio:text:cta.body}}</p>
  <div class="actions"><a class="btn" href="/pricing">{{ventrio:text:cta.button}}</a></div>
</div></section>
${FOOTER}`;

const PRICING = `${NAV}
<header class="band"><div class="wrap" data-ventrio-layout="offset">
  <p class="eyebrow">{{ventrio:text:nav.pricing}}</p>
  <h1>{{ventrio:text:pricing.title}}</h1>
  <p class="lede">{{ventrio:text:pricing.body}}</p>
</div></header>
<section class="band"><div class="wrap">
  <article class="card">
    <h3>{{ventrio:text:pricing.plan}}</h3>
    <div class="price"><strong>{{ventrio:text:pricing.price}}</strong></div>
    <p>{{ventrio:text:pricing.note}}</p>
    <div class="actions"><a class="btn" href="/">{{ventrio:text:pricing.cta}}</a></div>
  </article>
</div></section>
<section class="band"><div class="wrap">
  <h2>{{ventrio:text:faq.title}}</h2>
  <dl class="faq">
    <div><dt>{{ventrio:text:faq.q1}}</dt><dd>{{ventrio:text:faq.a1}}</dd></div>
    <div><dt>{{ventrio:text:faq.q2}}</dt><dd>{{ventrio:text:faq.a2}}</dd></div>
    <div><dt>{{ventrio:text:faq.q3}}</dt><dd>{{ventrio:text:faq.a3}}</dd></div>
  </dl>
</div></section>
${FOOTER}`;

export const BENIGN_BUNDLE: CodegenBundleV1 = {
  version: CODEGEN_ENVELOPE_VERSION,
  css: CSS,
  routes: [
    { path: "/", title: "{{ventrio:text:page.home.title}}", bodyHtml: HOME },
    { path: "/pricing", title: "{{ventrio:text:page.pricing.title}}", bodyHtml: PRICING },
  ],
};

import type { GeneratedAppV1 } from "../contract";

/**
 * Fixture 3 — a local business site.
 *
 * Information architecture: a scrolling public page with anchored navigation.
 * Warm, rounded, generous — nothing like the dashboard's systematic grid or the
 * timeline's dense workspace.
 *
 * Its interactions are the ones this kind of site actually needs: a gallery
 * that opens a modal with keyboard dismissal, pricing that recalculates on a
 * frequency toggle, and an enquiry form that validates and confirms in place.
 */
export const LOCAL_APP: GeneratedAppV1 = {
  schemaVersion: "app-1",
  metadata: {
    name: "Fold & Crumb",
    description: "A neighbourhood bakery: pastry, sourdough, and standing orders.",
    locale: "en",
  },
  runtime: { template: "react-spa", dependencies: ["react", "lucide-react", "clsx"] },
  routes: [{ path: "/", module: "src/App.tsx", title: "Fold & Crumb" }],
  files: {
    "src/data/shop.ts": `export interface Item { id: string; name: string; note: string; tone: string }

export const GALLERY: Item[] = [
  { id: "g1", name: "Morning croissant", note: "Laminated over three days, baked at six.", tone: "#d9a441" },
  { id: "g2", name: "Country sourdough", note: "A long cold ferment and a very hot oven.", tone: "#a9713f" },
  { id: "g3", name: "Cardamom bun", note: "Rolled by hand, glazed twice.", tone: "#c98a5e" },
  { id: "g4", name: "Rye and seed", note: "Dense, sour, keeps all week.", tone: "#7d5a3c" },
  { id: "g5", name: "Almond twist", note: "Yesterday's croissant, better today.", tone: "#e0b06a" },
  { id: "g6", name: "Olive fougasse", note: "Friday only, and it goes fast.", tone: "#8a8f5c" },
];

export interface Tier { id: string; name: string; weekly: number; blurb: string; includes: string[]; featured?: boolean }

export const TIERS: Tier[] = [
  { id: "t1", name: "The Loaf", weekly: 9, blurb: "One loaf a week, your pick.",
    includes: ["One country or rye loaf", "Collect any morning", "Pause any week"] },
  { id: "t2", name: "The Table", weekly: 22, blurb: "Bread and pastry for a household.", featured: true,
    includes: ["Two loaves", "Four pastries", "Saturday extras", "Pause any week"] },
  { id: "t3", name: "The Counter", weekly: 58, blurb: "A standing order for a small cafe.",
    includes: ["Six loaves", "Twelve pastries", "Wholesale pricing", "Morning delivery"] },
];
`,
    "src/components/TopBar.tsx": `import { useState } from "react";
import clsx from "clsx";
import { Menu, X } from "lucide-react";

const LINKS = [
  { href: "#counter", label: "The counter" },
  { href: "#standing", label: "Standing orders" },
  { href: "#visit", label: "Visit" },
];

export default function TopBar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="topbar">
      <a className="brand" href="#top">Fold &amp; Crumb</a>
      <button type="button" className="burger" aria-expanded={open}
        aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
        {open ? <X size={20} aria-hidden="true" /> : <Menu size={20} aria-hidden="true" />}
      </button>
      <nav className={clsx("links", open && "links-open")} aria-label="Sections">
        {LINKS.map((link) => (
          <a key={link.href} href={link.href} onClick={() => setOpen(false)}>{link.label}</a>
        ))}
      </nav>
    </header>
  );
}
`,
    "src/components/Gallery.tsx": `import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { GALLERY, type Item } from "../data/shop";

export default function Gallery() {
  const [open, setOpen] = useState<Item | null>(null);

  // Escape closes the modal. Without it a keyboard user is stuck behind an
  // overlay with no way back, which is the usual way a hand-built lightbox
  // fails an accessibility pass.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <section id="counter" className="counter">
      <h2>What is on the counter</h2>
      <p className="lede">Baked each morning. When it is gone it is gone.</p>

      <ul className="grid">
        {GALLERY.map((item) => (
          <li key={item.id}>
            <button type="button" className="tile" onClick={() => setOpen(item)}>
              <span className="swatch" style={{ background: item.tone }} aria-hidden="true" />
              <span className="tile-name">{item.name}</span>
            </button>
          </li>
        ))}
      </ul>

      {open ? (
        <div className="overlay" role="dialog" aria-modal="true" aria-label={open.name}
          onClick={() => setOpen(null)}>
          <div className="sheet" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="sheet-close" aria-label="Close" onClick={() => setOpen(null)}>
              <X size={18} aria-hidden="true" />
            </button>
            <span className="sheet-swatch" style={{ background: open.tone }} aria-hidden="true" />
            <h3>{open.name}</h3>
            <p>{open.note}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
`,
    "src/components/Standing.tsx": `import { useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { TIERS } from "../data/shop";

export default function Standing() {
  const [monthly, setMonthly] = useState(false);

  return (
    <section id="standing" className="standing">
      <h2>Standing orders</h2>
      <p className="lede">Set it once. Pause whenever you are away.</p>

      <div className="toggle" role="group" aria-label="Billing frequency">
        <button type="button" aria-pressed={!monthly}
          className={clsx("toggle-btn", !monthly && "toggle-on")} onClick={() => setMonthly(false)}>
          Weekly
        </button>
        <button type="button" aria-pressed={monthly}
          className={clsx("toggle-btn", monthly && "toggle-on")} onClick={() => setMonthly(true)}>
          Monthly
        </button>
      </div>

      <ul className="tiers">
        {TIERS.map((tier) => (
          <li key={tier.id} className={clsx("tier", tier.featured && "tier-featured")}>
            {tier.featured ? <span className="tag">Most taken</span> : null}
            <h3>{tier.name}</h3>
            <p className="price">
              <strong>£{monthly ? tier.weekly * 4 : tier.weekly}</strong>
              <span>/{monthly ? "month" : "week"}</span>
            </p>
            <p className="tier-blurb">{tier.blurb}</p>
            <ul className="includes">
              {tier.includes.map((line) => (
                <li key={line}><Check size={14} aria-hidden="true" /> {line}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </section>
  );
}
`,
    "src/components/Enquiry.tsx": `import { useState } from "react";
import { MapPin, Clock } from "lucide-react";

export default function Enquiry() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sent, setSent] = useState(false);

  function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "We need a name for the order.";
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) next.email = "We need a working email address.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setSent(true);
  }

  return (
    <section id="visit" className="visit">
      <div className="visit-info">
        <h2>Come and find us</h2>
        <p className="visit-line"><MapPin size={16} aria-hidden="true" /> 14 Ashfield Row, on the corner</p>
        <p className="visit-line"><Clock size={16} aria-hidden="true" /> Tuesday to Sunday, 7am until it runs out</p>
        <p className="visit-note">
          For a standing order or something for a party, leave a note and we will
          write back the same day.
        </p>
      </div>

      <div className="visit-form">
        {sent ? (
          <div className="sent" role="status">
            <h3>Thank you, {name.trim()}.</h3>
            <p>We will reply to {email.trim()} today.</p>
            <button type="button" className="again" onClick={() => {
              setSent(false); setName(""); setEmail(""); setNote("");
            }}>Send another</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <label htmlFor="n">Name</label>
            <input id="n" value={name} onChange={(e) => setName(e.target.value)}
              aria-invalid={Boolean(errors.name)} placeholder="Your name" />
            {errors.name ? <p className="err">{errors.name}</p> : null}

            <label htmlFor="e">Email</label>
            <input id="e" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              aria-invalid={Boolean(errors.email)} placeholder="you@example.com" />
            {errors.email ? <p className="err">{errors.email}</p> : null}

            <label htmlFor="m">What do you need?</label>
            <textarea id="m" rows={4} value={note} onChange={(e) => setNote(e.target.value)}
              placeholder="Six loaves on Saturdays, from the 12th" />

            <button type="submit" className="send">Send it</button>
          </form>
        )}
      </div>
    </section>
  );
}
`,
    "src/styles.css": `:root{
  --paper:#fbf6ee; --card:#fffdf9; --ink:#2c2118; --dim:#7a6a58;
  --line:#e6dccc; --crust:#b8703a; --deep:#5c3a1e;
}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);
  font-family:Georgia,'Iowan Old Style','Times New Roman',serif;font-size:16px;line-height:1.6}
button{font:inherit;cursor:pointer}
h1,h2,h3{margin:0;font-weight:400;letter-spacing:-.01em}
.lede{color:var(--dim);margin:6px 0 26px;max-width:46ch}

.topbar{position:sticky;top:0;z-index:20;display:flex;align-items:center;gap:20px;
  padding:16px 26px;background:rgba(251,246,238,.92);border-bottom:1px solid var(--line);
  backdrop-filter:blur(8px)}
.brand{font-size:19px;text-decoration:none;color:inherit;margin-right:auto;letter-spacing:.01em}
.burger{display:none;border:0;background:none;color:inherit;padding:4px}
.links{display:flex;gap:22px}
.links a{color:var(--dim);text-decoration:none;font-size:14.5px;font-family:ui-sans-serif,system-ui,sans-serif}
.links a:hover{color:var(--crust)}

.hero{padding:76px 26px 60px;max-width:760px}
.hero h1{font-size:clamp(2.3rem,6vw,3.9rem);line-height:1.08}
.hero p{color:var(--dim);font-size:1.1rem;max-width:44ch;margin:18px 0 0}
.hero-cta{display:inline-block;margin-top:28px;background:var(--deep);color:var(--paper);
  text-decoration:none;padding:13px 26px;border-radius:999px;
  font-family:ui-sans-serif,system-ui,sans-serif;font-size:14.5px}
.hero-cta:hover{background:var(--crust)}

section{padding:56px 26px;max-width:1080px}
h2{font-size:clamp(1.5rem,3.2vw,2.1rem)}

.grid{list-style:none;margin:0;padding:0;display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}
.tile{width:100%;text-align:left;background:var(--card);border:1px solid var(--line);
  border-radius:16px;padding:0 0 14px;overflow:hidden;transition:transform .18s ease,box-shadow .18s ease}
.tile:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(92,58,30,.12)}
.swatch{display:block;height:150px}
.tile-name{display:block;padding:12px 15px 0;font-size:15.5px}

.overlay{position:fixed;inset:0;background:rgba(44,33,24,.55);display:grid;
  place-items:center;padding:24px;z-index:40}
.sheet{position:relative;background:var(--card);border-radius:18px;max-width:420px;
  width:100%;overflow:hidden;padding-bottom:22px}
.sheet-swatch{display:block;height:170px}
.sheet h3{padding:16px 22px 0;font-size:22px}
.sheet p{padding:6px 22px 0;margin:0;color:var(--dim)}
.sheet-close{position:absolute;top:12px;right:12px;background:rgba(251,246,238,.9);
  border:0;border-radius:50%;width:32px;height:32px;display:grid;place-items:center}

.toggle{display:inline-flex;border:1px solid var(--line);border-radius:999px;
  padding:3px;background:var(--card);margin-bottom:26px}
.toggle-btn{border:0;background:none;border-radius:999px;padding:7px 18px;
  font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;color:var(--dim)}
.toggle-on{background:var(--deep);color:var(--paper)}

.tiers{list-style:none;margin:0;padding:0;display:grid;
  grid-template-columns:repeat(3,minmax(0,1fr));gap:18px;align-items:start}
.tier{position:relative;background:var(--card);border:1px solid var(--line);
  border-radius:18px;padding:22px 20px}
.tier-featured{border-color:var(--crust);box-shadow:0 12px 30px rgba(184,112,58,.13)}
.tag{position:absolute;top:-11px;left:20px;background:var(--crust);color:var(--paper);
  font-family:ui-sans-serif,system-ui,sans-serif;font-size:12px;letter-spacing:.08em;
  text-transform:uppercase;padding:3px 10px;border-radius:999px}
.tier h3{font-size:19px}
.price{margin:10px 0 4px;display:flex;align-items:baseline;gap:4px}
.price strong{font-size:34px;font-weight:400;letter-spacing:-.03em}
.price span{color:var(--dim);font-size:14px}
.tier-blurb{margin:0 0 14px;color:var(--dim);font-size:14.5px}
.includes{list-style:none;margin:0;padding:0;display:grid;gap:7px;
  font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px}
.includes li{display:flex;align-items:center;gap:8px;color:var(--dim)}

.visit{display:grid;grid-template-columns:1fr 1fr;gap:46px;align-items:start}
.visit-line{display:flex;align-items:center;gap:9px;color:var(--dim);margin:12px 0 0;font-size:15px}
.visit-note{margin:20px 0 0;max-width:36ch}
.visit-form{background:var(--card);border:1px solid var(--line);border-radius:18px;padding:24px}
form{display:grid;gap:5px;font-family:ui-sans-serif,system-ui,sans-serif}
label{font-size:13px;margin-top:12px;color:var(--dim)}
input,textarea{border:1px solid var(--line);border-radius:10px;padding:11px 13px;
  font:inherit;font-size:14.5px;background:var(--paper);color:var(--ink);resize:vertical}
input:focus,textarea:focus{outline:2px solid #e3c9a8;border-color:var(--crust)}
input[aria-invalid="true"]{border-color:#b3261e}
.err{margin:2px 0 0;color:#b3261e;font-size:12.5px}
.send{margin-top:20px;justify-self:start;background:var(--deep);color:var(--paper);
  border:0;border-radius:999px;padding:12px 26px;font-size:14.5px}
.send:hover{background:var(--crust)}
.sent h3{font-size:21px}
.sent p{color:var(--dim);margin:8px 0 0}
.again{margin-top:18px;background:none;border:1px solid var(--line);border-radius:999px;
  padding:9px 20px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:14px;color:var(--dim)}

.foot{border-top:1px solid var(--line);padding:26px;color:var(--dim);font-size:14px;max-width:none}

@media (max-width:860px){
  .grid,.tiers{grid-template-columns:repeat(2,minmax(0,1fr))}
  .visit{grid-template-columns:1fr;gap:30px}
}
@media (max-width:620px){
  .burger{display:block}
  .links{display:none;position:absolute;top:100%;left:0;right:0;flex-direction:column;
    gap:0;background:var(--card);border-bottom:1px solid var(--line);padding:8px 0}
  .links-open{display:flex}
  .links a{padding:11px 26px}
  .grid,.tiers{grid-template-columns:1fr}
  section{padding:44px 20px}
  .hero{padding:52px 20px 40px}
}
`,
    "src/App.tsx": `import TopBar from "./components/TopBar";
import Gallery from "./components/Gallery";
import Standing from "./components/Standing";
import Enquiry from "./components/Enquiry";
import "./styles.css";

export default function App() {
  return (
    <div id="top">
      <TopBar />

      <section className="hero">
        <h1>Bread that takes three days, sold in one morning.</h1>
        <p>
          A small bakery on Ashfield Row. Everything is mixed the day before and
          baked before the street wakes up.
        </p>
        <a className="hero-cta" href="#standing">Set up a standing order</a>
      </section>

      <Gallery />
      <Standing />
      <Enquiry />

      <footer className="foot">
        Fold &amp; Crumb · 14 Ashfield Row · Closed Mondays
      </footer>
    </div>
  );
}
`,
  },
};

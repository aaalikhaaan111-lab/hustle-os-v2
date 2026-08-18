import { readFileSync } from "node:fs";

/**
 * The landing page makes no claim the product cannot support.
 *
 * A marketing page is the easiest place in a codebase for a fiction to appear
 * and the hardest place for anyone to notice it later: nobody diffs a hero
 * against reality. These checks are the reality.
 */
let passed = 0;
const failures: string[] = [];
function check(name: string, ok: boolean, detail?: string) {
  if (ok) { passed += 1; return; }
  failures.push(`${name}${detail ? ` — ${detail}` : ""}`);
}

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const landing = read("src/components/landing/Landing.tsx");
const css = read("src/components/landing/landing.css");
const en = JSON.parse(read("messages/en.json")).landing as Record<string, string>;
const ru = JSON.parse(read("messages/ru.json")).landing as Record<string, string>;
const copy = Object.values(en).join(" ") + " " + Object.values(ru).join(" ");

/* ── 1. no invented proof ────────────────────────────────────────────────── */

/**
 * Ventrio has no customers to name, no testimonials to quote and no usage to
 * report. A landing page that invents any of them is lying on the one screen
 * a stranger judges the product by.
 */
check("no customer counts or usage numbers",
  !/\b\d[\d,.]*\s*(\+|k\b|m\b)?\s*(users?|customers?|businesses|teams|companies|projects built|creators)/i.test(copy),
  "a number about how many people use this is a number Ventrio does not have");
check("no testimonials or named customers",
  !/testimonial|trusted by|loved by|as seen in|case study/i.test(copy));
check("no star ratings or awards", !/★|⭐|rated \d|award/i.test(copy));

/**
 * The only integrations named are messengers, and they are named as planned.
 * Anything else would be an integration that does not exist.
 */
check("messengers are labelled as coming, not shipped",
  /coming|скоро/i.test(en.chatEyebrow + ru.chatEyebrow) &&
  /not available yet/i.test(en.chatLede) &&
  /пока это недоступно/i.test(ru.chatLede),
  "Telegram and WhatsApp are not built; the section must say so in both languages");
check("no other integrations are claimed",
  !/\b(slack|gmail|notion|zapier|stripe|hubspot|salesforce)\b/i.test(copy));

/* ── 2. pricing comes from the entitlements, not from prose ──────────────── */

check("plan limits are read from PLANS",
  /PLANS\[plan\]\.generationsPerMonth/.test(landing) &&
  /PLANS\[plan\]\.maxPublishedProjects/.test(landing) &&
  /PLANS\[plan\]\.canRemoveBranding/.test(landing),
  "a hand-written limit on the landing will outlive the limit the product enforces");

/* ── 3. the entry points still work ──────────────────────────────────────── */

/**
 * The composer is the product's real front door: it writes a seed and routes
 * into /create, through signup when logged out. The rebuild must not have
 * turned it into decoration.
 */
check("the hero still mounts the real composer", /<LandingComposer/.test(landing));
check("and so does the closing section",
  (landing.match(/<LandingComposer/g) ?? []).length >= 2);
check("signed-out visitors are sent through signup with a destination",
  /\/signup\?next=%2Fcreate/.test(landing));
check("New project still starts a fresh session", /\/create\?fresh=1/.test(landing));

/* ── 4. responsive by construction ───────────────────────────────────────── */

/**
 * Every multi-column layout starts at one or two columns and widens at a
 * breakpoint, and every track is `minmax(0, …)` so a long word cannot push the
 * page sideways. This is checked because the browser available here cannot be
 * resized below its own width, so the phone layout is verified by construction
 * rather than by eye.
 */
const tracks = css.match(/grid-template-columns:[^;]+/g) ?? [];
check("multi-column tracks cannot blow out",
  tracks.filter((t) => /repeat\(/.test(t)).every((t) => /minmax\(0/.test(t)),
  "a track without minmax(0,…) overflows on the first long word");
check("the page has a mobile-first gutter", /--lp-gutter: 1\.25rem/.test(css));
check("navigation survives on narrow screens",
  !/\.lp-nav \{[^}]*display: none/.test(css),
  "the destinations used to vanish under 880px with nothing in their place");

/* ── 5. motion answers the pointer, never the scroll ─────────────────────── */

/**
 * THE SCROLL-REVEAL SYSTEM IS GONE and must not come back.
 *
 * A page that fades each band in as you reach it answers the reader's first
 * action — scrolling — with content that is not there yet. Everything on this
 * page is present at load; what moves is what the visitor points at.
 */
check("nothing is revealed on scroll",
  !/lp-reveal/.test(css) && !/IntersectionObserver/.test(read("src/components/landing/LandingParts.tsx")),
  "an entrance tied to scroll position is the thing this page stopped doing");
check("the one keyframe animation is a transition, not an entrance",
  (css.match(/@keyframes/g) ?? []).length === 1 && /@keyframes lp-blur/.test(css),
  "a keyframe that runs on load is an entrance; this one only runs while a label travels");

/* The interactions that replaced it, each verified in the browser against the
   reference: a label that swaps in place, and a card deck that opens one at a
   time under the pointer. */
check("the button swaps its label without resizing",
  /\.lp-swap\b/.test(css) && /translateY\(-100%\)/.test(css));
check("a card is not interactive and reveals its figure on hover alone",
  /<article key=\{card\.n\} className="lp-card"/.test(read("src/components/landing/LandingParts.tsx")) &&
  /@media \(hover: hover\)[\s\S]{0,240}\.lp-card:hover \.lp-figure/.test(css),
  "the deck used to resize like an accordion; now only the hovered card changes, and only visually");
check("and the figure is simply present where there is no pointer to hover with",
  /@media \(hover: none\)[\s\S]{0,200}\.lp-figure \{ opacity: 0\.65/.test(css),
  "a visual revealed only on hover does not exist on a phone");
check("touch gets its own feedback",
  /@media \(hover: none\)[\s\S]{0,300}:active/.test(css));
check("and all of it stops under reduced motion",
  /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,220}transition-duration: 0\.01ms/.test(css));

/* ── 6. the navigation is the registry component ─────────────────────────── */

const parts = read("src/components/landing/LandingParts.tsx");
check("navigation uses shadcn's Navigation Menu",
  /@\/components\/ui\/shadcn\/navigation-menu/.test(parts) &&
  /<NavigationMenuLink/.test(parts));
check("and every item opens a real panel rather than underlining itself",
  /<NavigationMenuTrigger/.test(parts) && /<NavigationMenuContent/.test(parts) &&
  /\.lp-nav-panel/.test(css));
check("destinations are real pages plus the one section that is not",
  /"\/pricing"/.test(parts) && /"\/about"/.test(parts) && /"\/faq"/.test(parts) && /"#how"/.test(parts));
check("and the anchor lands clear of the sticky header",
  /scroll-margin-top/.test(css));

/* ── 7. the after-launch stage demonstrates rather than asserts ──────────── */

/**
 * SELECTION MUST NOT BE STOLEN BY A REFLOW.
 *
 * Opening an item expands its description, which reflows the list — and a
 * reflow that slides a different item under a stationary cursor fires
 * `mouseenter` on it. With `onMouseEnter` the last item was literally
 * unselectable: clicking it re-flowed the list and whatever landed under the
 * pointer took the selection straight back. `mousemove` only fires when the
 * pointer actually moves.
 */
const stage = read("src/components/landing/AfterStage.tsx");
check("the stage changes on click only",
  !/onMouseEnter=/.test(stage) && !/onMouseMove=/.test(stage) && /onClick=/.test(stage),
  "moving a pointer down the list must not play four things at the reader");
check("and the stage box never changes size when it does",
  /aspect-ratio: 16 \/ 10/.test(css) && /\.lp-stage \{[\s\S]{0,200}overflow: hidden/.test(css),
  "a stage that resizes with its contents moves the page under the reader");
check("every section is a real button inside a tablist",
  /role="tablist"/.test(stage) && /role="tab"/.test(stage) &&
  /type="button"/.test(stage) && /aria-selected=/.test(stage));
check("all four states exist", /"words"/.test(stage) && /"device"/.test(stage) &&
  /"feedback"/.test(stage) && /"anywhere"/.test(stage));
check("the stage uses Motion for React", /from "motion\/react"/.test(stage));
check("and honours reduced motion in its own transitions",
  /useReducedMotion/.test(stage) && /duration: 0 \}/.test(stage));

/**
 * The demonstrations are drawn, not screenshotted, and the numbers in them are
 * labelled as an example — Ventrio counts responses, it does not track
 * visitors, and the landing must not imply otherwise.
 */
check("the media slots are declared but no asset is invented to fill them",
  /video\?: string/.test(stage) && !/\.mp4|\.webm|\.gif/.test(stage),
  "the messenger clip was explicitly out of scope; inventing the other three is the same mistake");
check("an empty slot says it is empty, in both languages",
  /stageSlotNote/.test(stage) && /stageSoon/.test(stage) &&
  /coming/i.test(en.stageSoon) && /скоро/i.test(ru.stageSoon));
check("and the FAQ is a real single-open accordion",
  /aria-expanded=/.test(parts) && /\.lp-faq-a \{[\s\S]{0,160}grid-template-rows: 0fr/.test(css) &&
  /\.lp-faq-item\[data-open="true"\] \.lp-faq-a \{ grid-template-rows: 1fr/.test(css));

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ landing: ${passed} checks passed`);

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
const css = read("src/components/public/public.css");
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
/**
 * The destinations must remain REACHABLE on a phone — which is what this always
 * guarded. It used to do that by proving the desktop nav was never hidden, back
 * when hiding it would have left nothing behind. Below 880px the nav is now
 * removed from the layout on purpose and the same destinations live in a sheet
 * behind one control, so the check is that the drawer exists and carries them.
 *
 * The nav wrapped onto its own full-width row and then onto two lines inside
 * it, so the header stood three rows tall at 390px before any content.
 */
const publicHeader = read("src/components/public/PublicHeader.tsx");
check("every destination is still reachable on a phone",
  /<SheetContent/.test(publicHeader) && /lp-menu-link/.test(publicHeader) &&
  /menus\.map/.test(publicHeader.slice(publicHeader.indexOf("SheetContent"))),
  "the drawer must carry the same destinations the desktop nav does");
check("and the desktop nav is removed from the layout rather than merely hidden",
  /\.lp-header-inner > \.lp-nav \{ display: none; \}/.test(css),
  "a hidden-but-laid-out nav still contributes width to its grid track");
check("the phone header is one fixed row",
  /@media \(max-width: 879px\) \{[\s\S]{0,400}height: 3\.5rem/.test(css));

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
/**
 * Keyframes are allowed, entrances are not. Every animation on this page is
 * bound to a `:hover`, a `[data-state]` or a `[data-motion]` — nothing runs
 * because the page loaded or because a band scrolled into view.
 */
check("no keyframe animation runs on load",
  /@keyframes lp-blur/.test(css) && /@keyframes lp-nav-in/.test(css) &&
  !/animation:[^;]*(?:lp-blur|lp-nav)[^;]*(?:infinite|backwards)/.test(css) &&
  !/lp-reveal|scroll-timeline|view-timeline/.test(css),
  "an entrance is a keyframe nobody asked for");

/* The interactions that replaced it, each verified in the browser against the
   reference: a label that swaps in place, and a card deck that opens one at a
   time under the pointer. */
check("the button swaps its label without resizing",
  /\.lp-swap\b/.test(css) && /translateY\(-100%\)/.test(css));
/**
 * The deck is a text accordion again. The version between carried a small
 * drawing in every card and revealed it on hover — four illustrations competing
 * with four sentences, and a permanent gap reserved for them in the resting
 * state, which is what stopped the calm default from being calm.
 */
const deck = read("src/components/landing/LandingParts.tsx");
check("the deck is a hover accordion, and carries no figures",
  /\.lp-card\[data-open="true"\] \{ flex-grow: 2\.6; \}/.test(css) &&
  !/lp-figure|lp-fig\b/.test(css) && !/lp-figure|CardFigure/.test(deck),
  "the drawings were the thing the section was asked to lose");
/**
 * `onMouseMove`, never `onMouseEnter`: opening a card reflows the row, and a
 * reflow that slides another card under a stationary cursor fires `mouseenter`
 * on it — which made the last card literally unselectable.
 */
check("and a reflow cannot steal the selection",
  /onMouseMove=/.test(deck) && !/onMouseEnter=/.test(deck));
check("keyboard and touch reach it the same way",
  /onFocus=/.test(deck) && /onClick=/.test(deck) && /aria-expanded=/.test(deck));
check("and every explanation is open where there is no pointer",
  /@media \(hover: none\), \(max-width: 1049px\) \{[\s\S]{0,240}\.lp-card-body \{ grid-template-rows: 1fr/.test(css),
  "copy behind an interaction the device cannot perform is copy a phone never sees");
check("touch gets its own feedback",
  /@media \(hover: none\)[\s\S]{0,300}:active/.test(css));
check("and all of it stops under reduced motion",
  /@media \(prefers-reduced-motion: reduce\)[\s\S]{0,220}transition-duration: 0\.01ms/.test(css));

/* ── 6. the navigation is the registry component ─────────────────────────── */

const header = read("src/components/public/PublicHeader.tsx");
const faqComponent = read("src/components/public/Faq.tsx");
const shell = read("src/components/public/PublicShell.tsx");
const appShell = read("src/components/layout/AppShell.tsx");
const publicRoutes = read("src/components/public/routes.ts");
check("navigation uses shadcn's Navigation Menu",
  /@\/components\/ui\/shadcn\/navigation-menu/.test(header) &&
  /<NavigationMenuLink/.test(header));
check("and every item opens a real panel rather than underlining itself",
  /<NavigationMenuTrigger/.test(header) && /<NavigationMenuContent/.test(header) &&
  /\.lp-nav-panel/.test(css));
check("destinations are real pages plus the homepage sections",
  /"\/pricing"/.test(header) && /"\/about"/.test(header) &&
  /"\/faq"/.test(header) && /"\/who-its-for"/.test(header) && /"\/contact"/.test(header));
/* An in-page target must be rooted at `/`. A bare `#how` resolves against the
   CURRENT page, so on /pricing it pointed at nothing and did nothing. */
check("and every in-page target is rooted at the homepage",
  /"\/#how"/.test(header) && /"\/#after"/.test(header) && /"\/#pricing"/.test(header) &&
  !/href: "#/.test(header),
  "a bare hash only works on the one page that has the section");

/* ── 6b. one header, not four ────────────────────────────────────────────── */

/**
 * The site had FOUR pieces of public chrome: this navigation on `/`, an
 * `InfoLayout` on the info pages, `BackNav` + `PageHeader` on the legal set,
 * and `StudioTopBar` mounted by `AppShell` over all of them. /pricing rendered
 * two stacked headers because of the last one.
 */
check("every public route mounts the one shared shell",
  ["src/app/page.tsx", "src/app/pricing/page.tsx", "src/app/about/page.tsx",
   "src/app/who-its-for/page.tsx", "src/app/faq/page.tsx", "src/app/contact/page.tsx",
   "src/app/privacy/page.tsx", "src/app/terms/page.tsx", "src/app/login/page.tsx",
   "src/app/signup/page.tsx"]
    .every((f) => /<PublicShell>/.test(read(f))),
  "a public page with its own chrome is how the site ended up with four headers");
check("and the shell is the only thing that mounts the header",
  /<PublicHeader/.test(shell) && /<PublicFooter/.test(shell));
check("the app shell stands down where the public shell is mounted",
  /carriesPublicShell/.test(appShell) && /PUBLIC_SHELL_ROUTES/.test(publicRoutes),
  "two headers on one page is what happens when both sides guess");
check("and the anchor lands clear of the sticky header",
  /scroll-margin-top/.test(css));

/* ── 6c. the navigation actually animates ────────────────────────────────── */

/**
 * The registry ships `animate-in` / `zoom-in-90` / `animate-out` on the
 * viewport. Those are `tw-animate-css` utilities and this project neither
 * installs nor imports that package, so every one of them compiled to nothing
 * and the panel appeared and vanished in a single frame.
 */
check("the animation utilities the registry assumes are still absent",
  !/tw-animate-css|tailwindcss-animate/.test(read("package.json")),
  "if this is ever installed, delete the hand-written keyframes rather than stacking both");
check("so the panel carries its own enter and leave",
  /@keyframes lp-nav-in/.test(css) && /@keyframes lp-nav-out/.test(css) &&
  /\[data-state="open"\] \{\s*animation: lp-nav-in/.test(css) &&
  /\[data-state="closed"\] \{\s*animation: lp-nav-out/.test(css));

/**
 * KEYFRAMES, NOT TRANSITIONS. Radix's Presence reads `animationName` off the
 * computed style to decide whether to hold a closing node in the DOM. A
 * transition on `[data-state="closed"]` never runs — the element is already
 * gone.
 */
check("the leave is an animation, so Radix waits for it",
  !/\[data-state="closed"\] \{\s*transition:/.test(css));
check("it moves on opacity, translate, scale and blur",
  /@keyframes lp-nav-in \{[\s\S]{0,200}opacity: 0;[\s\S]{0,120}translateY\(-6px\) scale\(0\.985\);[\s\S]{0,80}blur\(6px\)/.test(css));
check("in the 180-240ms band, on the page's one easing",
  /animation: lp-nav-in 220ms var\(--lp-ease\)/.test(css) &&
  /animation: lp-nav-out 180ms var\(--lp-ease\)/.test(css));

/**
 * EVERY DROPDOWN USED TO OPEN IN THE SAME PLACE.
 *
 * The registry's default renders ONE shared `NavigationMenuViewport` and
 * portals whichever item is open into it, so all four panels appeared at the
 * same coordinates — "Questions" opened under "Pricing". `viewport={false}`
 * makes Radix render each panel inside its own item, which is what lets the
 * stylesheet anchor it to the trigger it belongs to.
 */
check("each panel is rendered inside its own item, not a shared viewport",
  /viewport=\{false\}/.test(header) && !/navigation-menu-viewport/.test(css),
  "one shared viewport is one position for four different triggers");
check("and is anchored to that item rather than to the menu",
  /\.lp-nav-list > li \{\s*\n\s*position: relative;/.test(css) &&
  /\.lp-nav-panel \{[\s\S]{0,200}position: absolute;[\s\S]{0,120}top: 100%;/.test(css));
/* No magic numbers: the edges pin to their own item's corner, not to an offset. */
check("the outer items pin to a corner instead of a hard-coded offset",
  /li:first-child \.lp-nav-panel \{\s*\n\s*left: 0;/.test(css) &&
  /li:last-child \.lp-nav-panel \{[\s\S]{0,60}right: 0;/.test(css) &&
  !/left: -?\d+px/.test(css));
check("and the chevron keeps pace with the panel it belongs to",
  /\.lp-nav-trigger > svg \{ transition-duration: var\(--lp-fast\); \}/.test(css),
  "the registry sets 300ms, slower than the thing it is announcing");

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
check("no motion asset is invented to sit alongside the artwork",
  !/\.mp4|\.webm|\.gif/.test(stage),
  "the messenger clip was explicitly out of scope; inventing the other three is the same mistake");
check("the stage says out loud that it is an illustration, in both languages",
  /stageDemoNote/.test(stage) &&
  /illustration/i.test(en.stageDemoNote) && /иллюстрация/i.test(ru.stageDemoNote),
  "a drawing of the product must not be mistaken for a recording of it");
/* Each demonstration has to show the thing its topic claims, not a bar. */
/**
 * The stage shows the supplied artwork now. It held drawn posters, then scenes
 * rebuilt from the platform's components; both were the product described
 * rather than shown, which is the most a page can do while it waits for
 * artwork.
 */
check("every topic has a still, and they are the supplied assets",
  ["landing-1", "landing-2", "landing-3", "landing-4"].every((n) => stage.includes(`/landing-images/${n}.jpg`)) &&
  /const STILL: Record<SectionId/.test(stage));
/**
 * The artwork is authoritative: nothing may sit in front of it. An empty
 * `VIDEO` map used to, which left the four approved states one stray filename
 * away from showing something else.
 */
check("no media slot can outrank the artwork",
  !/const VIDEO/.test(stage) && !/<video/.test(stage) && !/VIDEO\[/.test(stage),
  "the images render directly, with no precedence check in front of them");
/* The bytes are JPEG; the extension now says so. */
check("the assets are referenced by their true type",
  !/landing-images\/[a-z0-9-]+\.png/.test(stage) && !/landing-images\/[a-z0-9-]+\.png/.test(landing));
check("nothing is recreated in CSS",
  !/lp-scene|s-turn-user|s-turn-assistant/.test(stage) && !/\.lp-scene/.test(css),
  "the brief was to use the PNGs directly, not to redraw them");
/* Mixed aspect ratios in a fixed 16:10 stage: contain, never stretch or crop. */
check("the artwork is contained, not stretched or cropped",
  /\.lp-stage-img \{[\s\S]{0,200}object-fit: contain/.test(css));
/* The messenger asset belongs to the one forward-looking section and nowhere
   else — it carries a "Coming soon" badge of its own. */
check("the messenger art appears once, in the messenger section only",
  (landing.match(/landing-messenger\.jpg/g) ?? []).length === 1 &&
  !/landing-messenger/.test(stage));
check("and it is lazy, sized, and sharp on retina",
  /loading="lazy"/.test(stage) && /sizes=/.test(stage) &&
  /width=\{still\.width\}/.test(stage) && /height=\{still\.height\}/.test(stage),
  "intrinsic dimensions are what let the optimiser build a srcset");
check("and the FAQ is a real single-open accordion, shared with /faq",
  /aria-expanded=/.test(faqComponent) &&
  /\.lp-faq-a \{[\s\S]{0,160}grid-template-rows: 0fr/.test(css) &&
  /\.lp-faq-item\[data-open="true"\] \.lp-faq-a \{ grid-template-rows: 1fr/.test(css) &&
  /@\/components\/public\/Faq/.test(read("src/app/faq/page.tsx")),
  "/faq used to render a second, differently-styled answer to the same question");

/* ── report ─────────────────────────────────────────────────────────────── */

if (failures.length > 0) {
  console.error(`\n✗ ${failures.length} failed, ${passed} passed\n`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`✓ landing: ${passed} checks passed`);

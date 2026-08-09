import type { GeneratedAppV1 } from "../contract";

/**
 * Fixture 1 — an interactive chronology.
 *
 * Information architecture: a single dense workspace. Persistent left rail of
 * filters, a scrollable spine in the middle, a detail panel that fills from a
 * selection. No hero, no marketing sections, no footer — this is a tool.
 *
 * The interactions are the product: filtering by era and by thread narrows the
 * spine, selecting an entry populates the panel, and the counts update live.
 * None of this is expressible as a page schema, which is the point of the
 * fixture.
 */
export const TIMELINE_APP: GeneratedAppV1 = {
  schemaVersion: "app-1",
  metadata: {
    name: "Chronoverse",
    description: "Every entry in the saga, ordered by when it actually happened.",
    locale: "en",
  },
  runtime: { template: "react-spa", dependencies: ["react", "lucide-react", "clsx"] },
  routes: [{ path: "/", module: "src/App.tsx", title: "Chronoverse" }],
  files: {
    "src/data/entries.ts": `export interface Entry {
  id: string; title: string; year: string; era: string;
  threads: string[]; medium: "film" | "series"; blurb: string;
}

export const ERAS = ["Before the Wars", "First Assembly", "The Fracture", "After"] as const;
export const THREADS = ["Infinity Stones", "The TVA", "Multiverse", "Wakanda"] as const;

export const ENTRIES: Entry[] = [
  { id: "e1", title: "The Frozen Line", year: "1943", era: "Before the Wars", threads: ["Infinity Stones"], medium: "film",
    blurb: "A cube changes hands in a mountain facility and the century bends around it." },
  { id: "e2", title: "Signal from the Ice", year: "1945", era: "Before the Wars", threads: ["Infinity Stones"], medium: "film",
    blurb: "The first recorded loss that everyone later pretends was a victory." },
  { id: "e3", title: "Desert Prototype", year: "2008", era: "First Assembly", threads: [], medium: "film",
    blurb: "An engineer builds his way out of a cave and does not stop building." },
  { id: "e4", title: "Borrowed Thunder", year: "2011", era: "First Assembly", threads: ["Infinity Stones"], medium: "film",
    blurb: "A prince is exiled to a small town and learns the size of a small town." },
  { id: "e5", title: "The Assembly", year: "2012", era: "First Assembly", threads: ["Infinity Stones", "Multiverse"], medium: "film",
    blurb: "Six people who do not like each other agree on one afternoon." },
  { id: "e6", title: "Paper Trails", year: "2014", era: "The Fracture", threads: ["The TVA"], medium: "series",
    blurb: "A clerk notices the timestamps do not agree and files a report nobody reads." },
  { id: "e7", title: "The Fracture", year: "2018", era: "The Fracture", threads: ["Infinity Stones", "Wakanda"], medium: "film",
    blurb: "Half of everything, and the half that remains has to carry it." },
  { id: "e8", title: "Five Years", year: "2018", era: "The Fracture", threads: [], medium: "series",
    blurb: "The quiet part: what people did while waiting for something that might not come." },
  { id: "e9", title: "Branch Office", year: "2022", era: "After", threads: ["The TVA", "Multiverse"], medium: "series",
    blurb: "A bureaucracy discovers it has been pruning the wrong branches." },
  { id: "e10", title: "Doors Everywhere", year: "2023", era: "After", threads: ["Multiverse"], medium: "film",
    blurb: "Every choice that was not made turns out to have an address." },
  { id: "e11", title: "The Reclamation", year: "2024", era: "After", threads: ["Wakanda"], medium: "film",
    blurb: "A nation decides what it owes the world that ignored it." },
];
`,
    "src/components/FilterRail.tsx": `import clsx from "clsx";
import { Filter, X } from "lucide-react";
import { ERAS, THREADS } from "../data/entries";

interface Props {
  era: string | null; thread: string | null; medium: string | null;
  onEra: (v: string | null) => void;
  onThread: (v: string | null) => void;
  onMedium: (v: string | null) => void;
  onClear: () => void;
  showing: number; total: number;
}

function Group({ label, options, value, onChange }: {
  label: string; options: readonly string[]; value: string | null; onChange: (v: string | null) => void;
}) {
  return (
    <section className="group">
      <h3>{label}</h3>
      <div className="chips">
        {options.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={value === option}
            className={clsx("chip", value === option && "chip-on")}
            onClick={() => onChange(value === option ? null : option)}
          >
            {option}
          </button>
        ))}
      </div>
    </section>
  );
}

export default function FilterRail(props: Props) {
  const active = props.era || props.thread || props.medium;
  return (
    <aside className="rail">
      <header className="rail-head">
        <Filter size={15} aria-hidden="true" />
        <span>Filters</span>
        {active ? (
          <button type="button" className="clear" onClick={props.onClear}>
            <X size={13} aria-hidden="true" /> Clear
          </button>
        ) : null}
      </header>

      <p className="count">
        <strong>{props.showing}</strong> of {props.total} entries
      </p>

      <Group label="Era" options={ERAS} value={props.era} onChange={props.onEra} />
      <Group label="Thread" options={THREADS} value={props.thread} onChange={props.onThread} />
      <Group label="Medium" options={["film", "series"]} value={props.medium} onChange={props.onMedium} />
    </aside>
  );
}
`,
    "src/components/Spine.tsx": `import clsx from "clsx";
import type { Entry } from "../data/entries";

interface Props {
  entries: Entry[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function Spine({ entries, selectedId, onSelect }: Props) {
  if (entries.length === 0) {
    return (
      <div className="empty">
        <p>Nothing matches those filters.</p>
        <p className="empty-hint">Clear one and the spine fills back in.</p>
      </div>
    );
  }

  return (
    <ol className="spine">
      {entries.map((entry) => (
        <li key={entry.id}>
          <button
            type="button"
            aria-current={selectedId === entry.id}
            className={clsx("node", selectedId === entry.id && "node-on")}
            onClick={() => onSelect(entry.id)}
          >
            <span className="node-year">{entry.year}</span>
            <span className="node-body">
              <span className="node-title">{entry.title}</span>
              <span className="node-meta">
                {entry.medium}
                {entry.threads.length > 0 ? \` · \${entry.threads.join(", ")}\` : ""}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}
`,
    "src/components/DetailPanel.tsx": `import { Link2, Clapperboard, Tv } from "lucide-react";
import type { Entry } from "../data/entries";

export default function DetailPanel({ entry, onThread }: { entry: Entry | null; onThread: (t: string) => void }) {
  if (!entry) {
    return (
      <section className="detail detail-empty">
        <p>Select an entry.</p>
        <p className="detail-hint">Its threads and place in the order appear here.</p>
      </section>
    );
  }

  const Icon = entry.medium === "film" ? Clapperboard : Tv;

  return (
    <section className="detail" aria-live="polite">
      <p className="detail-year">{entry.year}</p>
      <h2>{entry.title}</h2>
      <p className="detail-medium"><Icon size={14} aria-hidden="true" /> {entry.medium}</p>
      <p className="detail-blurb">{entry.blurb}</p>

      <h4>In era</h4>
      <p className="detail-era">{entry.era}</p>

      <h4>Threads</h4>
      {entry.threads.length === 0 ? (
        <p className="detail-none">Stands alone.</p>
      ) : (
        <ul className="thread-list">
          {entry.threads.map((thread) => (
            <li key={thread}>
              <button type="button" className="thread" onClick={() => onThread(thread)}>
                <Link2 size={13} aria-hidden="true" /> {thread}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
`,
    "src/styles.css": `:root{
  --bg:#0b0c0f; --panel:#121419; --line:#23262e; --ink:#eceff4;
  --dim:#8f97a6; --accent:#e0803c; --accent-soft:rgba(224,128,60,.16);
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:15px}
button{font:inherit;color:inherit;background:none;border:0;cursor:pointer}
h1,h2,h3,h4{margin:0}

.shell{display:grid;grid-template-columns:250px minmax(0,1fr) 330px;
  min-height:100vh;align-items:stretch}
.masthead{grid-column:1/-1;display:flex;align-items:baseline;gap:14px;
  padding:20px 26px;border-bottom:1px solid var(--line);background:var(--panel)}
.masthead h1{font-family:Georgia,'Times New Roman',serif;font-size:22px;
  font-weight:400;letter-spacing:.01em}
.masthead p{margin:0;color:var(--dim);font-size:13px}

.rail{border-right:1px solid var(--line);padding:20px 18px;background:var(--panel)}
.rail-head{display:flex;align-items:center;gap:7px;font-size:12px;
  letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.clear{margin-left:auto;display:inline-flex;align-items:center;gap:4px;
  color:var(--accent);font-size:11px;letter-spacing:.06em}
.count{margin:14px 0 20px;font-size:13px;color:var(--dim)}
.count strong{color:var(--ink);font-size:19px;font-weight:700}
.group{margin-bottom:20px}
.group h3{font-size:11px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--dim);margin-bottom:8px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{border:1px solid var(--line);border-radius:999px;padding:5px 11px;
  font-size:12.5px;color:var(--dim);transition:all .16s ease}
.chip:hover{border-color:var(--accent);color:var(--ink)}
.chip-on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent)}

.stream{padding:22px 26px;overflow:auto}
.spine{list-style:none;margin:0;padding:0;position:relative}
.spine::before{content:"";position:absolute;left:62px;top:6px;bottom:6px;
  width:1px;background:var(--line)}
.spine li{position:relative}
.node{display:flex;gap:18px;width:100%;text-align:left;padding:12px 12px 12px 0;
  border-radius:8px;transition:background .16s ease}
.node:hover{background:rgba(255,255,255,.03)}
.node-on{background:var(--accent-soft)}
.node-year{width:50px;flex:none;text-align:right;color:var(--dim);
  font-variant-numeric:tabular-nums;font-size:13px;padding-top:2px}
.node-body{display:block;flex:1;min-width:0;padding-left:22px;position:relative}
.node-body::before{content:"";position:absolute;left:-5px;top:7px;width:9px;height:9px;
  border-radius:50%;background:var(--bg);border:1.5px solid var(--line)}
.node-on .node-body::before{background:var(--accent);border-color:var(--accent)}
.node-title{display:block;font-size:15.5px;font-weight:600;letter-spacing:-.01em}
.node-meta{display:block;color:var(--dim);font-size:12.5px;margin-top:2px}
.empty{padding:60px 10px;color:var(--dim)}
.empty-hint{font-size:13px;opacity:.7}

.detail{border-left:1px solid var(--line);padding:22px 22px 40px;background:var(--panel)}
.detail-empty{color:var(--dim)}
.detail-hint{font-size:13px;opacity:.7}
.detail-year{color:var(--accent);font-size:13px;letter-spacing:.12em;margin:0 0 6px}
.detail h2{font-family:Georgia,serif;font-size:26px;font-weight:400;line-height:1.15}
.detail-medium{display:flex;align-items:center;gap:6px;color:var(--dim);
  font-size:12.5px;text-transform:capitalize;margin:8px 0 0}
.detail-blurb{line-height:1.65;color:#c9cfda;margin:16px 0 22px;font-size:14.5px}
.detail h4{font-size:11px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--dim);margin:18px 0 6px}
.detail-era{margin:0;font-size:14px}
.detail-none{margin:0;color:var(--dim);font-size:14px}
.thread-list{list-style:none;margin:0;padding:0;display:flex;flex-wrap:wrap;gap:6px}
.thread{display:inline-flex;align-items:center;gap:5px;border:1px solid var(--line);
  border-radius:6px;padding:5px 9px;font-size:12.5px;color:var(--dim)}
.thread:hover{border-color:var(--accent);color:var(--accent)}

@media (max-width:1100px){
  .shell{grid-template-columns:220px minmax(0,1fr)}
  .detail{grid-column:1/-1;border-left:0;border-top:1px solid var(--line)}
}
@media (max-width:720px){
  .shell{grid-template-columns:1fr}
  .rail{border-right:0;border-bottom:1px solid var(--line)}
  .spine::before{left:52px}
  .node-year{width:42px}
}
`,
    "src/App.tsx": `import { useMemo, useState } from "react";
import FilterRail from "./components/FilterRail";
import Spine from "./components/Spine";
import DetailPanel from "./components/DetailPanel";
import { ENTRIES } from "./data/entries";
import "./styles.css";

export default function App() {
  const [era, setEra] = useState<string | null>(null);
  const [thread, setThread] = useState<string | null>(null);
  const [medium, setMedium] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>("e5");

  const visible = useMemo(
    () => ENTRIES.filter((entry) =>
      (!era || entry.era === era)
      && (!thread || entry.threads.includes(thread))
      && (!medium || entry.medium === medium)),
    [era, thread, medium],
  );

  const selected = visible.find((entry) => entry.id === selectedId)
    ?? ENTRIES.find((entry) => entry.id === selectedId)
    ?? null;

  return (
    <div className="shell">
      <header className="masthead">
        <h1>Chronoverse</h1>
        <p>Ordered by when it happened, not when it was released.</p>
      </header>

      <FilterRail
        era={era} thread={thread} medium={medium}
        onEra={setEra} onThread={setThread} onMedium={setMedium}
        onClear={() => { setEra(null); setThread(null); setMedium(null); }}
        showing={visible.length} total={ENTRIES.length}
      />

      <main className="stream">
        <Spine entries={visible} selectedId={selectedId} onSelect={setSelectedId} />
      </main>

      <DetailPanel entry={selected} onThread={setThread} />
    </div>
  );
}
`,
  },
};

import type { GeneratedAppV1 } from "../contract";

/**
 * Fixture 4 — a routed application.
 *
 * WHY THIS EXISTS, stated plainly because it is the reason a bug shipped three
 * times. The other three fixtures do not import `react-router-dom` at all. They
 * navigate with anchors, state and modals — which is legitimate for what they
 * are, and which meant that every offline test and every browser harness run
 * passed while the one library that cannot work in an opaque-origin `srcdoc`
 * document was never once exercised.
 *
 * The failure that hole concealed: the preview document's URL is
 * `about:srcdoc`, a cannot-be-a-base URL. react-router builds its own URLs with
 * `new URL(href, location.origin !== "null" ? location.origin : location.href)`,
 * so on the first navigation that becomes `new URL("/", "about:srcdoc")` and
 * throws `TypeError: "/" cannot be parsed as a URL`. `<BrowserRouter>` fails a
 * second, independent way: `history.pushState` is refused on an opaque origin,
 * and react-router's fallback is `location.assign("/…")`, which blanks the frame.
 *
 * So this fixture is deliberately the shape that breaks. It uses BOTH router
 * kinds a model might reach for, and it navigates to bare `/` — the exact value
 * in the reported error — as well as to a nested path. If the runtime ever
 * regresses, this is the fixture that goes blank.
 *
 * It is a real application rather than a test page, on the same terms as the
 * other three: a small project workspace with a sidebar, three routes, a detail
 * route with a parameter, and a not-found route.
 */
export const ROUTER_APP: GeneratedAppV1 = {
  schemaVersion: "app-1",
  metadata: {
    name: "Atlas Routes",
    description: "A small project workspace with real client-side routing.",
    locale: "en",
  },
  runtime: {
    template: "react-spa",
    dependencies: ["react", "react-router-dom", "lucide-react", "clsx"],
  },
  routes: [
    { path: "/", module: "src/App.tsx", title: "Overview" },
    { path: "/projects", module: "src/App.tsx", title: "Projects" },
    { path: "/settings", module: "src/App.tsx", title: "Settings" },
  ],
  files: {
    "src/data/projects.ts": `export interface Project {
  id: string;
  name: string;
  owner: string;
  status: "active" | "paused" | "done";
  note: string;
}

export const PROJECTS: Project[] = [
  { id: "atlas", name: "Atlas", owner: "Rin", status: "active", note: "Mapping the northern routes." },
  { id: "beacon", name: "Beacon", owner: "Sam", status: "paused", note: "Waiting on the survey data." },
  { id: "cedar", name: "Cedar", owner: "Ada", status: "done", note: "Shipped last quarter." },
];

export function findProject(id: string | undefined): Project | undefined {
  return PROJECTS.find((project) => project.id === id);
}
`,
    "src/components/Sidebar.tsx": `import { NavLink } from "react-router-dom";
import { LayoutGrid, FolderOpen, Settings } from "lucide-react";
import clsx from "clsx";

// Bare "/" is the value that appeared in the production error. It stays.
const LINKS = [
  { to: "/", label: "Overview", Icon: LayoutGrid },
  { to: "/projects", label: "Projects", Icon: FolderOpen },
  { to: "/settings", label: "Settings", Icon: Settings },
];

export default function Sidebar() {
  return (
    <nav className="sidebar" aria-label="Sections">
      <p className="mark">Atlas</p>
      {LINKS.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          className={({ isActive }) => clsx("navlink", isActive && "navlink-on")}
        >
          <Icon size={17} aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
`,
    "src/routes/Overview.tsx": `import { useNavigate, Link } from "react-router-dom";
import { PROJECTS } from "../data/projects";

export default function Overview() {
  // useNavigate to an absolute path is the other way this used to throw.
  const navigate = useNavigate();
  const active = PROJECTS.filter((project) => project.status === "active").length;

  return (
    <section className="panel">
      <h1>Overview</h1>
      <p className="lede">
        {active} of {PROJECTS.length} projects are active.
      </p>
      <div className="tiles">
        {PROJECTS.map((project) => (
          <article key={project.id} className="tile">
            <h2>{project.name}</h2>
            <p>{project.note}</p>
            <Link className="tile-link" to={"/projects/" + project.id}>
              Open {project.name}
            </Link>
          </article>
        ))}
      </div>
      <div className="row">
        <button type="button" className="btn" onClick={() => navigate("/projects")}>
          All projects
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => navigate("/")}>
          Back to start
        </button>
      </div>
    </section>
  );
}
`,
    "src/routes/Projects.tsx": `import { Link, useSearchParams } from "react-router-dom";
import { PROJECTS } from "../data/projects";

const FILTERS = ["all", "active", "paused", "done"] as const;

export default function Projects() {
  const [params, setParams] = useSearchParams();
  const filter = params.get("status") ?? "all";
  const shown = filter === "all" ? PROJECTS : PROJECTS.filter((p) => p.status === filter);

  return (
    <section className="panel">
      <h1>Projects</h1>
      <div className="chips" role="group" aria-label="Filter by status">
        {FILTERS.map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={filter === value}
            className={filter === value ? "chip chip-on" : "chip"}
            onClick={() => setParams(value === "all" ? {} : { status: value })}
          >
            {value}
          </button>
        ))}
      </div>
      <ul className="rows">
        {shown.map((project) => (
          <li key={project.id}>
            <Link to={"/projects/" + project.id}>{project.name}</Link>
            <span className={"pill pill-" + project.status}>{project.status}</span>
            <span className="owner">{project.owner}</span>
          </li>
        ))}
      </ul>
      {shown.length === 0 && <p className="lede">Nothing with that status.</p>}
    </section>
  );
}
`,
    "src/routes/ProjectDetail.tsx": `import { Link, useNavigate, useParams } from "react-router-dom";
import { findProject } from "../data/projects";

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = findProject(id);

  if (!project) {
    return (
      <section className="panel">
        <h1>Not found</h1>
        <p className="lede">No project called “{id}”.</p>
        <Link className="btn" to="/projects">Back to projects</Link>
      </section>
    );
  }

  return (
    <section className="panel">
      <h1>{project.name}</h1>
      <p className="lede">{project.note}</p>
      <dl className="facts">
        <div><dt>Owner</dt><dd>{project.owner}</dd></div>
        <div><dt>Status</dt><dd>{project.status}</dd></div>
        <div><dt>Identifier</dt><dd>{project.id}</dd></div>
      </dl>
      <div className="row">
        <button type="button" className="btn" onClick={() => navigate(-1)}>Back</button>
        <Link className="btn btn-quiet" to="/">Overview</Link>
      </div>
    </section>
  );
}
`,
    "src/routes/Settings.tsx": `import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Settings() {
  const navigate = useNavigate();
  const [notify, setNotify] = useState(true);
  const [name, setName] = useState("Atlas workspace");
  const [saved, setSaved] = useState(false);

  return (
    <section className="panel">
      <h1>Settings</h1>
      <form
        className="form"
        onSubmit={(event) => {
          event.preventDefault();
          setSaved(true);
        }}
      >
        <label className="field">
          <span>Workspace name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => setNotify(event.target.checked)}
          />
          <span>Email me when a project changes status</span>
        </label>
        <div className="row">
          <button type="submit" className="btn">Save</button>
          <button type="button" className="btn btn-quiet" onClick={() => navigate("/")}>
            Done
          </button>
        </div>
        {saved && <p className="saved" role="status">Saved.</p>}
      </form>
    </section>
  );
}
`,
    "src/App.tsx": `import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Sidebar from "./components/Sidebar";
import Overview from "./routes/Overview";
import Projects from "./routes/Projects";
import ProjectDetail from "./routes/ProjectDetail";
import Settings from "./routes/Settings";
import "./styles.css";

// BrowserRouter on purpose: it is what a model reaches for, and it is the
// component whose history writes an opaque origin refuses.
export default function App() {
  return (
    <BrowserRouter>
      <div className="shell">
        <Sidebar />
        <main className="main">
          <Routes>
            <Route path="/" element={<Overview />} />
            <Route path="/projects" element={<Projects />} />
            <Route path="/projects/:id" element={<ProjectDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route
              path="*"
              element={
                <section className="panel">
                  <h1>No such page</h1>
                  <Link className="btn" to="/">Go to overview</Link>
                </section>
              }
            />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
`,
    "src/styles.css": `:root{
  --bg:#f6f6f4;--panel:#fff;--ink:#1b1b1a;--ink-2:#5d5d58;--line:#e3e3de;
  --accent:#2f5d50;--accent-soft:#e6efeb;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font:16px/1.55 ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.shell{display:grid;grid-template-columns:232px 1fr;min-height:100vh}
.sidebar{background:var(--panel);border-right:1px solid var(--line);
  padding:22px 14px;display:flex;flex-direction:column;gap:4px}
.mark{margin:0 0 16px 10px;font-size:17px;font-weight:650;letter-spacing:-.01em}
.navlink{display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:9px;
  color:var(--ink-2);text-decoration:none;font-size:14.5px;font-weight:520}
.navlink:hover{background:#f1f1ee;color:var(--ink)}
.navlink-on{background:var(--accent-soft);color:var(--accent);font-weight:600}
.main{padding:34px 38px;min-width:0}
.panel{max-width:820px}
h1{margin:0 0 6px;font-size:26px;font-weight:640;letter-spacing:-.015em}
h2{margin:0 0 4px;font-size:16.5px;font-weight:600}
.lede{margin:0 0 20px;color:var(--ink-2);font-size:15px}
.tiles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:22px}
.tile{background:var(--panel);border:1px solid var(--line);border-radius:12px;padding:16px}
.tile p{margin:0 0 12px;color:var(--ink-2);font-size:14px}
.tile-link{color:var(--accent);font-size:14px;font-weight:560;text-decoration:none}
.tile-link:hover{text-decoration:underline}
.row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.btn{appearance:none;border:1px solid var(--accent);background:var(--accent);color:#fff;
  padding:9px 15px;border-radius:9px;font:inherit;font-size:14.5px;font-weight:560;
  cursor:pointer;text-decoration:none;display:inline-block}
.btn:hover{filter:brightness(1.07)}
.btn-quiet{background:var(--panel);color:var(--ink);border-color:var(--line)}
.chips{display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap}
.chip{appearance:none;background:var(--panel);border:1px solid var(--line);color:var(--ink-2);
  padding:6px 13px;border-radius:999px;font:inherit;font-size:13.5px;cursor:pointer}
.chip-on{background:var(--accent-soft);border-color:var(--accent);color:var(--accent);font-weight:580}
.rows{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:8px}
.rows li{display:grid;grid-template-columns:1fr auto auto;gap:14px;align-items:center;
  background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:13px 15px}
.rows a{color:var(--ink);font-weight:560;text-decoration:none;font-size:15px}
.rows a:hover{color:var(--accent)}
.pill{font-size:12.5px;padding:3px 10px;border-radius:999px;background:#f1f1ee;color:var(--ink-2)}
.pill-active{background:var(--accent-soft);color:var(--accent)}
.pill-done{background:#eceaf6;color:#4b3f7a}
.owner{font-size:13.5px;color:var(--ink-2)}
.facts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin:0 0 22px}
.facts dt{font-size:12.5px;color:var(--ink-2);margin-bottom:2px}
.facts dd{margin:0;font-size:15px;font-weight:560}
.form{display:flex;flex-direction:column;gap:15px;max-width:430px}
.field{display:flex;flex-direction:column;gap:6px;font-size:14px;color:var(--ink-2)}
.field input{padding:10px 12px;border:1px solid var(--line);border-radius:9px;
  font:inherit;font-size:16px;color:var(--ink);background:var(--panel)}
.check{display:flex;gap:9px;align-items:flex-start;font-size:14.5px;color:var(--ink-2)}
.saved{margin:0;color:var(--accent);font-size:14px;font-weight:560}
@media (max-width:760px){
  .shell{grid-template-columns:1fr}
  .sidebar{flex-direction:row;overflow-x:auto;border-right:0;border-bottom:1px solid var(--line);
    padding:12px;align-items:center}
  .mark{margin:0 10px 0 6px}
  .main{padding:22px 18px}
  .tiles,.facts{grid-template-columns:1fr}
  .rows li{grid-template-columns:1fr auto}
  .owner{display:none}
}
`,
  },
};

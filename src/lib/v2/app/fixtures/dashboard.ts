import type { GeneratedAppV1 } from "../contract";

/**
 * Fixture 2 — a product dashboard.
 *
 * Information architecture: sidebar navigation switching between views, each
 * with its own content. KPI row, a real chart, a data table, and a form that
 * validates and commits into local state.
 *
 * Deliberately nothing like the timeline: light surface, systematic sans
 * typography, tabular numbers, a grid of cards rather than a spine, and
 * navigation as the primary interaction rather than filtering.
 */
export const DASHBOARD_APP: GeneratedAppV1 = {
  schemaVersion: "app-1",
  metadata: {
    name: "Ledgerline",
    description: "Revenue, retention and payouts for a small subscription business.",
    locale: "en",
  },
  runtime: { template: "react-spa", dependencies: ["react", "recharts", "lucide-react", "clsx"] },
  routes: [{ path: "/", module: "src/App.tsx", title: "Ledgerline" }],
  files: {
    "src/data/metrics.ts": `export const MONTHLY = [
  { month: "Feb", mrr: 18200, churn: 3.1 },
  { month: "Mar", mrr: 19850, churn: 2.8 },
  { month: "Apr", mrr: 21400, churn: 3.4 },
  { month: "May", mrr: 20950, churn: 4.1 },
  { month: "Jun", mrr: 23600, churn: 2.6 },
  { month: "Jul", mrr: 26100, churn: 2.2 },
  { month: "Aug", mrr: 27450, churn: 2.4 },
];

export interface Payout { id: string; account: string; plan: string; amount: number; status: "cleared" | "pending" | "held" }

export const PAYOUTS: Payout[] = [
  { id: "p1", account: "Northwind Studio", plan: "Team", amount: 480, status: "cleared" },
  { id: "p2", account: "Halvorsen & Co", plan: "Solo", amount: 96, status: "pending" },
  { id: "p3", account: "Bright Rail", plan: "Team", amount: 480, status: "cleared" },
  { id: "p4", account: "Ostara Labs", plan: "Scale", amount: 1240, status: "held" },
  { id: "p5", account: "Corvid Press", plan: "Solo", amount: 96, status: "cleared" },
  { id: "p6", account: "Maren Fields", plan: "Team", amount: 480, status: "pending" },
];
`,
    "src/components/Sidebar.tsx": `import clsx from "clsx";
import { LayoutGrid, Receipt, UserPlus } from "lucide-react";

export type View = "overview" | "payouts" | "invite";

const ITEMS: Array<{ id: View; label: string; Icon: typeof LayoutGrid }> = [
  { id: "overview", label: "Overview", Icon: LayoutGrid },
  { id: "payouts", label: "Payouts", Icon: Receipt },
  { id: "invite", label: "Add account", Icon: UserPlus },
];

export default function Sidebar({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <nav className="side" aria-label="Sections">
      <p className="wordmark">Ledgerline</p>
      <ul>
        {ITEMS.map(({ id, label, Icon }) => (
          <li key={id}>
            <button
              type="button"
              aria-current={view === id ? "page" : undefined}
              className={clsx("nav-item", view === id && "nav-on")}
              onClick={() => onView(id)}
            >
              <Icon size={16} aria-hidden="true" />
              {label}
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
`,
    "src/components/Overview.tsx": `import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";
import { TrendingUp, TrendingDown, Users } from "lucide-react";
import { MONTHLY } from "../data/metrics";

function Kpi({ label, value, delta, up, Icon }: {
  label: string; value: string; delta: string; up: boolean; Icon: typeof Users;
}) {
  return (
    <article className="kpi">
      <header><Icon size={15} aria-hidden="true" /> {label}</header>
      <p className="kpi-value">{value}</p>
      <p className={up ? "kpi-delta up" : "kpi-delta down"}>
        {up ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
        {delta}
      </p>
    </article>
  );
}

export default function Overview() {
  const latest = MONTHLY[MONTHLY.length - 1];
  const previous = MONTHLY[MONTHLY.length - 2];
  const growth = (((latest.mrr - previous.mrr) / previous.mrr) * 100).toFixed(1);

  return (
    <>
      <div className="kpis">
        <Kpi label="MRR" value={"$" + latest.mrr.toLocaleString()} delta={growth + "% vs last month"} up Icon={TrendingUp} />
        <Kpi label="Churn" value={latest.churn + "%"} delta="0.2pt improvement" up={false} Icon={TrendingDown} />
        <Kpi label="Accounts" value="214" delta="9 added this month" up Icon={Users} />
      </div>

      <section className="panel">
        <header className="panel-head">
          <h2>Recurring revenue</h2>
          <p>Seven months, net of refunds.</p>
        </header>
        <div className="chart">
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={MONTHLY} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
              <defs>
                <linearGradient id="fill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#2f5bff" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="#2f5bff" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e6eaf1" vertical={false} />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7688" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7688" }} />
              <Tooltip contentStyle={{ borderRadius: 10, border: "1px solid #e6eaf1", fontSize: 13 }} />
              <Area type="monotone" dataKey="mrr" stroke="#2f5bff" strokeWidth={2} fill="url(#fill)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </section>
    </>
  );
}
`,
    "src/components/Payouts.tsx": `import { useState } from "react";
import clsx from "clsx";
import { PAYOUTS } from "../data/metrics";

type Status = "all" | "cleared" | "pending" | "held";
const TABS: Status[] = ["all", "cleared", "pending", "held"];

export default function Payouts() {
  const [status, setStatus] = useState<Status>("all");
  const rows = PAYOUTS.filter((p) => status === "all" || p.status === status);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Payouts</h2>
        <p>{rows.length} shown · \${total.toLocaleString()} total</p>
      </header>

      <div className="tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab} type="button" role="tab" aria-selected={status === tab}
            className={clsx("tab", status === tab && "tab-on")}
            onClick={() => setStatus(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      <table>
        <thead>
          <tr><th scope="col">Account</th><th scope="col">Plan</th><th scope="col">Status</th><th scope="col" className="num">Amount</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.account}</td>
              <td>{row.plan}</td>
              <td><span className={clsx("pill", "pill-" + row.status)}>{row.status}</span></td>
              <td className="num">\${row.amount}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 ? <p className="none">No payouts with that status.</p> : null}
    </section>
  );
}
`,
    "src/components/InviteForm.tsx": `import { useState } from "react";
import { Check } from "lucide-react";

interface Added { name: string; email: string; plan: string }

export default function InviteForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [plan, setPlan] = useState("Solo");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [added, setAdded] = useState<Added[]>([]);

  function submit(event: { preventDefault: () => void }) {
    event.preventDefault();
    const next: Record<string, string> = {};
    if (name.trim().length < 2) next.name = "Give the account a name.";
    if (!/^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$/.test(email)) next.email = "That does not look like an email address.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    setAdded([{ name: name.trim(), email: email.trim(), plan }, ...added]);
    setName(""); setEmail(""); setPlan("Solo");
  }

  return (
    <section className="panel">
      <header className="panel-head">
        <h2>Add an account</h2>
        <p>Nothing leaves this page.</p>
      </header>

      <form onSubmit={submit} noValidate>
        <label htmlFor="f-name">Account name</label>
        <input id="f-name" value={name} onChange={(e) => setName(e.target.value)}
          aria-invalid={Boolean(errors.name)} placeholder="Northwind Studio" />
        {errors.name ? <p className="err">{errors.name}</p> : null}

        <label htmlFor="f-email">Billing email</label>
        <input id="f-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
          aria-invalid={Boolean(errors.email)} placeholder="billing@example.com" />
        {errors.email ? <p className="err">{errors.email}</p> : null}

        <label htmlFor="f-plan">Plan</label>
        <select id="f-plan" value={plan} onChange={(e) => setPlan(e.target.value)}>
          <option>Solo</option><option>Team</option><option>Scale</option>
        </select>

        <button type="submit" className="submit">Add account</button>
      </form>

      {added.length > 0 ? (
        <ul className="added">
          {added.map((row, i) => (
            <li key={i}><Check size={14} aria-hidden="true" /> {row.name} · {row.email} · {row.plan}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
`,
    "src/styles.css": `:root{
  --bg:#f6f8fb; --card:#fff; --line:#e6eaf1; --ink:#101728;
  --dim:#6b7688; --accent:#2f5bff; --ok:#12805c; --warn:#a8620a; --bad:#b3261e;
}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--ink);
  font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;font-size:14.5px}
button{font:inherit;cursor:pointer}
h1,h2{margin:0}

.layout{display:grid;grid-template-columns:212px minmax(0,1fr);min-height:100vh}
.side{background:var(--card);border-right:1px solid var(--line);padding:20px 14px}
.wordmark{margin:0 0 22px 10px;font-weight:800;letter-spacing:-.02em;font-size:16px}
.side ul{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.nav-item{display:flex;align-items:center;gap:10px;width:100%;text-align:left;
  padding:9px 10px;border:0;border-radius:8px;background:none;color:var(--dim)}
.nav-item:hover{background:#f0f3f8;color:var(--ink)}
.nav-on{background:#eaefff;color:var(--accent);font-weight:600}

.main{padding:26px 30px 48px;min-width:0}
.main > header{margin-bottom:20px}
.main > header h1{font-size:24px;letter-spacing:-.025em}
.main > header p{margin:4px 0 0;color:var(--dim)}

.kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}
.kpi{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:15px 16px}
.kpi header{display:flex;align-items:center;gap:6px;color:var(--dim);font-size:12.5px}
.kpi-value{margin:8px 0 4px;font-size:26px;font-weight:750;letter-spacing:-.03em;
  font-variant-numeric:tabular-nums}
.kpi-delta{margin:0;font-size:12.5px;display:flex;align-items:center;gap:4px}
.up{color:var(--ok)} .down{color:var(--warn)}

.panel{background:var(--card);border:1px solid var(--line);border-radius:14px;
  padding:18px 18px 20px;margin-bottom:18px}
.panel-head h2{font-size:16px;letter-spacing:-.015em}
.panel-head p{margin:3px 0 14px;color:var(--dim);font-size:13px}
.chart{margin:0 -6px}

.tabs{display:flex;gap:6px;margin-bottom:12px}
.tab{border:1px solid var(--line);background:none;border-radius:999px;
  padding:5px 13px;font-size:12.5px;color:var(--dim);text-transform:capitalize}
.tab-on{background:var(--ink);border-color:var(--ink);color:#fff}

table{width:100%;border-collapse:collapse;font-size:13.5px}
th{text-align:left;font-size:11px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--dim);padding:0 10px 8px;border-bottom:1px solid var(--line)}
td{padding:11px 10px;border-bottom:1px solid var(--line)}
.num{text-align:right;font-variant-numeric:tabular-nums}
.pill{display:inline-block;padding:2px 9px;border-radius:999px;font-size:11.5px;font-weight:600}
.pill-cleared{background:#e3f5ee;color:var(--ok)}
.pill-pending{background:#fdf0dc;color:var(--warn)}
.pill-held{background:#fdeae8;color:var(--bad)}
.none{color:var(--dim);font-size:13px;padding:14px 2px 2px}

form{display:grid;gap:5px;max-width:400px}
label{font-size:12.5px;font-weight:600;margin-top:9px}
input,select{border:1px solid var(--line);border-radius:8px;padding:9px 11px;
  font:inherit;background:#fff;color:var(--ink)}
input:focus,select:focus{outline:2px solid #c3d0ff;border-color:var(--accent)}
input[aria-invalid="true"]{border-color:var(--bad)}
.err{margin:1px 0 0;color:var(--bad);font-size:12px}
.submit{margin-top:16px;justify-self:start;background:var(--accent);color:#fff;
  border:0;border-radius:9px;padding:10px 18px;font-weight:650}
.submit:hover{background:#2447d6}
.added{list-style:none;margin:18px 0 0;padding:14px 0 0;border-top:1px solid var(--line);
  display:grid;gap:7px;font-size:13.5px}
.added li{display:flex;align-items:center;gap:7px;color:var(--ok)}

@media (max-width:900px){
  .layout{grid-template-columns:1fr}
  .side{border-right:0;border-bottom:1px solid var(--line)}
  .side ul{grid-auto-flow:column;grid-auto-columns:1fr}
  .nav-item{justify-content:center}
  .kpis{grid-template-columns:1fr}
  .main{padding:20px 16px 40px}
}
`,
    "src/App.tsx": `import { useState } from "react";
import Sidebar, { type View } from "./components/Sidebar";
import Overview from "./components/Overview";
import Payouts from "./components/Payouts";
import InviteForm from "./components/InviteForm";
import "./styles.css";

const TITLES: Record<View, { title: string; sub: string }> = {
  overview: { title: "Overview", sub: "How the month is going." },
  payouts: { title: "Payouts", sub: "What is owed and what has cleared." },
  invite: { title: "Add account", sub: "Bring a customer onto a plan." },
};

export default function App() {
  const [view, setView] = useState<View>("overview");
  const heading = TITLES[view];

  return (
    <div className="layout">
      <Sidebar view={view} onView={setView} />
      <main className="main">
        <header>
          <h1>{heading.title}</h1>
          <p>{heading.sub}</p>
        </header>
        {view === "overview" ? <Overview /> : null}
        {view === "payouts" ? <Payouts /> : null}
        {view === "invite" ? <InviteForm /> : null}
      </main>
    </div>
  );
}
`,
  },
};

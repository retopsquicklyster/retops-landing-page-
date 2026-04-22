import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout, { GenerateReportButton } from "../components/DashboardLayout";
import { api } from "../lib/api";
import {
  ShieldCheck, Award, Users, MessageCircle, TrendingUp, TrendingDown,
  Bell, Bot, AlertTriangle, DatabaseZap,
} from "lucide-react";
import { toast } from "sonner";

export default function QADashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const navigate = useNavigate();

  const fetchStats = async () => {
    try {
      const r = await api.get("/dashboard/stats");
      setStats(r.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, []);

  const seedDemo = async () => {
    setSeeding(true);
    try {
      const r = await api.post("/seed-demo");
      toast.success(r.data.status === "seeded" ? `Seeded ${r.data.interactions} interactions` : "Demo data already present");
      fetchStats();
    } catch (e) {
      toast.error("Seed failed");
    } finally {
      setSeeding(false);
    }
  };

  const forceReseed = async () => {
    setSeeding(true);
    try {
      const r = await api.post("/seed-demo?force=true");
      toast.success(`Re-seeded ${r.data.interactions} interactions`);
      fetchStats();
    } finally {
      setSeeding(false);
    }
  };

  const empty = !loading && (!stats || stats.interactions_total === 0);

  return (
    <DashboardLayout
      title="QA Dashboard"
      subtitle="Monitor quality assurance metrics and agent performance"
      actions={
        <>
          <button data-testid="seed-demo-btn" onClick={seedDemo} disabled={seeding} className="btn-ghost flex items-center gap-2">
            <DatabaseZap className="w-4 h-4" /> {seeding ? "Seeding…" : "Seed demo data"}
          </button>
          <GenerateReportButton />
        </>
      }
    >
      {empty ? (
        <EmptyState onSeed={seedDemo} seeding={seeding} />
      ) : (
        <div className="space-y-6">
          <GettingStartedChecklist stats={stats} />
          {/* Top stat cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            <StatCard icon={ShieldCheck} label="QA Coverage" value={`${stats?.coverage ?? 0}%`} delta="+2.1% vs last week" positive tid="stat-coverage" />
            <StatCard icon={Award} label="Avg QA Score" value={stats?.avg_score ?? 0} delta="+1.8% vs last week" positive tid="stat-avg-score" />
            <StatCard icon={Users} label="Active Agents" value={stats?.active_agents ?? 0} delta={`${stats?.interactions_today ?? 0} today`} positive tid="stat-agents" />
            <StatCard icon={MessageCircle} label="Interactions" value={stats?.interactions_total ?? 0} delta={`${stats?.interactions_today ?? 0} in last 24h`} positive tid="stat-interactions" />
          </div>

          {/* Revenue at risk row */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.1fr,0.9fr] gap-5">
            <div className="ret-card p-6" data-testid="card-revenue-risk">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))]">Revenue at risk</p>
                  <p className="stat-num mt-2">${(stats?.total_arr_at_risk ?? 0).toLocaleString()}</p>
                  <p className="text-sm text-[hsl(var(--ink-2))] mt-1">
                    Across <strong>{stats?.at_risk_accounts ?? 0}</strong> at-risk accounts
                  </p>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-red-50 grid place-items-center">
                  <TrendingDown className="w-6 h-6 text-red-500" />
                </div>
              </div>
              <hr className="my-5" />
              <div className="grid grid-cols-2 gap-6">
                <AiHumanCompare ai={stats?.ai_avg ?? 0} human={stats?.human_avg ?? 0} />
                <div>
                  <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))] mb-3">Score distribution</p>
                  <DistBar label="90-100 (Excellent)" pct={pct(stats?.score_distribution?.["90-100"], stats?.interactions_total)} color="#10b981" />
                  <DistBar label="80-89 (Good)" pct={pct(stats?.score_distribution?.["80-89"], stats?.interactions_total)} color="#3b82f6" />
                  <DistBar label="70-79 (Fair)" pct={pct(stats?.score_distribution?.["70-79"], stats?.interactions_total)} color="#f59e0b" />
                  <DistBar label="Below 70" pct={pct(stats?.score_distribution?.["<70"], stats?.interactions_total)} color="#ef4444" />
                </div>
              </div>
            </div>

            <div className="ret-card p-6" data-testid="card-top-agents">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display text-lg font-semibold">Top performing agents</h3>
                <Award className="w-4 h-4 text-[hsl(var(--ink-3))]" />
              </div>
              <div className="space-y-2">
                {(stats?.top_agents || []).map((a, i) => (
                  <div key={a.agent} className="flex items-center gap-3 py-2.5 rounded-lg hover:bg-[hsl(var(--bg-subtle))] px-2 transition-colors">
                    <span className="w-7 h-7 rounded-full bg-[hsl(var(--brand-100))] text-[hsl(var(--brand-ink))] text-xs font-bold grid place-items-center">
                      {i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-semibold">{a.agent} {a.type === "AI" && <span className="pill pill-info" style={{ padding: "1px 6px", fontSize: 10 }}>AI</span>}</p>
                      <p className="text-xs text-[hsl(var(--ink-3))]">{a.count} interactions</p>
                    </div>
                    <span className="font-mono font-bold text-sm">{a.avg_score}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Alerts */}
          <div className="ret-card p-6" data-testid="card-alerts">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-[hsl(var(--brand))]" /> Live alerts
              </h3>
              <span className="text-xs text-[hsl(var(--ink-3))]">{stats?.alerts?.length || 0} signals</span>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {(stats?.alerts || []).map((a, i) => (
                <div
                  key={i}
                  onClick={() => a.interaction_id && navigate(`/dashboard/interactions/${a.interaction_id}`)}
                  className="flex items-start gap-3 p-4 rounded-xl border border-[hsl(var(--line))] hover:border-[hsl(var(--brand-200))] cursor-pointer transition-colors"
                  data-testid={`alert-${i}`}
                >
                  <AlertIcon type={a.type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`pill ${pillFor(a.severity)}`} style={{ padding: "2px 8px", fontSize: 10 }}>{a.type}</span>
                      <span className="text-xs text-[hsl(var(--ink-3))] font-mono">{fmtTime(a.created_at)}</span>
                    </div>
                    <p className="text-sm font-semibold mt-1.5">{a.title}</p>
                    <p className="text-xs text-[hsl(var(--ink-2))] mt-0.5 truncate">{a.note}</p>
                  </div>
                </div>
              ))}
              {(!stats?.alerts || stats.alerts.length === 0) && (
                <p className="text-sm text-[hsl(var(--ink-3))]">No alerts in the last 24h.</p>
              )}
            </div>
          </div>

          {/* Recent Interactions */}
          <div className="ret-card overflow-hidden" data-testid="recent-interactions">
            <div className="flex items-center justify-between p-5 pb-0">
              <h3 className="font-display text-lg font-semibold">Recent Interactions</h3>
              <button onClick={() => navigate("/dashboard/interactions")} className="text-sm font-semibold text-[hsl(var(--brand))] hover:underline" data-testid="view-all-btn">
                View All
              </button>
            </div>
            <table className="w-full text-sm mt-4">
              <thead className="bg-[hsl(var(--bg-subtle))]">
                <tr className="text-xs text-[hsl(var(--ink-3))] uppercase tracking-wider text-left">
                  <th className="px-5 py-3 font-semibold">Agent</th>
                  <th className="px-5 py-3 font-semibold">Customer</th>
                  <th className="px-5 py-3 font-semibold text-center">QA Score</th>
                  <th className="px-5 py-3 font-semibold">Status</th>
                  <th className="px-5 py-3 font-semibold">Time</th>
                  <th className="px-5 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {(stats?.recent_interactions || []).map((r) => (
                  <tr key={r.interaction_id} className="border-t border-[hsl(var(--line-2))] hover:bg-[hsl(var(--bg-subtle))] cursor-pointer"
                      onClick={() => navigate(`/dashboard/interactions/${r.interaction_id}`)}
                      data-testid={`recent-${r.interaction_id}`}>
                    <td className="px-5 py-3.5 font-semibold">{r.agent}</td>
                    <td className="px-5 py-3.5 text-[hsl(var(--ink-2))]">{r.customer}</td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex w-11 h-7 rounded-md items-center justify-center font-mono font-bold text-xs ${scoreBadge(r.qa_score)}`}>
                        {r.qa_score}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`pill ${r.status === "Needs Coaching" ? "pill-warn" : "pill-ok"}`}>{r.status}</span>
                    </td>
                    <td className="px-5 py-3.5 text-[hsl(var(--ink-3))] font-mono text-xs">{fmtAgo(r.created_at)}</td>
                    <td className="px-5 py-3.5 text-right">
                      {r.status === "Needs Coaching" && (
                        <button onClick={(e) => { e.stopPropagation(); toast.info(`Alert sent to ${r.agent}'s supervisor`); }}
                                data-testid={`send-alert-${r.interaction_id}`}
                                className="btn-primary !py-1.5 !px-3 text-xs">
                          Send Alert
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {(!stats?.recent_interactions || stats.recent_interactions.length === 0) && (
                  <tr><td colSpan="6" className="px-5 py-8 text-center text-[hsl(var(--ink-3))]">No interactions yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Danger zone for demo */}
          <div className="flex justify-end">
            <button data-testid="reseed-btn" onClick={forceReseed} disabled={seeding} className="text-xs text-[hsl(var(--ink-3))] underline underline-offset-4 hover:text-[hsl(var(--ink))]">
              Reset & re-seed demo
            </button>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

const pct = (n, total) => (total ? Math.round((n / total) * 100) : 0);

const scoreBadge = (s) => s >= 90 ? "bg-emerald-100 text-emerald-700" : s >= 80 ? "bg-blue-100 text-blue-700" : s >= 70 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700";
const fmtAgo = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} mins ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hrs ago`;
  return `${Math.round(hrs / 24)} days ago`;
};

const StatCard = ({ icon: Icon, label, value, delta, positive, tid }) => (
  <div className="ret-card p-5" data-testid={tid}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))]">{label}</p>
        <p className="stat-num mt-3">{value}</p>
      </div>
      <div className="w-10 h-10 rounded-xl bg-[hsl(var(--brand-100))] grid place-items-center text-[hsl(var(--brand))]">
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <p className={`text-xs mt-4 flex items-center gap-1 ${positive ? "text-emerald-600" : "text-red-500"}`}>
      <TrendingUp className="w-3 h-3" /> {delta}
    </p>
  </div>
);

const DistBar = ({ label, pct, color }) => (
  <div className="mb-2.5">
    <div className="flex justify-between text-xs mb-1">
      <span className="text-[hsl(var(--ink-2))]">{label}</span>
      <span className="font-mono font-semibold">{pct}%</span>
    </div>
    <div className="progress-rail">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  </div>
);

const AiHumanCompare = ({ ai, human }) => (
  <div>
    <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))] mb-3">AI vs Human</p>
    <div className="space-y-3">
      <div>
        <div className="flex justify-between text-xs mb-1"><span>Human avg</span><span className="font-mono font-semibold">{human}</span></div>
        <div className="progress-rail"><div className="progress-fill" style={{ width: `${human}%`, background: "hsl(var(--brand))" }} /></div>
      </div>
      <div>
        <div className="flex justify-between text-xs mb-1"><span>AI avg</span><span className="font-mono font-semibold">{ai}</span></div>
        <div className="progress-rail"><div className="progress-fill" style={{ width: `${ai}%`, background: "#3b82f6" }} /></div>
      </div>
    </div>
  </div>
);

const AlertIcon = ({ type }) => {
  const map = { Churn: TrendingDown, QA: AlertTriangle, AI: Bot, Upsell: TrendingUp };
  const Ic = map[type] || AlertTriangle;
  const color = type === "Upsell" ? "text-emerald-600 bg-emerald-50" : "text-amber-600 bg-amber-50";
  return <div className={`w-8 h-8 rounded-lg grid place-items-center ${color}`}><Ic className="w-4 h-4" /></div>;
};

const pillFor = (sev) => sev === "High" ? "pill-danger" : sev === "Info" ? "pill-info" : "pill-warn";
const fmtTime = (iso) => {
  if (!iso) return "";
  try { return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); } catch { return ""; }
};

const EmptyState = ({ onSeed, seeding }) => (
  <div className="ret-card p-12 text-center" data-testid="empty-state">
    <div className="w-16 h-16 mx-auto rounded-2xl bg-[hsl(var(--brand-100))] grid place-items-center text-[hsl(var(--brand))]">
      <DatabaseZap className="w-7 h-7" />
    </div>
    <h3 className="font-display text-2xl font-semibold mt-5">Welcome to your RetOps workspace</h3>
    <p className="text-[hsl(var(--ink-2))] mt-2 max-w-lg mx-auto">
      Load a set of demo interactions to see QA scoring, churn risk detection, AI hallucination flags, and coaching cards in action.
    </p>
    <button data-testid="empty-seed-btn" onClick={onSeed} disabled={seeding} className="btn-primary mt-6">
      {seeding ? "Loading demo data…" : "Load demo data"}
    </button>
  </div>
);


const GettingStartedChecklist = ({ stats }) => {
  const [dismissed, setDismissed] = useState(() => localStorage.getItem("retops_checklist_dismissed") === "1");
  const steps = [
    { id: "upload",   label: "Upload your first transcript",  done: (stats?.interactions_total || 0) > 0, to: "/dashboard/upload" },
    { id: "bulk",     label: "Try bulk scoring with the Urban Flavours sample", done: (stats?.interactions_total || 0) > 6, to: "/dashboard/bulk" },
    { id: "exec",     label: "Review the Executive dashboard",  done: (stats?.interactions_total || 0) > 0, to: "/dashboard/executive" },
    { id: "coaching", label: "Complete a coaching card",        done: (stats?.coaching_completed || 0) > 0, to: "/dashboard/coaching" },
    { id: "digest",   label: "Preview the Weekly Digest email", done: false, to: "/dashboard/digest" },
  ];
  const complete = steps.filter((s) => s.done).length;
  if (dismissed || complete === steps.length) return null;
  return (
    <div className="ret-card p-5 border-[hsl(var(--retops-teal))]/40" data-testid="getting-started">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-[hsl(var(--retops-teal))]">Get started · {complete}/{steps.length}</p>
          <h3 className="font-display text-xl font-semibold text-[hsl(var(--retops-navy))]">Your first 5 minutes with RetOps</h3>
        </div>
        <button onClick={() => { localStorage.setItem("retops_checklist_dismissed", "1"); setDismissed(true); }} data-testid="gs-dismiss" className="text-xs text-[hsl(var(--ink-3))] hover:text-[hsl(var(--ink))]">Dismiss</button>
      </div>
      <ul className="mt-4 grid md:grid-cols-5 gap-2">
        {steps.map((s) => (
          <li key={s.id}>
            <a href={s.to} className={`block p-3 rounded-xl border text-sm transition-colors ${s.done ? "bg-emerald-50 border-emerald-100 text-emerald-700" : "bg-white border-[hsl(var(--line))] hover:border-[hsl(var(--retops-teal))] text-[hsl(var(--ink))]"}`}>
              <span className="mr-1">{s.done ? "✓" : "→"}</span>{s.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

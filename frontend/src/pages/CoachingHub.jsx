import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { GraduationCap, ArrowUpRight, Users, CheckCircle2, Award, BookOpen, Plus, Send, Trophy, History, Video, BookMarked } from "lucide-react";
import { toast } from "sonner";

const TABS = [
  { id: "overview",  label: "Overview",        icon: GraduationCap },
  { id: "modules",   label: "Training Modules", icon: BookOpen },
  { id: "leaderboard", label: "Leaderboard",   icon: Trophy },
  { id: "recent",    label: "Recent Activity",  icon: History },
];

export default function CoachingHub() {
  const [cards, setCards] = useState([]);
  const [tab, setTab] = useState("overview");
  const [dataMode, setDataMode] = useState("demo");
  const [liveKpis, setLiveKpis] = useState(null);
  const navigate = useNavigate();

  useEffect(() => { api.get("/coaching").then((r) => setCards(r.data)); }, []);
  useEffect(() => {
    if (dataMode === "live" && !liveKpis) {
      api.get("/coaching/kpis").then((r) => setLiveKpis(r.data)).catch(() => {});
    }
  }, [dataMode, liveKpis]);

  const live = dataMode === "live" && liveKpis;
  const kpi = {
    learners:    live ? liveKpis.active_learners         : 156,
    completion:  live ? `${liveKpis.completion_rate_pct}%` : "87%",
    improvement: live ? `${liveKpis.avg_score_improvement >= 0 ? "+" : ""}${liveKpis.avg_score_improvement}` : "+8.3",
    modules:     live ? liveKpis.total_modules           : 24,
  };

  return (
    <DashboardLayout
      title="Coaching Hub"
      subtitle="Personalized learning and development platform"
      actions={
        <>
          <div className="hidden md:inline-flex items-center bg-white border border-[hsl(var(--line))] rounded-full p-0.5" data-testid="coaching-mode-toggle">
            {["demo", "live"].map((m) => (
              <button key={m} onClick={() => setDataMode(m)} data-testid={`mode-${m}`}
                className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-colors ${dataMode === m ? "bg-[hsl(var(--retops-navy))] text-white" : "text-[hsl(var(--ink-2))]"}`}>
                {m === "live" ? "Live data" : "Demo"}
              </button>
            ))}
          </div>
          <button data-testid="create-module-btn" onClick={() => toast.info("Module creator — coming soon")} className="btn-ghost flex items-center gap-2"><Plus className="w-4 h-4" /> Create Module</button>
          <button data-testid="assign-training-btn" onClick={() => toast.info("Training assigner — coming soon")} className="btn-primary flex items-center gap-2"><Send className="w-4 h-4" /> Assign Training</button>
        </>
      }
    >
      {/* KPI strip */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-5">
        <HubKpi icon={Users}        label="Active Learners"        value={kpi.learners}    delta={live ? "from seeded agents" : "+12% this week"}  color="bg-blue-50 text-blue-600" tid="hub-learners" />
        <HubKpi icon={CheckCircle2} label="Completion Rate"        value={kpi.completion}  delta={live ? "coaching cards triggered" : "+5% this month"}  color="bg-emerald-50 text-emerald-600" tid="hub-completion" />
        <HubKpi icon={Award}        label="Avg. Score Improvement" value={kpi.improvement} delta={live ? "newest vs oldest half" : "+2.1 points"} color="bg-amber-50 text-amber-600" tid="hub-improvement" />
        <HubKpi icon={BookOpen}     label="Total Modules"          value={kpi.modules}     delta={live ? "unique coaching headlines" : "3 new this week"} color="bg-purple-50 text-purple-600" tid="hub-modules" />
      </div>

      {/* Tabs */}
      <div className="ret-card p-6" data-testid="coaching-tabs-card">
        <div className="flex border-b border-[hsl(var(--line-2))] -mx-6 px-6 -mt-6 pt-6 mb-6 gap-6 overflow-x-auto">
          {TABS.map((t) => (
            <button
              key={t.id}
              data-testid={`tab-${t.id}`}
              onClick={() => setTab(t.id)}
              className={`pb-3 flex items-center gap-2 text-sm font-semibold transition-colors ${tab === t.id ? "text-[hsl(var(--retops-navy))] border-b-2 border-[hsl(var(--retops-navy))] -mb-px" : "text-[hsl(var(--ink-3))] hover:text-[hsl(var(--ink-2))]"}`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {tab === "overview" && <Overview />}
        {tab === "modules" && <ModulesList cards={cards} navigate={navigate} />}
        {tab === "leaderboard" && <Leaderboard />}
        {tab === "recent" && <RecentActivity cards={cards} navigate={navigate} />}
      </div>
    </DashboardLayout>
  );
}

const HubKpi = ({ icon: Icon, label, value, delta, color, tid }) => (
  <div className="ret-card p-5" data-testid={tid}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))]">{label}</p>
        <p className="kpi-num mt-3">{value}</p>
      </div>
      <div className={`w-10 h-10 rounded-xl grid place-items-center ${color}`}><Icon className="w-5 h-5" /></div>
    </div>
    <p className="text-xs mt-4 text-emerald-600 tabular-nums">↗ {delta}</p>
  </div>
);

const Overview = () => (
  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="coaching-overview">
    <div>
      <h4 className="font-display text-lg font-semibold mb-4">Learning Progress</h4>
      <div className="space-y-3">
        {[
          { title: "Customer Service Fundamentals", meta: "8 modules · 4 hours", pct: 75 },
          { title: "Advanced Communication",        meta: "6 modules · 3 hours", pct: 45 },
          { title: "Conflict De-escalation",        meta: "5 modules · 2.5 hours", pct: 30 },
        ].map((m) => (
          <div key={m.title} className="p-4 rounded-xl border border-[hsl(var(--line-2))]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{m.title}</p>
                <p className="text-xs text-[hsl(var(--ink-3))] tabular-nums">{m.meta}</p>
              </div>
              <p className="text-sm font-semibold text-[hsl(var(--ink-2))] tabular-nums">{m.pct}% Complete</p>
            </div>
            <div className="h-1.5 mt-3 bg-[hsl(var(--line-2))] rounded-full overflow-hidden">
              <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: "hsl(var(--retops-teal))" }} />
            </div>
          </div>
        ))}
      </div>
    </div>

    <div>
      <h4 className="font-display text-lg font-semibold mb-4">Recommended for You</h4>
      <div className="space-y-3">
        {[
          { icon: Video,       title: "Handling Difficult Customers", sub: "Based on your recent QA scores", color: "bg-blue-50 text-blue-600" },
          { icon: BookMarked,  title: "Product Knowledge Update",     sub: "New features and policies",     color: "bg-emerald-50 text-emerald-600" },
          { icon: Trophy,      title: "Objection Handling Mastery",   sub: "Improve your close rate",       color: "bg-amber-50 text-amber-600" },
        ].map((r) => (
          <div key={r.title} className="p-4 rounded-xl border border-[hsl(var(--line-2))] flex items-center gap-3 hover:border-[hsl(var(--brand-200))] cursor-pointer transition-colors">
            <div className={`w-10 h-10 rounded-xl grid place-items-center ${r.color}`}><r.icon className="w-5 h-5" /></div>
            <div className="flex-1">
              <p className="text-sm font-semibold">{r.title}</p>
              <p className="text-xs text-[hsl(var(--ink-3))]">{r.sub}</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-[hsl(var(--ink-3))]" />
          </div>
        ))}
      </div>
    </div>
  </div>
);

const ModulesList = ({ cards, navigate }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" data-testid="coaching-grid">
    {cards.map((c) => (
      <div key={c.interaction_id} className="ret-card p-5 cursor-pointer hover:border-[hsl(var(--brand-200))] transition-colors" onClick={() => navigate(`/dashboard/interactions/${c.interaction_id}`)} data-testid={`coach-${c.interaction_id}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--brand-100))] text-[hsl(var(--brand))] grid place-items-center"><GraduationCap className="w-5 h-5" /></div>
            <div>
              <p className="text-sm font-semibold">{c.agent}</p>
              <p className="text-xs text-[hsl(var(--ink-3))]">{c.customer} · Score {c.qa_score}</p>
            </div>
          </div>
          <ArrowUpRight className="w-4 h-4 text-[hsl(var(--ink-3))]" />
        </div>
        <p className="font-display text-lg font-semibold mt-4 leading-snug">{c.headline}</p>
        {c.growth_areas?.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Growth areas</p>
            <ul className="text-sm text-[hsl(var(--ink-2))] list-disc list-inside space-y-0.5">
              {c.growth_areas.slice(0, 3).map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>
        )}
      </div>
    ))}
    {cards.length === 0 && <p className="text-sm text-[hsl(var(--ink-3))]">No coaching cards yet. Upload an interaction or seed demo data.</p>}
  </div>
);

const Leaderboard = () => (
  <div data-testid="coaching-leaderboard">
    <table className="w-full text-sm">
      <thead className="text-xs text-[hsl(var(--ink-3))] uppercase tracking-wider text-left">
        <tr><th className="pb-3">Rank</th><th className="pb-3">Agent</th><th className="pb-3 text-right">Score improvement</th><th className="pb-3 text-right">Modules completed</th><th className="pb-3 text-right">Streak</th></tr>
      </thead>
      <tbody>
        {[
          { rank: 1, agent: "Emma Davis",     delta: "+12.4", modules: 18, streak: 42 },
          { rank: 2, agent: "Sarah Johnson",  delta: "+9.8",  modules: 15, streak: 28 },
          { rank: 3, agent: "Alex Rodriguez", delta: "+8.1",  modules: 12, streak: 21 },
          { rank: 4, agent: "Mike Chen",      delta: "+6.2",  modules: 11, streak: 14 },
          { rank: 5, agent: "Priya Sharma",   delta: "+5.9",  modules: 10, streak: 9  },
        ].map((r) => (
          <tr key={r.rank} className="border-t border-[hsl(var(--line-2))]">
            <td className="py-3 tabular-nums"><span className="w-7 h-7 inline-grid place-items-center rounded-full bg-[hsl(var(--brand-100))] text-[hsl(var(--brand-ink))] text-xs font-bold">{r.rank}</span></td>
            <td className="py-3 font-semibold">{r.agent}</td>
            <td className="py-3 text-right font-bold text-emerald-600 tabular-nums">{r.delta}</td>
            <td className="py-3 text-right tabular-nums">{r.modules}</td>
            <td className="py-3 text-right tabular-nums">{r.streak} days</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const RecentActivity = ({ cards, navigate }) => (
  <div data-testid="coaching-recent">
    <ul className="space-y-2">
      {cards.slice(0, 10).map((c) => (
        <li key={c.interaction_id} onClick={() => navigate(`/dashboard/interactions/${c.interaction_id}`)} className="flex items-center justify-between p-3 rounded-xl border border-[hsl(var(--line-2))] hover:border-[hsl(var(--brand-200))] cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[hsl(var(--brand-100))] text-[hsl(var(--brand))] grid place-items-center"><GraduationCap className="w-4 h-4" /></div>
            <div>
              <p className="text-sm font-semibold">{c.agent}</p>
              <p className="text-xs text-[hsl(var(--ink-3))]">{c.headline}</p>
            </div>
          </div>
          <span className="text-xs tabular-nums text-[hsl(var(--ink-3))]">Score {c.qa_score}</span>
        </li>
      ))}
      {cards.length === 0 && <p className="text-sm text-[hsl(var(--ink-3))]">No activity yet.</p>}
    </ul>
  </div>
);

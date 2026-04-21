import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { TrendingDown, AlertTriangle, Sparkles, TrendingUp, DollarSign } from "lucide-react";

export default function ExecutiveView() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    api.get("/dashboard/stats").then(r => setStats(r.data));
  }, []);

  return (
    <DashboardLayout
      title="Executive View"
      subtitle="One-page view of quality posture, revenue at risk, and operational priorities"
    >
      <div className="brand-gradient-ink grid-dot rounded-2xl p-8 text-white mb-6" data-testid="exec-hero">
        <div className="flex items-center justify-between text-xs uppercase tracking-[0.2em] text-emerald-200/70">
          <span>Command overview</span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live · last 7 days
          </span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mt-7">
          <ExecStat label="Revenue at risk" value={`$${((stats?.total_arr_at_risk ?? 0) / 1000).toFixed(1)}K`} foot={`${stats?.at_risk_accounts ?? 0} accounts`} danger />
          <ExecStat label="Avg QA score" value={stats?.avg_score ?? 0} foot="Across all interactions" />
          <ExecStat label="Trust score" value={`${stats && stats.interactions_total ? Math.min(99, 80 + (stats.avg_score / 20)).toFixed(1) : 0}%`} foot="AI-human agreement" />
          <ExecStat label="QA coverage" value={`${stats?.coverage ?? 0}%`} foot={`${stats?.interactions_total ?? 0} scored`} ok />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-5">
        <div className="ret-card p-6" data-testid="exec-alerts">
          <h3 className="font-display text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[hsl(var(--brand))]" /> Priority signals
          </h3>
          <div className="space-y-3">
            {(stats?.alerts || []).slice(0, 8).map((a, i) => (
              <div key={i} className="flex items-start gap-3 py-3 border-b border-[hsl(var(--line-2))] last:border-0">
                <Icon type={a.type} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{a.title}</p>
                  <p className="text-xs text-[hsl(var(--ink-2))]">{a.note}</p>
                </div>
                <span className={`pill ${a.severity === "High" ? "pill-danger" : a.severity === "Info" ? "pill-info" : "pill-warn"}`} style={{ padding: "2px 8px", fontSize: 10 }}>{a.type}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="ret-card p-6" data-testid="exec-agents">
          <h3 className="font-display text-lg font-semibold mb-4">Agent performance</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-[hsl(var(--ink-3))] uppercase tracking-wider">
                <th className="text-left font-medium py-2">Agent</th>
                <th className="text-left font-medium py-2">Type</th>
                <th className="text-right font-medium py-2">Score</th>
                <th className="text-right font-medium py-2">#</th>
              </tr>
            </thead>
            <tbody>
              {(stats?.top_agents || []).map((a) => (
                <tr key={a.agent} className="border-t border-[hsl(var(--line-2))]">
                  <td className="py-2.5 font-medium">{a.agent}</td>
                  <td className="py-2.5"><span className={`pill ${a.type === "AI" ? "pill-info" : "pill-neutral"}`} style={{ padding: "1px 8px", fontSize: 10 }}>{a.type}</span></td>
                  <td className="py-2.5 text-right font-mono font-semibold">{a.avg_score}</td>
                  <td className="py-2.5 text-right font-mono text-[hsl(var(--ink-3))]">{a.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DashboardLayout>
  );
}

const ExecStat = ({ label, value, foot, ok, danger }) => (
  <div>
    <p className="text-[11px] uppercase tracking-widest text-emerald-200/60">{label}</p>
    <p className="font-display text-[34px] font-semibold mt-2">{value}</p>
    <p className={`text-xs mt-1 ${danger ? "text-red-300" : ok ? "text-emerald-300" : "text-emerald-200/70"}`}>{foot}</p>
  </div>
);

const Icon = ({ type }) => {
  const map = { Churn: TrendingDown, QA: AlertTriangle, AI: Sparkles, Upsell: TrendingUp };
  const Ic = map[type] || DollarSign;
  return <div className="w-8 h-8 rounded-lg bg-[hsl(var(--brand-100))] text-[hsl(var(--brand))] grid place-items-center flex-none"><Ic className="w-4 h-4" /></div>;
};

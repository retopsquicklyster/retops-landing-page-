import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import ShareResultModal from "../components/ShareResultModal";
import { api } from "../lib/api";
import {
  DollarSign, Target, TrendingUp, Users, AlertTriangle, Share2, Download,
} from "lucide-react";

export default function ExecutiveView() {
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [range, setRange] = useState("30d");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get("/executive/overview"), api.get("/dashboard/stats")])
      .then(([o, s]) => { setData(o.data); setStats(s.data); });
  }, []);

  const bi = data?.business_impact || {};

  return (
    <DashboardLayout
      title="Executive Dashboard"
      subtitle="Strategic insights and business impact metrics"
      actions={
        <>
          <select data-testid="range-select" value={range} onChange={(e) => setRange(e.target.value)}
            className="btn-ghost !py-2 bg-white border border-[hsl(var(--line))] pr-8">
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
          <button data-testid="share-result-btn" onClick={() => setShareOpen(true)} className="btn-gold flex items-center gap-2">
            <Share2 className="w-4 h-4" /> Share result
          </button>
          <button data-testid="exec-export-btn" onClick={() => window.print()} className="btn-ghost flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Report
          </button>
        </>
      }
    >
      {/* Top stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <ExecKpi icon={DollarSign} label="QA ROI" value={fmtMoney(bi.qa_roi)} delta="+18.5%" caption="Revenue impact from QA improvements" tid="kpi-roi" />
        <ExecKpi icon={Target} label="Customer Satisfaction" value={`${bi.csat_pct ?? 0}%`} delta="+5.8%" caption="Overall CSAT score improvement" tid="kpi-csat" />
        <ExecKpi icon={TrendingUp} label="Agent Productivity" value={`+${bi.agent_productivity_delta ?? 0}%`} delta="+4.2%" caption="Efficiency gains from coaching" tid="kpi-productivity" />
        <ExecKpi icon={Users} label="Cost Savings" value={fmtMoney(bi.cost_savings)} delta="+12.3%" caption="Reduced training and turnover costs" tid="kpi-savings" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mt-5">
        {/* Business Impact */}
        <div className="ret-card p-6" data-testid="business-impact">
          <h3 className="font-display text-lg font-semibold mb-4">Business Impact</h3>
          <div className="space-y-3">
            <ImpactRow
              title="Customer Retention"
              subtitle={`${bi.customer_retention?.from ?? 0}% → ${bi.customer_retention?.to ?? 0}%`}
              value={`+$${((bi.customer_retention?.arr_gain ?? 0) / 1000).toFixed(0)}K ARR`}
              color="text-emerald-600"
            />
            <ImpactRow
              title="First Call Resolution"
              subtitle={`${bi.first_call_resolution?.from ?? 0}% → ${bi.first_call_resolution?.to ?? 0}%`}
              value={`-$${Math.abs((bi.first_call_resolution?.cost_delta ?? 0) / 1000).toFixed(0)}K costs`}
              color="text-blue-600"
            />
            <ImpactRow
              title="Average Handle Time"
              subtitle={`${bi.avg_handle_time?.from ?? ""} → ${bi.avg_handle_time?.to ?? ""}`}
              value={`+${bi.avg_handle_time?.capacity_delta_pct ?? 0}% capacity`}
              color="text-purple-600"
            />
            <ImpactRow
              title="Agent Turnover"
              subtitle={`${bi.agent_turnover?.from ?? 0}% → ${bi.agent_turnover?.to ?? 0}%`}
              value={`-$${Math.abs((bi.agent_turnover?.cost_delta ?? 0) / 1000).toFixed(0)}K costs`}
              color="text-orange-600"
            />
          </div>
        </div>

        {/* Department Performance */}
        <div className="ret-card p-6" data-testid="department-performance">
          <h3 className="font-display text-lg font-semibold mb-4">Department Performance</h3>
          <div className="space-y-3">
            {(data?.departments || []).map((d) => (
              <div key={d.department} className="flex items-center justify-between p-4 rounded-xl border border-[hsl(var(--line-2))] hover:border-[hsl(var(--brand-200))] transition-colors" data-testid={`dept-${d.department}`}>
                <div>
                  <p className="text-sm font-semibold">{d.department}</p>
                  <p className="text-xs text-[hsl(var(--ink-3))]">{d.agents} agents</p>
                </div>
                <div className="text-right">
                  <p className="font-display text-2xl font-semibold">{d.avg_score}</p>
                  <p className={`text-xs font-mono ${d.delta_pct >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                    {d.delta_pct >= 0 ? "↗" : "↘"} {d.delta_pct >= 0 ? "+" : ""}{d.delta_pct}%
                  </p>
                </div>
              </div>
            ))}
            {(!data?.departments || data.departments.length === 0) && (
              <p className="text-sm text-[hsl(var(--ink-3))]">Load demo data to populate departments.</p>
            )}
          </div>
        </div>
      </div>

      {/* Risk Alerts */}
      <div className="ret-card p-6 mt-5" data-testid="risk-alerts-exec">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-display text-lg font-semibold">Risk Alerts & Action Items</h3>
          <span className="text-xs text-[hsl(var(--ink-3))]">{data?.risk_alerts?.length || 0} active alerts</span>
        </div>
        <div className="space-y-3">
          {(data?.risk_alerts || []).map((a, i) => (
            <div key={i} className={`p-5 rounded-xl border ${riskBg(a.severity)} flex items-start justify-between gap-4`}>
              <div className="flex gap-4 items-start flex-1 min-w-0">
                <AlertTriangle className={`w-5 h-5 flex-none mt-0.5 ${riskIconColor(a.severity)}`} />
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs font-bold uppercase tracking-wider ${riskIconColor(a.severity)}`}>{a.severity}</span>
                    <span className="text-sm font-semibold">{a.department}</span>
                  </div>
                  <p className="text-sm mt-1.5 font-medium">{a.title}</p>
                  <p className="text-xs text-[hsl(var(--ink-2))] mt-0.5">{a.note}</p>
                  <p className="text-xs mt-1.5"><span className="font-semibold">Recommended Action:</span> {a.recommended_action}</p>
                </div>
              </div>
              <button
                onClick={() => a.interaction_id && navigate(`/dashboard/interactions/${a.interaction_id}`)}
                className="btn-ghost !py-2 !px-3 text-xs bg-white flex-none"
                data-testid={`take-action-${i}`}
              >
                Take Action
              </button>
            </div>
          ))}
          {(!data?.risk_alerts || data.risk_alerts.length === 0) && (
            <p className="text-sm text-[hsl(var(--ink-3))]">No active alerts — all accounts on track.</p>
          )}
        </div>
      </div>

      <ShareResultModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        metrics={{
          arr_at_risk: stats?.total_arr_at_risk || bi.arr_at_risk || 0,
          at_risk_accounts: stats?.at_risk_accounts || 0,
          coverage: stats?.coverage || 0,
          avg_score: stats?.avg_score || 0,
        }}
      />
    </DashboardLayout>
  );
}

const fmtMoney = (n) => {
  if (!n) return "$0";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1000)}K`;
  return `$${n}`;
};

const ExecKpi = ({ icon: Icon, label, value, delta, caption, tid }) => (
  <div className="ret-card p-5" data-testid={tid}>
    <div className="flex items-start justify-between">
      <div className="w-10 h-10 rounded-xl bg-[hsl(var(--brand-100))] text-[hsl(var(--brand))] grid place-items-center">
        <Icon className="w-5 h-5" />
      </div>
      <span className="text-xs font-mono font-bold text-emerald-600 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" /> {delta}
      </span>
    </div>
    <p className="stat-num mt-4">{value}</p>
    <p className="text-sm text-[hsl(var(--ink))] font-semibold mt-1">{label}</p>
    <p className="text-xs text-[hsl(var(--ink-3))] mt-1">{caption}</p>
  </div>
);

const ImpactRow = ({ title, subtitle, value, color }) => (
  <div className="flex items-center justify-between p-4 rounded-xl border border-[hsl(var(--line-2))]">
    <div>
      <p className="text-sm font-semibold">{title}</p>
      <p className="text-xs text-[hsl(var(--ink-3))] font-mono">{subtitle}</p>
    </div>
    <p className={`font-mono font-bold text-sm ${color}`}>{value}</p>
  </div>
);

const riskBg = (sev) => sev === "HIGH RISK" ? "bg-red-50 border-red-100" : sev === "MEDIUM RISK" ? "bg-amber-50 border-amber-100" : "bg-[hsl(var(--bg-subtle))] border-[hsl(var(--line))]";
const riskIconColor = (sev) => sev === "HIGH RISK" ? "text-red-600" : sev === "MEDIUM RISK" ? "text-amber-700" : "text-[hsl(var(--ink-2))]";

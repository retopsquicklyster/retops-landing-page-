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
  const [liveChurn, setLiveChurn] = useState(null);
  const [dataMode, setDataMode] = useState("demo"); // "demo" | "live"
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([api.get("/executive/overview"), api.get("/dashboard/stats")])
      .then(([o, s]) => { setData(o.data); setStats(s.data); });
  }, []);

  useEffect(() => {
    if (dataMode === "live" && !liveChurn) {
      api.get("/executive/churn-analysis").then((r) => setLiveChurn(r.data)).catch(() => {});
    }
  }, [dataMode, liveChurn]);

  const bi = data?.business_impact || {};
  const isEmpty = data && (stats?.interactions_total === 0 || !stats);

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
      {isEmpty && (
        <div className="ret-card p-10 text-center mb-5" data-testid="exec-empty-state">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[hsl(var(--brand-100))] grid place-items-center">
            <DollarSign className="w-6 h-6 text-[hsl(var(--brand-ink))]" />
          </div>
          <h3 className="font-display text-2xl mt-4 text-[hsl(var(--retops-navy))]">Your executive view is waiting on data.</h3>
          <p className="text-[hsl(var(--retops-muted))] mt-2 max-w-lg mx-auto">Upload a single transcript, run a bulk batch, or seed demo data to see revenue-at-risk, coaching ROI, and trust-score calibration populate in real time.</p>
          <div className="flex gap-2 justify-center mt-5">
            <button onClick={() => navigate("/dashboard/upload")} className="btn-primary">Upload a transcript</button>
            <button onClick={() => navigate("/dashboard/bulk")} className="btn-ghost">Bulk score</button>
          </div>
        </div>
      )}

      {/* Top stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
        <ExecKpi icon={DollarSign} label="QA ROI" value={fmtMoney(bi.qa_roi)} delta="+18.5%" caption="Revenue impact from QA improvements" tid="kpi-roi" />
        <ExecKpi icon={Target} label="Customer Satisfaction" value={`${bi.csat_pct ?? 0}%`} delta="+5.8%" caption="Overall CSAT score improvement" tid="kpi-csat" />
        <ExecKpi icon={TrendingUp} label="Agent Productivity" value={`${(bi.agent_productivity_delta ?? 0) >= 0 ? "+" : ""}${bi.agent_productivity_delta ?? 0}%`} delta="+4.2%" caption="Efficiency gains from coaching" tid="kpi-productivity" />
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
                  <p className="kpi-num kpi-num-sm">{d.avg_score}</p>
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

      {/* ==== Overall Churn Analysis ==== */}
      <section className="ret-card p-6 mt-5" data-testid="overall-churn-analysis">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
          <h3 className="font-display text-lg font-semibold">Overall Churn Analysis</h3>
          <div className="flex items-center gap-2">
            <DataModeToggle mode={dataMode} setMode={setDataMode} />
            <select className="text-xs bg-white border border-[hsl(var(--line))] rounded-lg px-2 py-1" data-testid="churn-range-select">
              <option>Last 30 days</option><option>Last 7 days</option><option>Last 90 days</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          {(() => {
            const L = liveChurn?.tiles;
            const live = dataMode === "live" && L;
            const fmtMoneyShort = (v) => v >= 1_000_000 ? `$${(v/1_000_000).toFixed(1)}M` : v >= 1_000 ? `$${Math.round(v/1000)}K` : `$${v||0}`;
            return (
              <>
                <ChurnTileCard tone="red"    label="Churn Rate"        value={live ? `${L.churn_rate_pct}%` : "8.2%"}   sub={live ? `${L.at_risk_customers} high-risk accounts` : "+1.3% vs last period"} />
                <ChurnTileCard tone="amber"  label="At-Risk Customers" value={live ? String(L.at_risk_customers) : "156"} sub={live ? "from live interactions" : "23% of customer base"} />
                <ChurnTileCard tone="gold"   label="Revenue at Risk"   value={live ? fmtMoneyShort(L.revenue_at_risk) : "$2.4M"}  sub={live ? `${L.arr_exposure_pct}% of total ARR` : "18% of total ARR"} />
                <ChurnTileCard tone="green"  label="Retention Rate"    value={live ? `${L.retention_rate_pct}%` : "91.8%"}  sub={live ? "current period" : "Above industry avg"} />
              </>
            );
          })()}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div data-testid="top-churn-reasons">
            <h4 className="text-sm font-semibold mb-3">Top Churn Reasons</h4>
            {[
              { label: "Pricing & Billing Issues", pct: 34, count: 89, color: "#ef4444" },
              { label: "Poor Customer Support",    pct: 28, count: 73, color: "#f97316" },
              { label: "Product Limitations",      pct: 18, count: 47, color: "#F8D210" },
              { label: "Competitor Switching",     pct: 12, count: 31, color: "#3b82f6" },
              { label: "Technical Issues",         pct:  8, count: 21, color: "#a855f7" },
            ].map((r) => (
              <div key={r.label} className="mb-3.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-semibold">{r.label}</span>
                  <span className="tabular-nums font-semibold">{r.pct}%</span>
                </div>
                <div className="h-1.5 bg-[hsl(var(--line-2))] rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${r.pct * 2.5}%`, background: r.color }} />
                </div>
                <p className="text-[11px] text-[hsl(var(--ink-3))] mt-1 tabular-nums">{r.count} customers affected</p>
              </div>
            ))}
          </div>
          <div data-testid="churn-by-segment">
            <h4 className="text-sm font-semibold mb-3">Churn by Customer Segment</h4>
            {[
              { seg: "Small Business", rate: "12.4%", total: "450",  delta: "+2.1%", dot: "#ef4444", deltaColor: "text-red-500" },
              { seg: "Mid-Market",     rate: "6.8%",  total: "280",  delta: "+0.8%", dot: "#F8D210", deltaColor: "text-red-500" },
              { seg: "Enterprise",     rate: "3.2%",  total: "120",  delta: "-0.5%", dot: "#14B8A6", deltaColor: "text-emerald-600" },
              { seg: "Startup",        rate: "15.6%", total: "320",  delta: "+3.2%", dot: "#ef4444", deltaColor: "text-red-500" },
            ].map((s) => (
              <div key={s.seg} className="flex items-center justify-between p-3 rounded-xl border border-[hsl(var(--line-2))] mb-2">
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
                  <div>
                    <p className="text-sm font-semibold">{s.seg}</p>
                    <p className="text-[11px] text-[hsl(var(--ink-3))] tabular-nums">{s.total} total customers</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold tabular-nums">{s.rate}</p>
                  <p className={`text-[11px] tabular-nums ${s.deltaColor}`}>{s.delta}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==== Recommended Churn Prevention Actions ==== */}
      <section className="ret-card p-6 mt-5 bg-[hsl(var(--brand-100))]/40" data-testid="prevention-actions">
        <h3 className="font-display text-lg font-semibold mb-4">Recommended Churn Prevention Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {[
            { t: "Billing Transparency Initiative", p: "High",   d: "Implement clearer billing statements and proactive billing communication.", i: "-25% billing churn" },
            { t: "Support Response Time Improvement", p: "High", d: "Reduce average response time from 4 hours to 1 hour.",                       i: "-30% support churn" },
            { t: "Product Feature Enhancement",     p: "Medium", d: "Accelerate development of top 5 requested features.",                       i: "-15% feature churn" },
            { t: "Competitive Analysis Program",    p: "Medium", d: "Monitor competitor moves and adjust pricing/features accordingly.",         i: "-20% competitive churn" },
            { t: "Technical Stability Investment",  p: "Low",    d: "Infrastructure improvements to reduce downtime by 50%.",                    i: "-40% technical churn" },
            { t: "Customer Success Program",        p: "High",   d: "Proactive outreach to at-risk customers with personalized retention offers.", i: "-35% overall churn" },
          ].map((a) => (
            <div key={a.t} className="bg-white rounded-xl p-4 border border-[hsl(var(--line-2))]" data-testid={`prevention-${a.t.replace(/\s+/g,'-').toLowerCase()}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[hsl(var(--ink))] flex-1">{a.t}</p>
                <span className={`pill ${a.p === "High" ? "pill-danger" : a.p === "Medium" ? "pill-warn" : "pill-ok"}`} style={{ padding: "2px 8px", fontSize: 10 }}>{a.p}</span>
              </div>
              <p className="text-xs text-[hsl(var(--ink-2))] mt-2 leading-relaxed">{a.d}</p>
              <p className="text-[11px] text-[hsl(var(--retops-teal))] mt-2 font-semibold">Expected Impact: {a.i}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ==== Strategic Insights ==== */}
      <section className="ret-card p-6 mt-5 bg-[hsl(var(--brand-100))]/40" data-testid="strategic-insights">
        <h3 className="font-display text-lg font-semibold mb-4">Strategic Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(() => {
            const S = liveChurn?.strategic;
            const live = dataMode === "live" && S;
            return (
              <>
                <InsightCard label="Coaching ROI"    value={live ? `${S.coaching_roi_pct}%` : "340%"}   sub="Return on coaching investment" color="text-emerald-600" />
                <InsightCard label="Quality Trend"   value={live ? `${S.quality_trend_pct >= 0 ? "+" : ""}${S.quality_trend_pct}%` : "+12.5%"} sub="QA score improvement YoY" color="text-blue-600" />
                <InsightCard label="Efficiency Gain" value={live ? `${S.efficiency_gain_pct}%` : "28%"}    sub="Operational efficiency increase" color="text-purple-600" />
              </>
            );
          })()}
        </div>
      </section>
    </DashboardLayout>
  );
}

const DataModeToggle = ({ mode, setMode }) => (
  <div className="inline-flex items-center bg-white border border-[hsl(var(--line))] rounded-full p-0.5" data-testid="data-mode-toggle">
    {["demo", "live"].map((m) => (
      <button
        key={m}
        onClick={() => setMode(m)}
        data-testid={`mode-${m}`}
        className={`px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider transition-colors ${mode === m ? "bg-[hsl(var(--retops-navy))] text-white" : "text-[hsl(var(--ink-2))]"}`}
      >
        {m === "live" ? "Live data" : "Demo"}
      </button>
    ))}
  </div>
);

const ChurnTileCard = ({ tone, label, value, sub }) => {
  const bgMap = { red: "bg-red-50 border-red-100", amber: "bg-amber-50 border-amber-100", gold: "bg-[#fff7cc]/70 border-[#F8D210]/40", green: "bg-emerald-50 border-emerald-100" };
  const valColor = { red: "text-red-600", amber: "text-amber-600", gold: "text-[#b08900]", green: "text-emerald-600" }[tone];
  return (
    <div className={`p-4 rounded-xl border ${bgMap[tone]}`} data-testid={`churn-tile-${tone}`}>
      <p className="text-[11px] uppercase tracking-[0.15em] font-semibold text-[hsl(var(--ink-2))]">{label}</p>
      <p className={`kpi-num mt-1.5 ${valColor}`}>{value}</p>
      <p className="text-[11px] text-[hsl(var(--ink-3))] mt-1 tabular-nums">{sub}</p>
    </div>
  );
};

const InsightCard = ({ label, value, sub, color }) => (
  <div className="bg-white rounded-xl p-5 border border-[hsl(var(--line-2))]">
    <p className="text-sm font-semibold text-[hsl(var(--ink))]">{label}</p>
    <p className={`kpi-num mt-2 ${color}`}>{value}</p>
    <p className="text-xs text-[hsl(var(--ink-3))] mt-1">{sub}</p>
  </div>
);

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

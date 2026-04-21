import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { AlertTriangle, Sparkles, TrendingDown, TrendingUp } from "lucide-react";

export default function RiskMonitor() {
  const [rows, setRows] = useState([]);
  const navigate = useNavigate();
  useEffect(() => {
    api.get("/interactions").then((r) => {
      const flagged = r.data.filter((x) => {
        const a = x.analysis || {};
        return a.churn_risk !== "Low" || a.ai_hallucination || a.policy_compliance === "Fail" || (a.qa_score ?? 100) < 70;
      });
      setRows(flagged);
    });
  }, []);

  return (
    <DashboardLayout title="Risk Monitor" subtitle="Live stream of churn, compliance, and AI quality flags">
      <div className="ret-card divide-y divide-[hsl(var(--line-2))]" data-testid="risk-stream">
        {rows.map((r) => {
          const a = r.analysis || {};
          return (
            <div key={r.interaction_id} onClick={() => navigate(`/dashboard/interactions/${r.interaction_id}`)} className="p-5 flex items-start gap-4 cursor-pointer hover:bg-[hsl(var(--bg-subtle))]">
              <RiskIcon kind={kindOf(a)} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold text-[hsl(var(--ink))]">{new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <span className={`pill ${badgeOf(a)}`}>{labelOf(a)}</span>
                </div>
                <p className="text-sm font-semibold mt-1.5">{r.customer} — {r.agent} ({r.agent_type})</p>
                <p className="text-sm text-[hsl(var(--ink-2))] mt-0.5">{summaryOf(a)}</p>
              </div>
              <div className="text-right">
                <p className="font-mono font-bold">{a.qa_score}</p>
                <p className="text-xs text-[hsl(var(--ink-3))]">${(a.arr_at_risk || 0).toLocaleString()} at risk</p>
              </div>
            </div>
          );
        })}
        {rows.length === 0 && <p className="p-10 text-center text-sm text-[hsl(var(--ink-3))]">No risk signals detected.</p>}
      </div>
    </DashboardLayout>
  );
}

function kindOf(a) {
  if (a.ai_hallucination) return "AI";
  if (a.churn_risk === "High" || a.churn_risk === "Medium") return "Churn";
  if ((a.qa_score ?? 100) < 70) return "QA";
  if (a.expansion_signal && a.expansion_signal !== "None") return "Upsell";
  return "Other";
}
const badgeOf = (a) => a.ai_hallucination ? "pill-danger" : a.churn_risk === "High" ? "pill-danger" : (a.qa_score ?? 100) < 70 ? "pill-warn" : a.expansion_signal && a.expansion_signal !== "None" ? "pill-ok" : "pill-neutral";
const labelOf = (a) => a.ai_hallucination ? "AI Hallucination — Flagged" : a.churn_risk === "High" ? "Churn Risk — High" : a.churn_risk === "Medium" ? "Churn Risk — Medium" : (a.qa_score ?? 100) < 70 ? "QA Below Threshold" : (a.expansion_signal && a.expansion_signal !== "None" ? "Upsell Signal" : "Flag");
const summaryOf = (a) => a.ai_hallucination ? a.hallucination_note : a.churn_signal || a.summary;

const RiskIcon = ({ kind }) => {
  const map = { AI: Sparkles, Churn: TrendingDown, QA: AlertTriangle, Upsell: TrendingUp };
  const Ic = map[kind] || AlertTriangle;
  const color = kind === "AI" ? "text-red-600 bg-red-50" : kind === "Churn" ? "text-amber-700 bg-amber-50" : kind === "Upsell" ? "text-emerald-700 bg-emerald-50" : "text-amber-700 bg-amber-50";
  return <div className={`w-9 h-9 rounded-xl grid place-items-center flex-none ${color}`}><Ic className="w-4 h-4" /></div>;
};

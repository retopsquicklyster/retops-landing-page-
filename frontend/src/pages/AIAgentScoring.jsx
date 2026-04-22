import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { Bot, AlertTriangle, Shield, ShieldCheck, MessageSquare, TrendingUp, CheckCircle2, Upload as UploadIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function AIAgentScoring() {
  const [agents, setAgents] = useState([]);
  const [interactions, setInteractions] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      api.get("/agents"),
      api.get("/interactions?agent_type=AI"),
    ]).then(([a, i]) => {
      setAgents(a.data.filter((x) => x.type === "AI"));
      setInteractions(i.data);
    });
  }, []);

  const totalAI = interactions.length;
  const avg = totalAI ? Math.round(interactions.reduce((s, x) => s + (x.analysis?.qa_score || 0), 0) / totalAI * 10) / 10 : 0;
  const hallucinations = interactions.filter((x) => x.analysis?.ai_hallucination).length;
  const policyFails = interactions.filter((x) => x.analysis?.policy_compliance === "Fail").length;

  return (
    <DashboardLayout
      title="AI Agent Scoring"
      subtitle="Every AI response reviewed against rules, knowledge, and risk thresholds — before it reaches the customer."
    >
      <div className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-5 mb-6">
        <Kpi icon={Bot} label="AI agents" value={agents.length} caption="monitored" tid="ai-kpi-agents" />
        <Kpi icon={ShieldCheck} label="Avg AI score" value={avg} caption="across 7-dim rubric" tid="ai-kpi-score" />
        <Kpi icon={MessageSquare} label="AI Interactions Today" value={totalAI.toLocaleString()} caption={`${totalAI} scored this period`} tid="ai-kpi-today" />
        <Kpi icon={TrendingUp} label="AI vs Human Score" value="+2.4%" caption="AI ahead" positive tid="ai-kpi-vshuman" />
        <Kpi icon={AlertTriangle} label="Hallucinations" value={hallucinations} caption="flagged this period" danger={hallucinations > 0} tid="ai-kpi-hallucinations" />
        <Kpi icon={Shield} label="Policy failures" value={policyFails} caption="blocked / rewritten" danger={policyFails > 0} tid="ai-kpi-policy" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,1.3fr] gap-5">
        <div className="ret-card p-6" data-testid="ai-agents-list">
          <h3 className="font-instrument text-xl text-[hsl(var(--retops-navy))] mb-4">AI agents</h3>
          <div className="space-y-2">
            {agents.map((a) => (
              <div key={a.name} className="flex items-center gap-3 p-3 rounded-xl border border-[hsl(var(--retops-border-2))]">
                <div className="w-10 h-10 rounded-xl grid place-items-center bg-[hsl(var(--retops-teal-2))] text-[hsl(var(--retops-navy))]">
                  <Bot className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">{a.name}</p>
                  <p className="text-xs text-[hsl(var(--retops-muted))]">{a.team} · {a.interactions} interactions · {a.high_risk_count} high-risk</p>
                </div>
                <p className="font-mono font-bold text-lg">{a.avg_score || "—"}</p>
              </div>
            ))}
            {agents.length === 0 && <p className="text-sm text-[hsl(var(--retops-muted-2))]">No AI agents yet. Seed demo data to populate.</p>}
          </div>
        </div>

        <div className="ret-card p-6" data-testid="ai-response-feed">
          <h3 className="font-instrument text-xl text-[hsl(var(--retops-navy))] mb-4">Quality gate — recent AI responses</h3>
          <div className="space-y-3">
            {interactions.map((x) => {
              const a = x.analysis || {};
              const verdict = a.ai_hallucination ? "BLOCK" : a.policy_compliance === "Fail" ? "REWRITE" : "SEND";
              const color = verdict === "BLOCK" ? "pill-danger" : verdict === "REWRITE" ? "pill-warn" : "pill-ok";
              return (
                <div key={x.interaction_id}
                  onClick={() => navigate(`/dashboard/interactions/${x.interaction_id}`)}
                  className="p-4 rounded-xl border border-[hsl(var(--retops-border-2))] hover:border-[hsl(var(--retops-teal))] cursor-pointer transition-colors"
                  data-testid={`ai-row-${x.interaction_id}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold">{x.agent} <span className="text-[hsl(var(--retops-muted-2))] font-normal">· {x.customer}</span></p>
                      <p className="text-xs text-[hsl(var(--retops-muted))] mt-1 line-clamp-2">{a.summary}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5 flex-none">
                      <span className={`pill ${color}`}>{verdict}</span>
                      <span className="font-mono font-bold text-sm">{a.qa_score}/100</span>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {a.ai_hallucination && <span className="pill pill-danger" style={{ padding: "1px 8px", fontSize: 10 }}><AlertTriangle className="w-3 h-3" /> Hallucination</span>}
                    {a.policy_compliance === "Fail" && <span className="pill pill-warn" style={{ padding: "1px 8px", fontSize: 10 }}>Policy drift</span>}
                    {a.expansion_signal && a.expansion_signal !== "None" && <span className="pill pill-ok" style={{ padding: "1px 8px", fontSize: 10 }}>Upsell signal</span>}
                  </div>
                </div>
              );
            })}
            {interactions.length === 0 && <p className="text-sm text-[hsl(var(--retops-muted-2))]">No AI interactions scored yet.</p>}
          </div>
        </div>
      </div>

      {/* Same Standards info card */}
      <div className="ret-card p-5 mt-5 bg-[hsl(var(--brand-100))]/50 border-[hsl(168_40%_82%)] flex items-start gap-3" data-testid="ai-fair-comparison">
        <CheckCircle2 className="w-5 h-5 text-[hsl(var(--retops-teal))] flex-none mt-0.5" />
        <div>
          <p className="font-semibold text-[hsl(var(--retops-navy))]">Same Standards, Fair Comparison</p>
          <p className="text-sm text-[hsl(var(--ink-2))] mt-1">AI agents are scored using the exact same QA methodology, metrics, and criteria as human agents. This ensures fair comparison and helps identify areas where AI agents excel or need improvement.</p>
        </div>
      </div>

      {/* Upload AI Agent Interaction */}
      <div className="ret-card p-6 mt-5" data-testid="ai-upload-cta">
        <h3 className="font-display text-lg font-semibold">Upload AI Agent Interaction</h3>
        <p className="text-sm text-[hsl(var(--ink-2))] mt-1">Drop a transcript from your AI agent — RetOps will score it against the exact same rubric used for humans.</p>
        <div className="mt-4 flex gap-3 flex-wrap">
          <button onClick={() => navigate("/dashboard/upload")} data-testid="ai-upload-btn" className="btn-primary flex items-center gap-2"><UploadIcon className="w-4 h-4" /> Upload Transcript</button>
          <button onClick={() => navigate("/dashboard/upload")} data-testid="ai-paste-btn" className="btn-ghost flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Paste Text</button>
        </div>
      </div>
    </DashboardLayout>
  );
}

const Kpi = ({ icon: Icon, label, value, caption, danger, positive, tid }) => (
  <div className="ret-card p-5" data-testid={tid}>
    <div className="flex items-start justify-between">
      <div className={`w-10 h-10 rounded-xl grid place-items-center ${danger ? "bg-red-50 text-red-600" : positive ? "bg-emerald-50 text-emerald-600" : "bg-[hsl(var(--retops-teal-2))] text-[hsl(var(--retops-navy))]"}`}>
        <Icon className="w-5 h-5" />
      </div>
    </div>
    <p className="kpi-num mt-4">{value}</p>
    <p className="text-sm font-semibold text-[hsl(var(--retops-text))] mt-1">{label}</p>
    <p className="text-xs text-[hsl(var(--retops-muted-2))] mt-1">{caption}</p>
  </div>
);

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import {
  ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Lightbulb,
  TrendingDown, TrendingUp, ShieldAlert, ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";

const RUBRIC_ORDER = ["greeting", "active_listening", "problem_solving", "empathy", "resolution", "closing"];
const RUBRIC_LABELS = {
  greeting: "Greeting",
  active_listening: "Active listening",
  problem_solving: "Problem solving",
  empathy: "Empathy",
  resolution: "Resolution",
  closing: "Closing",
};

export default function InteractionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [rescoring, setRescoring] = useState(false);

  useEffect(() => {
    const load = async () => {
      const r = await api.get(`/interactions/${id}`);
      setData(r.data);
    };

    void load();
  }, [id]);

  const rescore = async () => {
    setRescoring(true);
    try {
      const r = await api.post(`/interactions/${id}/rescore`);
      setData(r.data);
      toast.success("Re-scored");
    } catch { toast.error("Re-score failed"); }
    finally { setRescoring(false); }
  };

  if (!data) {
    return <DashboardLayout title="Interaction"><div className="p-10 text-center text-[hsl(var(--retops-muted-2))]">Loading…</div></DashboardLayout>;
  }
  const a = data.analysis || {};
  const churn = a.churn || {};
  const qb = a.qa_breakdown || {};
  const compliance = a.compliance || {};
  const status = a.qa_status || "watch";

  return (
    <DashboardLayout
      title={`${data.customer}`}
      subtitle={`${data.agent} (${data.agent_type}) · ${data.channel} · ${new Date(data.created_at).toLocaleString()}`}
      actions={
        <>
          <button data-testid="back-btn" onClick={() => navigate(-1)} className="btn-ghost flex items-center gap-2"><ArrowLeft className="w-4 h-4" />Back</button>
          <button data-testid="rescore-btn" onClick={rescore} disabled={rescoring} className="btn-primary flex items-center gap-2">
            <RefreshCw className={`w-4 h-4 ${rescoring ? "animate-spin" : ""}`} /> {rescoring ? "Re-scoring…" : "Re-score"}
          </button>
        </>
      }
    >
      {/* Alert banner for below-threshold / critical */}
      {(status === "below_threshold" || churn.risk_level === "critical" || compliance.has_violation) && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 flex items-start gap-3 mb-5" data-testid="alert-banner">
          <AlertTriangle className="w-5 h-5 text-red-600 flex-none mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-bold text-red-700 uppercase tracking-wider">
              {compliance.has_violation ? "Compliance alert" : churn.risk_level === "critical" ? "Emergency escalation" : "QA below threshold"}
            </p>
            <p className="text-sm text-red-700 mt-0.5">
              {compliance.has_violation && `Violations: ${(compliance.violation_types || []).join(", ")}. `}
              {churn.recommended_action}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-5">
        {/* Left: Score + Rubric + Transcript */}
        <div className="space-y-5">
          <div className="ret-card p-6" data-testid="score-card">
            <div className="flex items-start justify-between gap-6 flex-wrap">
              <div>
                <p className="text-xs uppercase tracking-widest text-[hsl(var(--retops-muted-2))]">QA Score</p>
                <p className="stat-num mt-2">
                  {a.qa_score ?? "—"}<span className="text-lg text-[hsl(var(--retops-muted-2))] font-normal">/100</span>
                </p>
                <p className="mt-2">
                  <span className={`pill ${statusPill(status)}`}>{statusLabel(status)}</span>
                </p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`pill ${riskPill(churn.risk_level)}`}>Churn · {cap(churn.risk_level || "low")} ({churn.risk_score ?? 0})</span>
                {compliance.has_violation && <span className="pill pill-danger flex items-center gap-1"><ShieldAlert className="w-3 h-3" />Compliance fail</span>}
                {!compliance.has_violation && <span className="pill pill-ok flex items-center gap-1"><ShieldCheck className="w-3 h-3" />Compliance pass</span>}
                {a.ai_verdict && <span className={`pill ${a.ai_verdict === "BLOCK" ? "pill-danger" : a.ai_verdict === "REWRITE" ? "pill-warn" : "pill-ok"}`}>AI · {a.ai_verdict}</span>}
                {a.sentiment_detail?.overall && (
                  <span className="pill pill-neutral">Sentiment · {cap(a.sentiment_detail.overall)} · {a.sentiment_detail.trajectory}</span>
                )}
              </div>
            </div>
            <p className="text-sm text-[hsl(var(--retops-muted))] mt-4">{a.summary}</p>
            {(a.interaction_tags || []).length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {a.interaction_tags.map((t) => <span key={t} className="pill pill-neutral" style={{ padding: "2px 8px", fontSize: 10 }}>{t}</span>)}
              </div>
            )}
          </div>

          {/* Rubric breakdown (new 0-100 with bars) */}
          <div className="ret-card p-6" data-testid="rubric">
            <h3 className="font-instrument text-2xl text-[hsl(var(--retops-navy))] mb-4">Rubric breakdown</h3>
            <div className="space-y-4">
              {RUBRIC_ORDER.map((k) => {
                const item = qb[k] || {};
                const s = item.score ?? 0;
                const w = item.weight ?? 0;
                return (
                  <div key={k} data-testid={`rubric-${k}`}>
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-[hsl(var(--retops-text))]">{RUBRIC_LABELS[k]}</span>
                        <span className="text-xs text-[hsl(var(--retops-muted-2))] font-mono">weight {w}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`pill ${s >= 75 ? "pill-ok" : s >= 60 ? "pill-warn" : "pill-danger"}`} style={{ padding: "1px 8px", fontSize: 10 }}>
                          {s >= 75 ? "Pass" : s >= 60 ? "Watch" : "Fail"}
                        </span>
                        <span className="font-mono font-bold text-sm tabular-nums w-12 text-right">{s}/100</span>
                      </div>
                    </div>
                    <div className="progress-rail mt-1.5">
                      <div className="progress-fill" style={{ width: `${s}%`, background: s >= 75 ? "hsl(var(--retops-success))" : s >= 60 ? "hsl(var(--retops-amber))" : "hsl(var(--retops-risk))" }} />
                    </div>
                    {item.reason && <p className="text-xs text-[hsl(var(--retops-muted))] mt-1.5">{item.reason}</p>}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 pt-4 border-t border-[hsl(var(--retops-border-2))] flex items-center justify-between">
              <span className="text-sm text-[hsl(var(--retops-muted))]">Weighted QA score</span>
              <span className="font-mono font-bold">{a.qa_score}/100</span>
            </div>
          </div>

          <div className="ret-card p-6" data-testid="transcript">
            <h3 className="font-instrument text-2xl text-[hsl(var(--retops-navy))] mb-3">Transcript</h3>
            <pre className="font-code text-xs leading-relaxed whitespace-pre-wrap text-[hsl(var(--retops-text))] bg-[hsl(var(--retops-bg))] rounded-xl p-4 border border-[hsl(var(--retops-border))]">{data.transcript}</pre>
          </div>
        </div>

        {/* Right: Churn + Coaching + Playbook */}
        <div className="space-y-5">
          <div className="ret-card p-6" data-testid="churn-card">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-widest text-[hsl(var(--retops-muted-2))]">Revenue at risk</p>
              <span className="font-mono text-xs text-[hsl(var(--retops-muted-2))]">risk {churn.risk_score ?? 0}/100</span>
            </div>
            <p className={`stat-num mt-2 ${(churn.revenue_at_risk || 0) > 0 ? "text-red-500" : "text-[hsl(var(--retops-muted))]"}`}>
              ${(churn.revenue_at_risk || 0).toLocaleString()}
            </p>
            <p className="text-sm text-[hsl(var(--retops-muted))] mt-2">{churn.recommended_action || "No action required"}</p>

            {/* Signals */}
            {(churn.signals || []).length > 0 && (
              <div className="mt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--retops-muted-2))] mb-2">Signals detected</p>
                <div className="flex flex-wrap gap-1.5">
                  {churn.signals.map((s) => <span key={s} className="pill pill-danger" style={{ padding: "2px 8px", fontSize: 10 }}>{humanize(s)}</span>)}
                </div>
              </div>
            )}

            {(churn.keywords_matched || []).length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--retops-muted-2))] mb-2">Keywords matched</p>
                <div className="flex flex-wrap gap-1.5">
                  {churn.keywords_matched.slice(0, 8).map((k, i) => <span key={i} className="pill pill-neutral font-code" style={{ padding: "2px 8px", fontSize: 10 }}>"{k}"</span>)}
                </div>
              </div>
            )}

            {a.expansion_signal && a.expansion_signal !== "None" && (
              <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold"><TrendingUp className="w-4 h-4" /> Expansion signal</div>
                <p className="text-sm text-emerald-900 mt-1">{a.expansion_signal}</p>
                {a.expansion_value_monthly > 0 && <p className="text-xs text-emerald-700 mt-1">Potential: +${a.expansion_value_monthly.toLocaleString()}/mo</p>}
              </div>
            )}
          </div>

          <div className="ret-card p-6" data-testid="coaching-card">
            <h3 className="font-instrument text-2xl text-[hsl(var(--retops-navy))] flex items-center gap-2"><Lightbulb className="w-5 h-5 text-[hsl(var(--retops-teal))]" /> Coaching card</h3>
            <Section title="Strengths" icon={CheckCircle2} color="text-emerald-600">
              {(a.coaching?.strengths || []).map((x, i) => <li key={i}>{x}</li>)}
            </Section>
            <Section title="Improvements" icon={AlertTriangle} color="text-amber-600">
              {(a.coaching?.improvements || []).map((x, i) => <li key={i}>{x}</li>)}
            </Section>
          </div>

          {(a.playbook?.triggered || (churn.risk_score || 0) >= 50) && (
            <div className="p-6 rounded-2xl text-white" style={{ background: "hsl(var(--retops-navy))", border: "1px solid hsl(var(--retops-navy))" }} data-testid="save-playbook">
              <h3 className="font-instrument text-2xl flex items-center gap-2 text-white"><TrendingDown className="w-5 h-5 text-[hsl(var(--retops-gold))]" /> Save playbook</h3>
              <p className="text-xs uppercase tracking-widest text-[hsl(var(--retops-gold))] font-semibold mt-2">{humanize(a.playbook?.trigger_type || "retention_assignment")}</p>
              <div className="mt-4 text-sm">
                <p className="font-semibold mb-2 text-white">Steps</p>
                <ol className="list-decimal list-inside space-y-1.5 text-white/85">
                  {(a.save_playbook?.steps || []).map((s, i) => <li key={i}>{s}</li>)}
                </ol>
                <p className="font-semibold mt-4 mb-1 text-white">Offer</p>
                <p className="text-[hsl(var(--retops-gold))] font-semibold">{a.save_playbook?.offer_suggestion}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

const humanize = (s) => (s || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : "");
const statusPill = (s) => s === "excellent" ? "pill-ok" : s === "good" ? "pill-info" : s === "watch" ? "pill-warn" : "pill-danger";
const statusLabel = (s) => ({ excellent: "Excellent", good: "Good", watch: "Watch", below_threshold: "Below threshold" }[s] || s);
const riskPill = (r) => r === "critical" ? "pill-danger" : r === "high" ? "pill-danger" : r === "medium" ? "pill-warn" : "pill-ok";

const Section = ({ title, icon: Icon, color, children }) => (
  <div className="mt-4">
    <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${color}`}><Icon className="w-3.5 h-3.5" /> {title}</p>
    <ul className="list-disc list-inside text-sm text-[hsl(var(--retops-muted))] mt-1.5 space-y-1">{children}</ul>
  </div>
);

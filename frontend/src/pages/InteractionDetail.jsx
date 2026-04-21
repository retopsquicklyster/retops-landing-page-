import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { ArrowLeft, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export default function InteractionDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [rescoring, setRescoring] = useState(false);

  const load = async () => {
    const r = await api.get(`/interactions/${id}`);
    setData(r.data);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const rescore = async () => {
    setRescoring(true);
    try {
      const r = await api.post(`/interactions/${id}/rescore`);
      setData(r.data);
      toast.success("Re-scored");
    } catch (e) { toast.error("Re-score failed"); }
    finally { setRescoring(false); }
  };

  if (!data) return <DashboardLayout title="Interaction"><div className="p-10 text-center text-[hsl(var(--ink-3))]">Loading…</div></DashboardLayout>;
  const a = data.analysis || {};

  return (
    <DashboardLayout
      title={`Interaction · ${data.customer}`}
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
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,1fr] gap-5">
        {/* Left: Score + Rubric + Transcript */}
        <div className="space-y-5">
          <div className="ret-card p-6" data-testid="score-card">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))]">QA Score</p>
                <p className="stat-num mt-2">{a.qa_score ?? "—"}<span className="text-lg text-[hsl(var(--ink-3))] font-normal">/100</span></p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`pill ${riskPill(a.churn_risk)}`}>Churn · {a.churn_risk}</span>
                {a.ai_hallucination && <span className="pill pill-danger">AI Hallucination</span>}
                <span className={`pill ${a.policy_compliance === "Pass" ? "pill-ok" : "pill-danger"}`}>Policy · {a.policy_compliance}</span>
              </div>
            </div>
            <p className="text-sm text-[hsl(var(--ink-2))] mt-4">{a.summary}</p>
          </div>

          <div className="ret-card p-6" data-testid="rubric">
            <h3 className="font-display text-lg font-semibold mb-3">Rubric breakdown</h3>
            <table className="w-full text-sm">
              <tbody>
                {(a.rubric || []).map((r) => (
                  <tr key={r.key} className="border-t border-[hsl(var(--line-2))]">
                    <td className="py-3 font-medium">{r.label}</td>
                    <td className="py-3 text-right font-mono font-semibold">{r.score}/10</td>
                    <td className="py-3 pl-4 w-28">
                      <span className={`pill ${r.verdict === "Pass" ? "pill-ok" : r.verdict === "Marginal" ? "pill-warn" : "pill-danger"}`}>{r.verdict}</span>
                    </td>
                    <td className="py-3 pl-4 text-xs text-[hsl(var(--ink-2))]">{r.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ret-card p-6" data-testid="transcript">
            <h3 className="font-display text-lg font-semibold mb-3">Transcript</h3>
            <pre className="font-mono text-xs leading-relaxed whitespace-pre-wrap text-[hsl(var(--ink))] bg-[hsl(var(--bg-subtle))] rounded-xl p-4 border border-[hsl(var(--line))]">{data.transcript}</pre>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="space-y-5">
          <div className="ret-card p-6" data-testid="risk-card">
            <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))]">Revenue exposure</p>
            <p className="stat-num mt-2 text-red-500">${(a.arr_at_risk || 0).toLocaleString()}</p>
            <p className="text-xs text-[hsl(var(--ink-2))] mt-2">{a.churn_signal}</p>
            {a.expansion_signal && a.expansion_signal !== "None" && (
              <div className="mt-5 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
                <div className="flex items-center gap-2 text-emerald-700 text-sm font-semibold"><TrendingUp className="w-4 h-4" /> Expansion signal</div>
                <p className="text-sm text-emerald-900 mt-1">{a.expansion_signal}</p>
                <p className="text-xs text-emerald-700 mt-1">Potential: +${(a.expansion_value_monthly || 0).toLocaleString()}/mo</p>
              </div>
            )}
          </div>

          <div className="ret-card p-6" data-testid="coaching-card">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-[hsl(var(--brand))]" /> Coaching card</h3>
            <p className="text-sm mt-3 font-semibold">{a.coaching_card?.headline}</p>
            <Section title="Strengths" icon={CheckCircle2} color="text-emerald-600">
              {(a.coaching_card?.strengths || []).map((x, i) => <li key={i}>{x}</li>)}
            </Section>
            <Section title="Growth areas" icon={AlertTriangle} color="text-amber-600">
              {(a.coaching_card?.growth_areas || []).map((x, i) => <li key={i}>{x}</li>)}
            </Section>
            <Section title="Recommended actions" icon={XCircle} color="text-[hsl(var(--brand))]">
              {(a.coaching_card?.recommended_actions || []).map((x, i) => <li key={i}>{x}</li>)}
            </Section>
          </div>

          <div className="ret-card p-6 bg-[hsl(var(--brand-100))] border-[hsl(168_40%_82%)]" data-testid="save-playbook">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2 text-[hsl(var(--brand-ink))]">
              <TrendingDown className="w-4 h-4" /> Save playbook
            </h3>
            <div className="mt-3 text-sm text-[hsl(var(--brand-ink))]/90">
              <p className="font-semibold mb-1">Steps</p>
              <ol className="list-decimal list-inside space-y-1">
                {(a.save_playbook?.steps || []).map((s, i) => <li key={i}>{s}</li>)}
              </ol>
              <p className="font-semibold mt-3 mb-1">Offer</p>
              <p>{a.save_playbook?.offer_suggestion}</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

const riskPill = (r) => r === "High" ? "pill-danger" : r === "Medium" ? "pill-warn" : r === "Low" ? "pill-ok" : "pill-neutral";

const Section = ({ title, icon: Icon, color, children }) => (
  <div className="mt-4">
    <p className={`flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider ${color}`}><Icon className="w-3.5 h-3.5" /> {title}</p>
    <ul className="list-disc list-inside text-sm text-[hsl(var(--ink-2))] mt-1.5 space-y-1">{children}</ul>
  </div>
);

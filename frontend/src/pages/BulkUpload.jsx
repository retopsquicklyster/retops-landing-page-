import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { Upload, Loader2, Sparkles, Users, AlertTriangle, TrendingDown, CheckCircle2, FileText, Download } from "lucide-react";
import { toast } from "sonner";

const PRESETS = [
  { id: "default", label: "General support", desc: "Standard QA rubric · any industry" },
  { id: "urban_flavours_delivery", label: "Urban Flavours Delivery", desc: "Cannabis delivery · 21+ verification · compliance-first" },
];

const SAMPLE_CSV = `customer,agent,channel,transcript
"Jenna M.","Tyler","Chat","Customer: Hey my order never showed up. Agent: Sorry, let me check. I see you're outside our license area, I can refund. Customer: Ugh Eaze delivers here. This is the third time."
"Marcus T.","Sasha","Chat","Customer: Can I use this for my anxiety? Agent: Yes totally, our indica strains calm you down. Customer: Great, ordering now."
"Riley P.","Tyler","Chat","Customer: Never received ID check at door. Agent: Oh, driver was in a rush, sorry. Customer: That's sketch, I want a refund."
"Dana K.","Sasha","Chat","Customer: Product was dry/stale. Agent: I'll ship a fresh batch tomorrow on us. Customer: Thanks, appreciate it."`;

export default function BulkUpload() {
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [file, setFile] = useState(null);
  const [preset, setPreset] = useState("urban_flavours_delivery");
  const [defCustomer, setDefCustomer] = useState("");
  const [defAgent, setDefAgent] = useState("");
  const [agentType, setAgentType] = useState("Human");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const handleFile = (f) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) { toast.error("File too large (max 10MB)"); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (e) => setContent(e.target.result);
    reader.readAsText(f);
  };

  const run = async () => {
    if (!content.trim()) { toast.error("Paste content or choose a file"); return; }
    setRunning(true);
    setResult(null);
    try {
      const r = await api.post("/interactions/bulk-upload", {
        content, client_preset: preset, default_customer: defCustomer, default_agent: defAgent, agent_type: agentType,
      });
      setResult(r.data);
      toast.success(`Scored ${r.data.scored}/${r.data.total} transcripts`);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Bulk scoring failed");
    } finally { setRunning(false); }
  };

  return (
    <DashboardLayout
      title="Bulk Upload & Score"
      subtitle="Drop in chats, emails, or a CSV. RetOps auto-identifies rep + customer, scores each, then aggregates by rep and per-customer churn."
    >
      {!result && (
        <div className="grid grid-cols-1 xl:grid-cols-[1.3fr,1fr] gap-5">
          {/* LEFT — input */}
          <div className="ret-card p-6 space-y-5" data-testid="bulk-input-card">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Client / industry preset</label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-2">
                {PRESETS.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    data-testid={`preset-${p.id}`}
                    onClick={() => setPreset(p.id)}
                    className={`p-4 rounded-xl border-2 text-left transition-all ${preset === p.id ? "border-[hsl(var(--retops-teal))] bg-[hsl(var(--retops-teal-2))]/40" : "border-[hsl(var(--line))] hover:border-[hsl(var(--brand-200))] bg-white"}`}
                  >
                    <p className="font-semibold text-sm">{p.label}</p>
                    <p className="text-xs text-[hsl(var(--ink-3))] mt-1">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Fallback customer (optional)">
                <input value={defCustomer} onChange={(e) => setDefCustomer(e.target.value)} data-testid="bulk-default-customer" className="input" placeholder="auto-detect from text" />
              </Field>
              <Field label="Fallback agent (optional)">
                <input value={defAgent} onChange={(e) => setDefAgent(e.target.value)} data-testid="bulk-default-agent" className="input" placeholder="auto-detect from text" />
              </Field>
              <Field label="Agent type">
                <select value={agentType} onChange={(e) => setAgentType(e.target.value)} data-testid="bulk-agent-type" className="input"><option>Human</option><option>AI</option></select>
              </Field>
            </div>

            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Transcripts</label>
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); handleFile(e.dataTransfer.files?.[0]); }}
                className="mt-2 p-5 border-2 border-dashed border-[hsl(var(--line))] hover:border-[hsl(var(--retops-teal))] rounded-2xl text-center cursor-pointer transition-colors"
                data-testid="bulk-dropzone"
              >
                <Upload className="w-6 h-6 mx-auto text-[hsl(var(--ink-3))]" />
                <p className="mt-2 text-sm font-semibold"><span className="text-[hsl(var(--retops-teal))]">Click to upload</span> or drag CSV / JSONL / TXT</p>
                <p className="text-xs text-[hsl(var(--ink-3))] mt-1">Up to 10MB · 200 transcripts</p>
                {file && <p className="mt-2 text-xs text-[hsl(var(--retops-teal))] font-semibold" data-testid="bulk-file-chosen">✓ {file.name} · {(file.size/1024).toFixed(1)} KB</p>}
                <input ref={fileRef} type="file" accept=".csv,.jsonl,.txt,.json,.md" className="hidden" data-testid="bulk-file-input"
                  onChange={(e) => handleFile(e.target.files?.[0])} />
              </div>
              <p className="text-xs text-[hsl(var(--ink-3))] mt-3">Or paste transcripts below (CSV, JSONL, or separate with <code className="font-code text-[hsl(var(--retops-teal))]">===</code>):</p>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={10}
                placeholder={"customer,agent,channel,transcript\n..."}
                className="input font-code text-xs leading-relaxed mt-2 w-full"
                data-testid="bulk-content-textarea"
              />
              <button type="button" onClick={() => { setContent(SAMPLE_CSV); toast.info("Sample Urban Flavours CSV loaded"); }} data-testid="bulk-load-sample" className="text-xs text-[hsl(var(--retops-teal))] mt-2 font-semibold">Load sample cannabis-delivery CSV →</button>
            </div>

            <button onClick={run} disabled={running || !content.trim()} className="btn-primary flex items-center gap-2" data-testid="bulk-run-btn">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {running ? "Scoring batch…" : "Score batch"}
            </button>
          </div>

          {/* RIGHT — how it works */}
          <div className="ret-card p-6 space-y-5">
            <h3 className="font-display text-lg font-semibold">How bulk scoring works</h3>
            <ol className="space-y-4 text-sm text-[hsl(var(--ink-2))]">
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[hsl(var(--retops-teal-2))] text-[hsl(var(--retops-navy))] grid place-items-center text-xs font-bold flex-none">1</span><span><b className="text-[hsl(var(--ink))]">Split.</b> CSV columns or <code className="font-code text-xs">===</code> separators divide the dump into individual interactions.</span></li>
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[hsl(var(--retops-teal-2))] text-[hsl(var(--retops-navy))] grid place-items-center text-xs font-bold flex-none">2</span><span><b className="text-[hsl(var(--ink))]">Identify.</b> LLM reads each transcript to pull out rep name, customer, channel, 1-line summary.</span></li>
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[hsl(var(--retops-teal-2))] text-[hsl(var(--retops-navy))] grid place-items-center text-xs font-bold flex-none">3</span><span><b className="text-[hsl(var(--ink))]">Score.</b> Each interaction runs through the RetOps rubric using your chosen client preset.</span></li>
              <li className="flex gap-3"><span className="w-6 h-6 rounded-full bg-[hsl(var(--retops-teal-2))] text-[hsl(var(--retops-navy))] grid place-items-center text-xs font-bold flex-none">4</span><span><b className="text-[hsl(var(--ink))]">Aggregate.</b> Per-rep leaderboard and per-customer churn heatmap are produced.</span></li>
            </ol>
            <div className="bg-[hsl(var(--brand-100))]/40 rounded-xl p-4 text-xs leading-relaxed">
              <p className="font-semibold text-[hsl(var(--retops-navy))]">Urban Flavours Delivery preset</p>
              <p className="text-[hsl(var(--ink-2))] mt-1">Applies cannabis-regulated scoring: 21+ ID verification at door, no medical claims, license-area compliance, delivery SLA, competitor awareness (Eaze / Grassdoor / SaveOnCannabis).</p>
            </div>
          </div>
        </div>
      )}

      {result && <Results r={result} navigate={navigate} reset={() => { setResult(null); setContent(""); setFile(null); }} />}
    </DashboardLayout>
  );
}

const Results = ({ r, navigate, reset }) => {
  const riskTone = (lvl) => lvl === "Critical" || lvl === "High" ? "text-red-600" : lvl === "Medium" ? "text-amber-600" : "text-emerald-600";
  const riskBg   = (lvl) => lvl === "Critical" || lvl === "High" ? "bg-red-50 border-red-100" : lvl === "Medium" ? "bg-amber-50 border-amber-100" : "bg-emerald-50 border-emerald-100";

  return (
    <div className="space-y-5" data-testid="bulk-results">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--ink-3))] font-semibold">{r.client_label}</p>
          <p className="font-display text-2xl text-[hsl(var(--retops-navy))]">Batch {r.batch_id} · {r.scored}/{r.total} scored</p>
        </div>
        <button onClick={reset} className="btn-ghost" data-testid="bulk-new-btn">Run another batch</button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <SummaryTile icon={CheckCircle2} label="Avg score"           value={r.summary.avg_score}             color="bg-[hsl(var(--retops-teal-2))] text-[hsl(var(--retops-navy))]" />
        <SummaryTile icon={AlertTriangle} label="Below threshold"     value={r.summary.below_threshold}       color="bg-red-50 text-red-600" />
        <SummaryTile icon={TrendingDown}  label="At-risk interactions" value={r.summary.at_risk_interactions}  color="bg-amber-50 text-amber-600" />
        <SummaryTile icon={Users}         label="Unique reps"          value={r.summary.unique_reps}           color="bg-blue-50 text-blue-600" />
        <SummaryTile icon={Users}         label="Unique customers"     value={r.summary.unique_customers}      color="bg-purple-50 text-purple-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Rep leaderboard */}
        <div className="ret-card p-6" data-testid="bulk-rep-leaderboard">
          <h3 className="font-display text-lg font-semibold">Scores by rep</h3>
          <ul className="mt-4 divide-y divide-[hsl(var(--line-2))]">
            {r.rep_leaderboard.map((rep) => (
              <li key={rep.rep} className="py-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-[hsl(var(--retops-navy))]">{rep.rep}</p>
                  <p className="text-xs text-[hsl(var(--ink-3))] tabular-nums">{rep.count} interactions · {rep.fails} fails · {rep.cards} coaching cards</p>
                </div>
                <div className="text-right">
                  <p className={`kpi-num ${rep.avg < 60 ? "text-red-600" : rep.avg < 75 ? "text-amber-600" : "text-emerald-600"}`}>{rep.avg}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Customer churn */}
        <div className="ret-card p-6" data-testid="bulk-customer-churn">
          <h3 className="font-display text-lg font-semibold">Customer churn risk</h3>
          <ul className="mt-4 divide-y divide-[hsl(var(--line-2))]">
            {r.customer_churn.map((c) => (
              <li key={c.customer} className="py-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-[hsl(var(--retops-navy))]">{c.customer}</p>
                  <span className={`pill ${c.churn_risk === "Low" ? "pill-ok" : c.churn_risk === "Medium" ? "pill-warn" : "pill-danger"}`} style={{padding:"2px 8px", fontSize:10}}>{c.churn_risk}</span>
                </div>
                <p className="text-xs text-[hsl(var(--ink-3))] mt-1 tabular-nums">{c.interactions} interactions · avg {c.avg_score}</p>
                {c.signals.length > 0 && <p className="text-xs text-[hsl(var(--ink-2))] mt-1 italic">{c.signals.join(" · ")}</p>}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Every interaction */}
      <div className="ret-card p-6" data-testid="bulk-all-interactions">
        <h3 className="font-display text-lg font-semibold">All scored interactions</h3>
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-sm">
            <thead className="text-xs text-[hsl(var(--ink-3))] uppercase tracking-wider text-left">
              <tr><th className="pb-2">Rep</th><th className="pb-2">Customer</th><th className="pb-2 text-right">Score</th><th className="pb-2 text-center">Risk</th><th className="pb-2">Summary</th><th></th></tr>
            </thead>
            <tbody>
              {r.interactions.map((x) => (
                <tr key={x.interaction_id} className="border-t border-[hsl(var(--line-2))] hover:bg-gray-50 cursor-pointer" onClick={() => navigate(`/dashboard/interactions/${x.interaction_id}`)} data-testid={`bulk-row-${x.interaction_id}`}>
                  <td className="py-2 font-semibold">{x.agent}</td>
                  <td className="py-2">{x.customer}</td>
                  <td className="py-2 text-right font-semibold tabular-nums">{x.qa_score}</td>
                  <td className="py-2 text-center"><span className={`pill ${riskBg(x.churn_risk)} ${riskTone(x.churn_risk)}`} style={{padding:"2px 8px", fontSize:10}}>{x.churn_risk}</span></td>
                  <td className="py-2 text-xs text-[hsl(var(--ink-2))] truncate max-w-xs">{x.summary}</td>
                  <td className="py-2 text-right"><FileText className="w-4 h-4 inline text-[hsl(var(--ink-3))]" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const SummaryTile = ({ icon: Icon, label, value, color }) => (
  <div className="ret-card p-4">
    <div className={`w-9 h-9 rounded-xl grid place-items-center ${color}`}><Icon className="w-4 h-4" /></div>
    <p className="kpi-num mt-3 text-[hsl(var(--retops-navy))]">{value}</p>
    <p className="text-xs text-[hsl(var(--ink-3))] mt-1">{label}</p>
  </div>
);

const Field = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))] mb-1.5 block">{label}</span>
    {children}
  </label>
);

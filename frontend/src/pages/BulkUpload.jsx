import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { Upload, Loader2, Sparkles, Users, AlertTriangle, TrendingDown, CheckCircle2, FileText, Plus, X } from "lucide-react";
import { toast } from "sonner";

const SAMPLE_CSV = `customer,agent,channel,transcript
"Jenna M.","Tyler","Chat","Customer: Hey my order never showed up. Agent: Sorry, let me check. I see you're outside our license area, I can refund. Customer: Ugh Eaze delivers here. This is the third time."
"Marcus T.","Sasha","Chat","Customer: Can I use this for my anxiety? Agent: Yes totally, our indica strains calm you down. Customer: Great, ordering now."
"Riley P.","Tyler","Chat","Customer: Never received ID check at door. Agent: Oh, driver was in a rush, sorry. Customer: That's sketch, I want a refund."
"Dana K.","Sasha","Chat","Customer: Product was dry/stale. Agent: I'll ship a fresh batch tomorrow on us. Customer: Thanks, appreciate it."`;

export default function BulkUpload() {
  const navigate = useNavigate();
  const [content, setContent] = useState("");
  const [files, setFiles] = useState([]);
  const [preset, setPreset] = useState("urban_flavours_delivery");
  const [presets, setPresets] = useState({ builtin: [], custom: [] });
  const [showAdd, setShowAdd] = useState(false);
  const [defCustomer, setDefCustomer] = useState("");
  const [defAgent, setDefAgent] = useState("");
  const [agentType, setAgentType] = useState("Human");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const fileRef = useRef(null);

  const loadPresets = async () => {
    try { const r = await api.get("/bulk/presets"); setPresets(r.data); } catch {}
  };
  useEffect(() => { loadPresets(); }, []);

  const handleFiles = async (list) => {
    if (!list || !list.length) return;
    const chosen = Array.from(list);
    const oversize = chosen.find((f) => f.size > 10 * 1024 * 1024);
    if (oversize) { toast.error(`"${oversize.name}" exceeds 10MB limit`); return; }
    const total = chosen.reduce((s, f) => s + f.size, 0);
    if (total > 25 * 1024 * 1024) { toast.error("Combined size exceeds 25MB — split into smaller batches"); return; }
    setFiles(chosen);
    // Read each file as text, join with === separator (backend splits on this)
    try {
      const texts = await Promise.all(chosen.map((f) => new Promise((resolve, reject) => {
        const r = new FileReader();
        r.onload = (e) => resolve({ name: f.name, text: String(e.target.result || "") });
        r.onerror = reject;
        r.readAsText(f);
      })));
      // Detect if any are CSV — if so just concat without ===; otherwise separate with ===
      const hasCsv = chosen.some((f) => /\.csv$/i.test(f.name));
      const combined = hasCsv
        ? texts.map((t) => t.text.trim()).join("\n")
        : texts.map((t) => `# FILE: ${t.name}\n${t.text.trim()}`).join("\n\n===\n\n");
      setContent(combined);
      if (chosen.length > 1) toast.success(`Loaded ${chosen.length} files (${(total / 1024).toFixed(0)} KB total)`);
    } catch {
      toast.error("Could not read one of the files");
    }
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
              <div className="flex gap-2 mt-2" data-testid="preset-row">
                <select
                  value={preset}
                  onChange={(e) => setPreset(e.target.value)}
                  data-testid="preset-select"
                  className="input flex-1"
                >
                  <optgroup label="Built-in">
                    {presets.builtin.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                  </optgroup>
                  {presets.custom.length > 0 && (
                    <optgroup label="Your custom presets">
                      {presets.custom.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
                    </optgroup>
                  )}
                </select>
                <button type="button" onClick={() => setShowAdd(true)} data-testid="add-preset-btn" className="btn-ghost flex items-center gap-1.5 px-3 whitespace-nowrap">
                  <Plus className="w-4 h-4" /> Add preset
                </button>
              </div>
              <p className="text-xs text-[hsl(var(--ink-3))] mt-2">
                {[...presets.builtin, ...presets.custom].find((p) => p.id === preset)?.desc || "Choose a scoring profile that matches your industry."}
              </p>
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
                onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
                className="mt-2 p-5 border-2 border-dashed border-[hsl(var(--line))] hover:border-[hsl(var(--retops-teal))] rounded-2xl text-center cursor-pointer transition-colors"
                data-testid="bulk-dropzone"
              >
                <Upload className="w-6 h-6 mx-auto text-[hsl(var(--ink-3))]" />
                <p className="mt-2 text-sm font-semibold"><span className="text-[hsl(var(--retops-teal))]">Click to upload</span> or drag CSV / JSONL / TXT · multi-select supported</p>
                <p className="text-xs text-[hsl(var(--ink-3))] mt-1">Up to 10MB per file · 25MB combined · 200 transcripts</p>
                {files.length > 0 && (
                  <div className="mt-2 text-xs text-[hsl(var(--retops-teal))] font-semibold" data-testid="bulk-file-chosen">
                    ✓ {files.length === 1 ? files[0].name : `${files.length} files selected`} · {(files.reduce((s, f) => s + f.size, 0) / 1024).toFixed(1)} KB
                  </div>
                )}
                <input ref={fileRef} type="file" multiple accept=".csv,.jsonl,.txt,.json,.md" className="hidden" data-testid="bulk-file-input"
                  onChange={(e) => handleFiles(e.target.files)} />
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
              <div className="flex items-center justify-between mt-2">
                <button type="button" onClick={() => { setContent(SAMPLE_CSV); toast.info("Sample Urban Flavours CSV loaded"); }} data-testid="bulk-load-sample" className="text-xs text-[hsl(var(--retops-teal))] font-semibold">Load sample cannabis-delivery CSV →</button>
                <span className="text-xs text-[hsl(var(--ink-3))] tabular-nums" data-testid="bulk-word-count">{content.trim() ? `${content.trim().split(/\s+/).length} words · ${content.length} chars` : ""}</span>
              </div>
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

      {result && <Results r={result} navigate={navigate} reset={() => { setResult(null); setContent(""); setFiles([]); }} />}

      {showAdd && <AddPresetModal onClose={() => setShowAdd(false)} onSaved={(p) => { loadPresets(); setPreset(p.id); setShowAdd(false); }} />}
    </DashboardLayout>
  );
}

const AddPresetModal = ({ onClose, onSaved }) => {
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [desc, setDesc] = useState("");
  const [context, setContext] = useState("");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!label.trim() || !context.trim()) { toast.error("Name and scoring context are required"); return; }
    const finalId = (id || label).trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    setSaving(true);
    try {
      const r = await api.post("/bulk/presets", { id: finalId, label: label.trim(), desc: desc.trim(), context: context.trim() });
      toast.success("Preset saved");
      onSaved(r.data);
    } catch (e) {
      toast.error(e?.response?.data?.detail || "Could not save preset");
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm grid place-items-center p-4" onClick={onClose} data-testid="add-preset-modal">
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-xl font-semibold">Add a client / industry preset</h3>
          <button onClick={onClose} data-testid="close-preset-modal" className="text-[hsl(var(--ink-3))] hover:text-[hsl(var(--ink))]"><X className="w-5 h-5" /></button>
        </div>
        <p className="text-sm text-[hsl(var(--ink-2))] mt-1">Define a scoring profile specific to one of your customers. This context is added to the LLM prompt for every interaction scored under this preset.</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Display name</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} data-testid="preset-label" className="input mt-1.5" placeholder="Acme Fitness · Membership support" />
          </label>
          <label className="block">
            <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">ID (optional)</span>
            <input value={id} onChange={(e) => setId(e.target.value)} data-testid="preset-id" className="input mt-1.5" placeholder="auto from name" />
          </label>
        </div>
        <label className="block mt-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Short description</span>
          <input value={desc} onChange={(e) => setDesc(e.target.value)} data-testid="preset-desc" className="input mt-1.5" placeholder="SaaS fitness · retention-focused · payment disputes" />
        </label>
        <label className="block mt-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Scoring context *</span>
          <textarea
            rows={8}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            data-testid="preset-context"
            className="input mt-1.5 leading-relaxed"
            placeholder={"Client: Acme Fitness — SaaS fitness-studio operators. Agents handle membership payment disputes, class-booking issues, and cancellation prevention.\n\nHard fails: (a) promises a refund outside the 7-day window, (b) doesn't verify account ownership before sharing payment details, (c) cancels without offering a pause.\n\nChurn signals: 'moving to ClassPass', 'too expensive', '2nd billing issue', 'cancel my account'.\n\nUpsell signals: 'adding another instructor', 'opening a second location'."}
          />
        </label>
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="btn-ghost" data-testid="preset-cancel">Cancel</button>
          <button onClick={save} disabled={saving} className="btn-primary flex items-center gap-2" data-testid="preset-save">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "Saving…" : "Save preset"}
          </button>
        </div>
      </div>
    </div>
  );
};

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
        <div className="flex gap-2">
          <button
            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/dashboard/bulk/${r.batch_id}`); toast.success("Batch URL copied"); }}
            data-testid="bulk-copy-link"
            className="btn-ghost"
          >
            Copy link
          </button>
          <button onClick={reset} className="btn-ghost" data-testid="bulk-new-btn">Run another batch</button>
        </div>
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

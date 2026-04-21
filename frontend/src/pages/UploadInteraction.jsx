import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { Upload as UploadIcon, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const SAMPLES = [
  {
    label: "Billing complaint (high churn risk)",
    customer: "Acme Corp",
    agent: "Alex Rodriguez",
    agent_type: "Human",
    channel: "Voice",
    type: "Billing",
    transcript: "Customer: Third call this month about the same charge — I'm looking at competitors.\nAgent: Our refund policy is 14 days, so I can't refund this.\nCustomer: That's not what your other rep told me. I need this escalated now.",
  },
  {
    label: "AI hallucination",
    customer: "Summit Logistics",
    agent: "Support Bot v3",
    agent_type: "AI",
    channel: "Chat",
    type: "Billing",
    transcript: "Customer: Does my plan include unlimited international calls?\nAgent: Yes, your subscription includes unlimited data and unlimited international calls on all plans.",
  },
  {
    label: "Upsell opportunity",
    customer: "NovaTech Ltd.",
    agent: "Emma Davis",
    agent_type: "Human",
    channel: "Chat",
    type: "Upsell",
    transcript: "Customer: We're adding two more offices next quarter, want to make sure we're on the right plan.\nAgent: Great — the Scale tier is a better fit, I'll loop in your AM.",
  },
];

export default function UploadInteraction() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    customer: "", agent: "", agent_type: "Human", channel: "Voice", type: "General", transcript: "", duration_sec: 0,
  });
  const [loading, setLoading] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const loadSample = (s) => setForm({ ...form, ...s });

  const submit = async (e) => {
    e.preventDefault();
    if (!form.customer || !form.agent || !form.transcript) {
      toast.error("Customer, agent, and transcript are required");
      return;
    }
    setLoading(true);
    try {
      const r = await api.post("/interactions", form);
      toast.success("Scored! Opening analysis…");
      navigate(`/dashboard/interactions/${r.data.interaction_id}`);
    } catch (err) {
      toast.error("Scoring failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Upload Interaction" subtitle="Drop in a transcript — RetOps will score it, detect churn risk, and produce a coaching card.">
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-5">
        <form onSubmit={submit} className="ret-card p-6" data-testid="upload-form">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Customer / Account">
              <input data-testid="in-customer" value={form.customer} onChange={(e) => set("customer", e.target.value)} className="input" placeholder="Acme Corp" />
            </Field>
            <Field label="Agent">
              <input data-testid="in-agent" value={form.agent} onChange={(e) => set("agent", e.target.value)} className="input" placeholder="Alex Rodriguez" />
            </Field>
            <Field label="Agent type">
              <select data-testid="in-agent-type" value={form.agent_type} onChange={(e) => set("agent_type", e.target.value)} className="input">
                <option>Human</option><option>AI</option>
              </select>
            </Field>
            <Field label="Channel">
              <select data-testid="in-channel" value={form.channel} onChange={(e) => set("channel", e.target.value)} className="input">
                <option>Voice</option><option>Chat</option><option>Email</option><option>Ticket</option>
              </select>
            </Field>
            <Field label="Interaction type">
              <input data-testid="in-type" value={form.type} onChange={(e) => set("type", e.target.value)} className="input" placeholder="Billing / Technical / Renewal" />
            </Field>
            <Field label="Duration (seconds)">
              <input data-testid="in-duration" type="number" value={form.duration_sec} onChange={(e) => set("duration_sec", parseInt(e.target.value || "0", 10))} className="input" />
            </Field>
          </div>
          <Field label="Transcript" className="mt-4">
            <textarea data-testid="in-transcript" value={form.transcript} onChange={(e) => set("transcript", e.target.value)} rows={12} className="input font-code text-xs leading-relaxed" placeholder="Paste or type the interaction transcript here…" />
          </Field>
          <button data-testid="score-btn" disabled={loading} type="submit" className="btn-primary mt-5 flex items-center gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? "Scoring with LLM…" : "Score this interaction"}
          </button>
        </form>

        <div className="space-y-4">
          <div className="ret-card p-6">
            <h3 className="font-display text-lg font-semibold flex items-center gap-2">
              <UploadIcon className="w-4 h-4 text-[hsl(var(--brand))]" /> Load a sample
            </h3>
            <p className="text-sm text-[hsl(var(--ink-2))] mt-1">
              Try one of the preset scenarios to see RetOps score human and AI interactions in real time.
            </p>
            <div className="mt-4 space-y-2">
              {SAMPLES.map((s, i) => (
                <button key={i} data-testid={`sample-${i}`} onClick={() => loadSample(s)} className="w-full text-left p-3 border border-[hsl(var(--line))] rounded-xl hover:border-[hsl(var(--brand-200))] hover:bg-[hsl(var(--bg-subtle))] transition-colors">
                  <p className="text-sm font-semibold">{s.label}</p>
                  <p className="text-xs text-[hsl(var(--ink-3))] mt-0.5">{s.customer} · {s.agent_type} · {s.channel}</p>
                </button>
              ))}
            </div>
          </div>

          <div className="ret-card p-6 bg-[hsl(var(--brand-100))] border-[hsl(168_40%_82%)]">
            <p className="text-xs uppercase tracking-widest text-[hsl(var(--brand-ink))] font-semibold">How scoring works</p>
            <ul className="text-sm text-[hsl(var(--brand-ink))]/80 mt-3 space-y-1.5 list-disc list-inside">
              <li>7-dimension rubric against your QA standards</li>
              <li>Churn risk + dollar exposure estimate</li>
              <li>AI hallucination & policy compliance checks</li>
              <li>Generates coaching card and save playbook</li>
            </ul>
          </div>
        </div>
      </div>

      <style>{`.input{width:100%;padding:10px 12px;border:1px solid hsl(var(--line));border-radius:10px;background:#fff;font-size:14px;transition:border-color 120ms ease}.input:focus{outline:none;border-color:hsl(var(--brand));box-shadow:0 0 0 3px hsl(var(--brand-100))}`}</style>
    </DashboardLayout>
  );
}

const Field = ({ label, children, className = "" }) => (
  <label className={`block ${className}`}>
    <span className="block text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))] mb-1.5">{label}</span>
    {children}
  </label>
);

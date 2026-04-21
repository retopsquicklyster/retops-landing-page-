import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { Save, Eye, EyeOff, Check } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = {
  openai: { label: "OpenAI", models: ["gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-4o", "gpt-4o-mini", "gpt-4.1-mini"] },
  anthropic: { label: "Anthropic", models: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001", "claude-opus-4-5-20251101"] },
  gemini: { label: "Google Gemini", models: ["gemini-3-flash-preview", "gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"] },
};

export default function Settings() {
  const [s, setS] = useState({ llm_provider: "openai", llm_model: "gpt-4o-mini", custom_api_key: "" });
  const [saving, setSaving] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => { api.get("/settings").then((r) => setS(r.data)); }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", s);
      toast.success("Settings saved");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const providerCfg = PROVIDERS[s.llm_provider] || PROVIDERS.openai;

  return (
    <DashboardLayout title="Settings" subtitle="LLM provider, API keys, and workspace preferences">
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-5 max-w-6xl">
        <div className="ret-card p-6" data-testid="llm-settings">
          <h3 className="font-display text-lg font-semibold">LLM provider</h3>
          <p className="text-sm text-[hsl(var(--ink-2))] mt-1">By default RetOps uses your Emergent LLM key. You can plug in your own OpenAI, Anthropic, or Gemini key below.</p>

          <div className="mt-5 grid grid-cols-2 gap-4">
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Provider</span>
              <select data-testid="provider-select" value={s.llm_provider} onChange={(e) => setS({ ...s, llm_provider: e.target.value, llm_model: PROVIDERS[e.target.value].models[0] })} className="mt-1.5 w-full p-2.5 border border-[hsl(var(--line))] rounded-xl bg-white">
                {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Model</span>
              <select data-testid="model-select" value={s.llm_model} onChange={(e) => setS({ ...s, llm_model: e.target.value })} className="mt-1.5 w-full p-2.5 border border-[hsl(var(--line))] rounded-xl bg-white">
                {providerCfg.models.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
          </div>

          <label className="block mt-4">
            <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Your {providerCfg.label} API key <span className="text-[hsl(var(--ink-3))] normal-case font-normal">(optional — leave blank to use Emergent key)</span></span>
            <div className="relative mt-1.5">
              <input data-testid="api-key-input" type={show ? "text" : "password"} value={s.custom_api_key} onChange={(e) => setS({ ...s, custom_api_key: e.target.value })} className="w-full p-2.5 pr-10 border border-[hsl(var(--line))] rounded-xl bg-white font-mono text-xs" placeholder="sk-…" />
              <button type="button" onClick={() => setShow(!show)} className="absolute right-2 top-1/2 -translate-y-1/2 text-[hsl(var(--ink-3))] hover:text-[hsl(var(--ink))]">
                {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </label>

          <button data-testid="save-settings-btn" onClick={save} disabled={saving} className="btn-primary mt-6 flex items-center gap-2">
            {saving ? "Saving…" : <><Save className="w-4 h-4" /> Save settings</>}
          </button>
        </div>

        <div className="space-y-5">
          <div className="ret-card p-6">
            <h3 className="font-display text-lg font-semibold">Active configuration</h3>
            <div className="mt-4 space-y-3">
              <Row label="Provider" value={providerCfg.label} />
              <Row label="Model" value={s.llm_model} mono />
              <Row label="Using custom key" value={s.custom_api_key ? "Yes" : "No — Emergent key"} />
            </div>
          </div>
          <div className="ret-card p-6 bg-[hsl(var(--brand-100))] border-[hsl(168_40%_82%)]">
            <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--brand-ink))]">Roadmap</p>
            <ul className="mt-2 text-sm text-[hsl(var(--brand-ink))]/80 space-y-1.5">
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5" /> Multi-provider LLM support</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5" /> BYO API keys</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5" /> Custom QA rubric (coming soon)</li>
              <li className="flex items-center gap-2"><Check className="w-3.5 h-3.5" /> CRM / helpdesk integrations (coming soon)</li>
            </ul>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

const Row = ({ label, value, mono }) => (
  <div className="flex items-center justify-between py-2 border-b border-[hsl(var(--line-2))] last:border-0">
    <span className="text-sm text-[hsl(var(--ink-2))]">{label}</span>
    <span className={`text-sm font-semibold ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

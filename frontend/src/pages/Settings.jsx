import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { Save, Eye, EyeOff, KeyRound, Globe, Bell, SlidersHorizontal, Shield, RotateCcw, Pencil, Settings as SettingsGear, Check, UserPlus, Copy, Trash2, Send } from "lucide-react";
import { toast } from "sonner";

const PROVIDERS = {
  openai: { label: "OpenAI", models: ["gpt-5.2", "gpt-5.1", "gpt-5", "gpt-5-mini", "gpt-4o", "gpt-4o-mini", "gpt-4.1-mini"] },
  anthropic: { label: "Anthropic", models: ["claude-sonnet-4-5-20250929", "claude-haiku-4-5-20251001", "claude-opus-4-5-20251101"] },
  gemini: { label: "Google Gemini", models: ["gemini-3-flash-preview", "gemini-3.1-pro-preview", "gemini-2.5-pro", "gemini-2.5-flash"] },
};

const DEFAULTS = {
  llm_provider: "openai",
  llm_model: "gpt-4o-mini",
  custom_api_key: "",
  digest_subscribed: false,
  digest_email: "",
  ai_keys: { openai: "", elevenlabs: "", google_cloud: "", deepgram: "", azure: "" },
  integrations: {
    gohighlevel_api_key: "",
    twilio_api_key: "",
    slack_webhook: "",
    teams_webhook: "",
    salesforce_api_key: "",
    hubspot_api_key: "",
    zendesk_api_key: "",
    intercom_api_key: "",
  },
  notifications: { email_alerts: true, slack_alerts: false, critical_only: false, alert_email: "" },
  quality: { pass_threshold: 75, warning_threshold: 60, hard_fail_cap: 59, churn_alert_threshold: 50 },
  security: { retention_days: 90, data_encryption: true, audit_logging: true, access_logging: true },
};

const TABS = [
  { id: "ai",          label: "AI API Keys",         icon: KeyRound },
  { id: "integrations",label: "External Integrations", icon: Globe },
  { id: "team",        label: "Team",                icon: UserPlus },
  { id: "notify",      label: "Notifications",       icon: Bell },
  { id: "quality",     label: "Quality Thresholds",  icon: SlidersHorizontal },
  { id: "security",    label: "Security & Privacy",  icon: Shield },
];

export default function Settings() {
  const [s, setS] = useState(DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("ai");

  useEffect(() => {
    api.get("/settings").then((r) => setS(mergeDeep(DEFAULTS, r.data || {})));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await api.put("/settings", s);
      toast.success("Settings saved");
    } catch { toast.error("Save failed"); }
    finally { setSaving(false); }
  };

  const resetDefaults = () => {
    if (!window.confirm("Reset all settings to defaults? This will not delete your API keys yet — you must click Save afterwards.")) return;
    setS({ ...DEFAULTS, llm_provider: s.llm_provider, llm_model: s.llm_model, custom_api_key: s.custom_api_key });
    toast.info("Defaults restored — click Save to apply");
  };

  return (
    <DashboardLayout
      title="Settings"
      subtitle="Configure API keys, integrations, and system preferences"
      actions={
        <>
          <button data-testid="reset-defaults-btn" onClick={resetDefaults} className="btn-ghost flex items-center gap-2">
            <RotateCcw className="w-4 h-4" /> Reset to Defaults
          </button>
          <button data-testid="save-settings-btn" onClick={save} disabled={saving} className="btn-primary flex items-center gap-2">
            <Save className="w-4 h-4" /> {saving ? "Saving…" : "Save Settings"}
          </button>
        </>
      }
    >
      {/* Tab nav */}
      <div className="border-b border-[hsl(var(--line))] mb-6 overflow-x-auto" data-testid="settings-tabs">
        <div className="flex gap-1 min-w-max">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                onClick={() => setTab(id)}
                data-testid={`settings-tab-${id}`}
                className={`px-4 py-3 text-sm font-semibold inline-flex items-center gap-2 border-b-2 -mb-[2px] transition-colors ${active ? "border-[hsl(var(--retops-teal))] text-[hsl(var(--retops-navy))]" : "border-transparent text-[hsl(var(--ink-3))] hover:text-[hsl(var(--ink))]"}`}
              >
                <Icon className="w-4 h-4" /> {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr,1fr] gap-5">
        <div className="space-y-5">
          {tab === "ai" && <AiKeysTab s={s} setS={setS} />}
          {tab === "integrations" && <IntegrationsTab s={s} setS={setS} />}
          {tab === "team" && <TeamTab />}
          {tab === "notify" && <NotificationsTab s={s} setS={setS} />}
          {tab === "quality" && <QualityTab s={s} setS={setS} />}
          {tab === "security" && <SecurityTab s={s} setS={setS} />}
        </div>

        <div className="space-y-5">
          <ActiveConfigCard s={s} />
          <ReminderCard />
        </div>
      </div>
    </DashboardLayout>
  );
}

/* ───────── AI Keys ───────── */
const AiKeysTab = ({ s, setS }) => (
  <div className="ret-card p-6" data-testid="tab-ai">
    <h3 className="font-display text-lg font-semibold">AI Service API Keys</h3>
    <p className="text-sm text-[hsl(var(--ink-2))] mt-1">Configure your AI service API keys to enable conversation analysis, voice processing, and other AI features.</p>

    {/* Primary LLM provider (legacy field — preserved) */}
    <div className="mt-5 p-4 rounded-xl border border-[hsl(var(--line-2))] bg-[hsl(var(--brand-100))]/40">
      <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--brand-ink))]">Primary LLM (used for RetOps scoring)</p>
      <div className="grid grid-cols-2 gap-3 mt-3">
        <label className="block">
          <span className="text-xs font-semibold text-[hsl(var(--ink-3))]">Provider</span>
          <select data-testid="provider-select" value={s.llm_provider} onChange={(e) => setS({ ...s, llm_provider: e.target.value, llm_model: PROVIDERS[e.target.value].models[0] })} className="input mt-1.5">
            {Object.entries(PROVIDERS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="text-xs font-semibold text-[hsl(var(--ink-3))]">Model</span>
          <select data-testid="model-select" value={s.llm_model} onChange={(e) => setS({ ...s, llm_model: e.target.value })} className="input mt-1.5">
            {(PROVIDERS[s.llm_provider] || PROVIDERS.openai).models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
      </div>
    </div>

    <div className="mt-5 space-y-4">
      <SecretField
        tid="ai-openai"
        label="OpenAI API Key"
        desc="For conversation analysis, sentiment detection, and coaching recommendations"
        placeholder="sk-…"
        value={s.ai_keys?.openai || s.custom_api_key || ""}
        onChange={(v) => setS({ ...s, ai_keys: { ...s.ai_keys, openai: v }, custom_api_key: v })}
      />
      <SecretField tid="ai-elevenlabs" label="ElevenLabs API Key" desc="For voice synthesis and audio-generation" placeholder="…"
        value={s.ai_keys?.elevenlabs || ""} onChange={(v) => setS({ ...s, ai_keys: { ...s.ai_keys, elevenlabs: v } })} />
      <SecretField tid="ai-google" label="Google Cloud API Key" desc="For translation services and speech recognition" placeholder="…"
        value={s.ai_keys?.google_cloud || ""} onChange={(v) => setS({ ...s, ai_keys: { ...s.ai_keys, google_cloud: v } })} />
      <SecretField tid="ai-deepgram" label="Deepgram API Key" desc="For audio transcription and voice processing" placeholder="Token …"
        value={s.ai_keys?.deepgram || ""} onChange={(v) => setS({ ...s, ai_keys: { ...s.ai_keys, deepgram: v } })} />
      <SecretField tid="ai-azure" label="Azure Cognitive Services" desc="For multilingual support and advanced analytics" placeholder="…"
        value={s.ai_keys?.azure || ""} onChange={(v) => setS({ ...s, ai_keys: { ...s.ai_keys, azure: v } })} />
    </div>
  </div>
);

/* ───────── Integrations ───────── */
const INTEGRATIONS = [
  { id: "zendesk_api_key",     label: "Zendesk API Token",    pull: "Tickets, agent notes, customer history.", push: "Add internal notes, create escalation tickets, update agent tags.", testable: "zendesk", extraFields: [
    { id: "zendesk_subdomain", label: "Zendesk Subdomain", placeholder: "yourco (from yourco.zendesk.com)", masked: false },
    { id: "zendesk_email",     label: "Zendesk Admin Email",  placeholder: "admin@yourco.com", masked: false },
  ]},
  { id: "intercom_api_key",    label: "Intercom Access Token", pull: "Conversation threads, customer data.", push: "Add conversation notes, tag customers, create follow-up messages.", testable: "intercom" },
  { id: "gohighlevel_api_key", label: "GoHighLevel API Key",   pull: "CRM conversations, lead data, pipeline status.", push: "Update contact records, create tasks, trigger workflows." },
  { id: "twilio_api_key",      label: "Twilio API Key",        pull: "Call recordings, SMS conversations, voice analytics.", push: "Send SMS, create call tasks, log interactions." },
  { id: "slack_webhook",       label: "Slack Webhook URL",     push: "Send alerts, coaching tasks, escalations to Slack channels. Real-time notifications with action buttons.", placeholder: "https://hooks.slack.com/…" },
  { id: "teams_webhook",       label: "Microsoft Teams Webhook", push: "Create Teams notifications, supervisor alerts, and coaching task assignments with direct action links.", placeholder: "https://outlook.office.com/…" },
  { id: "salesforce_api_key",  label: "Salesforce API Key",    pull: "Import customer data, interaction history.", push: "Update customer records, create tasks, log coaching notes." },
  { id: "hubspot_api_key",     label: "HubSpot API Key",       pull: "Customer journey data, support tickets.", push: "Update contact properties, create follow-up tasks, trigger workflows." },
];

const IntegrationsTab = ({ s, setS }) => {
  const [testing, setTesting] = useState("");
  const [pulling, setPulling] = useState("");
  const [results, setResults] = useState({});
  const testConnector = async (connector) => {
    setTesting(connector);
    try {
      // persist first so the backend reads the latest creds
      await api.put("/settings", s);
      const r = await api.post("/integrations/test", { connector });
      setResults({ ...results, [connector]: r.data });
      r.data.ok ? toast.success(`${connector}: ${r.data.detail}`) : toast.error(`${connector}: ${r.data.detail}`);
    } catch (e) {
      toast.error(`Test failed: ${e.response?.data?.detail || e.message}`);
    } finally { setTesting(""); }
  };
  const pullRecent = async (connector) => {
    setPulling(connector);
    try {
      await api.put("/settings", s);
      const r = await api.post("/integrations/pull", { connector, limit: 10, dry_run: false });
      toast.success(`Pulled ${r.data.pulled} · scored ${r.data.scored} new interactions from ${connector}`);
    } catch (e) {
      toast.error(`Pull failed: ${e.response?.data?.detail || e.message}`);
    } finally { setPulling(""); }
  };
  return (
    <>
      <div className="ret-card p-6" data-testid="tab-integrations">
        <h3 className="font-display text-lg font-semibold">External System Integrations</h3>
        <p className="text-sm text-[hsl(var(--ink-2))] mt-1">Connect with your existing tools and platforms for seamless workflow integration. Tokens are encrypted at rest and scoped to your workspace.</p>
        <div className="mt-5 space-y-4">
          {INTEGRATIONS.map((it) => (
            <div key={it.id} className="p-4 rounded-xl border border-[hsl(var(--line-2))] bg-[hsl(var(--brand-100))]/10">
              <SecretField
                tid={`int-${it.id}`}
                label={it.label}
                placeholder={it.placeholder || "…"}
                value={s.integrations?.[it.id] || ""}
                onChange={(v) => setS({ ...s, integrations: { ...s.integrations, [it.id]: v } })}
              />
              {(it.extraFields || []).map((ef) => (
                <label key={ef.id} className="block mt-3">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">{ef.label}</span>
                  <input
                    type="text"
                    placeholder={ef.placeholder}
                    value={s.integrations?.[ef.id] || ""}
                    onChange={(e) => setS({ ...s, integrations: { ...s.integrations, [ef.id]: e.target.value } })}
                    data-testid={`int-${ef.id}`}
                    className="w-full p-2.5 border border-[hsl(var(--line))] rounded-xl bg-white text-xs"
                  />
                </label>
              ))}
              {it.testable && (
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <button onClick={() => testConnector(it.testable)} disabled={testing === it.testable} data-testid={`test-${it.testable}`} className="btn-ghost !py-1.5 !px-3 !text-xs inline-flex items-center gap-1.5">
                    {testing === it.testable ? "Testing…" : "Test connection"}
                  </button>
                  <button onClick={() => pullRecent(it.testable)} disabled={pulling === it.testable} data-testid={`pull-${it.testable}`} className="btn-ghost !py-1.5 !px-3 !text-xs inline-flex items-center gap-1.5">
                    {pulling === it.testable ? "Pulling…" : "Pull 10 recent"}
                  </button>
                  {results[it.testable] && (
                    <span className={`text-[11px] font-semibold ${results[it.testable].ok ? "text-emerald-700" : "text-red-600"}`}>
                      {results[it.testable].ok ? "✓ Connected" : "✗ " + results[it.testable].detail.slice(0, 80)}
                    </span>
                  )}
                </div>
              )}
              <div className="mt-2 text-xs text-[hsl(var(--ink-2))] space-y-0.5">
                {it.pull && <p><span className="font-bold text-emerald-700">PULL:</span> {it.pull}</p>}
                {it.push && <p><span className="font-bold text-blue-700">PUSH:</span> {it.push}</p>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="ret-card p-6" data-testid="integration-architecture">
      <h3 className="font-display text-lg font-semibold">Integration Architecture</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-4">
        <div>
          <p className="text-sm font-bold text-emerald-700">PULL Sources (Data Ingestion)</p>
          <ul className="mt-2 text-xs text-[hsl(var(--ink-2))] space-y-1 list-disc pl-5">
            <li>Call recordings from phone systems</li>
            <li>Chat transcripts from live chat platforms</li>
            <li>Support tickets and agent notes</li>
            <li>Customer interaction history</li>
            <li>CRM customer data and context</li>
            <li>Email conversations and threads</li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-bold text-blue-700">PUSH Actions (Workflow Integration)</p>
          <ul className="mt-2 text-xs text-[hsl(var(--ink-2))] space-y-1 list-disc pl-5">
            <li>Create coaching tasks in LMS systems</li>
            <li>Send supervisor alerts and escalations</li>
            <li>Add customer tags and interaction notes</li>
            <li>Open priority support tickets</li>
            <li>Schedule follow-up calls and callbacks</li>
            <li>Update agent performance records</li>
          </ul>
        </div>
      </div>
    </div>

    <div className="ret-card p-6" data-testid="deployment-options">
      <h3 className="font-display text-lg font-semibold">Deployment Options</h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
        {[
          { t: "Embedded Widget",      d: "Real-time QA scores and coaching tips directly in your helpdesk interface." },
          { t: "Side Panel Integration", d: "Customer risk scores and interaction history alongside support tickets." },
          { t: "Standalone Dashboard", d: "Complete analytics platform with full reporting and management features." },
        ].map((o) => (
          <div key={o.t} className="p-4 rounded-xl border border-[hsl(var(--line-2))] bg-[hsl(var(--brand-100))]/30">
            <p className="text-sm font-semibold">{o.t}</p>
            <p className="text-xs text-[hsl(var(--ink-2))] mt-1">{o.d}</p>
          </div>
        ))}
      </div>
    </div>
  </>
  );
};

/* ───────── Notifications ───────── */
const NotificationsTab = ({ s, setS }) => {
  const n = s.notifications || {};
  const upd = (k, v) => setS({ ...s, notifications: { ...n, [k]: v } });
  return (
    <div className="ret-card p-6" data-testid="tab-notify">
      <h3 className="font-display text-lg font-semibold">Notifications & Alerts</h3>
      <p className="text-sm text-[hsl(var(--ink-2))] mt-1">Configure how RetOps notifies you about scoring failures, churn signals, and coaching tasks.</p>
      <div className="mt-5 space-y-3">
        <Toggle label="Email alerts"          desc="Receive QA failures and churn signals in your inbox" value={!!n.email_alerts} onChange={(v) => upd("email_alerts", v)} tid="notif-email" />
        <Toggle label="Slack alerts"          desc="Real-time push to your Slack workspace webhook"       value={!!n.slack_alerts} onChange={(v) => upd("slack_alerts", v)} tid="notif-slack" />
        <Toggle label="Critical-only filter"  desc="Suppress everything except High-risk churn + hallucinations" value={!!n.critical_only} onChange={(v) => upd("critical_only", v)} tid="notif-critical" />
      </div>
      <label className="block mt-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Alert delivery email (optional)</span>
        <input type="email" value={n.alert_email || ""} onChange={(e) => upd("alert_email", e.target.value)} className="input mt-1.5" placeholder="ops@yourco.com" data-testid="notif-email-input" />
      </label>

      <div className="mt-5 p-4 rounded-xl border border-[hsl(var(--line-2))] bg-[hsl(var(--brand-100))]/30">
        <p className="text-sm font-semibold">Weekly digest</p>
        <p className="text-xs text-[hsl(var(--ink-2))] mt-1">Automated Monday email — ARR at risk, top alerts, coaching priorities.</p>
        <div className="mt-3 flex items-center gap-3">
          <input type="checkbox" className="w-4 h-4" checked={!!s.digest_subscribed} onChange={(e) => setS({ ...s, digest_subscribed: e.target.checked })} data-testid="settings-digest-toggle" id="digest-sub" />
          <label htmlFor="digest-sub" className="text-sm">Subscribe to weekly digest</label>
        </div>
        <input type="email" value={s.digest_email || ""} onChange={(e) => setS({ ...s, digest_email: e.target.value })} placeholder="leave blank = your login email" className="input mt-3" data-testid="settings-digest-email-input" />
      </div>
    </div>
  );
};

/* ───────── Quality Thresholds ───────── */
const QualityTab = ({ s, setS }) => {
  const q = s.quality || {};
  const upd = (k, v) => setS({ ...s, quality: { ...q, [k]: Number(v) || 0 } });
  return (
    <div className="ret-card p-6" data-testid="tab-quality">
      <h3 className="font-display text-lg font-semibold">Quality Thresholds</h3>
      <p className="text-sm text-[hsl(var(--ink-2))] mt-1">Tune the QA score bands used across dashboards and coaching triggers.</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
        <NumField label="Pass threshold (QA score ≥)" desc="Above this, the interaction is marked Passing/Good." value={q.pass_threshold} onChange={(v) => upd("pass_threshold", v)} tid="q-pass" />
        <NumField label="Warning threshold (QA score ≥)" desc="Below Pass but above this, flagged as Watch." value={q.warning_threshold} onChange={(v) => upd("warning_threshold", v)} tid="q-warn" />
        <NumField label="Hard-fail cap" desc="If any hard-fail gate trips, score is capped at this value." value={q.hard_fail_cap} onChange={(v) => upd("hard_fail_cap", v)} tid="q-hfc" />
        <NumField label="Churn alert threshold (risk score ≥)" desc="Triggers the Risk Monitor alert + save playbook." value={q.churn_alert_threshold} onChange={(v) => upd("churn_alert_threshold", v)} tid="q-churn" />
      </div>
    </div>
  );
};

/* ───────── Security & Privacy ───────── */
const SecurityTab = ({ s, setS }) => {
  const sec = s.security || {};
  const upd = (k, v) => setS({ ...s, security: { ...sec, [k]: v } });
  return (
    <div className="ret-card p-6" data-testid="tab-security">
      <h3 className="font-display text-lg font-semibold">Security & Privacy Settings</h3>
      <p className="text-sm text-[hsl(var(--ink-2))] mt-1">Configure data retention, encryption, and audit logging preferences.</p>

      <label className="block mt-5">
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Data Retention Period (days)</span>
        <select value={sec.retention_days} onChange={(e) => upd("retention_days", Number(e.target.value))} className="input mt-1.5" data-testid="sec-retention">
          {[30, 60, 90, 180, 365, 730].map((d) => <option key={d} value={d}>{d} days</option>)}
        </select>
        <p className="text-xs text-[hsl(var(--ink-3))] mt-1.5">How long to retain interaction data and recordings</p>
      </label>

      <div className="mt-5 space-y-3">
        <Toggle label="Data Encryption" desc="Encrypt all data at rest and in transit." value={!!sec.data_encryption} onChange={(v) => upd("data_encryption", v)} tid="sec-encryption" />
        <Toggle label="Audit Logging"   desc="Log all system activities and changes."  value={!!sec.audit_logging}   onChange={(v) => upd("audit_logging", v)} tid="sec-audit" />
        <Toggle label="Access Logging"  desc="Track user access and login attempts."   value={!!sec.access_logging}  onChange={(v) => upd("access_logging", v)} tid="sec-access" />
      </div>
    </div>
  );
};


/* ───────── Team (workspace invites) ───────── */
const TeamTab = () => {
  const [emails, setEmails] = useState(["", "", ""]);
  const [invites, setInvites] = useState([]);
  const [sending, setSending] = useState(false);

  const loadInvites = async () => {
    try {
      const r = await api.get("/workspace/invites");
      setInvites(r.data.invites || []);
    } catch {}
  };
  useEffect(() => { loadInvites(); }, []);

  const sendInvites = async () => {
    const clean = emails.map((e) => e.trim()).filter(Boolean);
    if (!clean.length) { toast.error("Enter at least one email"); return; }
    setSending(true);
    try {
      const r = await api.post("/workspace/invites", { emails: clean });
      const { created, sent_via_email, invites: newInvites } = r.data;
      if (sent_via_email > 0) toast.success(`${sent_via_email} invite email${sent_via_email > 1 ? "s" : ""} sent · ${created - sent_via_email} link${created - sent_via_email !== 1 ? "s" : ""} ready to copy`);
      else toast.success(`${created} magic link${created > 1 ? "s" : ""} generated — copy and share`);
      setEmails(["", "", ""]);
      setInvites((prev) => [...newInvites.map((n) => ({ ...n, status: "pending" })), ...prev]);
      loadInvites();
    } catch (e) {
      toast.error(e.response?.data?.detail || "Failed to send invites");
    } finally { setSending(false); }
  };

  const revoke = async (token) => {
    if (!window.confirm("Revoke this invite?")) return;
    try {
      await api.delete(`/workspace/invites/${token}`);
      toast.success("Invite revoked");
      setInvites((v) => v.filter((i) => i.token !== token));
    } catch { toast.error("Failed to revoke"); }
  };

  const copyLink = (token) => {
    const link = `${window.location.origin}/invite/${token}`;
    navigator.clipboard?.writeText(link);
    toast.success("Magic link copied to clipboard");
  };

  return (
    <div className="ret-card p-6" data-testid="tab-team">
      <h3 className="font-display text-lg font-semibold">Invite your teammates</h3>
      <p className="text-sm text-[hsl(var(--ink-2))] mt-1">
        Drop their emails below — each gets a magic link into your workspace. They'll see the same interactions, coaching cards, and churn alerts you do.
      </p>

      <div className="mt-5 space-y-2.5">
        {emails.map((e, i) => (
          <div key={i} className="flex gap-2 items-center">
            <input
              type="email"
              value={e}
              onChange={(ev) => setEmails((list) => list.map((x, idx) => (idx === i ? ev.target.value : x)))}
              placeholder={i === 0 ? "sarah@yourco.com" : i === 1 ? "tyler@yourco.com" : "add another…"}
              className="input flex-1"
              data-testid={`invite-email-${i}`}
            />
            {emails.length > 1 && (
              <button onClick={() => setEmails((list) => list.filter((_, idx) => idx !== i))} className="text-[hsl(var(--ink-3))] hover:text-red-500 p-2" aria-label="Remove"><Trash2 className="w-4 h-4" /></button>
            )}
          </div>
        ))}
        <button onClick={() => setEmails((list) => [...list, ""])} className="text-xs font-semibold text-[hsl(var(--retops-teal))] hover:underline flex items-center gap-1" data-testid="add-invite-row">
          <UserPlus className="w-3.5 h-3.5" /> Add another teammate
        </button>
      </div>

      <button
        onClick={sendInvites}
        disabled={sending}
        data-testid="send-invites-btn"
        className="btn-primary mt-5 flex items-center gap-2"
      >
        <Send className="w-4 h-4" /> {sending ? "Sending…" : "Send invites"}
      </button>

      {invites.length > 0 && (
        <div className="mt-7 pt-5 border-t border-[hsl(var(--line-2))]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[hsl(var(--ink-3))]">Invites · {invites.length}</p>
          <div className="mt-3 space-y-2">
            {invites.map((inv) => {
              const status = inv.status || "pending";
              const pill = status === "accepted" ? "bg-emerald-50 text-emerald-700 border-emerald-200" : status === "expired" ? "bg-gray-100 text-gray-500 border-gray-200" : "bg-amber-50 text-amber-700 border-amber-200";
              return (
                <div key={inv.token} className="p-3 rounded-xl border border-[hsl(var(--line-2))] flex items-center justify-between gap-3 flex-wrap" data-testid={`invite-row-${inv.token.slice(0,8)}`}>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{inv.email}</p>
                    <p className="text-[11px] text-[hsl(var(--ink-3))] mt-0.5">{inv.created_at ? new Date(inv.created_at).toLocaleString() : "Just now"}</p>
                  </div>
                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-full border ${pill}`}>{status}</span>
                  {status === "pending" && (
                    <div className="flex gap-1">
                      <button onClick={() => copyLink(inv.token)} className="btn-ghost !py-1.5 !px-3 !text-xs inline-flex items-center gap-1.5" data-testid={`copy-invite-${inv.token.slice(0,8)}`}>
                        <Copy className="w-3.5 h-3.5" /> Copy link
                      </button>
                      <button onClick={() => revoke(inv.token)} className="btn-ghost !py-1.5 !px-3 !text-xs text-red-500 inline-flex items-center gap-1.5" data-testid={`revoke-invite-${inv.token.slice(0,8)}`}>
                        <Trash2 className="w-3.5 h-3.5" /> Revoke
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};


/* ───────── Shared right-side cards ───────── */
const ActiveConfigCard = ({ s }) => (
  <div className="ret-card p-6" data-testid="active-config-card">
    <h3 className="font-display text-lg font-semibold">Active configuration</h3>
    <div className="mt-4 space-y-2">
      <Row label="Provider" value={(PROVIDERS[s.llm_provider] || PROVIDERS.openai).label} />
      <Row label="Model" value={s.llm_model} mono />
      <Row label="Custom key" value={s.custom_api_key || s.ai_keys?.openai ? "Yes" : "RetOps-managed"} />
      <Row label="Digest subscription" value={s.digest_subscribed ? (s.digest_email || "login email") : "Off"} />
      <Row label="Retention" value={`${s.security?.retention_days || 90} days`} />
      <Row label="Pass threshold" value={`≥ ${s.quality?.pass_threshold || 75}`} mono />
    </div>
  </div>
);

const ReminderCard = () => (
  <div className="ret-card p-6 bg-[hsl(var(--brand-100))]/70 border-[hsl(168_40%_82%)]" data-testid="reminder-card">
    <div className="flex items-start gap-3">
      <SettingsGear className="w-5 h-5 mt-0.5 text-[hsl(var(--brand-ink))]" />
      <div>
        <p className="text-sm font-semibold text-[hsl(var(--brand-ink))]">Configuration Reminder</p>
        <p className="text-xs text-[hsl(var(--brand-ink))]/80 mt-1 leading-relaxed">Remember to save your settings after making changes. API keys are stored securely and encrypted.</p>
      </div>
    </div>
    <ul className="mt-4 text-xs text-[hsl(var(--brand-ink))]/80 space-y-1.5">
      <li className="flex items-center gap-2"><Check className="w-3 h-3" /> Multi-provider LLM support</li>
      <li className="flex items-center gap-2"><Check className="w-3 h-3" /> BYO API keys for every AI service</li>
      <li className="flex items-center gap-2"><Check className="w-3 h-3" /> Webhook-based push to Slack / Teams</li>
      <li className="flex items-center gap-2"><Check className="w-3 h-3" /> Per-workspace retention policy</li>
    </ul>
  </div>
);

/* ───────── Primitives ───────── */
const SecretField = ({ tid, label, desc, placeholder, value, onChange }) => {
  const [show, setShow] = useState(false);
  return (
    <div>
      <label className="block">
        <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">{label}</span>
        <div className="relative mt-1.5">
          <input
            data-testid={tid}
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="w-full p-2.5 pr-16 border border-[hsl(var(--line))] rounded-xl bg-white font-code text-xs"
            placeholder={placeholder}
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex gap-1">
            <button type="button" onClick={() => setShow(!show)} className="text-[hsl(var(--ink-3))] hover:text-[hsl(var(--ink))] p-1" aria-label="toggle visibility">
              {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            <button type="button" className="text-[hsl(var(--ink-3))] hover:text-[hsl(var(--ink))] p-1" aria-label="edit">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </label>
      {desc && <p className="text-xs text-[hsl(var(--ink-3))] mt-1.5">{desc}</p>}
    </div>
  );
};

const Toggle = ({ label, desc, value, onChange, tid }) => (
  <label className="flex items-center justify-between p-3 rounded-xl border border-[hsl(var(--line-2))] cursor-pointer hover:bg-[hsl(var(--brand-100))]/20 transition-colors">
    <div>
      <p className="text-sm font-semibold">{label}</p>
      {desc && <p className="text-xs text-[hsl(var(--ink-3))] mt-0.5">{desc}</p>}
    </div>
    <span className="inline-flex items-center">
      <input type="checkbox" className="sr-only peer" checked={!!value} onChange={(e) => onChange(e.target.checked)} data-testid={tid} />
      <span className="w-11 h-6 bg-gray-200 peer-checked:bg-[hsl(var(--retops-teal))] rounded-full relative transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:shadow after:transition peer-checked:after:translate-x-5"></span>
    </span>
  </label>
);

const NumField = ({ label, desc, value, onChange, tid }) => (
  <label className="block">
    <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">{label}</span>
    <input type="number" min={0} max={100} value={value ?? ""} onChange={(e) => onChange(e.target.value)} className="input mt-1.5 tabular-nums" data-testid={tid} />
    {desc && <p className="text-xs text-[hsl(var(--ink-3))] mt-1.5">{desc}</p>}
  </label>
);

const Row = ({ label, value, mono }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-[hsl(var(--line-2))] last:border-0">
    <span className="text-xs text-[hsl(var(--ink-2))]">{label}</span>
    <span className={`text-xs font-semibold truncate max-w-[60%] text-right ${mono ? "font-mono" : ""}`}>{value}</span>
  </div>
);

function mergeDeep(a, b) {
  const out = { ...a };
  for (const k of Object.keys(b || {})) {
    if (b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && typeof a[k] === "object" && a[k] !== null) {
      out[k] = mergeDeep(a[k], b[k]);
    } else if (b[k] !== undefined && b[k] !== null) {
      out[k] = b[k];
    }
  }
  return out;
}

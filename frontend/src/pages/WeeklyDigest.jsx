import { useEffect, useState } from "react";
import DashboardLayout from "../components/DashboardLayout";
import { api, API } from "../lib/api";
import { Mail, Send, Check, AlertTriangle, TrendingUp, GraduationCap, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const fmtMoney = (v) => (v ? `$${Number(v).toLocaleString()}` : "$0");

export default function WeeklyDigest() {
  const navigate = useNavigate();
  const [d, setD] = useState(null);
  const [settings, setSettings] = useState(null);
  const [sending, setSending] = useState(false);
  const [history, setHistory] = useState([]);

  const load = async () => {
    const [dg, st, hs] = await Promise.all([
      api.get("/digest/preview"),
      api.get("/settings"),
      api.get("/digest/history").catch(() => ({ data: [] })),
    ]);
    setD(dg.data);
    setSettings(st.data);
    setHistory(hs.data || []);
  };

  useEffect(() => { load(); }, []);

  const toggleSubscribe = async (val) => {
    try {
      await api.post("/digest/subscribe", { subscribed: val });
      setSettings((s) => ({ ...s, digest_subscribed: val }));
      toast.success(val ? "Subscribed to weekly digest" : "Unsubscribed");
    } catch { toast.error("Could not update subscription"); }
  };

  const sendNow = async () => {
    setSending(true);
    try {
      const r = await api.post("/digest/send-now");
      const status = r.data.delivery?.status;
      if (status === "sent") toast.success(`Digest emailed to ${r.data.recipient}`);
      else if (status === "logged") toast.success("Digest rendered & logged (add RESEND_API_KEY to send real email)");
      else toast.error(`Send failed: ${r.data.delivery?.error || "unknown"}`);
      load();
    } catch { toast.error("Send failed"); }
    finally { setSending(false); }
  };

  if (!d) return <DashboardLayout title="Weekly Digest" subtitle="Loading…"><div className="py-10 text-sm text-[hsl(var(--retops-muted))]">Loading digest…</div></DashboardLayout>;

  const k = d.kpis;

  return (
    <DashboardLayout
      title="Weekly Digest"
      subtitle={`Automated executive summary · ${d.period.from} → ${d.period.to}`}
      actions={
        <div className="flex items-center gap-2">
          <a
            href={`${API}/digest/preview.html`}
            target="_blank"
            rel="noreferrer"
            data-testid="digest-preview-html-link"
            className="text-sm px-4 py-2 rounded-xl border border-[hsl(var(--line))] hover:bg-white font-semibold"
          >
            Open email preview
          </a>
          <button
            data-testid="digest-send-now-btn"
            onClick={sendNow}
            disabled={sending}
            className="btn-primary flex items-center gap-2"
          >
            {sending ? "Sending…" : <><Send className="w-4 h-4" /> Send to my email</>}
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 xl:grid-cols-[1.5fr,1fr] gap-6">
        {/* LEFT — Digest content */}
        <div className="space-y-6" data-testid="digest-content">
          {/* KPI strip */}
          <div className="grid grid-cols-3 gap-3">
            <Kpi label="Revenue at risk" value={fmtMoney(k.arr_at_risk)} tone="risk" testid="kpi-arr" sub={`${k.accounts_at_risk} accounts`} />
            <Kpi label="Avg QA score" value={k.avg_qa_score || "—"} tone="neutral" testid="kpi-avg" sub={`${k.total_interactions} scored`} />
            <Kpi label="AI issues" value={k.hallucinations + k.policy_fails} tone="warn" testid="kpi-ai" sub={`${k.hallucinations} halluc · ${k.policy_fails} policy`} />
          </div>

          {/* Subscribe card */}
          <div className="ret-card p-5 flex items-center justify-between" data-testid="digest-subscribe-card">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[hsl(var(--brand-100))] text-[hsl(var(--brand-ink))] grid place-items-center">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <div className="font-display font-semibold text-[hsl(var(--retops-navy))]">Weekly digest subscription</div>
                <div className="text-xs text-[hsl(var(--retops-muted))]">Delivered every Monday to {settings?.digest_email || "your login email"}.</div>
              </div>
            </div>
            <label className="inline-flex items-center gap-2 cursor-pointer" data-testid="digest-subscribe-toggle">
              <input
                type="checkbox"
                className="sr-only peer"
                checked={!!settings?.digest_subscribed}
                onChange={(e) => toggleSubscribe(e.target.checked)}
              />
              <span className="w-11 h-6 bg-gray-200 peer-checked:bg-[hsl(var(--retops-teal))] rounded-full relative transition after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:w-5 after:h-5 after:bg-white after:rounded-full after:shadow after:transition peer-checked:after:translate-x-5"></span>
              <span className="text-sm font-semibold">{settings?.digest_subscribed ? "On" : "Off"}</span>
            </label>
          </div>

          {/* Top at-risk */}
          <section className="ret-card p-6" data-testid="digest-at-risk">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Top at-risk accounts</h3>
              <AlertTriangle className="w-4 h-4 text-[hsl(var(--retops-danger))]" />
            </div>
            {d.top_at_risk.length === 0 ? (
              <p className="text-sm text-[hsl(var(--retops-muted))] mt-3">No at-risk accounts this week.</p>
            ) : (
              <ul className="mt-4 divide-y divide-[hsl(var(--line-2))]">
                {d.top_at_risk.map((x) => (
                  <li
                    key={x.customer}
                    className="py-3 flex items-start justify-between gap-4 cursor-pointer hover:bg-gray-50 rounded-lg px-2 -mx-2"
                    onClick={() => navigate(`/dashboard/interactions/${x.last_interaction_id}`)}
                    data-testid={`at-risk-${x.customer.replace(/\s+/g,'-').toLowerCase()}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[hsl(var(--retops-navy))]">{x.customer}</div>
                      <div className="text-xs text-[hsl(var(--retops-muted))] mt-0.5 truncate">{x.last_signal || "Multiple churn signals detected"}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-[hsl(var(--retops-danger))]">{fmtMoney(x.arr_at_risk)}</div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--retops-muted))]">{x.churn_risk}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Coaching */}
          <section className="ret-card p-6" data-testid="digest-coaching">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Coaching priorities</h3>
              <GraduationCap className="w-4 h-4 text-[hsl(var(--retops-teal))]" />
            </div>
            {d.coaching_priorities.length === 0 ? (
              <p className="text-sm text-[hsl(var(--retops-muted))] mt-3">No coaching actions required.</p>
            ) : (
              <ul className="mt-4 divide-y divide-[hsl(var(--line-2))]">
                {d.coaching_priorities.map((c) => (
                  <li key={c.agent} className="py-3 flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-[hsl(var(--retops-navy))]">{c.agent}</div>
                      <div className="text-xs text-[hsl(var(--retops-muted))]">{c.type} · {c.interactions} interaction{c.interactions !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold">Avg {c.avg_score || "—"}</div>
                      <div className="text-[10px] uppercase tracking-wider font-semibold text-[hsl(var(--retops-muted))]">{c.cards} card{c.cards !== 1 ? "s" : ""}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Upsells */}
          <section className="ret-card p-6" data-testid="digest-upsells">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">Expansion signals <span className="text-[hsl(var(--retops-teal))]">+${(k.upsell_monthly || 0).toLocaleString()}/mo</span></h3>
              <TrendingUp className="w-4 h-4 text-[hsl(var(--retops-teal))]" />
            </div>
            {d.upsells.length === 0 ? (
              <p className="text-sm text-[hsl(var(--retops-muted))] mt-3">No expansion signals detected this week.</p>
            ) : (
              <ul className="mt-4 divide-y divide-[hsl(var(--line-2))]">
                {d.upsells.map((u, i) => (
                  <li key={i} className="py-3 flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-[hsl(var(--retops-navy))]">{u.customer}</div>
                      <div className="text-xs text-[hsl(var(--retops-muted))] mt-0.5 truncate">{u.signal}</div>
                    </div>
                    <div className="text-sm font-bold text-[hsl(var(--retops-teal))]">+${u.monthly.toLocaleString()}/mo</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* RIGHT — live email preview iframe + history */}
        <div className="space-y-5">
          <div className="ret-card overflow-hidden" data-testid="digest-email-preview">
            <div className="px-5 py-3 border-b border-[hsl(var(--line-2))] flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-wider font-semibold text-[hsl(var(--retops-muted))]">Email preview</div>
                <div className="text-sm font-semibold text-[hsl(var(--retops-navy))]">What leaders receive</div>
              </div>
              <a
                href={`${API}/digest/preview.html`}
                target="_blank"
                rel="noreferrer"
                className="text-[hsl(var(--retops-teal))] text-xs font-semibold flex items-center gap-1"
              >
                Full view <ArrowUpRight className="w-3 h-3" />
              </a>
            </div>
            <iframe
              title="Digest email preview"
              src={`${API}/digest/preview.html`}
              className="w-full h-[720px] bg-white"
              style={{ border: 0 }}
            />
          </div>

          <div className="ret-card p-5" data-testid="digest-history">
            <h4 className="font-display font-semibold text-[hsl(var(--retops-navy))]">Send history</h4>
            {history.length === 0 ? (
              <p className="text-sm text-[hsl(var(--retops-muted))] mt-2">No digests sent yet. Hit "Send to my email" above to test.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {history.slice(0, 5).map((h, i) => (
                  <li key={i} className="text-xs flex items-center justify-between py-2 border-b border-[hsl(var(--line-2))] last:border-0">
                    <div>
                      <div className="font-semibold text-[hsl(var(--retops-navy))]">{new Date(h.created_at).toLocaleString()}</div>
                      <div className="text-[hsl(var(--retops-muted))]">{h.email}</div>
                    </div>
                    <span className={`pill ${h.delivery?.status === "sent" ? "pill-teal" : "pill-gold"}`}>
                      {h.delivery?.status === "sent" ? <><Check className="w-3 h-3 inline mr-0.5" />Sent</> : h.delivery?.status || "logged"}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

const Kpi = ({ label, value, sub, tone, testid }) => {
  const color = tone === "risk" ? "text-[hsl(var(--retops-danger))]" : tone === "warn" ? "text-[hsl(var(--retops-gold-ink))]" : "text-[hsl(var(--retops-navy))]";
  return (
    <div className="ret-card p-4" data-testid={testid}>
      <div className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[hsl(var(--retops-muted))]">{label}</div>
      <div className={`kpi-num mt-1.5 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-[hsl(var(--retops-muted))] mt-1 num-data">{sub}</div>}
    </div>
  );
};

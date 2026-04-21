import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { Target, CheckCircle2 } from "lucide-react";

export default function ChurnSavePlaybook() {
  const [params, setParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(params.get("account") || "");
  const [playbook, setPlaybook] = useState(null);

  useEffect(() => {
    api.get("/accounts").then((r) => setAccounts(r.data));
  }, []);

  useEffect(() => {
    if (!selected) return setPlaybook(null);
    api.get(`/playbooks/account/${encodeURIComponent(selected)}`).then((r) => setPlaybook(r.data)).catch(() => setPlaybook(null));
  }, [selected]);

  return (
    <DashboardLayout title="Churn Save Playbook" subtitle="Generated from the most recent customer interaction">
      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-5">
        <div className="ret-card p-5" data-testid="account-list">
          <h3 className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))] font-semibold mb-3">Accounts</h3>
          <div className="space-y-1.5">
            {accounts.map((a) => (
              <button key={a.name} onClick={() => { setSelected(a.name); setParams({ account: a.name }); }} data-testid={`acct-${a.name}`}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${selected === a.name ? "border-[hsl(var(--brand))] bg-[hsl(var(--brand-100))]" : "border-[hsl(var(--line))] hover:bg-[hsl(var(--bg-subtle))]"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold">{a.name}</span>
                  <span className={`pill ${a.churn_risk === "High" ? "pill-danger" : a.churn_risk === "Medium" ? "pill-warn" : "pill-ok"}`}>{a.churn_risk}</span>
                </div>
                <p className="text-xs text-[hsl(var(--ink-3))] mt-1">ARR ${(a.arr || 0).toLocaleString()} · at risk ${(a.arr_at_risk || 0).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="ret-card p-6" data-testid="playbook-pane">
          {!playbook && <p className="text-sm text-[hsl(var(--ink-3))]">Select an account on the left to view its save playbook.</p>}
          {playbook && (
            <>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))]">Account</p>
                  <h2 className="font-display text-2xl font-semibold mt-1">{playbook.customer}</h2>
                </div>
                <div className="text-right">
                  <span className={`pill ${playbook.churn_risk === "High" ? "pill-danger" : playbook.churn_risk === "Medium" ? "pill-warn" : "pill-ok"}`}>Churn · {playbook.churn_risk}</span>
                  <p className="text-xs mt-1 text-[hsl(var(--ink-2))]">ARR ${(playbook.arr || 0).toLocaleString()} · at risk ${(playbook.arr_at_risk || 0).toLocaleString()}</p>
                </div>
              </div>

              <div className="mt-5 p-4 rounded-xl bg-[hsl(var(--bg-subtle))] border border-[hsl(var(--line))]">
                <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Signal</p>
                <p className="text-sm mt-1">{playbook.signal || "No recent churn signal"}</p>
              </div>

              <h3 className="font-display text-lg font-semibold mt-6 flex items-center gap-2"><Target className="w-4 h-4 text-[hsl(var(--brand))]" /> Steps</h3>
              <ol className="mt-3 space-y-2">
                {(playbook.save_playbook?.steps || []).map((s, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-xl border border-[hsl(var(--line))]">
                    <span className="w-6 h-6 rounded-full bg-[hsl(var(--brand))] text-white text-xs font-bold grid place-items-center flex-none">{i + 1}</span>
                    <span className="text-sm">{s}</span>
                  </li>
                ))}
              </ol>

              {playbook.save_playbook?.talking_points?.length > 0 && (
                <>
                  <h3 className="font-display text-lg font-semibold mt-6">Talking points</h3>
                  <ul className="mt-2 space-y-1.5">
                    {playbook.save_playbook.talking_points.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm"><CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 flex-none" /><span>{t}</span></li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-6 p-5 rounded-xl brand-bg">
                <p className="text-xs uppercase tracking-widest text-emerald-100/70">Recommended offer</p>
                <p className="font-display text-2xl font-semibold mt-1">{playbook.save_playbook?.offer_suggestion || "—"}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

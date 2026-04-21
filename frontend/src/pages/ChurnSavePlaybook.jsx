import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { Target, CheckCircle2, Share2, Copy, Check, ExternalLink } from "lucide-react";
import { toast } from "sonner";

export default function ChurnSavePlaybook() {
  const [params, setParams] = useSearchParams();
  const [accounts, setAccounts] = useState([]);
  const [selected, setSelected] = useState(params.get("account") || "");
  const [playbook, setPlaybook] = useState(null);
  const [shareUrl, setShareUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    api.get("/accounts").then((r) => setAccounts(r.data));
  }, []);

  useEffect(() => {
    if (!selected) { setPlaybook(null); setShareUrl(""); return; }
    api.get(`/playbooks/account/${encodeURIComponent(selected)}`).then((r) => setPlaybook(r.data)).catch(() => setPlaybook(null));
    setShareUrl("");
  }, [selected]);

  const createShare = async () => {
    if (!selected) return;
    setSharing(true);
    try {
      const r = await api.post(`/playbooks/share/${encodeURIComponent(selected)}`);
      const url = `${window.location.origin}/share/p/${r.data.token}`;
      setShareUrl(url);
      toast.success("Public link ready");
    } catch { toast.error("Could not create share link"); }
    finally { setSharing(false); }
  };

  const copyShare = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("Copy failed"); }
  };

  return (
    <DashboardLayout title="Churn Save Playbook" subtitle="Generated from the most recent customer interaction">
      <div className="grid grid-cols-1 lg:grid-cols-[320px,1fr] gap-5">
        <div className="ret-card p-5" data-testid="account-list">
          <h3 className="text-xs uppercase tracking-widest text-[hsl(var(--retops-muted-2))] font-semibold mb-3">Accounts</h3>
          <div className="space-y-1.5">
            {accounts.map((a) => (
              <button key={a.name} onClick={() => { setSelected(a.name); setParams({ account: a.name }); }} data-testid={`acct-${a.name}`}
                className={`w-full text-left p-3 rounded-xl border transition-colors ${selected === a.name ? "border-[hsl(var(--retops-navy))] bg-[hsl(var(--retops-teal-2))]" : "border-[hsl(var(--retops-border))] hover:bg-[hsl(var(--retops-bg))]"}`}>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-[hsl(var(--retops-text))]">{a.name}</span>
                  <span className={`pill ${a.churn_risk === "High" ? "pill-danger" : a.churn_risk === "Medium" ? "pill-warn" : "pill-ok"}`}>{a.churn_risk}</span>
                </div>
                <p className="text-xs text-[hsl(var(--retops-muted-2))] mt-1">ARR ${(a.arr || 0).toLocaleString()} · at risk ${(a.arr_at_risk || 0).toLocaleString()}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="ret-card p-6" data-testid="playbook-pane">
          {!playbook && <p className="text-sm text-[hsl(var(--retops-muted-2))]">Select an account on the left to view its save playbook.</p>}
          {playbook && (
            <>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-xs uppercase tracking-widest text-[hsl(var(--retops-muted-2))]">Account</p>
                  <h2 className="font-instrument text-3xl text-[hsl(var(--retops-navy))] mt-1">{playbook.customer}</h2>
                </div>
                <div className="text-right">
                  <span className={`pill ${playbook.churn_risk === "High" ? "pill-danger" : playbook.churn_risk === "Medium" ? "pill-warn" : "pill-ok"}`}>Churn · {playbook.churn_risk}</span>
                  <p className="text-xs mt-1 text-[hsl(var(--retops-muted))]">ARR ${(playbook.arr || 0).toLocaleString()} · at risk ${(playbook.arr_at_risk || 0).toLocaleString()}</p>
                </div>
              </div>

              {/* Public share card */}
              <div className="mt-5 p-4 rounded-xl bg-[hsl(var(--retops-teal-2))] border border-[hsl(168_45%_82%)]" data-testid="public-share-card">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-[hsl(var(--retops-navy))]">
                    <Share2 className="w-4 h-4" />
                    <span className="text-sm font-semibold">Public share</span>
                    <span className="text-xs text-[hsl(var(--retops-muted))]">Read-only link you can text to a prospect mid-conversation.</span>
                  </div>
                  {!shareUrl ? (
                    <button data-testid="create-share-btn" onClick={createShare} disabled={sharing} className="btn-primary !py-1.5 !px-3 text-xs flex items-center gap-1.5">
                      <Share2 className="w-3.5 h-3.5" /> {sharing ? "Creating…" : "Create public link"}
                    </button>
                  ) : (
                    <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                      <input readOnly value={shareUrl} className="flex-1 text-xs font-mono py-1.5 px-2 rounded-md border border-[hsl(var(--retops-border))] bg-white" data-testid="share-url-input" />
                      <button onClick={copyShare} data-testid="share-url-copy" className="btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />} {copied ? "Copied" : "Copy"}
                      </button>
                      <a href={shareUrl} target="_blank" rel="noopener noreferrer" data-testid="share-url-open" className="btn-ghost !py-1.5 !px-2 text-xs flex items-center gap-1">
                        <ExternalLink className="w-3.5 h-3.5" /> Open
                      </a>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 p-4 rounded-xl bg-[hsl(var(--retops-bg))] border border-[hsl(var(--retops-border))]">
                <p className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--retops-muted-2))]">Signal</p>
                <p className="text-sm mt-1 text-[hsl(var(--retops-text))]">{playbook.signal || "No recent churn signal"}</p>
              </div>

              <h3 className="font-instrument text-2xl text-[hsl(var(--retops-navy))] mt-6 flex items-center gap-2"><Target className="w-5 h-5 text-[hsl(var(--retops-teal))]" /> Steps</h3>
              <ol className="mt-3 space-y-2">
                {(playbook.save_playbook?.steps || []).map((s, i) => (
                  <li key={i} className="flex items-start gap-3 p-3 rounded-xl border border-[hsl(var(--retops-border))] bg-white">
                    <span className="w-6 h-6 rounded-full bg-[hsl(var(--retops-navy))] text-white text-xs font-bold grid place-items-center flex-none">{i + 1}</span>
                    <span className="text-sm text-[hsl(var(--retops-text))]">{s}</span>
                  </li>
                ))}
              </ol>

              {playbook.save_playbook?.talking_points?.length > 0 && (
                <>
                  <h3 className="font-instrument text-2xl text-[hsl(var(--retops-navy))] mt-6">Talking points</h3>
                  <ul className="mt-2 space-y-1.5">
                    {playbook.save_playbook.talking_points.map((t, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-[hsl(var(--retops-text))]"><CheckCircle2 className="w-4 h-4 text-[hsl(var(--retops-teal))] mt-0.5 flex-none" /><span>{t}</span></li>
                    ))}
                  </ul>
                </>
              )}

              <div className="mt-6 p-5 rounded-xl bg-[hsl(var(--retops-navy))] text-white">
                <p className="text-xs uppercase tracking-widest text-[hsl(var(--retops-gold))] font-semibold">Recommended offer</p>
                <p className="font-instrument text-2xl mt-1">{playbook.save_playbook?.offer_suggestion || "—"}</p>
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

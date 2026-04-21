import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { Logo } from "../components/Logo";
import { UserPlus, ShieldCheck, AlertTriangle, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const API = process.env.REACT_APP_BACKEND_URL;

/** Public landing for a workspace invite token — set a password, join the same workspace. */
export default function InviteAccept() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(true);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    axios
      .get(`${API}/api/invites/${token}`, { withCredentials: true })
      .then((r) => { setInvite(r.data); setName(r.data.email?.split("@")[0] || ""); })
      .catch((e) => setError(e.response?.data?.detail || "Invite not found or expired"))
      .finally(() => setPending(false));
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setBusy(true);
    try {
      const r = await axios.post(
        `${API}/api/invites/accept`,
        { token, name: name.trim(), password },
        { withCredentials: true }
      );
      if (r.data.session_token) localStorage.setItem("retops_session", r.data.session_token);
      toast.success(`Welcome to RetOps, ${r.data.name}!`);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to accept invite");
    } finally { setBusy(false); }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--retops-bg))] flex flex-col">
      <header className="px-6 py-5 border-b border-[hsl(var(--line))] bg-white">
        <div className="max-w-[1080px] mx-auto"><Logo size="header" /></div>
      </header>

      <main className="flex-1 grid place-items-center px-5 py-10">
        <div className="w-full max-w-md">
          {pending ? (
            <div className="ret-card p-8 text-center">
              <div className="w-10 h-10 rounded-full border-2 border-[hsl(var(--retops-teal))] border-t-transparent animate-spin mx-auto" />
              <p className="text-sm text-[hsl(var(--retops-muted))] mt-4">Checking your invite…</p>
            </div>
          ) : error ? (
            <div className="ret-card p-8" data-testid="invite-error">
              <div className="w-12 h-12 rounded-full bg-red-50 grid place-items-center text-red-500">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <h1 className="font-instrument text-2xl mt-4">This invite can't be used</h1>
              <p className="text-sm text-[hsl(var(--retops-muted))] mt-2">{error}</p>
              <button onClick={() => navigate("/auth")} className="btn-ghost mt-5 text-sm">Sign in instead →</button>
            </div>
          ) : (
            <div className="ret-card p-8" data-testid="invite-accept">
              <div className="w-12 h-12 rounded-full bg-[hsl(var(--brand-100))] grid place-items-center text-[hsl(var(--retops-teal))]">
                <UserPlus className="w-6 h-6" />
              </div>
              <p className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--retops-teal))] font-semibold mt-5">You're invited</p>
              <h1 className="font-instrument text-2xl sm:text-3xl mt-2 leading-tight text-[hsl(var(--retops-navy))]">
                {invite.inviter_name} wants you on their RetOps workspace
              </h1>
              <p className="text-sm text-[hsl(var(--retops-muted))] mt-3">
                Set a password to join — you'll see the same interactions, coaching cards, and churn alerts as the rest of the team.
              </p>

              <form onSubmit={submit} className="mt-6 space-y-4">
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Email</span>
                  <input type="email" value={invite.email} disabled className="input mt-1.5 bg-gray-50 cursor-not-allowed" data-testid="invite-email-field" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Your name</span>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sarah Chen" className="input mt-1.5" data-testid="invite-name" />
                </label>
                <label className="block">
                  <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Create password</span>
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="min. 8 characters" className="input mt-1.5" data-testid="invite-password" required minLength={8} />
                </label>
                <button type="submit" disabled={busy} data-testid="accept-invite-btn" className="btn-primary w-full flex items-center justify-center gap-2">
                  {busy ? "Joining…" : <>Join workspace <ArrowRight className="w-4 h-4" /></>}
                </button>
              </form>

              <p className="text-[11px] text-[hsl(var(--retops-muted-2))] mt-5 flex items-center gap-1.5">
                <ShieldCheck className="w-3 h-3" /> Invited by {invite.inviter_email} · secure magic link
              </p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

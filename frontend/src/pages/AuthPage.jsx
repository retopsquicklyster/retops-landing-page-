import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Logo } from "../components/Logo";
import { ArrowRight, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

const BOOK_DEMO = "https://link.quicklyster.ca/widget/booking/Uqx8qFGVds9HVLl42Bij";

const trackBookDemo = () => {
  try {
    const url = `${process.env.REACT_APP_BACKEND_URL}/api/track/book-demo`;
    const body = JSON.stringify({ source_path: window.location.pathname, referrer: document.referrer });
    if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    else fetch(url, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch (_e) { /* swallow */ }
};

function formatApiErrorDetail(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail))
    return detail.map((e) => (e && typeof e.msg === "string" ? e.msg : JSON.stringify(e))).filter(Boolean).join(" ");
  if (detail && typeof detail.msg === "string") return detail.msg;
  return String(detail);
}

export default function AuthPage() {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { refresh } = useAuth();

  const submit = async (e) => {
    e.preventDefault();
    if (!email || !password) { toast.error("Email and password are required"); return; }
    setLoading(true);
    try {
      if (mode === "register") {
        await api.post("/auth/register", { email, password, name });
      } else {
        await api.post("/auth/login", { email, password });
      }
      await refresh();
      toast.success(mode === "register" ? "Account created" : "Welcome back");
      navigate("/dashboard");
    } catch (e2) {
      const msg = formatApiErrorDetail(e2?.response?.data?.detail) || "Authentication failed";
      toast.error(msg);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-[hsl(var(--retops-bg))]">
      {/* LEFT — navy brand panel */}
      <div className="hidden lg:flex retops-hero-dark text-white relative overflow-hidden p-12 flex-col justify-between">
        <Link to="/"><Logo dark /></Link>
        <div className="relative z-10">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-gold))]">Revenue intelligence</p>
          <h2 className="font-instrument text-5xl leading-tight mt-4">Every cancelled customer left warning signs. RetOps catches them before they leave.</h2>
          <p className="text-white/70 mt-6 max-w-md leading-relaxed">Full QA coverage for human + AI support. Churn risk with dollars attached. Coaching on autopilot.</p>
        </div>
        <p className="text-xs text-white/40 relative z-10">© {new Date().getFullYear()} RetOps · Revenue Intelligence</p>
      </div>

      {/* RIGHT — auth card */}
      <div className="flex items-center justify-center p-8 md:p-14">
        <div className="w-full max-w-md" data-testid="auth-card">
          <div className="lg:hidden mb-8"><Link to="/"><Logo size="sm" /></Link></div>
          <div className="inline-flex items-center bg-white border border-[hsl(var(--line))] rounded-full p-1 mb-6" data-testid="auth-mode-toggle">
            {["login", "register"].map((m) => (
              <button key={m} onClick={() => setMode(m)} data-testid={`mode-${m}`}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-colors ${mode === m ? "bg-[hsl(var(--retops-navy))] text-white" : "text-[hsl(var(--ink-2))]"}`}>
                {m === "login" ? "Sign in" : "Register"}
              </button>
            ))}
          </div>
          <h1 className="font-instrument text-4xl leading-tight text-[hsl(var(--retops-navy))]">{mode === "login" ? "Welcome back." : "Create your RetOps account."}</h1>
          <p className="text-[hsl(var(--ink-2))] mt-2 text-sm">{mode === "login" ? "Sign in with your business email." : "Use your business email so your team data stays separate."}</p>

          <form onSubmit={submit} className="mt-6 space-y-4" data-testid="auth-form">
            {mode === "register" && (
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Your name</span>
                <input data-testid="in-name" value={name} onChange={(e) => setName(e.target.value)} className="input mt-1.5" placeholder="Alex Rodriguez" />
              </label>
            )}
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Work email</span>
              <input data-testid="in-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input mt-1.5" placeholder="you@business.com" required />
            </label>
            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">Password</span>
              <input data-testid="in-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="input mt-1.5" placeholder={mode === "register" ? "min 8 characters" : "••••••••"} required />
            </label>
            <button data-testid="auth-submit-btn" type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-3">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {loading ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"} <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-[hsl(var(--line))]">
            <a href={BOOK_DEMO} target="_blank" rel="noreferrer" onClick={trackBookDemo} data-testid="book-demo-link" className="flex items-center justify-center gap-2 text-sm font-semibold text-[hsl(var(--retops-navy))] hover:text-[hsl(var(--retops-teal))]">
              <Calendar className="w-4 h-4" /> Book a demo instead →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../lib/api";
import { useAuth } from "../contexts/AuthContext";
import { Logo } from "../components/Logo";
import { ArrowRight, Loader2, Calendar } from "lucide-react";
import { toast } from "sonner";

const BOOK_DEMO = "https://link.quicklyster.ca/widget/booking/Uqx8qFGVds9HVLl42Bij";

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

  const startGoogle = () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

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
          <p className="text-[hsl(var(--ink-2))] mt-2 text-sm">{mode === "login" ? "Sign in with any business email — or continue with Google." : "Any email works. Use your business address to keep team data separate."}</p>

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

          <div className="my-6 flex items-center gap-3 text-xs text-[hsl(var(--ink-3))]">
            <span className="h-px flex-1 bg-[hsl(var(--line))]"></span>or<span className="h-px flex-1 bg-[hsl(var(--line))]"></span>
          </div>
          <button onClick={startGoogle} data-testid="google-signin-btn" className="btn-ghost w-full flex items-center justify-center gap-2 py-3 border-[hsl(var(--line))]">
            <svg className="w-4 h-4" viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>
            Continue with Google
          </button>

          <div className="mt-6 pt-6 border-t border-[hsl(var(--line))]">
            <a href={BOOK_DEMO} target="_blank" rel="noreferrer" data-testid="book-demo-link" className="flex items-center justify-center gap-2 text-sm font-semibold text-[hsl(var(--retops-navy))] hover:text-[hsl(var(--retops-teal))]">
              <Calendar className="w-4 h-4" /> Book a demo instead →
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

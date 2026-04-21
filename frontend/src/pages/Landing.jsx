import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Activity, Brain, TrendingDown, CheckCircle2 } from "lucide-react";
import { Logo } from "../components/Logo";
import { useAuth } from "../contexts/AuthContext";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const startLogin = () => {
    const redirectUrl = `${window.location.origin}/dashboard`;
    window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  };

  return (
    <div className="min-h-screen">
      {/* HERO */}
      <section className="brand-gradient-ink relative overflow-hidden">
        <div className="absolute inset-0 grid-dot pointer-events-none opacity-70" />
        <header className="relative z-10 max-w-[1280px] mx-auto px-8 py-6 flex items-center justify-between">
          <Logo dark />
          <div className="flex items-center gap-3">
            <span className="hidden md:inline text-xs font-medium text-emerald-200/70 tracking-widest uppercase">
              AI Revenue Protection
            </span>
            {user ? (
              <button data-testid="go-to-dashboard-btn" onClick={() => navigate("/dashboard")} className="btn-primary">
                Open dashboard <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            ) : (
              <button data-testid="sign-in-btn" onClick={startLogin} className="btn-primary">
                Sign in with Google
              </button>
            )}
          </div>
        </header>

        <div className="relative z-10 max-w-[1280px] mx-auto px-8 pt-16 pb-28 grid lg:grid-cols-[1.1fr,0.9fr] gap-14 items-center">
          <div className="rise">
            <span className="pill" style={{ background: "rgba(16,185,129,0.12)", color: "#6EE7B7", borderColor: "rgba(16,185,129,0.25)" }}>
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              100% QA coverage — Human + AI
            </span>
            <h1 className="font-display text-white text-[44px] sm:text-[56px] lg:text-[64px] leading-[1.05] font-semibold mt-5">
              Every cancelled customer left <em className="text-emerald-300 not-italic">warning signs</em>.<br />
              RetOps catches them before they leave.
            </h1>
            <p className="text-emerald-100/70 text-lg mt-6 max-w-xl">
              Built for support teams that need full QA coverage, faster coaching, and earlier risk detection across
              human and AI interactions — scored against your rubric, with the dollar impact attached.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <button data-testid="hero-sign-in-btn" onClick={user ? () => navigate("/dashboard") : startLogin} className="btn-primary">
                {user ? "Open dashboard" : "Sign in with Google"} <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
              <a href="#platform" className="btn-ghost" style={{ background: "transparent", color: "#fff", borderColor: "rgba(255,255,255,0.2)" }}>
                See the platform
              </a>
            </div>
          </div>

          {/* mock ops card */}
          <div className="ret-card-dark p-6 rise rise-2">
            <div className="flex items-center justify-between text-xs text-emerald-200/70 uppercase tracking-[0.2em]">
              <span>RetOps / Executive</span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Stat label="Revenue at risk" value="$474K" delta="12% vs last week" danger />
              <Stat label="At-risk accounts" value="83" delta="23 new this week" />
              <Stat label="Trust score" value="91.2%" delta="AI–human agreement" />
              <Stat label="QA coverage" value="100%" delta="4,217 scored today" ok />
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-xs text-emerald-200/60 uppercase tracking-widest mb-3">Recent alerts</p>
              <ul className="space-y-2 text-sm">
                <Alert tag="Churn · High" label="Acme Corp ($14.4K ARR)" time="08:41" />
                <Alert tag="QA < 60" label="Alex R. — Score 58" time="08:38" />
                <Alert tag="AI Hallucination" label="Support Bot v3" time="08:34" />
                <Alert tag="Upsell" label="NovaTech +$2.4K/mo" time="08:29" ok />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* WHAT IT CATCHES */}
      <section id="platform" className="max-w-[1280px] mx-auto px-8 py-24 grid lg:grid-cols-4 gap-6">
        {[
          { icon: ShieldCheck, title: "100% QA coverage", copy: "Score every call, chat, and ticket on your rubric — no sampling, no blind spots." },
          { icon: TrendingDown, title: "Revenue at risk", copy: "Tie churn signals to account value so leaders see where money is actually exposed." },
          { icon: Brain, title: "AI quality gate", copy: "Catch hallucinations and policy drift before the response reaches the customer." },
          { icon: Activity, title: "Coaching from real calls", copy: "Coaching cards built from what actually happened on the line, not guesswork." },
        ].map((f, i) => (
          <div key={i} className={`ret-card p-6 rise rise-${i + 1}`}>
            <f.icon className="w-6 h-6 text-[hsl(var(--brand))]" />
            <h3 className="font-display text-xl font-semibold mt-4">{f.title}</h3>
            <p className="text-[hsl(var(--ink-2))] text-sm mt-2 leading-relaxed">{f.copy}</p>
          </div>
        ))}
      </section>

      {/* THE GAP */}
      <section className="bg-white border-t border-[hsl(var(--line))]">
        <div className="max-w-[1280px] mx-auto px-8 py-24 grid lg:grid-cols-[1.1fr,0.9fr] gap-14">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--ink-3))]">The math</p>
            <h2 className="font-display text-4xl lg:text-5xl font-semibold mt-3 leading-tight">
              A small miss per conversation becomes a massive leak at scale.
            </h2>
            <p className="text-[hsl(var(--ink-2))] mt-5 leading-relaxed max-w-xl">
              Thousands of interactions a week, sampled at 2–3%. That's where churn hides — inside the conversations no
              one ever reviewed. RetOps reviews all of them, ties the signals to ARR, and tells the team what to do next.
            </p>
          </div>
          <div className="ret-card p-7">
            <p className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--ink-3))] mb-4">Illustrative impact</p>
            <dl className="divide-y divide-[hsl(var(--line))]">
              {[
                ["Subscribers", "500,000"],
                ["Monthly churn", "1.5 – 2.5%"],
                ["ARPU", "$40"],
                ["Monthly loss", "$480K – $800K"],
                ["CAC to replace", "$300 – $500"],
                ["Annual cost", "up to $48M"],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center justify-between py-3">
                  <dt className="text-sm text-[hsl(var(--ink-2))]">{k}</dt>
                  <dd className="font-mono text-sm text-[hsl(var(--ink))] font-semibold">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-[1280px] mx-auto px-8 py-24 text-center">
        <h2 className="font-display text-3xl lg:text-4xl font-semibold">Bring in your conversations. RetOps scores them. Your team gets the next move.</h2>
        <div className="mt-7 flex items-center justify-center gap-3">
          <button data-testid="cta-sign-in-btn" onClick={user ? () => navigate("/dashboard") : startLogin} className="btn-primary">
            {user ? "Open dashboard" : "Sign in with Google"}
            <ArrowRight className="w-4 h-4 inline ml-1" />
          </button>
        </div>
        <div className="mt-8 flex items-center justify-center gap-6 text-xs text-[hsl(var(--ink-3))]">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />Full QA coverage</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />Dollar value on churn risk</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />AI + human in one view</span>
        </div>
      </section>

      <footer className="border-t border-[hsl(var(--line))] bg-white">
        <div className="max-w-[1280px] mx-auto px-8 py-8 flex items-center justify-between">
          <Logo size="sm" />
          <span className="text-xs text-[hsl(var(--ink-3))]">© {new Date().getFullYear()} RetOps · Revenue Intelligence</span>
        </div>
      </footer>
    </div>
  );
}

const Stat = ({ label, value, delta, ok, danger }) => (
  <div>
    <p className="text-[11px] uppercase tracking-widest text-emerald-200/60">{label}</p>
    <p className="font-display text-3xl font-semibold text-white mt-2">{value}</p>
    <p className={`text-xs mt-1 ${danger ? "text-red-300" : ok ? "text-emerald-300" : "text-emerald-200/70"}`}>{delta}</p>
  </div>
);

const Alert = ({ tag, label, time, ok }) => (
  <li className="flex items-center justify-between">
    <span className="flex items-center gap-2">
      <span className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      <span className="text-emerald-100/80">{tag}</span>
      <span className="text-white">· {label}</span>
    </span>
    <span className="font-mono text-[11px] text-emerald-200/60">{time}</span>
  </li>
);

import { useNavigate } from "react-router-dom";
import { ArrowRight, ShieldCheck, Activity, Brain, TrendingDown, CheckCircle2, Sparkles } from "lucide-react";
import { Logo } from "../components/Logo";
import ROICalculator from "../components/ROICalculator";
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
    <div className="min-h-screen bg-[hsl(var(--retops-bg))]">
      {/* HERO — light bg with navy text + gold CTA (matches retops.ai) */}
      <section className="retops-hero relative overflow-hidden border-b border-[hsl(var(--retops-border))]">
        <header className="relative z-10 max-w-[1280px] mx-auto px-8 py-6 flex items-center justify-between">
          <Logo />
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[hsl(var(--retops-navy))]">
              <a href="#platform" className="hover:text-[hsl(var(--retops-gold-hover))]">Platform</a>
              <a href="#roi-calculator" className="hover:text-[hsl(var(--retops-gold-hover))]">ROI</a>
            </nav>
            {user ? (
              <button data-testid="go-to-dashboard-btn" onClick={() => navigate("/dashboard")} className="btn-gold">
                Open dashboard <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
            ) : (
              <button data-testid="sign-in-btn" onClick={startLogin} className="btn-gold">
                Sign in with Google
              </button>
            )}
          </div>
        </header>

        <div className="relative z-10 max-w-[1280px] mx-auto px-8 pt-14 pb-24 grid lg:grid-cols-[1.1fr,0.9fr] gap-14 items-center">
          <div className="rise">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#8a6b00]">
              AI-powered quality, coaching, and retention
            </p>
            <h1 className="font-instrument text-[44px] sm:text-[56px] lg:text-[64px] leading-[1.05] mt-5 text-[hsl(var(--retops-navy))]">
              Every cancelled customer left <span className="text-[hsl(var(--retops-teal))]">warning signs</span>. RetOps catches them before they leave.
            </h1>
            <p className="text-[hsl(var(--retops-muted))] text-lg mt-6 max-w-xl leading-relaxed">
              Built for support teams that need full QA coverage, faster coaching, and earlier risk detection across
              human and AI interactions — scored against your rubric, with the dollar impact attached.
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <button data-testid="hero-sign-in-btn" onClick={user ? () => navigate("/dashboard") : startLogin} className="btn-gold">
                {user ? "Open dashboard" : "Sign in with Google"} <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
              <a href="#roi-calculator" data-testid="see-roi-link" className="btn-ghost">See your ROI</a>
            </div>
          </div>

          {/* executive mock card — dark navy like retops.ai command overview */}
          <div className="ret-card-dark p-6 rise rise-2">
            <div className="flex items-center justify-between text-xs text-white/55 uppercase tracking-[0.2em]">
              <span>RetOps / Executive</span>
              <span className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[hsl(var(--retops-teal))] animate-pulse" /> Live
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-4">
              <Stat label="Revenue at risk" value="$474K" delta="12% vs last week" danger />
              <Stat label="At-risk accounts" value="83" delta="23 new this week" />
              <Stat label="Trust score" value="91.2%" delta="AI–human agreement" teal />
              <Stat label="QA coverage" value="100%" delta="4,217 scored today" teal />
            </div>
            <div className="mt-5 border-t border-white/10 pt-4">
              <p className="text-[10px] font-semibold text-white/55 uppercase tracking-[0.22em] mb-3">Recent alerts</p>
              <ul className="space-y-2 text-sm">
                <Alert tag="Churn · High" label="Acme Corp ($14.4K ARR)" time="08:41" sev="risk" />
                <Alert tag="QA < 60" label="Alex R. — Score 58" time="08:38" sev="amber" />
                <Alert tag="AI Hallucination" label="Support Bot v3" time="08:34" sev="risk" />
                <Alert tag="Upsell Signal" label="NovaTech +$2.4K/mo" time="08:29" sev="teal" />
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Built for contact-center teams strip — matches retops.ai */}
      <section className="relative border-b border-[hsl(var(--retops-border))] bg-white py-10 sm:py-14" aria-labelledby="contact-center-features-heading">
        <div className="max-w-[1280px] mx-auto px-8">
          <div className="flex flex-col items-start gap-10 lg:flex-row lg:items-center lg:gap-x-16">
            <h2 id="contact-center-features-heading" className="text-xs font-bold uppercase tracking-widest text-[hsl(var(--retops-navy))] flex-shrink-0">
              Built for contact-center teams
            </h2>
            <div className="grid flex-1 gap-x-10 gap-y-5 sm:grid-cols-2 lg:gap-x-12">
              {[
                "Capture calls, chats, and tickets in one decision layer.",
                "Move from QA signal to coaching and retention action faster.",
                "Score interactions against the rubric your team already trusts.",
                "Give leaders one place to see scorecards, themes, and risk.",
              ].map((t, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--retops-navy))]/10">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[hsl(var(--retops-navy))]" />
                  </div>
                  <p className="text-sm leading-relaxed text-[hsl(var(--retops-navy))]/80">{t}</p>
                </div>
              ))}
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
            <div className="w-11 h-11 rounded-xl grid place-items-center bg-[hsl(var(--retops-teal-2))] text-[hsl(var(--retops-navy))]">
              <f.icon className="w-5 h-5" />
            </div>
            <h3 className="font-instrument text-2xl mt-4 text-[hsl(var(--retops-navy))]">{f.title}</h3>
            <p className="text-[hsl(var(--retops-muted))] text-sm mt-2 leading-relaxed">{f.copy}</p>
          </div>
        ))}
      </section>

      {/* ROI Calculator */}
      <ROICalculator />

      {/* Founding 50 style CTA */}
      <section className="bg-[hsl(var(--retops-navy))] text-white">
        <div className="max-w-[1280px] mx-auto px-8 py-24 grid lg:grid-cols-2 gap-14 items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-gold))]">Founding 50</p>
            <h2 className="font-instrument text-4xl lg:text-5xl mt-4 leading-tight">
              Bring in your conversations. RetOps scores them. Your team gets the next move.
            </h2>
            <p className="text-white/70 mt-5 max-w-xl leading-relaxed">
              Founding members get locked-in pricing, direct founder access, early access to new modules, and
              priority on roadmap decisions tied to real customer operations.
            </p>
            <button
              data-testid="cta-sign-in-btn"
              onClick={user ? () => navigate("/dashboard") : startLogin}
              className="btn-gold mt-8"
            >
              {user ? "Open dashboard" : "Sign in with Google"} <ArrowRight className="w-4 h-4 inline ml-1" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {[
              ["100% QA coverage", ShieldCheck],
              ["Dollar on churn risk", TrendingDown],
              ["AI + human in one view", Brain],
              ["Coaching from real calls", Sparkles],
            ].map(([label, Ic], i) => (
              <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <Ic className="w-5 h-5 text-[hsl(var(--retops-gold))]" />
                <p className="mt-3 text-sm font-semibold">{label}</p>
                <p className="text-xs text-white/60 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Included</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[hsl(var(--retops-border))] bg-white">
        <div className="max-w-[1280px] mx-auto px-8 py-8 flex items-center justify-between">
          <Logo size="sm" />
          <span className="text-xs text-[hsl(var(--retops-muted-2))]">© {new Date().getFullYear()} RetOps · Revenue Intelligence</span>
        </div>
      </footer>
    </div>
  );
}

const Stat = ({ label, value, delta, danger, teal }) => (
  <div>
    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-white/55">{label}</p>
    <p className="font-instrument text-[30px] text-white mt-2 leading-none">{value}</p>
    <p className={`text-xs mt-1.5 ${danger ? "text-[hsl(var(--retops-amber))]" : teal ? "text-[hsl(var(--retops-teal))]" : "text-white/65"}`}>{delta}</p>
  </div>
);

const Alert = ({ tag, label, time, sev }) => {
  const color = sev === "risk" ? "bg-red-400" : sev === "teal" ? "bg-[hsl(var(--retops-teal))]" : "bg-[hsl(var(--retops-amber))]";
  const tagColor = sev === "risk" ? "text-red-300" : sev === "teal" ? "text-[hsl(var(--retops-teal))]" : "text-amber-300";
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="flex items-center gap-2 min-w-0">
        <span className={`w-1.5 h-1.5 rounded-full flex-none ${color}`} />
        <span className={`font-semibold flex-none ${tagColor}`}>{tag}</span>
        <span className="text-white truncate">· {label}</span>
      </span>
      <span className="font-mono text-[11px] text-white/55 flex-none">{time}</span>
    </li>
  );
};

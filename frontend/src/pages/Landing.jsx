import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, ShieldCheck, Activity, Brain, TrendingDown, CheckCircle2, Sparkles, Calendar } from "lucide-react";
import { Logo } from "../components/Logo";
import ROICalculator from "../components/ROICalculator";
import { useAuth } from "../contexts/AuthContext";

const BOOK_DEMO = "https://link.quicklyster.ca/widget/booking/Uqx8qFGVds9HVLl42Bij";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);

  const goAuth = () => navigate("/auth");

  // Sticky-nav scrolled state
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll-reveal
  useEffect(() => {
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => { if (e.isIntersecting) e.target.classList.add("in-view"); }),
      { threshold: 0.15, rootMargin: "0px 0px -8% 0px" },
    );
    document.querySelectorAll(".reveal").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="min-h-screen bg-[hsl(var(--retops-bg))]">
      {/* HERO — light bg with navy text + gold CTA (matches retops.ai) */}
      <section className="retops-hero relative overflow-hidden border-b border-[hsl(var(--retops-border))]">
        <header className={`sticky top-0 z-30 backdrop-blur transition-colors ${scrolled ? "bg-white/85 border-b border-[hsl(var(--retops-border))]" : "bg-transparent"}`}>
          <div className="max-w-[1280px] mx-auto px-8 py-5 flex items-center justify-between">
            <Logo />
            <div className="flex items-center gap-6">
              <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[hsl(var(--retops-navy))]">
                <a href="#platform" className="hover:text-[hsl(var(--retops-gold-hover))]">Platform</a>
                <a href="#roi-calculator" className="hover:text-[hsl(var(--retops-gold-hover))]">ROI</a>
              </nav>
              <a href={BOOK_DEMO} target="_blank" rel="noreferrer" data-testid="nav-book-demo" className="hidden md:inline-flex btn-ghost items-center gap-1.5 text-sm">
                <Calendar className="w-4 h-4" /> Book a demo
              </a>
              {user ? (
                <button data-testid="go-to-dashboard-btn" onClick={() => navigate("/dashboard")} className="btn-gold">
                  Open dashboard <ArrowRight className="w-4 h-4 inline ml-1" />
                </button>
              ) : (
                <button data-testid="sign-in-btn" onClick={goAuth} className="btn-gold">
                  Sign in or Register
                </button>
              )}
            </div>
          </div>
        </header>

        {/* Floating decorative orbs — cool hero effect */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="hero-orbs">
          <div className="orb" style={{ width: 420, height: 420, top: "-6%", left: "-8%", background: "radial-gradient(circle, rgba(20,184,166,0.32), transparent 70%)", animationDelay: "0s" }} />
          <div className="orb" style={{ width: 360, height: 360, top: "8%", right: "-6%", background: "radial-gradient(circle, rgba(248,210,16,0.28), transparent 70%)", animationDelay: "-4s" }} />
          <div className="orb" style={{ width: 260, height: 260, bottom: "-4%", left: "34%", background: "radial-gradient(circle, rgba(11,31,59,0.12), transparent 70%)", animationDelay: "-8s" }} />
        </div>

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
            <p className="font-instrument text-xl mt-6 text-[hsl(var(--retops-navy))]/80">
              Protect the revenue hidden in &nbsp;
              <span className="rotator text-[hsl(var(--retops-gold-hover))]" data-testid="hero-rotator" style={{ minWidth: "15ch" }}>
                <span>every conversation.</span>
                <span>every complaint.</span>
                <span>every interaction.</span>
              </span>
            </p>
            <div className="flex flex-wrap gap-3 mt-8">
              <button data-testid="hero-sign-in-btn" onClick={user ? () => navigate("/dashboard") : goAuth} className="btn-gold">
                {user ? "Open dashboard" : "Sign in or Register"} <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
              <a href={BOOK_DEMO} target="_blank" rel="noreferrer" data-testid="hero-book-demo" className="btn-ghost flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Book a demo
              </a>
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

      {/* ==== The Blind Spot (investor section) ==== */}
      <section className="bg-white border-t border-[hsl(var(--retops-border))]" data-testid="blind-spot-section">
        <div className="max-w-[1280px] mx-auto px-8 py-24">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-teal))] reveal">The blind spot</p>
          <h2 className="font-instrument text-4xl lg:text-5xl mt-4 leading-tight text-[hsl(var(--retops-navy))] max-w-3xl reveal">
            You cannot protect the conversations your team never sees.
          </h2>
          <div className="grid lg:grid-cols-2 gap-10 mt-10">
            <p className="text-[hsl(var(--retops-muted))] text-lg leading-relaxed reveal">
              Most support teams still review a tiny sample of customer interactions. That means the majority of churn signals, compliance misses, coaching gaps, and bad AI replies pass through unnoticed.
            </p>
            <p className="text-[hsl(var(--retops-muted))] text-lg leading-relaxed reveal">
              A customer hints they're shopping competitors. Another gets incorrect billing information. Another leaves frustrated enough to never come back. RetOps catches those moments before they become lost revenue.
            </p>
          </div>
        </div>
      </section>

      {/* ==== The Math (ARR leak at scale) ==== */}
      <section className="bg-[hsl(var(--retops-bg))] border-t border-[hsl(var(--retops-border))]" data-testid="the-math-section">
        <div className="max-w-[1280px] mx-auto px-8 py-24">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8a6b00] reveal">The math</p>
          <h2 className="font-instrument text-4xl lg:text-5xl mt-4 leading-tight text-[hsl(var(--retops-navy))] max-w-3xl reveal">
            A small miss per conversation becomes a massive leak at scale.
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mt-10">
            {[
              ["Subscribers",       "500,000",     "base"],
              ["Monthly churn",     "1.5 — 2.5%",  "industry"],
              ["ARPU",              "$40",         "avg"],
              ["Monthly loss",      "$480K — $800K", "before RetOps"],
              ["CAC to replace",    "$300 — $500", "per customer"],
              ["Annual cost",       "up to $48M",  "operational leak"],
            ].map(([label, value, sub]) => (
              <div key={label} className="p-5 rounded-2xl bg-white border border-[hsl(var(--retops-border))] reveal">
                <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[hsl(var(--retops-muted))]">{label}</p>
                <p className="font-instrument text-2xl mt-2 text-[hsl(var(--retops-navy))]">{value}</p>
                <p className="text-[11px] text-[hsl(var(--retops-muted-2))] mt-1">{sub}</p>
              </div>
            ))}
          </div>
          <p className="text-[hsl(var(--retops-muted))] mt-8 max-w-2xl reveal">
            RetOps ties conversation quality to real business impact — not just scores on a dashboard.
          </p>
        </div>
      </section>

      {/* ==== What Monday Morning Looks Like (live stream) ==== */}
      <section className="retops-hero-dark text-white border-t border-white/5" data-testid="monday-section">
        <div className="max-w-[1280px] mx-auto px-8 py-24">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-gold))] reveal">The platform</p>
          <h2 className="font-instrument text-4xl lg:text-5xl mt-4 leading-tight max-w-3xl reveal">
            What Monday morning looks like with RetOps.
          </h2>
          <p className="text-white/70 text-lg mt-5 max-w-3xl leading-relaxed reveal">
            By the time your team logs in, RetOps has already analyzed the last 24 hours of calls, chats, tickets, and AI responses. Revenue risk. QA failures. AI mistakes. Escalations. Coaching opportunities. Expansion signals — all surfaced in one operational view.
          </p>
          <div className="mt-10 rounded-3xl bg-white/[0.04] border border-white/10 overflow-hidden reveal">
            <div className="px-6 py-4 bg-white/[0.03] border-b border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-[hsl(var(--retops-teal))] animate-pulse" />
                <span className="text-xs font-semibold uppercase tracking-[0.15em] text-white/70">Live — updated 2m ago</span>
              </div>
              <span className="text-xs text-white/50">RetOps / Risk monitor</span>
            </div>
            <div className="divide-y divide-white/5">
              {[
                { t:"08:41", sev:"CHURN RISK — HIGH", color:"text-red-300", body:<><span className="text-white font-semibold">Acme Corp</span> · ARR $14,400 · Third billing complaint in 14 days. Mentioned &ldquo;looking at alternatives&rdquo; on call #4471. → Retention playbook triggered automatically.</> },
                { t:"08:38", sev:"QA ALERT — BELOW THRESHOLD", color:"text-amber-300", body:<><span className="text-white font-semibold">Alex R.</span> · Score 58/100 · Skipped identity verification on 3 consecutive calls. → Coaching card generated.</> },
                { t:"08:34", sev:"AI HALLUCINATION — FLAGGED", color:"text-red-300", body:<><span className="text-white font-semibold">Support Bot v3</span> · Claimed &ldquo;unlimited international&rdquo; — ground truth 500 min. → Response blocked. Escalated to human.</> },
                { t:"08:29", sev:"SALES SIGNAL — UPSELL", color:"text-[hsl(var(--retops-teal))]", body:<><span className="text-white font-semibold">NovaTech Ltd.</span> · &ldquo;Adding two more offices next quarter.&rdquo; Estimated expansion $2,400/mo. → Routed to AM.</> },
                { t:"08:22", sev:"CHURN RISK — MEDIUM", color:"text-amber-300", body:<><span className="text-white font-semibold">Brightfield Inc.</span> · ARR $7,200 · Negative sentiment detected in 2 of last 5 interactions.</> },
              ].map((e,i) => (
                <div key={i} className="px-6 py-5 flex gap-5">
                  <span className="text-xs text-white/40 tabular-nums w-16 flex-none pt-0.5">{e.t}</span>
                  <div className="min-w-0">
                    <p className={`text-[11px] font-bold uppercase tracking-[0.15em] ${e.color}`}>{e.sev}</p>
                    <p className="text-sm text-white/80 mt-1 leading-relaxed">{e.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ==== Score Output — Anatomy of one scored interaction ==== */}
      <section className="bg-white border-t border-[hsl(var(--retops-border))]" data-testid="score-output-section">
        <div className="max-w-[1280px] mx-auto px-8 py-24">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-teal))] reveal">Score output</p>
          <h2 className="font-instrument text-4xl lg:text-5xl mt-4 leading-tight text-[hsl(var(--retops-navy))] max-w-3xl reveal">
            What one scored interaction gives your team.
          </h2>
          <div className="grid lg:grid-cols-[1fr,1.2fr] gap-10 mt-10 items-start">
            <p className="text-[hsl(var(--retops-muted))] text-lg leading-relaxed reveal">
              Every call, chat, and ticket becomes a usable record. RetOps scores against your QA rubric, highlights what went wrong, estimates business risk, and triggers the next step — coaching, retention, escalation, or follow-up.
            </p>
            <div className="rounded-3xl border border-[hsl(var(--retops-border))] bg-[hsl(var(--retops-bg))] p-6 reveal">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.15em] font-semibold text-[hsl(var(--retops-muted))]">Interaction #4471</span>
                <span className="pill pill-danger" style={{padding:"3px 10px"}}>Below Threshold · 58</span>
              </div>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-4 text-sm">
                <div><p className="text-[11px] uppercase tracking-wider text-[hsl(var(--retops-muted))]">Customer</p><p className="font-semibold">Acme Corp</p></div>
                <div><p className="text-[11px] uppercase tracking-wider text-[hsl(var(--retops-muted))]">Agent</p><p className="font-semibold">Alex R.</p></div>
                <div><p className="text-[11px] uppercase tracking-wider text-[hsl(var(--retops-muted))]">Churn risk</p><p className="font-semibold text-red-600">High · $14,400/yr at risk</p></div>
                <div><p className="text-[11px] uppercase tracking-wider text-[hsl(var(--retops-muted))]">Signal</p><p className="font-semibold">3rd complaint · competitor mention</p></div>
              </div>
              <div className="mt-5 space-y-2">
                {[
                  ["Greeting & identification", "9/10",  "Pass"],
                  ["Problem understanding",     "7/10",  "Pass"],
                  ["Policy accuracy",           "3/10",  "Fail — wrong refund policy"],
                  ["Resolution offered",        "6/10",  "Marginal"],
                  ["Empathy & tone",            "8/10",  "Pass"],
                  ["Compliance (ID verify)",    "0/10",  "Fail — skipped"],
                  ["Close & next steps",        "5/10",  "Marginal"],
                ].map(([k, s, v]) => (
                  <div key={k} className="grid grid-cols-[1fr,52px,1fr] gap-3 text-sm items-center py-1.5 border-b border-[hsl(var(--line-2))] last:border-0">
                    <span className="text-[hsl(var(--ink-2))]">{k}</span>
                    <span className="font-bold tabular-nums text-[hsl(var(--retops-navy))]">{s}</span>
                    <span className={`text-xs ${v.startsWith("Fail") ? "text-red-600" : v.startsWith("Pass") ? "text-emerald-600" : "text-amber-600"}`}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==== How it works — 3 steps ==== */}
      <section className="bg-[hsl(var(--retops-bg))] border-t border-[hsl(var(--retops-border))]" data-testid="how-it-works-section">
        <div className="max-w-[1280px] mx-auto px-8 py-24">
          <h2 className="font-instrument text-4xl lg:text-5xl leading-tight text-[hsl(var(--retops-navy))] max-w-3xl reveal">
            Bring in your conversations. RetOps scores them. Your team gets the next move.
          </h2>
          <div className="grid md:grid-cols-3 gap-6 mt-12">
            {[
              { n:"01", t:"Connect",  d:"Upload recordings, connect your helpdesk, or send transcripts through your workflow. RetOps fits into the systems you already use.", note:"Fast setup. Rollout depends on your stack." },
              { n:"02", t:"Analyze",  d:"Every interaction is scored on your rubric. Churn signals are detected. Compliance is checked. AI and human interactions are reviewed in the same system.", note:"Full coverage, not sampling." },
              { n:"03", t:"Act",      d:"Your team gets alerts, coaching priorities, retention actions, and executive visibility without waiting on manual QA review.", note:"From insight to action, automatically." },
            ].map((s) => (
              <div key={s.n} className="p-6 rounded-3xl bg-white border border-[hsl(var(--retops-border))] reveal">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-gold))]">Step {s.n}</p>
                <p className="font-instrument text-3xl mt-3 text-[hsl(var(--retops-navy))]">{s.t}</p>
                <p className="text-[hsl(var(--retops-muted))] mt-3 leading-relaxed">{s.d}</p>
                <p className="text-xs text-[hsl(var(--retops-teal))] mt-4 font-semibold">{s.note}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==== Comparison table ==== */}
      <section className="bg-white border-t border-[hsl(var(--retops-border))]" data-testid="comparison-section">
        <div className="max-w-[1280px] mx-auto px-8 py-24">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-teal))] reveal">The gap</p>
          <h2 className="font-instrument text-4xl lg:text-5xl mt-4 leading-tight text-[hsl(var(--retops-navy))] max-w-3xl reveal">
            Most tools solve one piece. RetOps connects the chain.
          </h2>
          <div className="mt-10 overflow-x-auto reveal">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-[0.15em] text-[hsl(var(--retops-muted))]">
                  <th className="py-3 pr-6"></th>
                  <th className="py-3 px-3 text-center">Sampling QA</th>
                  <th className="py-3 px-3 text-center">Analytics only</th>
                  <th className="py-3 px-3 text-center">CS tools</th>
                  <th className="py-3 px-3 text-center bg-[hsl(var(--retops-teal-2))] text-[hsl(var(--retops-navy))] font-bold rounded-t-lg">RetOps</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--line-2))]">
                {[
                  ["Quality scoring",              true,  false, false, true],
                  ["Dollar value on churn risk",   false, false, true,  true],
                  ["Recommended next steps",       false, false, false, true],
                  ["Human + AI quality in one view", false, false, false, true],
                ].map(([row, a, b, c, d]) => (
                  <tr key={row}>
                    <td className="py-4 pr-6 font-semibold text-[hsl(var(--retops-navy))]">{row}</td>
                    {[a,b,c,d].map((v, i) => (
                      <td key={i} className={`py-4 px-3 text-center ${i === 3 ? "bg-[hsl(var(--retops-teal-2))]/50" : ""}`}>
                        {v ? <span className="text-emerald-600 text-lg">✓</span> : <span className="text-[hsl(var(--retops-muted-2))]">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* ==== FAQ ==== */}
      <section className="bg-white border-t border-[hsl(var(--retops-border))]" data-testid="faq-section">
        <div className="max-w-[880px] mx-auto px-8 py-24">
          <h2 className="font-instrument text-4xl lg:text-5xl leading-tight text-[hsl(var(--retops-navy))] reveal">
            Frequently asked
          </h2>
          <div className="mt-8 divide-y divide-[hsl(var(--retops-border))] reveal">
            {[
              { q: "Do I have to replace my current QA tool?",    a: "No. RetOps runs alongside your existing stack and ingests from your helpdesk, call recording, or transcripts. You can pilot on a single team for 14 days." },
              { q: "Can RetOps score my AI agents too?",           a: "Yes — AI responses are scored against the exact same 6-dimension rubric with added checks for hallucination, policy drift, and grounding. Responses can be auto-blocked or rewritten before reaching the customer." },
              { q: "How does the dollar value on churn risk work?", a: "Each scored interaction produces a churn risk score (0–100) from 12 weighted signals. We multiply that by the account's annual contract value to surface real exposure in dollars." },
              { q: "What data do you need to get started?",         a: "Transcripts only. Audio (MP3/WAV/WEBM) is transcribed via RetOps Transcription. You choose the rubric — ours or yours — and we calibrate on ~50 sample interactions before rollout." },
              { q: "Is my transcript data used to train models?",   a: "Never. RetOps uses pluggable LLMs with enterprise no-training flags. Transcripts are encrypted in transit and at rest. You can bring your own LLM API key in Settings." },
              { q: "Pricing?",                                      a: "Founding-member pricing locked in for the first 50 customers. Based on interactions scored per month. Book a demo and we'll size it to your volume." },
            ].map((f, i) => (
              <details key={i} className="group py-5" data-testid={`faq-${i}`}>
                <summary className="cursor-pointer list-none flex items-center justify-between">
                  <span className="font-semibold text-[hsl(var(--retops-navy))] text-lg">{f.q}</span>
                  <span className="text-2xl text-[hsl(var(--retops-muted))] group-open:rotate-45 transition-transform">+</span>
                </summary>
                <p className="mt-3 text-[hsl(var(--retops-muted))] leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

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
            <div className="flex flex-wrap gap-3 mt-8">
              <button
                data-testid="cta-sign-in-btn"
                onClick={user ? () => navigate("/dashboard") : goAuth}
                className="btn-gold"
              >
                {user ? "Open dashboard" : "Sign in or Register"} <ArrowRight className="w-4 h-4 inline ml-1" />
              </button>
              <a href={BOOK_DEMO} target="_blank" rel="noreferrer" data-testid="cta-book-demo" className="px-5 py-3 rounded-full bg-white/10 hover:bg-white/15 border border-white/15 text-white font-semibold text-sm inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Book a demo
              </a>
            </div>
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

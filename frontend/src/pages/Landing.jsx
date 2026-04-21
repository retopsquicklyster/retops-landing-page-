import { useNavigate } from "react-router-dom";
import { useEffect, useState, useRef } from "react";
import { ArrowRight, CheckCircle2, Calendar } from "lucide-react";
import { Logo } from "../components/Logo";
import ROICalculator from "../components/ROICalculator";
import DemoVideoModal, { WatchDemoButton } from "../components/DemoVideoModal";
import BrandIcon from "../components/BrandIcons";
import { useAuth } from "../contexts/AuthContext";

const BOOK_DEMO = "https://link.quicklyster.ca/widget/booking/Uqx8qFGVds9HVLl42Bij";

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export default function Landing() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

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
      {/* Sticky nav — lives OUTSIDE the hero section so `overflow-hidden` on the hero
          can't clip `position: sticky`. Blurs + shadows once the page scrolls. */}
      <header className={`sticky top-0 z-50 border-b transition-all duration-200 ${scrolled ? "bg-white/80 backdrop-blur-md border-[hsl(var(--retops-border))] shadow-[0_1px_20px_-8px_rgba(11,31,59,.25)]" : "bg-white border-[hsl(var(--retops-border))]"}`}>
        <div className="max-w-[1280px] mx-auto px-6 lg:px-8 flex items-center justify-between h-14 sm:h-14 py-1 sm:py-0">
          <div className="self-start pt-1 sm:pt-0.5 flex items-center">
            <Logo size="header" />
          </div>
          <div className="flex items-center gap-3 md:gap-6">
            <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-[hsl(var(--retops-navy))]">
              <a href="#platform" className="hover:text-[hsl(var(--retops-gold-hover))]">Platform</a>
              <a href="#how-it-works-section" className="hover:text-[hsl(var(--retops-gold-hover))]">How it works</a>
              <a href="#roi-calculator" className="hover:text-[hsl(var(--retops-gold-hover))]">ROI</a>
              <a href="#faq-section" className="hover:text-[hsl(var(--retops-gold-hover))]">FAQ</a>
            </nav>
            {user ? (
              <button data-testid="go-to-dashboard-btn" onClick={() => navigate("/dashboard")} className="btn-gold text-sm py-2">
                Open dashboard
              </button>
            ) : (
              <a href={BOOK_DEMO} target="_blank" rel="noreferrer" data-testid="nav-book-demo" className="btn-gold text-sm py-2 inline-flex items-center gap-1.5">
                Book a demo
              </a>
            )}
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              data-testid="mobile-menu-btn"
              aria-label="Toggle menu"
              className="md:hidden inline-flex items-center justify-center w-9 h-9 rounded-lg text-[hsl(var(--retops-navy))] hover:bg-[hsl(var(--retops-bg))]"
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                {menuOpen ? <><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></> : <><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></>}
              </svg>
            </button>
          </div>
        </div>
        {menuOpen && (
          <div className="md:hidden border-t border-[hsl(var(--retops-border))] bg-white" data-testid="mobile-menu">
            <nav className="px-6 py-3 flex flex-col gap-3 text-sm font-medium text-[hsl(var(--retops-navy))]">
              <a href="#platform" onClick={() => setMenuOpen(false)}>Platform</a>
              <a href="#how-it-works-section" onClick={() => setMenuOpen(false)}>How it works</a>
              <a href="#roi-calculator" onClick={() => setMenuOpen(false)}>ROI</a>
              <a href="#faq-section" onClick={() => setMenuOpen(false)}>FAQ</a>
              <button onClick={() => { setMenuOpen(false); goAuth(); }} data-testid="mobile-sign-in" className="text-left">Sign in or Register</button>
            </nav>
          </div>
        )}
      </header>

      {/* HERO — light bg with navy text + gold CTA (matches retops.ai) */}
      <section className="retops-hero relative overflow-hidden border-b border-[hsl(var(--retops-border))]">

        {/* Floating decorative orbs — cool hero effect */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="hero-orbs">
          <div className="orb" style={{ width: 420, height: 420, top: "-6%", left: "-8%", background: "radial-gradient(circle, rgba(20,184,166,0.32), transparent 70%)", animationDelay: "0s" }} />
          <div className="orb" style={{ width: 360, height: 360, top: "8%", right: "-6%", background: "radial-gradient(circle, rgba(248,210,16,0.28), transparent 70%)", animationDelay: "-4s" }} />
          <div className="orb" style={{ width: 260, height: 260, bottom: "-4%", left: "34%", background: "radial-gradient(circle, rgba(11,31,59,0.12), transparent 70%)", animationDelay: "-8s" }} />
        </div>

        <div className="relative z-10 max-w-[1280px] mx-auto px-5 sm:px-8 pt-10 sm:pt-14 pb-16 sm:pb-24 grid lg:grid-cols-[1.1fr,0.9fr] gap-8 lg:gap-14 items-center">
          <div className="rise">
            <p className="text-[11px] sm:text-xs font-bold uppercase tracking-[0.18em] text-[#8a6b00]">
              AI-powered quality, coaching, and retention
            </p>
            <h1 className="font-instrument text-[38px] sm:text-[56px] lg:text-[64px] leading-[1.06] sm:leading-[1.05] mt-4 sm:mt-5 text-[hsl(var(--retops-navy))]">
              Every cancelled customer left <span className="text-[hsl(var(--retops-teal))]">warning signs</span>. RetOps catches them before they leave.
            </h1>
            <p className="text-[hsl(var(--retops-muted))] text-base sm:text-lg mt-4 sm:mt-6 max-w-xl leading-relaxed hidden sm:block">
              Built for support teams that need full QA coverage, faster coaching, and earlier risk detection across human and AI interactions — scored against your rubric, with the dollar impact attached.
            </p>
            <p className="font-instrument text-lg sm:text-xl mt-4 sm:mt-6 text-[hsl(var(--retops-navy))]/80">
              Protect the revenue hidden in &nbsp;
              <span className="rotator text-[#8a6b00]" data-testid="hero-rotator" style={{ minWidth: "15ch" }}>
                <span>every conversation.</span>
                <span>every complaint.</span>
                <span>every interaction.</span>
              </span>
            </p>
            <div className="flex flex-wrap gap-2 sm:gap-3 mt-6 sm:mt-8">
              <a href="#roi-calculator" data-testid="hero-see-roi" className="btn-gold flex items-center gap-1.5">
                See your ROI
              </a>
              <WatchDemoButton onClick={() => setDemoOpen(true)} />
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

      {/* ==== PLATFORM — scroll-pinned card stack ==== REMOVED FROM TOP, MOVED AFTER HOW-IT-WORKS */}

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
        <div className="max-w-[1080px] mx-auto px-6 py-24">
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-[#8a6b00] reveal">The math</p>
            <h2 className="font-instrument text-4xl lg:text-5xl mt-4 leading-tight text-[hsl(var(--retops-navy))] reveal max-w-3xl mx-auto">
              A small miss per conversation becomes a massive leak at scale.
            </h2>
            <p className="text-[hsl(var(--retops-muted))] text-base mt-5 max-w-2xl mx-auto leading-relaxed reveal">
              Here's how avoidable churn compounds across a mid-sized support org — and why early detection pays for itself many times over.
            </p>
          </div>

          <div className="mt-14 rounded-3xl bg-white border border-[hsl(var(--retops-border))] overflow-hidden shadow-sm reveal">
            <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[hsl(var(--retops-border))]">
              {[
                { label: "Subscriber base",        val: "500,000",       sub: "typical mid-market scale" },
                { label: "Monthly churn rate",     val: "2%",            sub: "industry benchmark" },
                { label: "Customers lost / month", val: "10,000",        sub: "500K × 2%", highlight: true },
              ].map((x, i) => (
                <div key={i} className="p-6 md:p-8 relative">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[hsl(var(--retops-muted))]">{x.label}</p>
                  <p className={`kpi-num kpi-num-lg mt-3 ${x.highlight ? "text-[#b91c1c]" : "text-[hsl(var(--retops-navy))]"}`}>{x.val}</p>
                  <p className="text-xs text-[hsl(var(--retops-muted-2))] mt-2">{x.sub}</p>
                  {i < 2 && (
                    <span aria-hidden className="hidden md:grid absolute top-1/2 -right-3 -translate-y-1/2 w-6 h-6 rounded-full bg-white border border-[hsl(var(--retops-border))] place-items-center text-xs font-bold text-[hsl(var(--retops-muted))]">×</span>
                  )}
                </div>
              ))}
            </div>
            <div className="border-t border-[hsl(var(--retops-border))] grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[hsl(var(--retops-border))]">
              {[
                { label: "× ARPU",             val: "$40 / mo",     sub: "typical SaaS / subscription" },
                { label: "Monthly revenue loss", val: "$400K",      sub: "10K × $40", highlight: true },
                { label: "Annualized loss",      val: "$4.8M",      sub: "× 12 months", highlight: true },
              ].map((x, i) => (
                <div key={i} className="p-6 md:p-8 relative">
                  <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-[hsl(var(--retops-muted))]">{x.label}</p>
                  <p className={`kpi-num kpi-num-lg mt-3 ${x.highlight ? "text-[#b91c1c]" : "text-[hsl(var(--retops-navy))]"}`}>{x.val}</p>
                  <p className="text-xs text-[hsl(var(--retops-muted-2))] mt-2">{x.sub}</p>
                </div>
              ))}
            </div>
            <div className="bg-[hsl(var(--retops-navy))] text-white p-6 md:p-8 flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-gold))]">With RetOps</p>
                <p className="font-instrument text-2xl md:text-3xl mt-2">Save <span className="text-[hsl(var(--retops-gold))]">20–40%</span> of avoidable churn — that's up to <span className="text-[hsl(var(--retops-teal))]">$1.9M/yr</span> protected.</p>
              </div>
              <a href="#roi-calculator" className="btn-gold text-sm">See your ROI</a>
            </div>
          </div>

          <p className="text-center text-xs text-[hsl(var(--retops-muted-2))] mt-6 reveal">
            Replacing a lost customer also costs 5–25× more than retaining one. RetOps ties conversation quality to real business impact — not just scores on a dashboard.
          </p>
        </div>
      </section>

      {/* ==== Customer Journey Roadmap ==== */}
      <section className="bg-white border-t border-[hsl(var(--retops-border))]" data-testid="customer-journey-section">
        <div className="max-w-[1280px] mx-auto px-8 py-24 text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-muted))] reveal">Customer journey</p>
          <h2 className="font-instrument text-4xl lg:text-5xl mt-4 leading-tight text-[hsl(var(--retops-navy))] reveal">
            From raw interaction data to revenue protection.
          </h2>
          <p className="text-[hsl(var(--retops-muted))] text-lg mt-6 max-w-2xl mx-auto leading-relaxed reveal">
            RetOps turns conversations into scored insight, risk detection, and next-step action across both human and AI support.
          </p>

          <div className="relative mt-20 pb-4">
            <svg aria-hidden className="absolute top-12 left-0 w-full h-20 hidden md:block pointer-events-none" viewBox="0 0 1200 80" preserveAspectRatio="none">
              <path d="M 30 40 Q 130 5, 220 40 T 430 40 T 640 40 T 850 40 T 1060 40 T 1170 40" stroke="hsl(var(--retops-muted))" strokeWidth="1" fill="none" strokeDasharray="3 5" opacity="0.35" />
            </svg>
            <ol className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-y-10 gap-x-3 relative">
              {[
                { name:"connect",   t:"Connect",          d:"Ingest every customer touchpoint" },
                { name:"normalize", t:"Normalize",        d:"Turn scattered interaction data into one usable stream" },
                { name:"score",     t:"Score",            d:"Review every interaction against your rubric" },
                { name:"detect",    t:"Detect risk",      d:"Spot churn, compliance, and AI quality issues early" },
                { name:"trigger",   t:"Trigger action",   d:"Route alerts, playbooks, and follow-up automatically" },
                { name:"coach",     t:"Coach and improve",d:"Help teams get better from real interaction data" },
                { name:"protect",   t:"Protect revenue",  d:"Reduce avoidable churn and operational leakage", gold: true },
              ].map((s, i) => (
                <li key={s.t} className="relative journey-step-loop reveal" style={{ animationDelay: `${i}s`, transitionDelay: `${i * 80}ms` }} data-testid={`journey-step-${String(i+1).padStart(2,'0')}`}>
                  <div className="journey-icon mx-auto w-14 h-16 rounded-xl grid place-items-center relative z-10 shadow-sm transition-all hover:-translate-y-1 bg-[hsl(var(--retops-bg))] border border-[hsl(var(--retops-border))]" style={{ animationDelay: `${i}s` }}>
                    <BrandIcon name={s.name} className="w-6 h-6 text-[hsl(var(--retops-navy))] journey-icon-svg" style={{ animationDelay: `${i}s` }} />
                  </div>
                  <p className="journey-label font-display text-sm font-semibold mt-5 text-[hsl(var(--retops-navy))]">{s.t}</p>
                  <p className="text-xs text-[hsl(var(--retops-muted))] mt-1.5 leading-snug max-w-[150px] mx-auto">{s.d}</p>
                </li>
              ))}
            </ol>
          </div>
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

      {/* ==== PLATFORM — scroll-pinned card stack (moved here, after How it works) ==== */}
      <PlatformStack />

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
              ["100% QA coverage",       "score"],
              ["Dollar on churn risk",   "churn"],
              ["AI + human in one view", "ai_gate"],
              ["Coaching from real calls", "coach"],
            ].map(([label, ic], i) => (
              <div key={i} className="p-5 rounded-2xl bg-white/5 border border-white/10">
                <BrandIcon name={ic} className="w-6 h-6 text-[hsl(var(--retops-gold))]" />
                <p className="mt-3 text-sm font-semibold">{label}</p>
                <p className="text-xs text-white/60 mt-1 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Included</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="border-t border-[hsl(var(--retops-border))] bg-white">
        <div className="max-w-[1280px] mx-auto px-8 py-6 flex items-center justify-between">
          <Logo size="header" />
          <span className="text-xs text-[hsl(var(--retops-muted-2))]">© {new Date().getFullYear()} RetOps · Revenue Intelligence</span>
        </div>
      </footer>

      <DemoVideoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
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


// ==== PlatformStack — scroll-pinned stacking cards (ONE SYSTEM. SEVEN JOBS DONE.) ====
const PLATFORM_CARDS = [
  {
    name: "score", tag: "01 · QA Coverage", title: "100% QA coverage",
    copy: "Score every call, chat, and ticket against your rubric — no sampling, no blind spots.",
    preview: [
      { label: "Signal matched", val: "policy + rubric" },
      { label: "QA score propagated", val: "100% coverage" },
      { label: "$ at risk surfaced", val: "playbook ready" },
    ],
  },
  {
    name: "ai_gate", tag: "02 · AI Quality Gate", title: "AI quality gate",
    copy: "Catch hallucinations, policy drift, and grounding failures before the response reaches the customer.",
    preview: [
      { label: "AI response flagged", val: "hallucination · 3/10" },
      { label: "Policy check", val: "FAIL · rewritten" },
      { label: "Grounded citation", val: "required" },
    ],
  },
  {
    name: "churn", tag: "03 · Churn Risk", title: "Revenue at risk",
    copy: "Tie churn signals to account value — leaders see exactly where money is exposed.",
    preview: [
      { label: "Acme Corp", val: "$14.4K · High" },
      { label: "Brightfield Inc.", val: "$7.2K · Medium" },
      { label: "Churn keyword", val: "competitor match" },
    ],
  },
  {
    name: "coach", tag: "04 · Coaching", title: "Coaching from real calls",
    copy: "Coaching cards from what actually happened on the line — not guesswork.",
    preview: [
      { label: "Alex R.", val: "Skipped ID verify · 3 calls" },
      { label: "Growth area", val: "Policy accuracy" },
      { label: "Module assigned", val: "De-escalation v2" },
    ],
  },
  {
    name: "exec", tag: "05 · Executive View", title: "Executive dashboard",
    copy: "Revenue-at-risk by segment, coaching ROI, and trust-score calibration in one screen.",
    preview: [
      { label: "ARR at risk", val: "$2.4M · 18%" },
      { label: "Coaching ROI", val: "340%" },
      { label: "Calibration", val: "91.2% agreement" },
    ],
  },
  {
    name: "bulk", tag: "06 · Bulk Ops", title: "Score 100s at once",
    copy: "Drop in transcripts — CSV, JSONL, or text. RetOps identifies rep + customer, scores each, aggregates.",
    preview: [
      { label: "Batch size", val: "200 transcripts" },
      { label: "Rep leaderboard", val: "auto-generated" },
      { label: "Custom preset", val: "Urban Flavours · cannabis" },
    ],
  },
  {
    name: "digest", tag: "07 · Weekly Digest", title: "Monday morning digest",
    copy: "Every leader gets a branded email: top at-risk accounts, coaching priorities, expansion signals.",
    preview: [
      { label: "Delivered", val: "Monday 09:00" },
      { label: "Top at-risk", val: "5 accounts" },
      { label: "Expansion signals", val: "+$2.4K/mo" },
    ],
  },
];

const PlatformStack = () => {
  const wrapRef = useRef(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = PLATFORM_CARDS.length;
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = Math.max(0, Math.min(1, -rect.top / scrollable));
      setActive(Math.min(total - 1, Math.floor(progress * total)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll to a specific card by scrolling the page — each card takes 90vh of scroll room
  const goToCard = (i) => {
    const el = wrapRef.current;
    if (!el) return;
    const total = PLATFORM_CARDS.length;
    const scrollable = el.offsetHeight - window.innerHeight;
    if (scrollable <= 0) return;
    const clamped = Math.max(0, Math.min(total - 1, i));
    // Use (total-1) as denominator so clamped===total-1 hits 100% of scrollable (fixes End-key off-by-one)
    const frac = total > 1 ? clamped / (total - 1) : 0;
    const target = el.offsetTop + frac * scrollable + (clamped === total - 1 ? -2 : 4);
    window.scrollTo({ top: target, behavior: "smooth" });
  };

  // ← → arrow-key navigation — active only when the stack section is in viewport
  useEffect(() => {
    const onKey = (e) => {
      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.6 && rect.bottom > window.innerHeight * 0.4;
      if (!inView) return;
      // Avoid hijacking if user is typing in an input
      if (document.activeElement && /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName)) return;
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); goToCard(active + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); goToCard(active - 1); }
      else if (e.key === "Home") { e.preventDefault(); goToCard(0); }
      else if (e.key === "End")  { e.preventDefault(); goToCard(PLATFORM_CARDS.length - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  // Touch-swipe navigation on mobile/tablet (horizontal swipes over the card area)
  const touch = useRef({ x: 0, y: 0, t: 0 });
  const onTouchStart = (e) => {
    const t = e.touches[0];
    touch.current = { x: t.clientX, y: t.clientY, t: Date.now() };
  };
  const onTouchEnd = (e) => {
    const t = e.changedTouches[0];
    const dx = t.clientX - touch.current.x;
    const dy = t.clientY - touch.current.y;
    const dt = Date.now() - touch.current.t;
    // Horizontal swipe: >40px, faster than 600ms, and dx dominates dy
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy) * 1.5 && dt < 600) {
      goToCard(active + (dx < 0 ? 1 : -1));
    }
  };

  return (
    <section id="platform" className="bg-[hsl(var(--retops-bg))] border-t border-[hsl(var(--retops-border))]" data-testid="platform-stack-section">
      <div className="max-w-[1080px] mx-auto px-6 pt-20 pb-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-teal))]">Platform</p>
        <h2 className="font-instrument text-4xl lg:text-5xl mt-4 leading-tight text-[hsl(var(--retops-navy))]">One system. Seven jobs done.</h2>
        <p className="text-[hsl(var(--retops-muted))] text-base mt-4 max-w-xl mx-auto">Scroll, swipe, or use <kbd className="px-1.5 py-0.5 rounded bg-white border border-[hsl(var(--retops-border))] text-[11px] font-mono">←</kbd> <kbd className="px-1.5 py-0.5 rounded bg-white border border-[hsl(var(--retops-border))] text-[11px] font-mono">→</kbd> to walk the stack. Everything RetOps catches across calls, chats, tickets, and AI.</p>
      </div>

      <div ref={wrapRef} className="relative" style={{ height: `${(PLATFORM_CARDS.length + 1) * 90}vh` }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <div className="sticky top-14 h-[calc(100vh-3.5rem)] flex items-center">
          <div className="w-full px-4 md:px-8">
            <div className="relative mx-auto" style={{ maxWidth: 960, height: "min(640px, 82vh)" }}>

              {/* Left / right nav arrows */}
              <button
                type="button"
                onClick={() => goToCard(active - 1)}
                disabled={active === 0}
                data-testid="platform-prev"
                aria-label="Previous card"
                className={`absolute top-1/2 -translate-y-1/2 -left-4 md:-left-16 z-30 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white border border-[hsl(var(--retops-border))] shadow-md grid place-items-center text-[hsl(var(--retops-navy))] transition-all hover:shadow-xl hover:-translate-y-[calc(50%+2px)] hover:border-[hsl(var(--retops-teal))] disabled:opacity-30 disabled:pointer-events-none`}
              >
                <ArrowRight className="w-4 h-4 rotate-180" />
              </button>
              <button
                type="button"
                onClick={() => goToCard(active + 1)}
                disabled={active === PLATFORM_CARDS.length - 1}
                data-testid="platform-next"
                aria-label="Next card"
                className={`absolute top-1/2 -translate-y-1/2 -right-4 md:-right-16 z-30 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white border border-[hsl(var(--retops-border))] shadow-md grid place-items-center text-[hsl(var(--retops-navy))] transition-all hover:shadow-xl hover:-translate-y-[calc(50%+2px)] hover:border-[hsl(var(--retops-teal))] disabled:opacity-30 disabled:pointer-events-none`}
              >
                <ArrowRight className="w-4 h-4" />
              </button>

              {PLATFORM_CARDS.map((card, i) => {
                const offset = i - active;
                const isPast = offset < 0;
                const absOffset = Math.abs(offset);
                // Visible stack: active + next 2 behind (offsets 1 and 2 pushed back/down),
                // past cards fade below. More pronounced scale+translate so cards read clearly as a stack.
                const scale = offset === 0 ? 1 : offset > 0 ? 1 - Math.min(offset, 3) * 0.04 : 1 - Math.min(absOffset, 3) * 0.06;
                const translateY = offset === 0
                  ? 0
                  : offset > 0
                    ? 24 * Math.min(offset, 3)      // cards ahead stack DOWN so you can see their edges
                    : -40 * Math.min(absOffset, 3); // past cards slide UP and out
                const opacity = offset > 2 ? 0 : isPast && absOffset > 1 ? 0 : 1 - Math.max(0, offset) * 0.15;
                // Stronger shadow + heavier border on the active card; stacked cards get a softer, deeper shadow for depth
                const cardShadow = offset === 0
                  ? "0 30px 60px -20px rgba(11,31,59,.45), 0 10px 25px -12px rgba(11,31,59,.25)"
                  : offset > 0
                    ? `0 ${18 + offset * 6}px ${28 + offset * 8}px -12px rgba(11,31,59,.25)`
                    : "0 8px 18px -10px rgba(11,31,59,.15)";
                const borderWidth = offset === 0 ? "2px" : "1px";
                return (
                  <div
                    key={card.title}
                    data-testid={`platform-card-${i + 1}`}
                    className="absolute inset-0 grid md:grid-cols-[1.15fr,1fr] rounded-3xl overflow-hidden bg-white transition-all duration-500"
                    style={{
                      transform: `translateY(${translateY}px) scale(${scale})`,
                      opacity,
                      zIndex: PLATFORM_CARDS.length - Math.abs(offset),
                      pointerEvents: offset === 0 ? "auto" : "none",
                      boxShadow: cardShadow,
                      border: `${borderWidth} solid ${offset === 0 ? "hsl(var(--retops-navy) / 0.18)" : "hsl(var(--retops-border))"}`,
                    }}
                  >
                    <div className="retops-hero-dark text-white p-8 md:p-10 flex flex-col justify-between relative overflow-hidden">
                      <div className="relative z-10">
                        <div className="w-11 h-11 rounded-xl bg-white/10 border border-white/20 grid place-items-center">
                          <BrandIcon name={card.name} className="w-6 h-6 text-white" />
                        </div>
                        <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[hsl(var(--retops-gold))] mt-6">{card.tag}</p>
                        <h3 className="font-instrument text-3xl md:text-4xl mt-2 leading-tight">{card.title}</h3>
                        <p className="text-white/75 mt-4 text-sm md:text-base leading-relaxed">{card.copy}</p>
                      </div>
                      <a href="#roi-calculator" className="relative z-10 inline-flex items-center gap-2 text-white/90 text-xs font-semibold mt-6 hover:text-[hsl(var(--retops-gold))]">
                        Learn more <ArrowRight className="w-3.5 h-3.5" />
                      </a>
                    </div>
                    <div className="bg-[hsl(var(--retops-bg))] p-6 md:p-8 flex items-center">
                      <div className="w-full">
                        <div className="rounded-xl bg-white border border-[hsl(var(--retops-border))] shadow-sm p-4 md:p-5">
                          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[hsl(var(--retops-muted))]">RetOps preview</p>
                          <div className="mt-4 space-y-2">
                            {card.preview.map((p, j) => (
                              <div key={j} className="bg-[hsl(var(--retops-bg))] rounded-lg px-3 py-2.5 text-xs flex items-center justify-between gap-2">
                                <span className="font-code text-[11px] text-[hsl(var(--retops-muted))] truncate">{p.label}</span>
                                <span className="font-code text-[11px] font-semibold text-[hsl(var(--retops-navy))] text-right">{p.val}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex gap-1.5" data-testid="platform-dots">
                {PLATFORM_CARDS.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => goToCard(i)}
                    data-testid={`platform-dot-${i}`}
                    aria-label={`Go to card ${i + 1}`}
                    className={`h-1.5 rounded-full transition-all ${i === active ? "w-8 bg-[hsl(var(--retops-navy))]" : "w-1.5 bg-[hsl(var(--retops-border))] hover:bg-[hsl(var(--retops-muted))]"}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

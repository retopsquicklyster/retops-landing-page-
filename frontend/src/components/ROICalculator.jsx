import { useState, useMemo } from "react";
import { Calculator, TrendingDown, Sparkles } from "lucide-react";

/**
 * Simple, conversational ROI calculator — 3 inputs, plain English, big "oh wow" numbers.
 * No jargon (no CAC / ARPU / "recovery rate"). Formats values correctly in thousands AND millions.
 */
export default function ROICalculator() {
  const [customers, setCustomers] = useState(5000);
  const [revPerCustomer, setRevPerCustomer] = useState(50); // $ / month
  const [churnPct, setChurnPct] = useState(2.0); // % monthly

  const result = useMemo(() => {
    const lostPerMonth = Math.round(customers * (churnPct / 100));
    const moneyPerMonth = Math.round(lostPerMonth * revPerCustomer);
    const moneyPerYear = moneyPerMonth * 12;
    const recovered = Math.round(moneyPerYear * 0.25); // 25% is the RetOps industry benchmark
    // Tangible "oh wow" comparisons for the annual loss
    const salaries = Math.max(1, Math.round(moneyPerYear / 65000)); // $65K avg support agent salary
    const coffees = Math.round(moneyPerYear / 5);                    // $5 coffee
    const iphones = Math.round(moneyPerYear / 1000);                 // $1K iPhone
    return { lostPerMonth, moneyPerMonth, moneyPerYear, recovered, salaries, coffees, iphones };
  }, [customers, revPerCustomer, churnPct]);

  return (
    <section id="roi-calculator" className="bg-white border-t border-[hsl(var(--line))]" data-testid="roi-calculator">
      <div className="max-w-[1200px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <div className="grid lg:grid-cols-[1fr,1.15fr] gap-8 lg:gap-14 items-start">
          {/* LEFT — 3 friendly inputs */}
          <div>
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--brand))] font-semibold">
              <Calculator className="w-4 h-4" /> ROI calculator
            </p>
            <h2 className="font-instrument text-3xl sm:text-4xl lg:text-5xl mt-3 leading-[1.1] text-[hsl(var(--retops-navy))]">
              How much is churn quietly costing you?
            </h2>
            <p className="text-[hsl(var(--retops-muted))] mt-4 leading-relaxed max-w-xl text-base sm:text-lg">
              Move the three sliders. Watch the number climb. No finance degree required.
            </p>

            <div className="mt-8 sm:mt-10 space-y-6 max-w-md">
              <Slider
                label="How many customers do you have?"
                hint="Total active users, subscribers, or accounts"
                value={customers}
                onChange={setCustomers}
                min={100}
                max={1_000_000}
                step={100}
                format={(v) => v.toLocaleString()}
                testid="roi-customers"
              />
              <Slider
                label="What do they pay you each month?"
                hint="Average revenue per customer"
                value={revPerCustomer}
                onChange={setRevPerCustomer}
                min={5}
                max={500}
                step={5}
                format={(v) => `$${v}`}
                testid="roi-arpu"
              />
              <Slider
                label="What % leave every month?"
                hint={churnPct <= 1.5 ? "Best-in-class SaaS" : churnPct <= 3 ? "Industry average" : "Churn is your biggest problem"}
                value={churnPct}
                onChange={setChurnPct}
                min={0.5}
                max={8}
                step={0.1}
                format={(v) => `${v.toFixed(1)}%`}
                testid="roi-churn"
              />
            </div>
          </div>

          {/* RIGHT — the "oh wow" output */}
          <div className="ret-card p-6 sm:p-8 relative overflow-hidden" data-testid="roi-output">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[hsl(var(--retops-teal))]/10 pointer-events-none" aria-hidden />

            {/* Line 1 — customers lost per month in plain words */}
            <p className="text-sm text-[hsl(var(--retops-muted))]">Every month you quietly lose</p>
            <p className="font-instrument text-3xl sm:text-4xl text-[hsl(var(--retops-navy))] mt-1 tabular-nums">
              <span data-testid="roi-customers-lost">{result.lostPerMonth.toLocaleString()}</span>
              <span className="text-[hsl(var(--retops-muted-2))] text-xl sm:text-2xl"> customers</span>
            </p>

            {/* Line 2 — the big $ yearly number */}
            <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-[hsl(var(--retops-bg))] border border-[hsl(var(--line))]">
              <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-red-500 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" /> That's costing you
              </p>
              <p className="font-instrument text-[44px] sm:text-[56px] leading-none mt-2 text-red-600 tabular-nums" data-testid="roi-annual-loss">
                {fmtDollar(result.moneyPerYear)}
              </p>
              <p className="text-[hsl(var(--retops-muted))] text-sm mt-1">
                a year — or <span className="font-semibold text-[hsl(var(--retops-navy))] tabular-nums">{fmtDollar(result.moneyPerMonth)}</span> every month, gone.
              </p>
            </div>

            {/* The "oh wow" comparisons */}
            <div className="mt-5" data-testid="roi-wow">
              <p className="text-[11px] uppercase tracking-[0.18em] font-semibold text-[hsl(var(--retops-muted-2))] mb-3">
                That's enough to…
              </p>
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <WowCard icon="💼" number={result.salaries.toLocaleString()} label={result.salaries === 1 ? "support agent hired full-time" : "support agents, fully loaded"} />
                <WowCard icon="📱" number={result.iphones.toLocaleString()} label="iPhone Pros for your team" />
                <WowCard icon="☕" number={fmtCompact(result.coffees)} label="lattes · every customer, every day" />
              </div>
            </div>

            {/* The fix */}
            <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-[hsl(var(--retops-navy))] text-white">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--retops-gold))] font-semibold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" /> With RetOps, you'd save
              </p>
              <p className="font-instrument text-[44px] sm:text-[56px] leading-none mt-2 tabular-nums" data-testid="roi-recovered">
                {fmtDollar(result.recovered)}
              </p>
              <p className="text-white/70 text-sm mt-1.5">
                a year — by catching churn signals before the customer hits cancel. (Based on a 25% save rate on flagged at-risk accounts.)
              </p>
            </div>

            <p className="text-[11px] text-[hsl(var(--retops-muted-2))] mt-4 leading-relaxed">
              Your numbers, your math. Actual recovery depends on conversation volume and how fast your CSM team acts on the signals RetOps surfaces.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───── Proper $ formatter — shows THOUSANDS and MILLIONS correctly ───── */
function fmtDollar(n) {
  if (n == null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  if (abs >= 1_000_000)     return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000)        return `$${Math.round(n / 1000).toLocaleString()}K`;
  if (abs >= 1_000)         return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
function fmtCompact(n) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${Math.round(n / 1000).toLocaleString()}K`;
  return n.toLocaleString();
}

const Slider = ({ label, hint, value, onChange, min, max, step, format, testid }) => (
  <label className="block">
    <div className="flex justify-between items-baseline gap-3 mb-2">
      <span className="text-sm font-semibold text-[hsl(var(--retops-navy))] leading-tight">{label}</span>
      <span className="font-instrument text-2xl sm:text-3xl text-[hsl(var(--retops-teal))] tabular-nums flex-none">{format(value)}</span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      onChange={(e) => onChange(parseFloat(e.target.value))}
      data-testid={testid}
      className="w-full accent-[hsl(var(--retops-teal))] cursor-pointer"
    />
    {hint && <p className="text-xs text-[hsl(var(--retops-muted-2))] mt-1.5">{hint}</p>}
  </label>
);

const WowCard = ({ icon, number, label }) => (
  <div className="bg-white border border-[hsl(var(--line))] rounded-xl p-3 sm:p-4 text-center">
    <div className="text-2xl sm:text-3xl" aria-hidden>{icon}</div>
    <p className="font-instrument text-2xl sm:text-3xl text-[hsl(var(--retops-navy))] mt-1 tabular-nums leading-none">{number}</p>
    <p className="text-[10px] sm:text-[11px] text-[hsl(var(--retops-muted))] mt-1.5 leading-tight">{label}</p>
  </div>
);

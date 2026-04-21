import { useState, useMemo } from "react";
import { Calculator, TrendingDown, ShieldCheck } from "lucide-react";

/**
 * Detailed-yet-relatable ROI calculator.
 * 4 inputs → crystal-clear output: Current Revenue vs. Revenue at Risk vs. What RetOps Saves.
 * Formats correctly across thousands, millions, and billions.
 */
export default function ROICalculator() {
  const [customers, setCustomers] = useState(5000);
  const [revPerCustomer, setRevPerCustomer] = useState(50);   // $ / month
  const [cancelRate, setCancelRate] = useState(6);            // % of tickets that end in cancellation
  const [monthlyTickets, setMonthlyTickets] = useState(1500); // support tickets / chats / calls per month

  const result = useMemo(() => {
    const currentMonthly = customers * revPerCustomer;
    const currentAnnual  = currentMonthly * 12;
    // Churn math: each month, (cancelRate %) of tickets end in a cancellation
    const lostPerMonth   = Math.round(monthlyTickets * (cancelRate / 100));
    const lostAnnual     = lostPerMonth * 12;
    const revenueAtRisk  = lostAnnual * revPerCustomer * 12; // each lost customer's annualized value
    const revAtRiskPct   = currentAnnual > 0 ? (revenueAtRisk / currentAnnual) * 100 : 0;
    // RetOps recovery — catches 25% of at-risk signals early
    const recovered      = Math.round(revenueAtRisk * 0.25);
    // Tangible comparisons
    const salaries       = Math.max(1, Math.round(revenueAtRisk / 65000));
    return {
      currentMonthly, currentAnnual,
      lostPerMonth, lostAnnual,
      revenueAtRisk, revAtRiskPct, recovered, salaries,
    };
  }, [customers, revPerCustomer, cancelRate, monthlyTickets]);

  return (
    <section id="roi-calculator" className="bg-white border-t border-[hsl(var(--line))]" data-testid="roi-calculator">
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <div className="grid lg:grid-cols-[1fr,1.15fr] gap-10 lg:gap-14 items-start">
          {/* ═══════════ LEFT — inputs ═══════════ */}
          <div>
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--brand))] font-semibold">
              <Calculator className="w-4 h-4" /> ROI calculator
            </p>
            <h2 className="font-instrument text-3xl sm:text-4xl lg:text-5xl mt-3 leading-[1.08] text-[hsl(var(--retops-navy))]">
              How much revenue is quietly slipping through your support team?
            </h2>
            <p className="text-[hsl(var(--retops-muted))] mt-4 leading-relaxed max-w-xl text-sm sm:text-base">
              Answer four questions you <em>already</em> know. No churn-rate guessing, no finance degree. See exactly what's at risk — and how much RetOps claws back.
            </p>

            <div className="mt-8 sm:mt-10 space-y-6 max-w-md">
              <Slider
                label="How many paying customers do you have?"
                hint="Total active subscribers or accounts"
                value={customers}
                onChange={setCustomers}
                min={50}
                max={1_000_000}
                step={50}
                format={(v) => v.toLocaleString()}
                testid="roi-customers"
              />
              <Slider
                label="What does each customer pay you per month?"
                hint="Average monthly subscription / order value"
                value={revPerCustomer}
                onChange={setRevPerCustomer}
                min={5}
                max={2000}
                step={5}
                format={(v) => `$${v.toLocaleString()}`}
                testid="roi-arpu"
              />
              <Slider
                label="How many support chats / calls / tickets do you handle per month?"
                hint="Every conversation is a save-or-lose moment"
                value={monthlyTickets}
                onChange={setMonthlyTickets}
                min={50}
                max={50_000}
                step={50}
                format={(v) => v.toLocaleString()}
                testid="roi-tickets"
              />
              <Slider
                label="Of those, roughly what % end with the customer leaving?"
                hint={cancelRate <= 3 ? "You have excellent retention" : cancelRate <= 7 ? "Around the industry norm" : "This is where RetOps pays for itself ten times over"}
                value={cancelRate}
                onChange={setCancelRate}
                min={1}
                max={20}
                step={0.5}
                format={(v) => `${v.toFixed(1)}%`}
                testid="roi-cancel-rate"
              />
            </div>
          </div>

          {/* ═══════════ RIGHT — output ═══════════ */}
          <div className="ret-card p-6 sm:p-8 relative overflow-hidden" data-testid="roi-output">
            <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-[hsl(var(--retops-teal))]/10 pointer-events-none" aria-hidden />

            {/* Current revenue — the baseline */}
            <div className="relative">
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--retops-muted-2))]">Your business today</p>
              <div className="mt-2 flex items-baseline justify-between gap-3">
                <div>
                  <p className="text-xs text-[hsl(var(--retops-muted))]">Current annual revenue</p>
                  <p className="font-instrument text-3xl sm:text-4xl text-[hsl(var(--retops-navy))] tabular-nums" data-testid="roi-current-revenue">
                    {fmtDollar(result.currentAnnual)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[hsl(var(--retops-muted))]">Support volume / yr</p>
                  <p className="font-instrument text-xl sm:text-2xl text-[hsl(var(--retops-navy))] tabular-nums">
                    {(result.lostPerMonth * 12 > 0 ? (result.lostPerMonth * 12 / Math.max(result.lostPerMonth, 1)).toLocaleString() : "0")} <span className="sr-only">chats per year</span>
                    <span className="text-lg">{(result.lostPerMonth * 12 === 0 ? "" : "")}</span>
                  </p>
                  <p className="font-instrument text-xl sm:text-2xl text-[hsl(var(--retops-navy))] tabular-nums">
                    {(monthlyTickets12(result.lostPerMonth, 12)).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Revenue at Risk — the wake-up call */}
            <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-red-50 border border-red-100" data-testid="roi-at-risk-block">
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-red-600 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" /> Revenue at risk · right now
              </p>
              <p className="font-instrument text-[44px] sm:text-[56px] leading-none mt-2 text-red-600 tabular-nums" data-testid="roi-revenue-at-risk">
                {fmtDollar(result.revenueAtRisk)}
              </p>
              <p className="text-[hsl(var(--ink-2))] text-sm mt-2 leading-relaxed">
                That's <span className="font-bold tabular-nums">{result.revAtRiskPct.toFixed(1)}%</span> of your revenue walking out the door — about <span className="font-bold tabular-nums">{result.lostPerMonth.toLocaleString()} customers every month</span> canceling for reasons your team could have caught in the conversation.
              </p>
              <p className="text-xs text-[hsl(var(--retops-muted))] mt-3 leading-relaxed">
                Enough to cover <span className="font-bold text-[hsl(var(--retops-navy))] tabular-nums">{result.salaries.toLocaleString()}</span> full-time support agents&nbsp;·&nbsp;fully loaded at $65K.
              </p>
            </div>

            {/* Math breakdown — full transparency */}
            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--retops-muted-2))] mb-2.5">The math, step by step</p>
              <dl className="divide-y divide-[hsl(var(--line))] text-sm">
                <BreakdownRow k="Support volume / month"         v={monthlyTickets.toLocaleString()} />
                <BreakdownRow k={`× ${cancelRate.toFixed(1)}% cancel rate`} v={`${result.lostPerMonth.toLocaleString()} customers / mo lost`} />
                <BreakdownRow k="Annualized lost customers"       v={(result.lostPerMonth * 12).toLocaleString()} />
                <BreakdownRow k={`× $${revPerCustomer} / mo × 12`} v={fmtDollar(result.revenueAtRisk)} bold />
              </dl>
            </div>

            {/* With RetOps */}
            <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-[hsl(var(--retops-navy))] text-white">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--retops-gold))] font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> With RetOps, you claw back
              </p>
              <p className="font-instrument text-[44px] sm:text-[56px] leading-none mt-2 tabular-nums" data-testid="roi-recovered">
                {fmtDollar(result.recovered)}
              </p>
              <p className="text-white/75 text-sm mt-2 leading-relaxed">
                a year — by catching the churn language, pricing pushback, and competitor mentions your team missed. Based on a 25% save rate on flagged at-risk accounts.
              </p>
            </div>

            <p className="text-[11px] text-[hsl(var(--retops-muted-2))] mt-4 leading-relaxed">
              Real-world save rates range 15–35% depending on how quickly your CSM team acts. Your numbers, your math — change any slider to see it update instantly.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───── helpers ───── */
function fmtDollar(n) {
  if (n == null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(abs >= 10_000_000_000 ? 0 : 1)}B`;
  if (abs >= 1_000_000)     return `$${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  if (abs >= 10_000)        return `$${Math.round(n / 1000).toLocaleString()}K`;
  if (abs >= 1_000)         return `$${(n / 1000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
const monthlyTickets12 = (perMonth) => perMonth * 12;

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

const BreakdownRow = ({ k, v, bold }) => (
  <div className="flex items-center justify-between py-2">
    <dt className="text-xs text-[hsl(var(--retops-muted))]">{k}</dt>
    <dd className={`tabular-nums ${bold ? "font-bold text-[hsl(var(--retops-navy))] text-base" : "font-semibold text-[hsl(var(--ink))]"}`}>{v}</dd>
  </div>
);

import { useState, useMemo } from "react";
import { Calculator, TrendingDown, ShieldCheck } from "lucide-react";

/**
 * Simple, transparent ROI calculator.
 * 3 plain-English inputs -> exact step-by-step math where every line adds up:
 *   1. Customers lost / month = Paying customers × Monthly churn %
 *   2. Monthly revenue lost   = Customers lost / month × Monthly price per customer
 *   3. Annual revenue lost    = Monthly revenue lost × 12 months
 *   4. Saved with RetOps      = Annual revenue lost × 25% recovery rate
 */
export default function ROICalculator() {
  const [customers, setCustomers] = useState(5000);
  const [revPerCustomer, setRevPerCustomer] = useState(50); // $ / month
  const [cancelRate, setCancelRate] = useState(2);          // % of customers leaving per month

  const result = useMemo(() => {
    const currentMonthly = customers * revPerCustomer;
    const currentAnnual  = currentMonthly * 12;

    // 1. Customers lost each month
    const lostPerMonth   = Math.round(customers * (cancelRate / 100));
    const lostAnnual     = lostPerMonth * 12;

    // 2. Monthly & annual revenue lost (computed directly from displayed numbers so math always adds up)
    const monthlyAtRisk  = lostPerMonth * revPerCustomer;
    const revenueAtRisk  = monthlyAtRisk * 12;
    const revAtRiskPct   = currentAnnual > 0 ? (revenueAtRisk / currentAnnual) * 100 : 0;

    // 3. RetOps recovery — saves 25% of avoidable churn
    const recoveredMonthly = Math.round(monthlyAtRisk * 0.25);
    const recovered        = Math.round(revenueAtRisk * 0.25);

    return {
      currentMonthly,
      currentAnnual,
      lostPerMonth,
      lostAnnual,
      monthlyAtRisk,
      revenueAtRisk,
      revAtRiskPct,
      recoveredMonthly,
      recovered,
    };
  }, [customers, revPerCustomer, cancelRate]);

  return (
    <section id="roi-calculator" className="bg-white border-t border-[hsl(var(--line))]" data-testid="roi-calculator">
      <div className="max-w-[1240px] mx-auto px-5 sm:px-8 py-16 sm:py-24">
        <div className="grid lg:grid-cols-[1fr,1.15fr] gap-10 lg:gap-14 items-start">
          {/* ═══════════ LEFT — 3 simple inputs ═══════════ */}
          <div>
            <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--brand))] font-semibold">
              <Calculator className="w-4 h-4" /> ROI calculator
            </p>
            <h2 className="font-instrument text-3xl sm:text-4xl lg:text-5xl mt-3 leading-[1.08] text-[hsl(var(--retops-navy))]">
              How much revenue is quietly slipping through your support team?
            </h2>
            <p className="text-[hsl(var(--retops-muted))] mt-4 leading-relaxed max-w-xl text-sm sm:text-base">
              Three simple numbers. Straightforward math that adds up at every step — see what churn is costing you each month and year, and how much RetOps claws back.
            </p>

            <div className="mt-8 sm:mt-10 space-y-6 max-w-md">
              <Slider
                label="1. How many paying customers do you have?"
                hint="Total active subscribers or customer accounts"
                value={customers}
                onChange={setCustomers}
                min={100}
                max={500_000}
                step={100}
                format={(v) => v.toLocaleString()}
                testid="roi-customers"
              />
              <Slider
                label="2. What does each customer pay per month?"
                hint="Average monthly subscription or account value (ARPU)"
                value={revPerCustomer}
                onChange={setRevPerCustomer}
                min={10}
                max={1000}
                step={5}
                format={(v) => `$${v.toLocaleString()}`}
                testid="roi-arpu"
              />
              <Slider
                label="3. What % of customers cancel each month?"
                hint={
                  cancelRate <= 1.5
                    ? "Low monthly churn"
                    : cancelRate <= 3.5
                      ? "Typical monthly churn benchmark (2–3%)"
                      : "High churn — early warning signs matter most here"
                }
                value={cancelRate}
                onChange={setCancelRate}
                min={0.5}
                max={10}
                step={0.5}
                format={(v) => `${v % 1 === 0 ? v.toFixed(0) : v.toFixed(1)}%`}
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
              <div className="mt-2 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[hsl(var(--retops-muted))]">Monthly revenue ({customers.toLocaleString()} × ${revPerCustomer.toLocaleString()})</p>
                  <p className="font-instrument text-2xl sm:text-3xl text-[hsl(var(--retops-navy))] tabular-nums mt-0.5">
                    {fmtDollar(result.currentMonthly)}<span className="text-sm text-[hsl(var(--retops-muted))] font-sans">/mo</span>
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-[hsl(var(--retops-muted))]">Annual revenue (× 12 months)</p>
                  <p className="font-instrument text-2xl sm:text-3xl text-[hsl(var(--retops-navy))] tabular-nums mt-0.5" data-testid="roi-current-revenue">
                    {fmtDollar(result.currentAnnual)}<span className="text-sm text-[hsl(var(--retops-muted))] font-sans">/yr</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Revenue at Risk — the wake-up call */}
            <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-red-50 border border-red-100" data-testid="roi-at-risk-block">
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-red-600 flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5" /> Annual revenue lost to churn
              </p>
              <p className="font-instrument text-[40px] sm:text-[52px] leading-none mt-2 text-red-600 tabular-nums" data-testid="roi-revenue-at-risk">
                {fmtExactDollar(result.revenueAtRisk)}
              </p>
              <p className="text-[hsl(var(--ink-2))] text-sm mt-2 leading-relaxed">
                That's <span className="font-bold tabular-nums">{fmtExactDollar(result.monthlyAtRisk)} every month</span> (<span className="font-bold tabular-nums">{result.lostPerMonth.toLocaleString()} customers/mo</span> × <span className="font-bold tabular-nums">${revPerCustomer.toLocaleString()}/mo</span>) walking out the door for reasons your team could have caught earlier.
              </p>
            </div>

            {/* Math breakdown — full transparency */}
            <div className="mt-5">
              <p className="text-[11px] uppercase tracking-[0.2em] font-semibold text-[hsl(var(--retops-muted-2))] mb-2.5">The math, step by step</p>
              <dl className="divide-y divide-[hsl(var(--line))] text-sm">
                <BreakdownRow
                  k={`1. Customers lost / month (${customers.toLocaleString()} × ${cancelRate % 1 === 0 ? cancelRate.toFixed(0) : cancelRate.toFixed(1)}%)`}
                  v={`${result.lostPerMonth.toLocaleString()} customers / mo`}
                />
                <BreakdownRow
                  k={`2. Monthly revenue lost (${result.lostPerMonth.toLocaleString()} × $${revPerCustomer.toLocaleString()})`}
                  v={`${fmtExactDollar(result.monthlyAtRisk)} / mo`}
                />
                <BreakdownRow
                  k={`3. Annual revenue lost (${fmtExactDollar(result.monthlyAtRisk)} × 12 months)`}
                  v={`${fmtExactDollar(result.revenueAtRisk)} / yr`}
                  bold
                />
                <BreakdownRow
                  k={`4. Saved with RetOps (25% of ${fmtExactDollar(result.revenueAtRisk)})`}
                  v={`${fmtExactDollar(result.recovered)} / yr`}
                  highlight
                />
              </dl>
            </div>

            {/* With RetOps */}
            <div className="mt-6 p-5 sm:p-6 rounded-2xl bg-[hsl(var(--retops-navy))] text-white">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--retops-gold))] font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5" /> With RetOps, you claw back
              </p>
              <p className="font-instrument text-[40px] sm:text-[52px] leading-none mt-2 tabular-nums" data-testid="roi-recovered">
                {fmtExactDollar(result.recovered)}
              </p>
              <p className="text-white/75 text-sm mt-2 leading-relaxed">
                a year (<span className="text-white font-semibold tabular-nums">{fmtExactDollar(result.recoveredMonthly)}/month</span>) — by catching the churn language, pricing pushback, and competitor mentions your team missed. Based on a 25% save rate on flagged at-risk accounts.
              </p>
            </div>

            <p className="text-[11px] text-[hsl(var(--retops-muted-2))] mt-4 leading-relaxed">
              Every number above uses exact arithmetic so you can verify it at a glance. Move any slider to test your own numbers.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───── helpers ───── */
function fmtExactDollar(n) {
  if (n == null || isNaN(n)) return "$0";
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtDollar(n) {
  if (n == null || isNaN(n)) return "$0";
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) {
    const val = (n / 1_000_000_000).toFixed(2).replace(/\.?0+$/, "");
    return `$${val}B`;
  }
  if (abs >= 1_000_000) {
    const val = (n / 1_000_000).toFixed(2).replace(/\.?0+$/, "");
    return `$${val}M`;
  }
  return `$${Math.round(n).toLocaleString()}`;
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

const BreakdownRow = ({ k, v, bold, highlight }) => (
  <div className="flex items-center justify-between py-2.5 gap-3">
    <dt className="text-xs text-[hsl(var(--retops-muted))]">{k}</dt>
    <dd
      className={`tabular-nums flex-none ${
        highlight
          ? "font-bold text-[hsl(var(--retops-teal))] text-base"
          : bold
            ? "font-bold text-[hsl(var(--retops-navy))] text-base"
            : "font-semibold text-[hsl(var(--ink))]"
      }`}
    >
      {v}
    </dd>
  </div>
);

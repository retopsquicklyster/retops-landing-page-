import { useState, useMemo } from "react";
import { Calculator } from "lucide-react";

export default function ROICalculator() {
  const [subs, setSubs] = useState(500000);
  const [churn, setChurn] = useState(2.0); // % monthly
  const [arpu, setArpu] = useState(40);
  const [cac, setCac] = useState(400);
  const [recovery, setRecovery] = useState(20); // %

  const result = useMemo(() => {
    const monthlyLost = Math.round(subs * (churn / 100));
    const monthlyRevLost = monthlyLost * arpu;
    const annualRevLost = monthlyRevLost * 12;
    const annualCac = monthlyLost * cac * 12;
    const totalAnnual = annualRevLost + annualCac;
    const retopsRecovered = Math.round(totalAnnual * (recovery / 100));
    return { monthlyLost, monthlyRevLost, annualRevLost, annualCac, totalAnnual, retopsRecovered };
  }, [subs, churn, arpu, cac, recovery]);

  const fmt = (n) => `$${(n / 1_000_000).toFixed(n >= 1_000_000 ? 2 : 2)}M`;
  const fmtK = (n) => n >= 1_000_000 ? fmt(n) : `$${Math.round(n / 1000).toLocaleString()}K`;

  return (
    <section id="roi-calculator" className="bg-white border-t border-[hsl(var(--line))]" data-testid="roi-calculator">
      <div className="max-w-[1280px] mx-auto px-8 py-24">
        <div className="grid lg:grid-cols-[1fr,1.1fr] gap-12 items-start">
          <div>
            <p className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-[hsl(var(--brand))] font-semibold">
              <Calculator className="w-4 h-4" /> ROI calculator
            </p>
            <h2 className="font-display text-4xl lg:text-5xl font-semibold mt-3 leading-tight">
              How much is invisible churn costing <em className="not-italic text-[hsl(var(--brand))]">your</em> support org?
            </h2>
            <p className="text-[hsl(var(--ink-2))] mt-4 leading-relaxed max-w-xl">
              Enter your numbers. RetOps-style QA coverage on every conversation typically recovers 15–25% of preventable churn by catching it before the customer cancels.
            </p>

            <div className="mt-8 space-y-5 max-w-md">
              <Slider label="Subscribers" value={subs} onChange={setSubs} min={10_000} max={5_000_000} step={10_000} format={(v) => v.toLocaleString()} testid="roi-subs" />
              <Slider label="Monthly churn rate" value={churn} onChange={setChurn} min={0.5} max={6} step={0.1} format={(v) => `${v.toFixed(1)}%`} testid="roi-churn" />
              <Slider label="ARPU (monthly)" value={arpu} onChange={setArpu} min={5} max={500} step={5} format={(v) => `$${v}`} testid="roi-arpu" />
              <Slider label="CAC to replace" value={cac} onChange={setCac} min={50} max={2000} step={50} format={(v) => `$${v}`} testid="roi-cac" />
              <Slider label="RetOps recovery rate" value={recovery} onChange={setRecovery} min={10} max={35} step={1} format={(v) => `${v}%`} testid="roi-recovery" />
            </div>
          </div>

          <div className="ret-card p-8" data-testid="roi-output">
            <p className="text-xs uppercase tracking-[0.2em] text-[hsl(var(--ink-3))] font-semibold">Your numbers today</p>
            <dl className="divide-y divide-[hsl(var(--line))] mt-4">
              <Row k="Customers lost / month" v={result.monthlyLost.toLocaleString()} />
              <Row k="Revenue lost / month" v={fmtK(result.monthlyRevLost)} />
              <Row k="Annual revenue loss" v={fmt(result.annualRevLost)} bold />
              <Row k="Annual replacement CAC" v={fmt(result.annualCac)} />
              <Row k="Total annual cost of churn" v={fmt(result.totalAnnual)} big danger />
            </dl>
            <div className="mt-7 p-6 rounded-2xl bg-[hsl(var(--retops-navy))] text-white">
              <p className="text-[11px] uppercase tracking-[0.2em] text-[hsl(var(--retops-gold))] font-semibold">With RetOps</p>
              <p className="font-instrument text-5xl mt-2">{fmt(result.retopsRecovered)}</p>
              <p className="text-sm text-white/70 mt-1">recoverable annual revenue protection</p>
            </div>
            <p className="text-xs text-[hsl(var(--ink-3))] mt-4">
              Based on your inputs and a {recovery}% recovery rate. Actual results depend on conversation volume, QA rubric fit, and retention playbook adoption.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

const Slider = ({ label, value, onChange, min, max, step, format, testid }) => (
  <label className="block">
    <div className="flex justify-between items-baseline mb-1.5">
      <span className="text-xs font-semibold uppercase tracking-wider text-[hsl(var(--ink-3))]">{label}</span>
      <span className="font-mono text-sm font-bold text-[hsl(var(--ink))]">{format(value)}</span>
    </div>
    <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))}
      data-testid={testid}
      className="w-full accent-[hsl(var(--brand))] cursor-pointer" />
  </label>
);

const Row = ({ k, v, big, bold, danger }) => (
  <div className={`flex items-center justify-between py-3 ${big ? "py-5" : ""}`}>
    <dt className={`text-sm ${big ? "text-[hsl(var(--ink))] font-semibold" : "text-[hsl(var(--ink-2))]"}`}>{k}</dt>
    <dd className={`font-mono ${big ? "text-3xl font-bold" : bold ? "text-base font-bold" : "text-sm font-semibold"} ${danger ? "text-red-500" : "text-[hsl(var(--ink))]"}`}>{v}</dd>
  </div>
);

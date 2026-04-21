import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import {
  Activity, AlertTriangle, Sparkles, TrendingDown, TrendingUp, MessageSquare,
  GraduationCap, Share2, DollarSign, Filter, ChevronRight,
} from "lucide-react";

const FILTERS = [
  { id: "all", label: "All events" },
  { id: "interaction", label: "Interactions scored" },
  { id: "churn", label: "Churn risk" },
  { id: "ai", label: "AI quality" },
  { id: "coaching", label: "Coaching" },
  { id: "share", label: "Shared playbooks" },
];

export default function ActivityHistory() {
  const [events, setEvents] = useState([]);
  const [filter, setFilter] = useState("all");
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/activity").then((r) => setEvents(r.data));
  }, []);

  const visible = events.filter((e) => filter === "all" || e.kind === filter);

  // Group by day
  const grouped = visible.reduce((acc, e) => {
    const d = new Date(e.at);
    const key = isToday(d) ? "Today" : isYesterday(d) ? "Yesterday" : d.toLocaleDateString([], { weekday: "long", month: "short", day: "numeric" });
    (acc[key] = acc[key] || []).push(e);
    return acc;
  }, {});

  return (
    <DashboardLayout title="Activity History" subtitle={`${events.length} events · complete audit trail of what RetOps scored, flagged, coached and shared`}>
      <div className="ret-card p-4 mb-5 flex flex-wrap items-center gap-2" data-testid="history-filters">
        <Filter className="w-4 h-4 text-[hsl(var(--retops-muted-2))] ml-2" />
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            data-testid={`filter-${f.id}`}
            className={`text-xs font-semibold py-1.5 px-3 rounded-full transition-colors ${
              filter === f.id
                ? "bg-[hsl(var(--retops-navy))] text-white"
                : "bg-[hsl(var(--retops-bg))] text-[hsl(var(--retops-muted))] hover:bg-[hsl(var(--retops-bg-elevated))]"
            }`}
          >
            {f.label}
          </button>
        ))}
        <span className="ml-auto text-xs text-[hsl(var(--retops-muted-2))]">{visible.length} shown</span>
      </div>

      <div className="space-y-8" data-testid="activity-timeline">
        {Object.entries(grouped).map(([day, items]) => (
          <section key={day}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-instrument text-xl text-[hsl(var(--retops-navy))]">{day}</h3>
              <span className="text-xs font-mono text-[hsl(var(--retops-muted-2))]">{items.length} event{items.length === 1 ? "" : "s"}</span>
              <div className="flex-1 h-px bg-[hsl(var(--retops-border))]" />
            </div>
            <div className="ret-card overflow-hidden">
              {items.map((e, i) => (
                <div
                  key={e.id || i}
                  onClick={() => e.link && navigate(e.link)}
                  data-testid={`event-${e.kind}-${i}`}
                  className={`flex items-start gap-4 p-4 ${i > 0 ? "border-t border-[hsl(var(--retops-border-2))]" : ""} ${e.link ? "cursor-pointer hover:bg-[hsl(var(--retops-bg))]" : ""}`}
                >
                  <KindIcon kind={e.kind} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`pill ${pillFor(e.kind)}`} style={{ padding: "2px 8px", fontSize: 10 }}>{labelOf(e.kind)}</span>
                      <span className="text-xs font-mono text-[hsl(var(--retops-muted-2))]">{new Date(e.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                      {e.severity === "High" && <span className="text-xs font-bold text-red-600">HIGH RISK</span>}
                    </div>
                    <p className="text-sm mt-1.5 font-semibold text-[hsl(var(--retops-text))]">{e.title}</p>
                    {e.note && <p className="text-xs text-[hsl(var(--retops-muted))] mt-0.5 truncate">{e.note}</p>}
                    {e.actor && <p className="text-[11px] text-[hsl(var(--retops-muted-2))] mt-1 font-mono">by {e.actor}</p>}
                  </div>
                  {e.value != null && (
                    <div className="text-right flex-none">
                      <p className="font-mono font-bold text-[hsl(var(--retops-text))]">{e.value}</p>
                      {e.value_sub && <p className="text-[11px] text-[hsl(var(--retops-muted-2))]">{e.value_sub}</p>}
                    </div>
                  )}
                  {e.link && <ChevronRight className="w-4 h-4 text-[hsl(var(--retops-muted-2))] mt-1 flex-none" />}
                </div>
              ))}
            </div>
          </section>
        ))}
        {visible.length === 0 && (
          <div className="ret-card p-10 text-center">
            <Activity className="w-8 h-8 mx-auto text-[hsl(var(--retops-muted-2))]" />
            <p className="text-sm text-[hsl(var(--retops-muted))] mt-3">No activity yet for this filter.</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

const isToday = (d) => { const n = new Date(); return d.toDateString() === n.toDateString(); };
const isYesterday = (d) => { const n = new Date(); n.setDate(n.getDate() - 1); return d.toDateString() === n.toDateString(); };

const ICONS = {
  interaction: MessageSquare,
  churn: TrendingDown,
  ai: Sparkles,
  qa: AlertTriangle,
  upsell: TrendingUp,
  coaching: GraduationCap,
  share: Share2,
  dollar: DollarSign,
};
const KindIcon = ({ kind }) => {
  const Ic = ICONS[kind] || Activity;
  const color =
    kind === "churn" ? "bg-red-50 text-red-600" :
    kind === "ai" ? "bg-amber-50 text-amber-700" :
    kind === "coaching" ? "bg-[hsl(var(--retops-teal-2))] text-[hsl(var(--retops-navy))]" :
    kind === "upsell" ? "bg-emerald-50 text-emerald-700" :
    kind === "share" ? "bg-[rgba(248,210,16,0.18)] text-[#8a6b00]" :
    "bg-[hsl(var(--retops-bg-elevated))] text-[hsl(var(--retops-navy))]";
  return <div className={`w-10 h-10 rounded-xl grid place-items-center flex-none ${color}`}><Ic className="w-5 h-5" /></div>;
};

const labelOf = (k) => ({
  interaction: "Interaction scored", churn: "Churn risk", ai: "AI quality",
  qa: "QA", upsell: "Upsell", coaching: "Coaching", share: "Shared playbook",
}[k] || k);

const pillFor = (k) => ({
  churn: "pill-danger", ai: "pill-warn", qa: "pill-warn",
  upsell: "pill-ok", coaching: "pill", share: "pill-gold", interaction: "pill-neutral",
}[k] || "pill-neutral");

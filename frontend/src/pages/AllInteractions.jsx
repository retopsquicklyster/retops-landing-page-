import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { Search, Filter } from "lucide-react";

export default function AllInteractions() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  const [risk, setRisk] = useState("");
  const [type, setType] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const fetchRows = async () => {
      const params = new URLSearchParams();
      if (risk) params.append("churn_risk", risk);
      if (type) params.append("agent_type", type);
      const r = await api.get(`/interactions?${params.toString()}`);
      setRows(r.data);
    };

    void fetchRows();
  }, [risk, type]);

  const visible = rows.filter((r) =>
    !q || [r.customer, r.agent, r.type, r.channel].some((v) => v && v.toLowerCase().includes(q.toLowerCase()))
  );

  return (
    <DashboardLayout title="All Interactions" subtitle={`${rows.length} scored interactions`}>
      <div className="ret-card p-5 mb-5 flex flex-wrap items-center gap-3" data-testid="filters-bar">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-[hsl(var(--ink-3))] absolute left-3 top-1/2 -translate-y-1/2" />
          <input data-testid="search-input" value={q} onChange={(e) => setQ(e.target.value)} className="w-full pl-10 pr-3 py-2.5 border border-[hsl(var(--line))] rounded-xl text-sm" placeholder="Search customer, agent, type…" />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-[hsl(var(--ink-3))]" />
          <select data-testid="filter-risk" value={risk} onChange={(e) => setRisk(e.target.value)} className="py-2.5 px-3 border border-[hsl(var(--line))] rounded-xl text-sm bg-white">
            <option value="">All churn risks</option>
            <option>High</option><option>Medium</option><option>Low</option>
          </select>
          <select data-testid="filter-agent-type" value={type} onChange={(e) => setType(e.target.value)} className="py-2.5 px-3 border border-[hsl(var(--line))] rounded-xl text-sm bg-white">
            <option value="">All agents</option>
            <option>Human</option><option>AI</option>
          </select>
        </div>
      </div>

      <div className="ret-card overflow-hidden" data-testid="interactions-table">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--bg-subtle))]">
            <tr className="text-xs text-[hsl(var(--ink-3))] uppercase tracking-wider text-left">
              <th className="px-5 py-3 font-semibold">Customer</th>
              <th className="px-5 py-3 font-semibold">Agent</th>
              <th className="px-5 py-3 font-semibold">Channel</th>
              <th className="px-5 py-3 font-semibold">Type</th>
              <th className="px-5 py-3 font-semibold text-right">QA Score</th>
              <th className="px-5 py-3 font-semibold">Churn</th>
              <th className="px-5 py-3 font-semibold text-right">ARR at risk</th>
              <th className="px-5 py-3 font-semibold">Flags</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const a = r.analysis || {};
              return (
                <tr key={r.interaction_id} onClick={() => navigate(`/dashboard/interactions/${r.interaction_id}`)} className="border-t border-[hsl(var(--line-2))] hover:bg-[hsl(var(--bg-subtle))] cursor-pointer" data-testid={`row-${r.interaction_id}`}>
                  <td className="px-5 py-3.5 font-semibold">{r.customer}</td>
                  <td className="px-5 py-3.5">
                    {r.agent}
                    <span className={`ml-2 pill ${r.agent_type === "AI" ? "pill-info" : "pill-neutral"}`} style={{ padding: "1px 6px", fontSize: 10 }}>{r.agent_type}</span>
                  </td>
                  <td className="px-5 py-3.5 text-[hsl(var(--ink-2))]">{r.channel}</td>
                  <td className="px-5 py-3.5 text-[hsl(var(--ink-2))]">{r.type}</td>
                  <td className="px-5 py-3.5 text-right font-mono font-bold">{a.qa_score ?? "—"}</td>
                  <td className="px-5 py-3.5"><span className={`pill ${riskPill(a.churn_risk)}`}>{a.churn_risk || "—"}</span></td>
                  <td className="px-5 py-3.5 text-right font-mono">${(a.arr_at_risk || 0).toLocaleString()}</td>
                  <td className="px-5 py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {a.ai_hallucination && <span className="pill pill-danger" style={{ padding: "1px 8px", fontSize: 10 }}>Hallucination</span>}
                      {a.policy_compliance === "Fail" && <span className="pill pill-warn" style={{ padding: "1px 8px", fontSize: 10 }}>Policy</span>}
                      {a.expansion_signal && a.expansion_signal !== "None" && <span className="pill pill-ok" style={{ padding: "1px 8px", fontSize: 10 }}>Upsell</span>}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan="8" className="px-5 py-10 text-center text-[hsl(var(--ink-3))]">No interactions match these filters.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}

const riskPill = (r) => r === "High" ? "pill-danger" : r === "Medium" ? "pill-warn" : r === "Low" ? "pill-ok" : "pill-neutral";

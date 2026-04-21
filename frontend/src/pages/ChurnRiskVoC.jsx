import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { DollarSign } from "lucide-react";

export default function ChurnRiskVoC() {
  const [accounts, setAccounts] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    api.get("/accounts").then((r) => setAccounts(r.data));
  }, []);

  const totalArrAtRisk = accounts.reduce((s, a) => s + (a.arr_at_risk || 0), 0);
  const highRisk = accounts.filter((a) => a.churn_risk === "High").length;

  return (
    <DashboardLayout title="Churn Risk & VoC" subtitle="Accounts ranked by exposure with voice-of-customer signals from latest interactions">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
        <div className="ret-card p-6">
          <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))]">Total ARR at risk</p>
          <p className="stat-num mt-2 text-red-500">${totalArrAtRisk.toLocaleString()}</p>
        </div>
        <div className="ret-card p-6">
          <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))]">High-risk accounts</p>
          <p className="stat-num mt-2">{highRisk}</p>
        </div>
        <div className="ret-card p-6">
          <p className="text-xs uppercase tracking-widest text-[hsl(var(--ink-3))]">Portfolio ARR</p>
          <p className="stat-num mt-2">${accounts.reduce((s, a) => s + (a.arr || 0), 0).toLocaleString()}</p>
        </div>
      </div>

      <div className="ret-card overflow-hidden" data-testid="accounts-table">
        <table className="w-full text-sm">
          <thead className="bg-[hsl(var(--bg-subtle))]">
            <tr className="text-xs text-[hsl(var(--ink-3))] uppercase tracking-wider text-left">
              <th className="px-5 py-3 font-semibold">Account</th>
              <th className="px-5 py-3 font-semibold text-right">ARR</th>
              <th className="px-5 py-3 font-semibold">Health</th>
              <th className="px-5 py-3 font-semibold">Churn risk</th>
              <th className="px-5 py-3 font-semibold text-right">ARR at risk</th>
              <th className="px-5 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {accounts.sort((a, b) => (b.arr_at_risk || 0) - (a.arr_at_risk || 0)).map((a) => (
              <tr key={a.name} className="border-t border-[hsl(var(--line-2))]" data-testid={`account-${a.name}`}>
                <td className="px-5 py-3.5 font-semibold">{a.name}</td>
                <td className="px-5 py-3.5 text-right font-mono">${a.arr.toLocaleString()}</td>
                <td className="px-5 py-3.5"><span className={`pill ${a.health === "Healthy" ? "pill-ok" : a.health === "Watch" ? "pill-warn" : "pill-danger"}`}>{a.health}</span></td>
                <td className="px-5 py-3.5"><span className={`pill ${a.churn_risk === "High" ? "pill-danger" : a.churn_risk === "Medium" ? "pill-warn" : "pill-ok"}`}>{a.churn_risk}</span></td>
                <td className="px-5 py-3.5 text-right font-mono font-semibold">${(a.arr_at_risk || 0).toLocaleString()}</td>
                <td className="px-5 py-3.5">
                  <button data-testid={`playbook-${a.name}`} onClick={() => navigate(`/dashboard/playbook?account=${encodeURIComponent(a.name)}`)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[hsl(var(--brand))] hover:underline">
                    <DollarSign className="w-3.5 h-3.5" /> Open save playbook
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DashboardLayout>
  );
}

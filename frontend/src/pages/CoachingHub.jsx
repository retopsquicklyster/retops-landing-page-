import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import DashboardLayout from "../components/DashboardLayout";
import { api } from "../lib/api";
import { GraduationCap, ArrowUpRight } from "lucide-react";

export default function CoachingHub() {
  const [cards, setCards] = useState([]);
  const navigate = useNavigate();
  useEffect(() => { api.get("/coaching").then((r) => setCards(r.data)); }, []);

  return (
    <DashboardLayout title="Coaching Hub" subtitle={`${cards.length} coaching cards generated from real interactions`}>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5" data-testid="coaching-grid">
        {cards.map((c) => (
          <div key={c.interaction_id} className="ret-card p-5 cursor-pointer hover:border-[hsl(var(--brand-200))] transition-colors" onClick={() => navigate(`/dashboard/interactions/${c.interaction_id}`)} data-testid={`coach-${c.interaction_id}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-[hsl(var(--brand-100))] text-[hsl(var(--brand))] grid place-items-center">
                  <GraduationCap className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-semibold">{c.agent}</p>
                  <p className="text-xs text-[hsl(var(--ink-3))]">{c.customer} · Score {c.qa_score}</p>
                </div>
              </div>
              <ArrowUpRight className="w-4 h-4 text-[hsl(var(--ink-3))]" />
            </div>
            <p className="font-display text-lg font-semibold mt-4 leading-snug">{c.headline}</p>
            {c.growth_areas?.length > 0 && (
              <div className="mt-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600 mb-1">Growth areas</p>
                <ul className="text-sm text-[hsl(var(--ink-2))] list-disc list-inside space-y-0.5">
                  {c.growth_areas.slice(0, 3).map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
          </div>
        ))}
        {cards.length === 0 && <p className="text-sm text-[hsl(var(--ink-3))]">No coaching cards yet. Upload an interaction or seed demo data.</p>}
      </div>
    </DashboardLayout>
  );
}

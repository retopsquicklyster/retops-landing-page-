import DashboardLayout from "../components/DashboardLayout";
import { Clock } from "lucide-react";

export default function ComingSoon({ title, blurb }) {
  return (
    <DashboardLayout title={title} subtitle="This module is on the roadmap">
      <div className="ret-card p-12 text-center">
        <div className="w-14 h-14 mx-auto rounded-2xl bg-[hsl(var(--brand-100))] text-[hsl(var(--brand))] grid place-items-center">
          <Clock className="w-6 h-6" />
        </div>
        <h3 className="font-display text-2xl font-semibold mt-5">{title} — coming soon</h3>
        <p className="text-[hsl(var(--ink-2))] max-w-lg mx-auto mt-2">{blurb}</p>
        <span className="pill mt-5 inline-flex">Founding customers get first access</span>
      </div>
    </DashboardLayout>
  );
}

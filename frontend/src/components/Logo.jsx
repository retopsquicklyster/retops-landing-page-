import { Shield } from "lucide-react";

export const Logo = ({ size = "md", dark = false }) => {
  const sz = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-7 h-7" : "w-8 h-8";
  const text = size === "lg" ? "text-2xl" : "text-lg";
  return (
    <div className="flex items-center gap-2" data-testid="retops-logo">
      <div className={`${sz} logo-mark`}>
        <Shield className="w-4 h-4" strokeWidth={2.5} />
      </div>
      <div className="flex flex-col leading-none">
        <span className={`font-display font-semibold ${text} ${dark ? "text-white" : "text-[hsl(var(--ink))]"}`}>
          RetOps
        </span>
        {size !== "sm" && (
          <span className={`text-[10px] font-medium uppercase tracking-[0.18em] ${dark ? "text-emerald-300/70" : "text-[hsl(var(--ink-3))]"}`}>
            Revenue Intelligence
          </span>
        )}
      </div>
    </div>
  );
};

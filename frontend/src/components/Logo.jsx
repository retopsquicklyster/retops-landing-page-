/**
 * RetOps logo — CSS gradient text lockup, matching the exact treatment on
 * retops.ai (teal → gold clip-path on the wordmark, "Revenue intelligence"
 * tagline below). No PNG — fully readable on light and dark backgrounds.
 */
export const Logo = ({ size = "md", dark = false }) => {
  const txt = size === "lg" ? "text-4xl sm:text-5xl" : size === "sm" ? "text-xl" : "text-2xl sm:text-3xl";
  const tag = size === "lg" ? "text-xs" : "text-[10px]";
  return (
    <div className="flex flex-col leading-none" data-testid="retops-logo">
      <span
        className={`font-bold tracking-tight ${txt} bg-clip-text text-transparent`}
        style={{ backgroundImage: "linear-gradient(90deg, hsl(var(--retops-teal)) 0%, hsl(var(--retops-gold)) 100%)" }}
      >
        RetOps
      </span>
      {size !== "sm" && (
        <span className={`${tag} font-semibold uppercase tracking-[0.22em] mt-1 ${dark ? "text-white/50" : "text-[hsl(var(--retops-muted))]"}`}>
          Revenue intelligence
        </span>
      )}
    </div>
  );
};

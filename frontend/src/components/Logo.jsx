/**
 * RetOps logo — primary PNG, with CSS gradient text fallback if the image fails.
 */
import { useState } from "react";

export const Logo = ({ size = "md", dark = false, compact = false }) => {
  const [failed, setFailed] = useState(false);
  const h =
    size === "lg" ? "h-52"
    : size === "sm" ? "h-20"
    : size === "header" ? (compact ? "h-12 sm:h-14" : "h-24 sm:h-32")
    : "h-36";
  const txt =
    size === "lg" ? "text-5xl sm:text-6xl"
    : size === "sm" ? "text-xl"
    : size === "header" ? "text-lg"
    : "text-3xl sm:text-4xl";
  const tag = size === "lg" ? "text-xs" : "text-[10px]";

  if (failed) {
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
  }

  return (
    <div className="flex items-center" data-testid="retops-logo">
      <img
        src="/brand/retops-logo.png"
        alt="RetOps — Revenue Protection Platform"
        className={`${h} w-auto object-contain transition-[height] duration-300 ease-out`}
        style={dark ? { filter: "brightness(0) invert(1)" } : undefined}
        onError={() => setFailed(true)}
      />
    </div>
  );
};

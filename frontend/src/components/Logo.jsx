/**
 * RetOps logo — shield mark with stylized gold "O" (concentric arcs).
 * Mimics the brand mark from retops.ai.
 */
export const RetOpsMark = ({ size = 36, className = "" }) => (
  <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-label="RetOps">
    <defs>
      <linearGradient id="ret-shield" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#0e2a4b" />
        <stop offset="1" stopColor="#0b1f3b" />
      </linearGradient>
    </defs>
    {/* shield */}
    <path
      d="M20 2 C 30 4, 36 6, 36 10 V 22 C 36 30, 29 36, 20 38 C 11 36, 4 30, 4 22 V 10 C 4 6, 10 4, 20 2 Z"
      fill="url(#ret-shield)"
      stroke="#0a1b33"
      strokeWidth="0.5"
    />
    {/* gold concentric arcs (fingerprint-style O) */}
    <g transform="translate(20 20)" fill="none" strokeLinecap="round">
      <circle r="8.5" stroke="#F8D210" strokeWidth="1.6" opacity="0.25" />
      <path d="M-7 -2 a 7 7 0 0 1 14 0" stroke="#F8D210" strokeWidth="1.6" />
      <path d="M-5.2 0 a 5.2 5.2 0 0 1 10.4 0" stroke="#F8D210" strokeWidth="1.6" />
      <path d="M-3.4 2 a 3.4 3.4 0 0 1 6.8 0" stroke="#F8D210" strokeWidth="1.6" />
      <circle r="1.2" fill="#F8D210" />
    </g>
  </svg>
);

export const Logo = ({ size = "md", dark = false }) => {
  const markSize = size === "lg" ? 44 : size === "sm" ? 28 : 36;
  const txt = size === "lg" ? "text-2xl" : "text-xl";
  return (
    <div className="flex items-center gap-2.5" data-testid="retops-logo">
      <RetOpsMark size={markSize} />
      <div className="flex flex-col leading-none">
        <span className={`font-instrument ${txt} tracking-tight ${dark ? "text-white" : "text-[hsl(var(--retops-navy))]"}`}>
          Ret<span className="text-[hsl(var(--retops-gold))]">O</span>ps
        </span>
        {size !== "sm" && (
          <span className={`text-[9px] font-semibold uppercase tracking-[0.22em] mt-1 ${dark ? "text-white/55" : "text-[hsl(var(--retops-muted-2))]"}`}>
            Revenue Protection Platform
          </span>
        )}
      </div>
    </div>
  );
};

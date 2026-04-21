/**
 * RetOps custom icon set — premium, branded, contextual.
 * Each icon is a hand-drawn SVG with RetOps navy/teal/gold palette baked in.
 * All icons share consistent 24x24 viewBox, 1.6 stroke-width, rounded caps.
 *
 * Usage:
 *   <BrandIcon name="connect" className="w-5 h-5 text-[hsl(var(--retops-teal))]" />
 */

const GOLD = "#F8D210";
const TEAL = "#14B8A6";
const NAVY = "#0b1f3b";

const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

// 1. CONNECT — flowing stream of data into a central node (replaces generic Plug)
export const ConnectIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <circle cx="12" cy="12" r="3.5" {...STROKE} />
    <circle cx="12" cy="12" r="1" fill={TEAL} stroke="none" />
    <path d="M3 6 Q 8 6 9 10" {...STROKE} />
    <path d="M3 12 Q 7 12 8.6 12" {...STROKE} />
    <path d="M3 18 Q 8 18 9 14" {...STROKE} />
    <circle cx="3" cy="6" r="1" fill={GOLD} stroke="none" />
    <circle cx="3" cy="12" r="1" fill={TEAL} stroke="none" />
    <circle cx="3" cy="18" r="1" fill={GOLD} stroke="none" />
  </svg>
);

// 2. NORMALIZE — mixed shapes merging into a clean grid
export const NormalizeIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M3 4 L 3 10 L 9 10 L 9 4 Z" {...STROKE} />
    <circle cx="6" cy="16" r="3" {...STROKE} />
    <path d="M13 4 L 17 7 L 13 10 Z" {...STROKE} />
    <rect x="13" y="13" width="8" height="7" rx="1.5" {...STROKE} />
    <path d="M 14 17 L 16.5 17 M 14 15 L 19.5 15" stroke={TEAL} strokeWidth="1.6" strokeLinecap="round" fill="none" />
    <circle cx="19.5" cy="19" r="0.9" fill={GOLD} stroke="none" />
  </svg>
);

// 3. SCORE — circular gauge with pointer (QA rubric)
export const ScoreIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M4 15 A 8 8 0 0 1 20 15" {...STROKE} />
    <path d="M12 15 L 17 10" stroke={GOLD} strokeWidth="2" strokeLinecap="round" fill="none" />
    <circle cx="12" cy="15" r="1.4" fill={NAVY} stroke="currentColor" strokeWidth="1.2" />
    <path d="M5.5 17 L 4.5 18.5" {...STROKE} />
    <path d="M18.5 17 L 19.5 18.5" {...STROKE} />
  </svg>
);

// 4. DETECT RISK — magnifying lens with pulse ring
export const DetectIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <circle cx="10" cy="10" r="5.5" {...STROKE} />
    <path d="M14.2 14.5 L 19 19" {...STROKE} />
    <circle cx="10" cy="10" r="1.6" fill={GOLD} stroke="none" />
    <path d="M10 5 L 10 7 M 5 10 L 7 10 M 10 15 L 10 13 M 15 10 L 13 10" stroke={TEAL} strokeWidth="1.4" strokeLinecap="round" />
  </svg>
);

// 5. TRIGGER ACTION — broadcast waves + signal pulse
export const TriggerIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <circle cx="12" cy="13" r="1.8" fill={GOLD} stroke="none" />
    <path d="M8.5 10 A 5 5 0 0 1 15.5 10" {...STROKE} />
    <path d="M6 8 A 8.5 8.5 0 0 1 18 8" {...STROKE} />
    <path d="M10.5 16 L 10.5 20 L 13.5 20 L 13.5 16" {...STROKE} />
  </svg>
);

// 6. COACH & IMPROVE — speech bubble + upward trend
export const CoachIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M4 6 C 4 5 5 4 6 4 L 18 4 C 19 4 20 5 20 6 L 20 13 C 20 14 19 15 18 15 L 11 15 L 7 19 L 7 15 L 6 15 C 5 15 4 14 4 13 Z" {...STROKE} />
    <path d="M7.5 11 L 10 8.5 L 13 10.5 L 16.5 7" stroke={TEAL} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <circle cx="16.5" cy="7" r="1" fill={GOLD} stroke="none" />
  </svg>
);

// 7. PROTECT REVENUE — shield with dollar interior (the gold anchor icon)
export const ProtectIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M12 3 L 20 6 L 20 12 C 20 16.5 16.5 20 12 21 C 7.5 20 4 16.5 4 12 L 4 6 Z" {...STROKE} />
    <path d="M12 8 L 12 16" stroke={GOLD} strokeWidth="2" strokeLinecap="round" fill="none" />
    <path d="M14 10 C 14 9 13 8.5 12 8.5 C 11 8.5 10 9.2 10 10.2 C 10 11.2 11 11.5 12 11.8 C 13 12.1 14 12.4 14 13.5 C 14 14.4 13 15 12 15 C 11 15 10 14.5 10 13.5" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" fill="none" />
  </svg>
);

// 8. AI QUALITY GATE — bot face with traffic light
export const AIGateIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <rect x="4" y="7" width="16" height="11" rx="3" {...STROKE} />
    <path d="M12 4 L 12 7" {...STROKE} />
    <circle cx="12" cy="4" r="0.8" fill={GOLD} stroke="none" />
    <circle cx="9" cy="12" r="1.2" fill={TEAL} stroke="none" />
    <circle cx="15" cy="12" r="1.2" fill={TEAL} stroke="none" />
    <path d="M9.5 15.5 L 14.5 15.5" {...STROKE} />
  </svg>
);

// 9. CHURN RISK — downward arrow with dollar drop
export const ChurnIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <path d="M5 6 L 9 10 L 13 7 L 19 14" {...STROKE} />
    <path d="M19 9 L 19 14 L 14 14" {...STROKE} />
    <path d="M6 18 L 8 18 M 10 18 L 13 18 M 15 18 L 18 18" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// 10. EXEC DASHBOARD — layered bars with highlight
export const ExecIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" {...STROKE} />
    <path d="M7 15 L 7 10" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M11 15 L 11 7" stroke={TEAL} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M15 15 L 15 12" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />
    <path d="M19 15 L 19 8" stroke={GOLD} strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

// 11. BULK OPS — stack of transcripts with sparkle (replaces generic Sparkles)
export const BulkIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <rect x="4" y="6" width="12" height="15" rx="1.5" {...STROKE} />
    <rect x="7" y="3" width="12" height="15" rx="1.5" {...STROKE} />
    <path d="M10 8 L 16 8 M 10 11 L 16 11 M 10 14 L 13 14" stroke={TEAL} strokeWidth="1.4" strokeLinecap="round" />
    <path d="M18.5 5 L 18.5 8 M 17 6.5 L 20 6.5" stroke={GOLD} strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// 12. WEEKLY DIGEST — envelope with gold seal
export const DigestIcon = (props) => (
  <svg viewBox="0 0 24 24" {...props}>
    <rect x="3" y="6" width="18" height="13" rx="1.5" {...STROKE} />
    <path d="M4 7 L 12 13 L 20 7" {...STROKE} />
    <circle cx="18" cy="17" r="2.2" fill={GOLD} stroke={NAVY} strokeWidth="1" />
  </svg>
);

/* ──────── Lookup dispatcher ──────── */
const MAP = {
  connect: ConnectIcon,
  normalize: NormalizeIcon,
  score: ScoreIcon,
  detect: DetectIcon,
  trigger: TriggerIcon,
  coach: CoachIcon,
  protect: ProtectIcon,
  ai_gate: AIGateIcon,
  churn: ChurnIcon,
  exec: ExecIcon,
  bulk: BulkIcon,
  digest: DigestIcon,
};

export default function BrandIcon({ name, className = "w-5 h-5", ...rest }) {
  const Cmp = MAP[name];
  if (!Cmp) return null;
  return <Cmp className={className} {...rest} aria-hidden="true" />;
}

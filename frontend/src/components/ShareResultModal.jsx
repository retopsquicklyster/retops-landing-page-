import { useState, useRef } from "react";
import { X, Twitter, Linkedin, Copy, Download, Check } from "lucide-react";

export default function ShareResultModal({ open, onClose, metrics }) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef(null);

  if (!open) return null;

  const shareText =
    `We found $${(metrics.arr_at_risk || 0).toLocaleString()} in revenue at risk across ${metrics.at_risk_accounts || 0} accounts in under 24h.\n\n` +
    `QA coverage: ${metrics.coverage || 0}% · Avg score: ${metrics.avg_score || 0}/100\n\n` +
    `That's what 100% QA coverage looks like with RetOps — AI revenue protection for support teams.`;

  const url = typeof window !== "undefined" ? window.location.origin : "https://retops.ai";

  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`;
  const linkedinHref = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;

  const doCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* noop */ }
  };

  const doDownload = async () => {
    // Simple approach: create a canvas with the same content
    const canvas = document.createElement("canvas");
    const w = 1200, h = 630;
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    // bg gradient
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, "#07201c");
    grad.addColorStop(1, "#0b3530");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#6EE7B7";
    ctx.font = "600 20px Inter, sans-serif";
    ctx.fillText("RETOPS · REVENUE INTELLIGENCE", 64, 80);
    ctx.fillStyle = "#fff";
    ctx.font = "600 92px 'Bricolage Grotesque', sans-serif";
    ctx.fillText(`$${((metrics.arr_at_risk || 0) / 1000).toFixed(1)}K`, 64, 220);
    ctx.font = "500 34px Inter, sans-serif";
    ctx.fillStyle = "rgba(230,248,240,0.85)";
    ctx.fillText("in revenue at risk, caught in under 24h", 64, 270);
    ctx.font = "500 24px Inter, sans-serif";
    ctx.fillStyle = "#6EE7B7";
    ctx.fillText(`${metrics.at_risk_accounts || 0} at-risk accounts · ${metrics.coverage || 0}% QA coverage · avg ${metrics.avg_score || 0}/100`, 64, 330);
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.font = "400 22px Inter, sans-serif";
    ctx.fillText("AI revenue protection for support teams.", 64, 500);
    ctx.fillText("RetOps QAs every conversation — human and AI — and attaches dollars to churn.", 64, 535);
    ctx.fillStyle = "#10b981";
    ctx.fillRect(64, 580, 160, 4);

    const link = document.createElement("a");
    link.download = "retops-share.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 grid place-items-center p-4" onClick={onClose} data-testid="share-modal">
      <div className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-[hsl(var(--line))]">
          <h3 className="font-display text-xl font-semibold">Share this result</h3>
          <button onClick={onClose} data-testid="share-close" className="p-1 rounded hover:bg-[hsl(var(--bg-subtle))]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Preview card */}
        <div ref={cardRef} className="brand-gradient-ink grid-dot p-8 text-white" data-testid="share-preview">
          <p className="text-xs uppercase tracking-[0.2em] text-emerald-300/80 font-semibold">RetOps · Revenue Intelligence</p>
          <p className="font-display text-6xl font-semibold mt-4">${((metrics.arr_at_risk || 0) / 1000).toFixed(1)}K</p>
          <p className="text-lg text-emerald-100/80 mt-1">in revenue at risk, caught in under 24h</p>
          <p className="text-sm text-emerald-300/90 mt-4 font-mono">
            {metrics.at_risk_accounts || 0} at-risk accounts · {metrics.coverage || 0}% QA coverage · avg {metrics.avg_score || 0}/100
          </p>
          <div className="mt-6 pt-5 border-t border-white/10 text-sm text-white/70">
            AI revenue protection for support teams. RetOps QAs every conversation — human and AI — and attaches dollars to churn.
          </div>
        </div>

        <div className="p-5 space-y-3">
          <textarea readOnly value={shareText} rows={4} className="w-full p-3 border border-[hsl(var(--line))] rounded-xl font-mono text-xs" data-testid="share-text" />
          <div className="flex flex-wrap items-center gap-2">
            <a data-testid="share-twitter" href={tweetHref} target="_blank" rel="noopener noreferrer" className="btn-primary flex items-center gap-2">
              <Twitter className="w-4 h-4" /> Tweet this
            </a>
            <a data-testid="share-linkedin" href={linkedinHref} target="_blank" rel="noopener noreferrer" className="btn-ghost flex items-center gap-2">
              <Linkedin className="w-4 h-4" /> LinkedIn
            </a>
            <button data-testid="share-copy" onClick={doCopy} className="btn-ghost flex items-center gap-2">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
              {copied ? "Copied" : "Copy text"}
            </button>
            <button data-testid="share-download" onClick={doDownload} className="btn-ghost flex items-center gap-2">
              <Download className="w-4 h-4" /> Download image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

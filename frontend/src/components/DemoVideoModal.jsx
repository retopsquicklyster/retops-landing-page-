import { useEffect, useRef } from "react";
import { X, Calendar, Play } from "lucide-react";

const BOOK_DEMO = "https://link.quicklyster.ca/widget/booking/Uqx8qFGVds9HVLl42Bij";

/**
 * Modal overlay that auto-plays a ~60-second scripted walkthrough of the
 * real RetOps UI (recorded via Playwright, transcoded to MP4 via ffmpeg).
 */
export default function DemoVideoModal({ open, onClose }) {
  const videoRef = useRef(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  // Auto-play when modal opens (respect browser policies)
  useEffect(() => {
    if (open && videoRef.current) {
      videoRef.current.currentTime = 0;
      const p = videoRef.current.play();
      if (p && p.catch) p.catch(() => {});
    }
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-md grid place-items-center p-4 md:p-8 animate-[fadein_.18s_ease-out]"
      onClick={onClose}
      data-testid="demo-video-modal"
    >
      <div
        className="relative w-full max-w-6xl rounded-2xl overflow-hidden shadow-[0_30px_80px_rgba(0,0,0,.55)] bg-[#0b1f3b]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 md:px-7 py-3.5 border-b border-white/10">
          <div className="flex items-center gap-3 min-w-0">
            <span className="w-2 h-2 rounded-full bg-[#F8D210] animate-pulse flex-none" />
            <p className="text-white/70 text-[11px] uppercase tracking-[0.22em] font-semibold truncate">
              RetOps — 60-second product tour
            </p>
          </div>
          <button
            onClick={onClose}
            data-testid="demo-video-close"
            aria-label="Close video"
            className="w-9 h-9 rounded-full grid place-items-center text-white/70 hover:text-white hover:bg-white/10 transition-colors flex-none"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* video */}
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            data-testid="demo-video-player"
            className="absolute inset-0 w-full h-full object-cover"
            poster="/video/retops-demo-poster.jpg"
            controls
            playsInline
            muted
            autoPlay
            preload="metadata"
          >
            <source src="/video/retops-demo.mp4" type="video/mp4" />
            <source src="/video/retops-demo.webm" type="video/webm" />
            Your browser does not support HTML5 video.
          </video>
        </div>

        {/* footer CTA */}
        <div className="px-5 md:px-7 py-4 flex items-center justify-between gap-3 flex-wrap border-t border-white/10 bg-[#0b1f3b]">
          <p className="text-white/70 text-sm leading-snug">
            This is the real product — not a mock. Ready to protect your revenue?
          </p>
          <a
            href={BOOK_DEMO}
            target="_blank"
            rel="noreferrer"
            data-testid="demo-video-book"
            className="btn-gold inline-flex items-center gap-1.5 text-sm !py-2"
          >
            <Calendar className="w-4 h-4" /> Book a demo
          </a>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline trigger button — play-circle + label.
 * Matches retops.ai's "Watch demo" aesthetic (navy-teal ghost pill).
 */
export function WatchDemoButton({ onClick, className = "" }) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid="watch-demo-btn"
      className={`inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full border border-[hsl(var(--retops-navy))]/15 bg-white/70 hover:bg-white text-[hsl(var(--retops-navy))] text-sm font-semibold transition-all hover:shadow-md hover:-translate-y-0.5 ${className}`}
    >
      <span className="w-7 h-7 rounded-full bg-[hsl(var(--retops-navy))] text-[#F8D210] grid place-items-center flex-none shadow-[0_0_0_3px_rgba(248,210,16,.25)]">
        <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
      </span>
      Watch 60-second demo
    </button>
  );
}

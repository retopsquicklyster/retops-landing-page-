const LOGO_SRC = "https://customer-assets.emergentagent.com/job_quick-launch-133/artifacts/xdswif0q_Retops%20company%20profile%20logo.png";

/**
 * Official RetOps logo lockup. The source PNG is a centered logo on a solid
 * black square, so we:
 *   (1) wrap it in a navy tile,
 *   (2) apply `mix-blend-mode: lighten` — black → navy, colors preserved,
 *   (3) render the image larger than the tile and offset it vertically to
 *       crop to the middle band (where the logo lives) with overflow hidden.
 */
export const Logo = ({ size = "md" }) => {
  const cfg = size === "lg"
    ? { w: 240, h: 96, imgW: 240, offset: -72, radius: 16 }
    : size === "sm"
    ? { w: 150, h: 54, imgW: 150, offset: -48, radius: 10 }
    : { w: 190, h: 74, imgW: 190, offset: -58, radius: 12 };

  return (
    <div
      data-testid="retops-logo"
      style={{
        width: cfg.w,
        height: cfg.h,
        backgroundColor: "hsl(218 68% 14%)",
        overflow: "hidden",
        borderRadius: cfg.radius,
        display: "inline-block",
      }}
    >
      <img
        src={LOGO_SRC}
        alt="RetOps — Revenue Protection Platform"
        style={{
          width: cfg.imgW,
          height: cfg.imgW, /* image is square */
          marginTop: cfg.offset,
          mixBlendMode: "lighten",
          display: "block",
          pointerEvents: "none",
          userSelect: "none",
        }}
        draggable={false}
      />
    </div>
  );
};

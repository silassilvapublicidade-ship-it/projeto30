/**
 * Pure CSS/SVG premium background for the auth screens - no photography, no
 * external assets, nothing that blocks the form on a slow connection. Layers
 * (back to front): base radial glow, a huge low-opacity "30" as a graphic
 * element (not competing with the form - see the opacity), a barely-there
 * technical grid, an SVG grain filter so the black field doesn't read as
 * flat/dead, and a vignette to keep focus centered on the card. Shared by
 * mobile and desktop; the desktop-only headline/copy lives in
 * AuthVisualPanel, layered on top of this.
 */
export function AuthBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <svg className="absolute size-0">
        <filter id="p30-auth-grain">
          <feTurbulence baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" type="fractalNoise" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
      </svg>

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 55% at 78% 15%, rgba(255,106,0,0.16), transparent 60%), radial-gradient(ellipse 60% 50% at 15% 85%, rgba(255,154,61,0.08), transparent 65%)",
        }}
      />

      <div
        className="absolute inset-0 [animation:p30-glow-breathe_9s_ease-in-out_infinite]"
        style={{
          background: "radial-gradient(ellipse 45% 40% at 82% 8%, rgba(255,106,0,0.14), transparent 70%)",
        }}
      />

      <span
        className="font-display absolute -bottom-[8vw] -left-[4vw] select-none text-[46vw] leading-none text-white/[0.035] sm:text-[32vw] lg:-bottom-[12vw] lg:left-[-6vw] lg:text-[30vw]"
        style={{ letterSpacing: "-0.04em" }}
      >
        30
      </span>

      <div
        className="absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.6) 0px, transparent 1px, transparent 64px), repeating-linear-gradient(0deg, rgba(255,255,255,0.6) 0px, transparent 1px, transparent 64px)",
        }}
      />

      <div className="absolute inset-0 opacity-[0.025]" style={{ filter: "url(#p30-auth-grain)" }} />

      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 90% 80% at 50% 45%, transparent 45%, rgba(0,0,0,0.55) 100%)",
        }}
      />
    </div>
  );
}

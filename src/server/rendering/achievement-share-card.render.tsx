import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ReactElement } from "react";

import { ImageResponse } from "next/og";

import type { AchievementCardContent } from "@/features/achievements/achievement-art.core";
import { RARITY_TIERS, type RarityTierConfig } from "@/features/achievements/achievement-rarity.core";
import type { SceneId } from "@/features/achievements/achievement-scene.core";
import type { ShareCardTemplateConfig } from "@/features/achievements/achievement-art.schemas";
import type { ProgressCardContent } from "@/features/achievements/progress-card.core";

import { AchievementIcon, CheckCircleIcon } from "./achievement-icons";

// Palette mirrors the brand tokens in src/app/globals.css. Satori renders
// each JSX tree in isolation (no browser, no CSS cascade) so these can't be
// `var(--p30-*)` references - they're duplicated here on purpose, as literal
// hex, to stay independent of any future globals.css refactor.
const P30_BLACK = "#050505";
const P30_GRAPHITE = "#111418";
const P30_GRAPHITE_2 = "#171b20";
const P30_WHITE = "#f8f6f1";
const P30_PORCELAIN = "#fffdf8";
const P30_MUTED = "#b7b4ac";
const P30_MUTED_2 = "#7c838b";
const P30_ORANGE = "#ff6a00";
const P30_AMBER = "#f2a93b";
const P30_LINE = "rgba(255, 255, 255, 0.07)";

// Satori's gradient parser doesn't reliably honor an 8-digit hex alpha
// suffix (`${hex}33`) - colors built that way rendered as near-opaque solid
// shapes instead of translucent glows. Always go through this helper for a
// translucent tier color instead of string-concatenating an alpha suffix.
function hexToRgba(hex: string, alpha: number) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

const FONT_DISPLAY = "P30 Display";
const FONT_BODY = "P30 Body";
const FONT_MONO = "P30 Mono";

function readFontFile(fileName: string) {
  return readFileSync(join(process.cwd(), "src", "server", "rendering", "fonts", fileName));
}

// Read once per server instance (module scope), never per-request - these
// are small (<55KB each) and never change at runtime.
const FONT_FILES = {
  displayBold: readFontFile("Fraunces-Bold.woff"),
  mono: readFontFile("IBMPlexMono-Medium.woff"),
  sansBold: readFontFile("Manrope-ExtraBold.woff"),
  sansRegular: readFontFile("Manrope-Regular.woff"),
};

const LOGO_DATA_URI = (() => {
  const buffer = readFileSync(join(process.cwd(), "public", "brand", "logo-mark-1024.png"));
  return `data:image/png;base64,${buffer.toString("base64")}`;
})();

/**
 * Thin diagonal hairlines at low opacity, full-bleed - the "technical
 * premium" base texture every card shares regardless of category/rarity
 * (the layer that stops a plain gradient from reading as a generic
 * wallpaper). Kept to 5 lines, wide spacing - a texture, not a pattern.
 */
function TechTextureLayer() {
  const lines = [140, 340, 560, 800, 1000];

  return (
    <div style={{ bottom: 0, display: "flex", left: 0, position: "absolute", right: 0, top: 0 }}>
      {lines.map((left) => (
        <div
          key={left}
          style={{
            background: `linear-gradient(180deg, transparent, ${P30_LINE}, transparent)`,
            height: "160%",
            left,
            position: "absolute",
            top: "-30%",
            transform: "rotate(12deg)",
            width: 1,
          }}
        />
      ))}
    </div>
  );
}

function RarityGlowLayer({ tier }: { tier: RarityTierConfig }) {
  return (
    <div
      style={{
        background: `radial-gradient(circle at 50% 38%, ${tier.glowColor}, transparent 60%)`,
        bottom: 0,
        display: "flex",
        left: 0,
        position: "absolute",
        right: 0,
        top: 0,
      }}
    />
  );
}

// A radial vignette reaches the top/bottom edges of a 9:16 canvas at a much
// shorter distance than the left/right edges, which was crushing most of
// the frame (including the category scene behind the medal) to near-black.
// A vertical linear vignette - darkening only the very top and bottom
// strips - reads correctly at this aspect ratio and still frames the card.
function VignetteLayer() {
  return (
    <div
      style={{
        background: `linear-gradient(180deg, ${P30_BLACK} 0%, transparent 16%, transparent 84%, ${P30_BLACK} 100%)`,
        bottom: 0,
        display: "flex",
        left: 0,
        opacity: 0.85,
        position: "absolute",
        right: 0,
        top: 0,
      }}
    />
  );
}

// --- Category scenes -------------------------------------------------
// Every scene is purely decorative, absolutely positioned, drawn from
// flexbox divs + gradients only (no raster assets) and kept deliberately
// sparse ("sem exageros, minimalista"). Each receives the rarity tier's
// accent color so the same motif reads bronze/silver/gold/legendary.

function AscendingLinesScene({ tier }: { tier: RarityTierConfig }) {
  const steps = [0, 1, 2, 3, 4];

  return (
    <div style={{ bottom: 0, display: "flex", left: 0, position: "absolute", right: 0, top: 0 }}>
      {steps.map((step) => (
        <div
          key={step}
          style={{
            background: tier.medalRing[1],
            bottom: 260 + step * 150,
            height: 4,
            left: 24 + step * 5,
            opacity: 0.14 - step * 0.016,
            position: "absolute",
            width: 64 - step * 6,
          }}
        />
      ))}
      {steps.map((step) => (
        <div
          key={`r${step}`}
          style={{
            background: tier.medalRing[1],
            bottom: 260 + step * 150,
            height: 4,
            opacity: 0.14 - step * 0.016,
            position: "absolute",
            right: 24 + step * 5,
            width: 64 - step * 6,
          }}
        />
      ))}
    </div>
  );
}

function SunriseGlowScene({ tier }: { tier: RarityTierConfig }) {
  return (
    <div style={{ bottom: 0, display: "flex", left: 0, position: "absolute", right: 0, top: 0 }}>
      <div
        style={{
          background: `radial-gradient(circle, ${hexToRgba(tier.medalRing[1], 0.27)}, transparent 70%)`,
          borderRadius: 9999,
          bottom: -420,
          display: "flex",
          height: 900,
          left: "50%",
          marginLeft: -450,
          position: "absolute",
          width: 900,
        }}
      />
      <div
        style={{
          background: tier.medalRing[1],
          bottom: 480,
          borderRadius: 9999,
          display: "flex",
          height: 2,
          left: 140,
          opacity: 0.22,
          position: "absolute",
          width: 800,
        }}
      />
    </div>
  );
}

function EmberRiseScene({ tier }: { tier: RarityTierConfig }) {
  const embers = [
    { left: 160, size: 10, top: 1200 },
    { left: 300, size: 6, top: 980 },
    { left: 780, size: 8, top: 1080 },
    { left: 860, size: 5, top: 800 },
    { left: 220, size: 5, top: 720 },
  ];

  return (
    <div style={{ bottom: 0, display: "flex", left: 0, position: "absolute", right: 0, top: 0 }}>
      <div
        style={{
          background: `radial-gradient(circle, ${tier.glowColor}, transparent 65%)`,
          bottom: -200,
          display: "flex",
          height: 820,
          left: "50%",
          marginLeft: -410,
          position: "absolute",
          width: 820,
        }}
      />
      {embers.map((ember) => (
        <div
          key={`${ember.left}-${ember.top}`}
          style={{
            background: tier.particleColor,
            borderRadius: 9999,
            display: "flex",
            height: ember.size,
            left: ember.left,
            opacity: 0.55,
            position: "absolute",
            top: ember.top,
            width: ember.size,
          }}
        />
      ))}
    </div>
  );
}

function SequenceMarksScene({ tier }: { tier: RarityTierConfig }) {
  const marks = Array.from({ length: 7 }, (_, index) => index);

  return (
    <div
      style={{
        background: `radial-gradient(circle, ${tier.glowColor}, transparent 68%)`,
        display: "flex",
        height: 720,
        left: "50%",
        marginLeft: -360,
        position: "absolute",
        top: 220,
        width: 720,
      }}
    >
      <div
        style={{
          display: "flex",
          gap: 16,
          left: "50%",
          marginLeft: -227,
          position: "absolute",
          top: 470,
        }}
      >
        {marks.map((index) => (
          <div
            key={index}
            style={{
              background: tier.medalRing[1],
              borderRadius: 5,
              display: "flex",
              height: 26,
              opacity: 0.13,
              width: 41,
            }}
          />
        ))}
      </div>
    </div>
  );
}

function OpenBookScene({ tier }: { tier: RarityTierConfig }) {
  // Satori doesn't reliably apply `transform: rotate()` to absolutely
  // positioned flex children (two "page" rectangles rendered square instead
  // of angled, reading as one flat slab rather than an open book) - a soft
  // warm/cool glow reads as "illuminated page" without needing rotation.
  return (
    <div
      style={{
        background: `radial-gradient(circle, ${tier.glowColor}, transparent 70%)`,
        display: "flex",
        height: 780,
        left: "50%",
        marginLeft: -390,
        position: "absolute",
        top: 210,
        width: 780,
      }}
    />
  );
}

function SpeedLinesScene({ tier }: { tier: RarityTierConfig }) {
  const lines = [0, 1, 2, 3, 4];

  return (
    <div style={{ display: "flex", position: "absolute", right: 4, top: 420 }}>
      {lines.map((index) => (
        <div
          key={index}
          style={{
            background: tier.medalRing[1],
            display: "flex",
            height: 4,
            marginTop: index * 30,
            opacity: 0.16 - index * 0.024,
            position: "absolute",
            right: index * 30,
            transform: "rotate(-28deg)",
            width: 200 - index * 22,
          }}
        />
      ))}
    </div>
  );
}

function SoftLightScene({ tier }: { tier: RarityTierConfig }) {
  return (
    <div
      style={{
        background: `radial-gradient(circle, ${tier.glowColor}, transparent 72%)`,
        borderRadius: 9999,
        display: "flex",
        height: 800,
        left: "50%",
        marginLeft: -400,
        position: "absolute",
        top: 260,
        width: 800,
      }}
    />
  );
}

function ProgressMarkerScene({ tier }: { tier: RarityTierConfig }) {
  return (
    <div
      style={{
        background: `radial-gradient(circle, ${tier.glowColor}, transparent 68%)`,
        display: "flex",
        height: 720,
        left: "50%",
        marginLeft: -360,
        position: "absolute",
        top: 220,
        width: 720,
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          left: "50%",
          marginLeft: -260,
          position: "absolute",
          top: 480,
          width: 520,
        }}
      >
        <div style={{ background: tier.medalRing[1], display: "flex", height: 3, opacity: 0.16, width: 240 }} />
        <div
          style={{
            background: tier.medalRing[1],
            borderRadius: 9999,
            display: "flex",
            height: 12,
            opacity: 0.4,
            width: 12,
          }}
        />
        <div style={{ background: tier.medalRing[1], display: "flex", height: 3, opacity: 0.06, width: 240 }} />
      </div>
    </div>
  );
}

function LoopArcScene({ tier }: { tier: RarityTierConfig }) {
  return (
    <div
      style={{
        background: `radial-gradient(circle, ${tier.glowColor}, transparent 68%)`,
        display: "flex",
        height: 720,
        left: "50%",
        marginLeft: -360,
        position: "absolute",
        top: 220,
        width: 720,
      }}
    >
      <div
        style={{
          border: `3px solid ${tier.medalRing[1]}`,
          borderRadius: 9999,
          borderRightColor: "transparent",
          borderTopColor: "transparent",
          display: "flex",
          height: 400,
          left: "50%",
          marginLeft: -200,
          opacity: 0.16,
          position: "absolute",
          top: 155,
          transform: "rotate(-35deg)",
          width: 400,
        }}
      />
    </div>
  );
}

function GridBloomScene({ tier }: { tier: RarityTierConfig }) {
  const cells = Array.from({ length: 5 }, (_, index) => index);

  return (
    <div style={{ bottom: 0, display: "flex", left: 0, position: "absolute", right: 0, top: 0 }}>
      <div
        style={{
          background: `radial-gradient(circle, ${hexToRgba(P30_ORANGE, 0.24)}, transparent 70%)`,
          display: "flex",
          height: 960,
          left: "50%",
          marginLeft: -480,
          position: "absolute",
          top: 180,
          width: 960,
        }}
      />
      <div
        style={{
          background: `radial-gradient(circle, ${hexToRgba(P30_AMBER, 0.18)}, transparent 65%)`,
          display: "flex",
          height: 760,
          left: "50%",
          marginLeft: -380,
          position: "absolute",
          top: 300,
          width: 760,
        }}
      />
      <div style={{ display: "flex", gap: 16, left: "50%", marginLeft: -196, position: "absolute", top: 540 }}>
        {cells.map((index) => (
          <div
            key={index}
            style={{
              background: tier.medalRing[1],
              borderRadius: 5,
              display: "flex",
              height: 26,
              opacity: 0.13,
              width: 26,
            }}
          />
        ))}
      </div>
    </div>
  );
}

const SCENES: Record<SceneId, (props: { tier: RarityTierConfig }) => ReactElement> = {
  "ascending-lines": AscendingLinesScene,
  "ember-rise": EmberRiseScene,
  "grid-bloom": GridBloomScene,
  "loop-arc": LoopArcScene,
  "open-book": OpenBookScene,
  "progress-marker": ProgressMarkerScene,
  "sequence-marks": SequenceMarksScene,
  "soft-light": SoftLightScene,
  "speed-lines": SpeedLinesScene,
  "sunrise-glow": SunriseGlowScene,
};

// --- Medal -------------------------------------------------------------

function Medal({ content, tier }: { content: AchievementCardContent; tier: RarityTierConfig }) {
  const size = 248;
  const innerSize = size - tier.ringWidth * 2;

  return (
    <div
      style={{
        alignItems: "center",
        background: `linear-gradient(135deg, ${tier.medalRing[0]}, ${tier.medalRing[1]})`,
        borderRadius: 9999,
        display: "flex",
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: `linear-gradient(160deg, ${P30_GRAPHITE_2}, ${P30_GRAPHITE})`,
          borderRadius: 9999,
          display: "flex",
          height: innerSize,
          justifyContent: "center",
          position: "relative",
          width: innerSize,
        }}
      >
        <div
          style={{
            background: `radial-gradient(circle at 50% 20%, rgba(255,255,255,0.22), transparent 60%)`,
            borderRadius: 9999,
            display: "flex",
            height: innerSize,
            position: "absolute",
            width: innerSize,
          }}
        />
        <AchievementIcon
          color={P30_PORCELAIN}
          icon={content.icon}
          size={Math.round(innerSize * 0.42)}
          strokeWidth={1.8}
        />
      </div>
    </div>
  );
}

// --- Small pieces --------------------------------------------------------

function Pill({ children, tone = "muted" }: { children: string; tone?: "accent" | "muted" }) {
  return (
    <div
      style={{
        alignItems: "center",
        border: `1px solid ${tone === "accent" ? P30_AMBER : "rgba(255,255,255,0.16)"}`,
        borderRadius: 9999,
        color: tone === "accent" ? P30_AMBER : P30_MUTED,
        display: "flex",
        fontFamily: FONT_MONO,
        fontSize: 20,
        gap: 8,
        letterSpacing: 2,
        padding: "8px 22px",
        textTransform: "uppercase",
      }}
    >
      {children}
    </div>
  );
}

/**
 * Renders the achievement share card as a PNG via next/og's ImageResponse
 * (Satori + Resvg, bundled with Next.js). Layered composition, back to
 * front: base gradient -> technical texture -> category scene -> rarity
 * glow -> vignette -> foreground content. Satori supports flexbox + a CSS
 * subset plus raw SVG passthrough (confirmed against the bundled
 * @vercel/og build) - no grid, no real blur/backdrop-filter, so "glass"
 * medal/badge surfaces are simulated with layered gradients instead.
 */
export function renderAchievementShareCardImage(
  content: AchievementCardContent,
  config: ShareCardTemplateConfig,
) {
  const tier = RARITY_TIERS[content.rarityTier];
  const Scene = SCENES[content.sceneId];
  const isStory = config.format === "story";

  // Instagram Stories overlays its own UI (profile bar, reply field) across
  // roughly the top/bottom 230px - all critical foreground content must sit
  // inside the remaining safe band. Feed posts have no such overlay, so they
  // just get generous uniform padding instead.
  const topInset = isStory ? 230 : 96;
  const bottomInset = isStory ? 230 : 96;
  const sidePad = 84;

  const microDetails = [content.rarityLabel, content.numberLabel, content.unlockedPercentLabel].filter(
    (value): value is string => Boolean(value),
  );

  return new ImageResponse(
    (
      <div
        style={{
          background: `linear-gradient(165deg, ${P30_GRAPHITE} 0%, ${P30_BLACK} 62%)`,
          display: "flex",
          fontFamily: FONT_BODY,
          height: "100%",
          position: "relative",
          width: "100%",
        }}
      >
        <TechTextureLayer />
        <Scene tier={tier} />
        <RarityGlowLayer tier={tier} />
        <VignetteLayer />

        <div
          style={{
            alignItems: "center",
            bottom: bottomInset,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            left: sidePad,
            position: "absolute",
            right: sidePad,
            textAlign: "center",
            top: topInset,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og requires a raw <img>, not next/image */}
          <img alt="" height={68} src={LOGO_DATA_URI} width={68} />

          <div style={{ display: "flex", marginTop: 28 }}>
            <div
              style={{
                alignItems: "center",
                background: "rgba(255,255,255,0.06)",
                borderRadius: 9999,
                color: P30_PORCELAIN,
                display: "flex",
                fontFamily: FONT_MONO,
                fontSize: 22,
                gap: 8,
                letterSpacing: 2,
                padding: "10px 26px",
                textTransform: "uppercase",
              }}
            >
              <CheckCircleIcon color={P30_ORANGE} size={20} />
              Conquista desbloqueada
            </div>
          </div>

          {content.badgeLabel ? (
            <div style={{ display: "flex", marginTop: 18 }}>
              <Pill tone="accent">{content.badgeLabel}</Pill>
            </div>
          ) : null}

          <div style={{ display: "flex", marginTop: 46 }}>
            <Medal content={content} tier={tier} />
          </div>

          <div
            style={{
              color: P30_WHITE,
              display: "flex",
              fontFamily: FONT_DISPLAY,
              fontSize: 78,
              fontWeight: 700,
              letterSpacing: -1,
              lineHeight: 1.08,
              marginTop: 42,
              maxWidth: 900,
              textTransform: "uppercase",
            }}
          >
            {content.title}
          </div>

          {content.subtitle ? (
            <div
              style={{
                color: P30_MUTED,
                display: "flex",
                fontSize: 34,
                lineHeight: 1.4,
                marginTop: 24,
                maxWidth: 780,
              }}
            >
              {content.subtitle.length > 140 ? `${content.subtitle.slice(0, 139)}…` : content.subtitle}
            </div>
          ) : null}

          {content.challengeLabel ? (
            <div style={{ color: P30_MUTED_2, display: "flex", fontSize: 26, marginTop: 22 }}>
              {content.challengeLabel}
            </div>
          ) : null}

          <div
            style={{
              background: `linear-gradient(90deg, transparent, ${P30_LINE}, transparent)`,
              display: "flex",
              height: 1,
              marginTop: 56,
              width: 300,
            }}
          />

          <div
            style={{ color: P30_WHITE, display: "flex", fontSize: 32, fontWeight: 600, marginTop: 38 }}
          >
            {content.attributionLine}
          </div>
          <div style={{ color: P30_MUTED_2, display: "flex", fontSize: 25, marginTop: 8 }}>
            {content.dateLabel}
          </div>

          {microDetails.length > 0 ? (
            <div
              style={{
                color: P30_MUTED_2,
                display: "flex",
                fontFamily: FONT_MONO,
                fontSize: 18,
                gap: 14,
                letterSpacing: 1,
                marginTop: 28,
                textTransform: "uppercase",
              }}
            >
              {microDetails.join("   ·   ")}
            </div>
          ) : null}

          <div
            style={{
              color: P30_MUTED_2,
              display: "flex",
              fontFamily: FONT_MONO,
              fontSize: 21,
              letterSpacing: 3,
              marginTop: 20,
              opacity: 0.7,
            }}
          >
            {content.footerLine.toUpperCase()}
          </div>
        </div>
      </div>
    ),
    {
      fonts: [
        { data: FONT_FILES.displayBold, name: FONT_DISPLAY, style: "normal", weight: 700 },
        { data: FONT_FILES.sansRegular, name: FONT_BODY, style: "normal", weight: 400 },
        { data: FONT_FILES.sansBold, name: FONT_BODY, style: "normal", weight: 700 },
        { data: FONT_FILES.mono, name: FONT_MONO, style: "normal", weight: 500 },
      ],
      height: config.height,
      width: config.width,
    },
  );
}

// --- Progress cards (dia concluido / novo recorde) ----------------------
// Reaproveita TODAS as primitivas acima (fontes, logo, texturas, cenas,
// vinheta, badge) - nunca uma segunda engine. So o conteudo/discriminador
// de tipo muda; a composicao em camadas e identica ao card de conquista.
// Sem sistema de raridade (nao se aplica a progresso diario) - usa sempre
// o tom "ouro" da marca como acento premium fixo.

function ProgressBadge({ icon, tier }: { icon: "flame" | "sunrise"; tier: RarityTierConfig }) {
  const size = 220;
  const innerSize = size - tier.ringWidth * 2;

  return (
    <div
      style={{
        alignItems: "center",
        background: `linear-gradient(135deg, ${tier.medalRing[0]}, ${tier.medalRing[1]})`,
        borderRadius: 9999,
        display: "flex",
        height: size,
        justifyContent: "center",
        width: size,
      }}
    >
      <div
        style={{
          alignItems: "center",
          background: `linear-gradient(160deg, ${P30_GRAPHITE_2}, ${P30_GRAPHITE})`,
          borderRadius: 9999,
          display: "flex",
          height: innerSize,
          justifyContent: "center",
          position: "relative",
          width: innerSize,
        }}
      >
        <div
          style={{
            background: `radial-gradient(circle at 50% 20%, rgba(255,255,255,0.22), transparent 60%)`,
            borderRadius: 9999,
            display: "flex",
            height: innerSize,
            position: "absolute",
            width: innerSize,
          }}
        />
        <AchievementIcon color={P30_PORCELAIN} icon={icon} size={Math.round(innerSize * 0.42)} strokeWidth={1.8} />
      </div>
    </div>
  );
}

/**
 * Renderiza os cards de progresso (dia concluido = card_type 'progress',
 * novo recorde = card_type 'streak_record') - mesma engine/composicao de
 * renderAchievementShareCardImage (Satori + Resvg via next/og), so o
 * conteudo e o rotulo do badge superior mudam.
 */
export function renderProgressShareCardImage(content: ProgressCardContent, config: ShareCardTemplateConfig) {
  const tier = RARITY_TIERS.ouro;
  const Scene = SCENES[content.sceneId];
  const isStory = config.format === "story";

  const topInset = isStory ? 230 : 96;
  const bottomInset = isStory ? 230 : 96;
  const sidePad = 84;

  return new ImageResponse(
    (
      <div
        style={{
          background: `linear-gradient(165deg, ${P30_GRAPHITE} 0%, ${P30_BLACK} 62%)`,
          display: "flex",
          fontFamily: FONT_BODY,
          height: "100%",
          position: "relative",
          width: "100%",
        }}
      >
        <TechTextureLayer />
        <Scene tier={tier} />
        <RarityGlowLayer tier={tier} />
        <VignetteLayer />

        <div
          style={{
            alignItems: "center",
            bottom: bottomInset,
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            left: sidePad,
            position: "absolute",
            right: sidePad,
            textAlign: "center",
            top: topInset,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- next/og requires a raw <img>, not next/image */}
          <img alt="" height={68} src={LOGO_DATA_URI} width={68} />

          <div style={{ display: "flex", marginTop: 28 }}>
            <Pill tone="accent">{content.attributionLine}</Pill>
          </div>

          <div style={{ display: "flex", marginTop: 46 }}>
            <ProgressBadge icon={content.icon} tier={tier} />
          </div>

          <div
            style={{
              color: P30_WHITE,
              display: "flex",
              fontFamily: FONT_DISPLAY,
              fontSize: 72,
              fontWeight: 700,
              letterSpacing: -1,
              lineHeight: 1.08,
              marginTop: 42,
              maxWidth: 900,
              textTransform: "uppercase",
            }}
          >
            {content.title}
          </div>

          {content.subtitle ? (
            <div
              style={{
                color: P30_MUTED,
                display: "flex",
                fontSize: 32,
                lineHeight: 1.4,
                marginTop: 24,
                maxWidth: 780,
              }}
            >
              {content.subtitle.length > 140 ? `${content.subtitle.slice(0, 139)}…` : content.subtitle}
            </div>
          ) : null}

          {content.challengeLabel ? (
            <div style={{ color: P30_MUTED_2, display: "flex", fontSize: 26, marginTop: 22 }}>
              {content.challengeLabel}
            </div>
          ) : null}

          <div
            style={{
              background: `linear-gradient(90deg, transparent, ${P30_LINE}, transparent)`,
              display: "flex",
              height: 1,
              marginTop: 56,
              width: 300,
            }}
          />

          <div style={{ color: P30_MUTED_2, display: "flex", fontSize: 25, marginTop: 30 }}>{content.dateLabel}</div>

          {content.microDetails.length > 0 ? (
            <div
              style={{
                color: P30_MUTED_2,
                display: "flex",
                fontFamily: FONT_MONO,
                fontSize: 18,
                gap: 14,
                letterSpacing: 1,
                marginTop: 22,
                textTransform: "uppercase",
              }}
            >
              {content.microDetails.join("   ·   ")}
            </div>
          ) : null}

          <div
            style={{
              color: P30_MUTED_2,
              display: "flex",
              fontFamily: FONT_MONO,
              fontSize: 21,
              letterSpacing: 3,
              marginTop: 20,
              opacity: 0.7,
            }}
          >
            {content.footerLine.toUpperCase()}
          </div>
        </div>
      </div>
    ),
    {
      fonts: [
        { data: FONT_FILES.displayBold, name: FONT_DISPLAY, style: "normal", weight: 700 },
        { data: FONT_FILES.sansRegular, name: FONT_BODY, style: "normal", weight: 400 },
        { data: FONT_FILES.sansBold, name: FONT_BODY, style: "normal", weight: 700 },
        { data: FONT_FILES.mono, name: FONT_MONO, style: "normal", weight: 500 },
      ],
      height: config.height,
      width: config.width,
    },
  );
}

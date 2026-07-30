import { ImageResponse } from "next/og";

import type { AchievementCardContent } from "@/features/achievements/achievement-art.core";
import type { ShareCardTemplateConfig } from "@/features/achievements/achievement-art.schemas";

/**
 * Renders the achievement share card as a PNG via next/og's ImageResponse
 * (Satori + Resvg, bundled with Next.js - see node_modules/next/dist/docs/
 * 01-app/03-api-reference/04-functions/image-response.md). Chosen over
 * standalone @vercel/og / satori / resvg-wasm / sharp / canvas packages
 * because it ships with Next.js itself (zero extra dependency), runs
 * server-side in a Route Handler, and outputs PNG directly - see the
 * "solucao de geracao escolhida" section of the final report for the full
 * comparison. Only flexbox + a CSS subset is supported (Satori constraint),
 * so this layout intentionally avoids grid/absolute-heavy composition.
 */
export function renderAchievementShareCardImage(
  content: AchievementCardContent,
  config: ShareCardTemplateConfig,
) {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: `linear-gradient(160deg, ${config.background.from}, ${config.background.to})`,
          color: config.textColor,
          display: "flex",
          flexDirection: "column",
          fontFamily: "sans-serif",
          height: "100%",
          justifyContent: "space-between",
          padding: "72px 64px",
          width: "100%",
        }}
      >
        <div style={{ display: "flex", fontSize: 28, fontWeight: 700, letterSpacing: 4, opacity: 0.85 }}>
          PROJETO 30
        </div>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: 28,
            textAlign: "center",
          }}
        >
          <div
            style={{
              alignItems: "center",
              background: config.accentColor,
              borderRadius: 9999,
              display: "flex",
              fontSize: 72,
              height: 160,
              justifyContent: "center",
              width: 160,
            }}
          >
            🏆
          </div>

          {content.badgeLabel ? (
            <div
              style={{
                border: `2px solid ${config.accentColor}`,
                borderRadius: 9999,
                display: "flex",
                fontSize: 26,
                letterSpacing: 2,
                opacity: 0.9,
                padding: "10px 28px",
                textTransform: "uppercase",
              }}
            >
              {content.badgeLabel}
            </div>
          ) : null}

          <div style={{ display: "flex", fontSize: 64, fontWeight: 800, lineHeight: 1.15, maxWidth: 880 }}>
            {content.title}
          </div>

          {content.subtitle ? (
            <div style={{ display: "flex", fontSize: 32, lineHeight: 1.4, maxWidth: 800, opacity: 0.92 }}>
              {content.subtitle}
            </div>
          ) : null}

          {config.showChallengeBranding && content.challengeLabel ? (
            <div style={{ display: "flex", fontSize: 28, opacity: 0.8 }}>{content.challengeLabel}</div>
          ) : null}
        </div>

        <div
          style={{
            alignItems: "center",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            textAlign: "center",
          }}
        >
          <div style={{ display: "flex", fontSize: 30, fontWeight: 600 }}>{content.attributionLine}</div>
          <div style={{ display: "flex", fontSize: 24, opacity: 0.75 }}>{content.dateLabel}</div>
          {config.showFooterSignature ? (
            <div style={{ display: "flex", fontSize: 22, marginTop: 12, opacity: 0.6 }}>
              {content.footerLine}
            </div>
          ) : null}
        </div>
      </div>
    ),
    {
      height: config.height,
      width: config.width,
    },
  );
}

import type { MetadataRoute } from "next";

// Static content (no cookies()/headers()/searchParams), so Next serves this
// as a cached route by default - correct here, the manifest never varies
// per request.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Projeto 30",
    short_name: "Projeto 30",
    description: "30 dias para evoluir com disciplina, constância e uma experiência digital calma.",
    start_url: "/app/hoje",
    scope: "/",
    display: "standalone",
    display_override: ["window-controls-overlay", "standalone", "browser"],
    orientation: "portrait-primary",
    background_color: "#050505",
    theme_color: "#050505",
    lang: "pt-BR",
    categories: ["productivity", "lifestyle", "health"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
    shortcuts: [
      {
        name: "Hoje",
        url: "/app/hoje",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Desafios",
        url: "/app/desafios",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Dicas",
        url: "/app/dicas",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Conquistas",
        url: "/app/conquistas",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}

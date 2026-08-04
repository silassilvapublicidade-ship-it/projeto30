import type { Metadata, Viewport } from "next";
import { Fraunces, IBM_Plex_Mono, Manrope } from "next/font/google";
import "./globals.css";

import { ServiceWorkerManager } from "@/components/pwa/service-worker-manager";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

const body = Manrope({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

const siteDescription =
  "Uma jornada de pequenas escolhas para fortalecer corpo, mente, caráter e espírito por meio de ciclos de 30 dias.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Projeto 30, 30 dias para evoluir",
    template: "%s | Projeto 30",
  },
  description: siteDescription,
  applicationName: "Projeto 30",
  authors: [{ name: "Silas Silva" }],
  creator: "Silas Silva",
  openGraph: {
    title: "Projeto 30, 30 dias para evoluir",
    description: siteDescription,
    siteName: "Projeto 30",
    locale: "pt_BR",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Projeto 30, 30 dias para evoluir",
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Projeto 30",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  colorScheme: "dark",
  themeColor: "#050505",
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-BR"
      className={`${display.variable} ${body.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-background text-foreground">
        {children}
        <ServiceWorkerManager />
      </body>
    </html>
  );
}

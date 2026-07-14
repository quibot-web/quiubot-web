import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import JobFlotante from "@/app/components/JobFlotante";
import AsistenteFlotante from "@/app/components/AsistenteFlotante";

export const metadata: Metadata = {
  metadataBase: new URL("https://quiubot.site"),
  title: {
    default: "Quiubot — Publicidad con IA para tu negocio",
    template: "%s · Quiubot",
  },
  description: "Genera estrategia, creativos y publica campañas en Meta Ads con IA, mientras Quiubot vigila y ajusta todo por ti.",
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
  openGraph: {
    title: "Quiubot — Publicidad con IA para tu negocio",
    description: "Genera estrategia, creativos y publica campañas en Meta Ads con IA, mientras Quiubot vigila y ajusta todo por ti.",
    images: ["/opengraph-image.png"],
  },
};

export const viewport = {
  themeColor: "#534AB7",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body>
        <SessionProvider>
          {children}
          <JobFlotante />
          <AsistenteFlotante />
        </SessionProvider>
      </body>
    </html>
  );
}
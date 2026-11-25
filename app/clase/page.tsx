import type { Metadata } from "next";
import { connection } from "next/server";
import ClaseEnVivo from "./ClaseEnVivo";
import { SUBTITULO_CLASE, TITULO_CLASE } from "./evento";

// Página pública (sin sesión, sin base de datos) para la clase en vivo del
// jueves 26 de noviembre de 2026. Ver middleware.ts (esPaginaClasePublica).

const DESCRIPCION = `${SUBTITULO_CLASE}. Jueves 26 de noviembre, 8:00 p. m. hora de Colombia.`;

// Barra del navegador del mismo color que el fondo de la página.
export const viewport = { themeColor: "#0C0A17" };

export const metadata: Metadata = {
  title: { absolute: `${TITULO_CLASE} · Quiubot` },
  description: DESCRIPCION,
  alternates: { canonical: "/clase" },
  openGraph: {
    title: TITULO_CLASE,
    description: DESCRIPCION,
    url: "/clase",
    siteName: "Quiubot",
    locale: "es_CO",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: TITULO_CLASE,
    description: DESCRIPCION,
  },
};

// La página se arma en cada visita: el primer render de la cuenta regresiva
// (y el estado antes/en vivo/terminó) sale con la hora real, no con la hora
// en que se hizo el build.
async function horaDeEstaVisita(): Promise<number> {
  await connection();
  return Date.now();
}

export default async function ClasePage() {
  const ahora = await horaDeEstaVisita();
  return <ClaseEnVivo ahoraServidor={ahora} />;
}

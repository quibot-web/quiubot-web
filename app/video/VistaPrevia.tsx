"use client";

import { Player } from "@remotion/player";
import { Composicion, duracionEnCuadros } from "@/video/Composicion";
import type { Guion } from "@/video/guion.schema";
import type { MediosResueltos } from "@/video/escenas/tipos";

// Aparte de page.tsx y cargado con next/dynamic + ssr:false: @remotion/player
// monta un <canvas>/reproductor que depende del navegador, igual que el
// resto de componentes de video/ -- sin esto, el render del lado del
// servidor de Next rompe en el primer build.
export default function VistaPrevia({
  guion,
  medios,
  pistaUrl,
  mostrarZonaSegura,
}: {
  guion: Guion;
  medios: MediosResueltos;
  pistaUrl: string | null;
  mostrarZonaSegura: boolean;
}) {
  return (
    <Player
      component={Composicion}
      inputProps={{ guion, medios, pistaUrl, mostrarZonaSegura }}
      durationInFrames={duracionEnCuadros(guion)}
      fps={guion.fps}
      compositionWidth={1080}
      compositionHeight={1920}
      style={{ width: "100%", maxWidth: 320, borderRadius: 12, overflow: "hidden" }}
      controls
      loop
    />
  );
}

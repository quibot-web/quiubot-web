"use client";

import { Player } from "@remotion/player";
import { ReelAutomatico, duracionReelAutomaticoEnCuadros } from "@/video/visuales/ReelAutomatico";
import type { Guion } from "@/video/guion.schema";
import type { MediosResueltos } from "@/video/escenas/tipos";

// Gemelo de VistaPrevia.tsx para piezas con pipeline de voz (Fase B
// v2.0, paso 2 de la integración a /contenido) -- ReelAutomatico en
// vez de Composicion. @remotion/media (voz/música) es experimental y
// basado en WebCodecs, pero @remotion/player usa <AudioForPreview>
// (confirmado en node_modules/@remotion/media/dist/esm/index.mjs) para
// cualquier contexto que no sea un render real -- si WebCodecs/el
// contexto no es seguro, cae solo a <Html5Audio> en vez de romper la
// vista previa, así que esto no necesita el mismo cuidado de
// unsafely-treat-insecure-origin-as-secure que sí hace falta para el
// render real (ColaDeRender.tsx).
export default function VistaPreviaConVoz({ guion, pistaMusicaUrl, medios }: { guion: Guion; pistaMusicaUrl: string | null; medios?: MediosResueltos }) {
  return (
    <Player
      component={ReelAutomatico}
      inputProps={{ guion, medios, pistaMusicaUrl, mostrarZonaSegura: false }}
      durationInFrames={duracionReelAutomaticoEnCuadros(guion)}
      fps={guion.fps}
      compositionWidth={1080}
      compositionHeight={1920}
      style={{ width: "100%", maxWidth: 320, borderRadius: 12, overflow: "hidden" }}
      controls
      loop
    />
  );
}

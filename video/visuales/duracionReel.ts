import type { Guion } from "../guion.schema";

// Separado de ReelAutomatico.tsx a propósito (mismo motivo que
// tamanos.ts/CapaBucleAudio.ts): ese archivo importa familiaDeFuente()
// de ../fuentes, que dispara loadFont() como efecto de módulo y
// revienta cualquier test que solo necesite esta cuenta pura (ver el
// comentario real de tamanos.ts).
export function duracionReelAutomaticoEnCuadros(guion: Guion): number {
  const tiempos = guion.tiemposRender ?? [];
  return Math.round(tiempos.reduce((acc, t) => acc + (t.fin_s - t.inicio_s), 0) * guion.fps);
}

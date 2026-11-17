import type { PalabraConTiempo } from "./generarVoz";
import type { TramoAudio } from "./compactarPausas";

// Ronda I: red de seguridad final contra el bug real de la ronda
// anterior (palabras mordidas al compactar). En vez de volver a
// transcribir un audio reconstruido con ffmpeg (que exigiría depender
// de RenderInternals.callFf -- API interna de @remotion/renderer, sin
// garantía de estabilidad entre versiones, arriesgada para un pipeline
// que corre en producción), esta verificación es puramente geométrica
// y exacta: cada palabra sobrevive completa si y solo si su propio
// rango [inicio_s, fin_s] en el archivo ORIGINAL cae enteramente
// dentro de alguno de los tramos que de verdad se van a reproducir.
// Como los tramos nunca se editan por dentro (compactarPausas.ts solo
// recorta DENTRO de silencio real, nunca dentro del rango de una
// palabra), esta comprobación es una garantía matemática, no una
// aproximación -- más fuerte que una retranscripción (que podría dar
// un falso positivo o negativo por el propio error de Whisper).
export type HallazgoPalabraPerdida = { palabra: string; inicio_s: number; fin_s: number; mensaje: string };

export function verificarPalabrasCompletas(palabrasOriginales: PalabraConTiempo[], tramosPorEscena: TramoAudio[][]): HallazgoPalabraPerdida[] {
  const tramos = tramosPorEscena.flat();
  const hallazgos: HallazgoPalabraPerdida[] = [];
  for (const p of palabrasOriginales) {
    const sobrevive = tramos.some((t) => t.original.inicio_s <= p.inicio_s + 1e-6 && t.original.fin_s >= p.fin_s - 1e-6);
    if (!sobrevive) {
      hallazgos.push({
        palabra: p.texto,
        inicio_s: p.inicio_s,
        fin_s: p.fin_s,
        mensaje: `La palabra "${p.texto}" (${p.inicio_s.toFixed(2)}s-${p.fin_s.toFixed(2)}s) quedó fuera de todos los tramos de audio conservados -- se perdería al reproducir el reel.`,
      });
    }
  }
  return hallazgos;
}

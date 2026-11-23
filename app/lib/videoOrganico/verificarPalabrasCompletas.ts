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

// 23 nov 2026: Whisper a veces estira una palabra sobre un silencio medido
// ("y" 21.48-22.28 con silencio real 21.58-21.87). Como compactarPausas
// solo quita silencio medido, una palabra se pierde solo si lo quitado toca
// la parte de ella que TIENE sonido (fuera de los silencios medidos).
export function verificarPalabrasCompletas(palabrasOriginales: PalabraConTiempo[], tramosPorEscena: TramoAudio[][], silencios: { inicio_s: number; fin_s: number }[] = []): HallazgoPalabraPerdida[] {
  const tramos = tramosPorEscena.flat().sort((a, b) => a.original.inicio_s - b.original.inicio_s);
  // Lo quitado: antes del primer tramo, entre tramos y después del último.
  const quitado: { desde: number; hasta: number }[] = [];
  if (tramos.length === 0) quitado.push({ desde: -Infinity, hasta: Infinity });
  else {
    quitado.push({ desde: -Infinity, hasta: tramos[0].original.inicio_s });
    for (let k = 1; k < tramos.length; k++) quitado.push({ desde: tramos[k - 1].original.fin_s, hasta: tramos[k].original.inicio_s });
    quitado.push({ desde: tramos[tramos.length - 1].original.fin_s, hasta: Infinity });
  }
  const hallazgos: HallazgoPalabraPerdida[] = [];
  for (const p of palabrasOriginales) {
    let conSonidoQuitado = 0;
    for (const q of quitado) {
      const a = Math.max(q.desde, p.inicio_s);
      const b = Math.min(q.hasta, p.fin_s);
      if (b - a <= 1e-6) continue;
      // descuenta lo que de ese pedazo es silencio medido
      let silencio = 0;
      for (const s of silencios) silencio += Math.max(0, Math.min(b, s.fin_s) - Math.max(a, s.inicio_s));
      conSonidoQuitado += Math.max(0, b - a - silencio);
    }
    if (conSonidoQuitado > 1e-3) {
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

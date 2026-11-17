import "server-only";
import { getSilentParts } from "@remotion/renderer";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

// Ronda I (revisión de escucha en staging, 18 nov 2026): compactarPausas.ts
// decidía DÓNDE cortar a partir de los huecos entre los tiempos de
// palabra de Whisper -- pero esos tiempos son medidas imprecisas de
// alineación (hay palabras reales con inicio_s===fin_s), nunca una
// medición real del audio. Cortar justo en ese límite impreciso, sobre
// todo en los bordes entre escenas (donde antes no se aplicaba ningún
// margen -- ver el comentario viejo en route.ts), mordió palabras
// reales ("conecta", "responde", "Quiubot") en un reel real.
//
// Esta función mide el audio de verdad: @remotion/renderer ya expone
// getSilentParts(), que corre el propio ffmpeg que Remotion empaqueta
// (confirmado real contra una toma real: detecta los mismos huecos que
// Whisper reporta, con bordes más ajustados). A partir de acá,
// compactarPausas.ts solo recorta DENTRO de un tramo que esta función
// ya confirmó que es silencio real -- nunca a partir de dónde Whisper
// CREE que empieza o termina una palabra.
export type SilencioReal = { inicio_s: number; fin_s: number };

const UMBRAL_RUIDO_DB = -30;
const DURACION_MINIMA_S = 0.12;

export async function detectarSilenciosReales(audio: ArrayBuffer, opciones: { umbralRuidoDb?: number; duracionMinima_s?: number } = {}): Promise<SilencioReal[]> {
  const { umbralRuidoDb = UMBRAL_RUIDO_DB, duracionMinima_s = DURACION_MINIMA_S } = opciones;
  const rutaTemporal = join(tmpdir(), `quiubot-voz-${randomUUID()}.mp3`);
  await writeFile(rutaTemporal, Buffer.from(audio));
  try {
    const resultado = await getSilentParts({
      src: rutaTemporal,
      minDurationInSeconds: duracionMinima_s,
      noiseThresholdInDecibels: umbralRuidoDb,
    });
    return resultado.silentParts.map((p) => ({ inicio_s: p.startInSeconds, fin_s: p.endInSeconds }));
  } finally {
    await unlink(rutaTemporal).catch(() => {});
  }
}

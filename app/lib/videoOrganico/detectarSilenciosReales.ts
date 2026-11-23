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

// 23 nov 2026 (voz que se comía la primera palabra): a -30 dB, el ataque
// suave de una palabra ("s", "f", "m", la "E" de "Escribe") contaba como
// silencio y el corte se metía en él. A -50 dB solo cuenta el silencio
// de verdad (el piso de la voz TTS medido es ~-69 dB). 0.2 s de mínimo:
// las oclusiones dentro de una palabra (la "c" de "Es-cribe", ~40 ms)
// nunca cuentan como pausa. Ninguna pausa se recorta si mide menos de
// eso (los objetivos son 0.25 / 0.4 s).
export const UMBRAL_SILENCIO_VOZ_DB = -50;
const UMBRAL_RUIDO_DB = UMBRAL_SILENCIO_VOZ_DB;
const DURACION_MINIMA_S = 0.2;

// ffmpeg mide picos de muestra: un chasquido de 50 ms en medio de una pausa
// la parte en dos pedazos y ninguno alcanza para recortar (medido real:
// 9c3bec9f, 0.7 s de pausa que quedaba sin tocar). Dos silencios separados
// por <= 60 ms se unen: ninguna palabra dura tan poco con silencio a los
// dos lados.
export const HUECO_MAXIMO_ENTRE_SILENCIOS_S = 0.06;
export function unirSilencios(partes: SilencioReal[], duracionMinima_s: number, huecoMaximo_s = HUECO_MAXIMO_ENTRE_SILENCIOS_S): SilencioReal[] {
  const unidas: SilencioReal[] = [];
  for (const p of [...partes].sort((a, b) => a.inicio_s - b.inicio_s)) {
    const ultima = unidas[unidas.length - 1];
    if (ultima && p.inicio_s - ultima.fin_s <= huecoMaximo_s) ultima.fin_s = Math.max(ultima.fin_s, p.fin_s);
    else unidas.push({ ...p });
  }
  return unidas.filter((s) => s.fin_s - s.inicio_s >= duracionMinima_s);
}

export async function detectarSilenciosReales(audio: ArrayBuffer, opciones: { umbralRuidoDb?: number; duracionMinima_s?: number } = {}): Promise<SilencioReal[]> {
  const { umbralRuidoDb = UMBRAL_RUIDO_DB, duracionMinima_s = DURACION_MINIMA_S } = opciones;
  const rutaTemporal = join(tmpdir(), `quiubot-voz-${randomUUID()}.mp3`);
  await writeFile(rutaTemporal, Buffer.from(audio));
  try {
    const resultado = await getSilentParts({
      src: rutaTemporal,
      minDurationInSeconds: 0.02, // pedazos chicos: se unen abajo
      noiseThresholdInDecibels: umbralRuidoDb,
    });
    return unirSilencios(resultado.silentParts.map((p) => ({ inicio_s: p.startInSeconds, fin_s: p.endInSeconds })), duracionMinima_s);
  } finally {
    await unlink(rutaTemporal).catch(() => {});
  }
}

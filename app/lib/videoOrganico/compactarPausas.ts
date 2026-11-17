import type { PalabraConTiempo } from "./generarVoz";
import type { SilencioReal } from "./detectarSilenciosReales";

// Fase B v2.0, ronda I (escuchó el reel real en staging, 18 nov 2026).
// La ronda H decidía DÓNDE cortar a partir de los huecos entre los
// tiempos de PALABRA de Whisper -- esos tiempos son una alineación
// aproximada (hay palabras reales con inicio_s===fin_s: "botón",
// "anuncio", "atención", "mejorar"), nunca una medición real del
// audio. Cortar justo en ese límite impreciso mordió palabras reales
// ("conecta", "responde", "Quiubot") en un reel real, sobre todo en
// los bordes entre escenas (donde la ronda H nunca aplicó margen,
// asumiendo que ese borde "siempre se cortó ahí, con la misma
// precisión de Whisper de siempre" -- un supuesto que resultó falso).
//
// Enfoque nuevo: el silencio se mide en la FORMA DE ONDA real
// (detectarSilenciosReales.ts, sobre el propio ffmpeg que Remotion ya
// empaqueta), nunca se infiere de dónde Whisper CREE que empieza o
// termina una palabra. Solo se recorta DENTRO de un tramo que esa
// medición real ya confirmó que es silencio -- nunca se toca nada
// fuera de ahí, así que jamás se puede morder una palabra real, sin
// importar si el corte cae en medio de una escena o entre dos
// distintas: ambos casos son, a partir de ahora, exactamente el mismo
// caso. Los tiempos de Whisper solo sirven para (a) decidir si un
// silencio real es "entre frases/escenas" o "dentro de una frase"
// (mirando si la palabra de antes termina en puntuación fuerte, o si
// las dos palabras son de escenas distintas) y (b) re-ubicar cada
// palabra en la línea de tiempo ya compactada, para sincronizar
// subtítulos y eventos -- nunca para decidir el corte en sí.
//
// Nunca se edita el archivo de audio. Cada "tramo" conservado sigue
// siendo una extracción directa del archivo ORIGINAL (campo
// "original"), solo que ahora puede haber más de uno por escena --
// ReelAutomatico.tsx coloca cada uno en su posición COMPACTADA (campo
// "compactado") dentro del Sequence de su propia escena.
export type PalabraCompactada = {
  texto: string;
  original: { inicio_s: number; fin_s: number };
  compactado: { inicio_s: number; fin_s: number };
};

export type TramoAudio = { original: { inicio_s: number; fin_s: number }; compactado: { inicio_s: number; fin_s: number } };

// Dentro de una misma frase: nunca más de un cuarto de segundo (igual
// que la ronda H). Entre frases/escenas: un respiro real, pedido
// explícito tras escuchar el reel (sonaba "mordido", no solo
// "apretado") -- el objetivo (0.4s) cae en el centro del rango
// pedido (0.35-0.45s).
export const PAUSA_DENTRO_DE_FRASE_S = 0.25;
export const PAUSA_ENTRE_FRASES_S = 0.4;

// Tolerancia de desacuerdo entre lo que ffmpeg mide como silencio y lo
// que Whisper cree que dura una palabra -- las dos mediciones nunca
// coinciden al milisegundo (confirmado real: ffmpeg detectó el mismo
// hueco entre escenas que Whisper, pero con bordes ~20-80ms distintos
// a cada lado). Un silencio real que no calza con NINGÚN hueco de
// palabras (más allá de esta tolerancia) nunca se recorta -- más
// seguro dejarlo intacto que arriesgar con un emparejamiento dudoso.
const TOLERANCIA_EMPAREJAMIENTO_S = 0.05;

type Remocion = { inicioOriginal: number; finOriginal: number; magnitud: number };

export function compactarConSilenciosReales(
  palabras: PalabraConTiempo[],
  silencios: SilencioReal[],
  escenaIndicePorPalabra: number[],
  opciones: { pausaDentroDeFrase_s?: number; pausaEntreFrases_s?: number } = {}
): { palabras: PalabraCompactada[]; tramosPorEscena: TramoAudio[][] } {
  if (palabras.length === 0) return { palabras: [], tramosPorEscena: [] };
  const pausaFrase = opciones.pausaDentroDeFrase_s ?? PAUSA_DENTRO_DE_FRASE_S;
  const pausaEntreFrases = opciones.pausaEntreFrases_s ?? PAUSA_ENTRE_FRASES_S;

  const remociones: Remocion[] = [];
  const primeraPalabra = palabras[0];
  const ultimaPalabra = palabras[palabras.length - 1];

  for (const s of silencios) {
    // Silencio antes de la primera palabra -- el gancho debe arrancar
    // en (casi) 0, sin importar cuánto dure este tramo inicial.
    if (s.fin_s <= primeraPalabra.inicio_s + TOLERANCIA_EMPAREJAMIENTO_S) {
      const finReal = Math.min(s.fin_s, primeraPalabra.inicio_s);
      if (finReal > 1e-6) remociones.push({ inicioOriginal: 0, finOriginal: finReal, magnitud: finReal });
      continue;
    }
    // Silencio después de la última palabra -- no afecta nada del
    // contenido hablado, se ignora (no hace falta recortar la cola).
    if (s.inicio_s >= ultimaPalabra.fin_s - TOLERANCIA_EMPAREJAMIENTO_S) continue;

    let i = -1;
    for (let k = 0; k < palabras.length - 1; k++) {
      if (s.inicio_s >= palabras[k].fin_s - TOLERANCIA_EMPAREJAMIENTO_S && s.fin_s <= palabras[k + 1].inicio_s + TOLERANCIA_EMPAREJAMIENTO_S) {
        i = k;
        break;
      }
    }
    if (i === -1) continue; // ambiguo, nunca se toca

    const distintaEscena = escenaIndicePorPalabra[i] !== escenaIndicePorPalabra[i + 1];
    const terminaEnPuntuacionFuerte = /[.?!;]$/.test(palabras[i].texto.trim());
    const esLimiteDeFrase = distintaEscena || terminaEnPuntuacionFuerte;
    const duracion = s.fin_s - s.inicio_s;
    const objetivo = esLimiteDeFrase ? pausaEntreFrases : Math.min(duracion, pausaFrase);
    if (duracion <= objetivo) continue;

    const recorte = duracion - objetivo;
    remociones.push({ inicioOriginal: s.inicio_s + objetivo / 2, finOriginal: s.fin_s - objetivo / 2, magnitud: recorte });
  }

  remociones.sort((a, b) => a.inicioOriginal - b.inicioOriginal);

  function corrimientoEn(tOriginal: number): number {
    let total = 0;
    for (const r of remociones) {
      if (r.finOriginal <= tOriginal + 1e-9) total += r.magnitud;
      else break;
    }
    return total;
  }

  const palabrasCompactadas: PalabraCompactada[] = palabras.map((p) => ({
    texto: p.texto,
    original: { inicio_s: p.inicio_s, fin_s: p.fin_s },
    compactado: { inicio_s: p.inicio_s - corrimientoEn(p.inicio_s), fin_s: p.fin_s - corrimientoEn(p.fin_s) },
  }));

  // Puntos de separación de tramos: los 2 bordes de cada remoción, más
  // (siempre) un punto en cada límite de escena -- aunque ese límite
  // no haya necesitado recorte (el hueco real ya estaba dentro del
  // objetivo), ReelAutomatico.tsx igual necesita un <CapaVoz> propio
  // por escena (cada una vive en su propio Sequence). Ese punto
  // "sin edición" no mueve nada (mismo original y compactado), así que
  // no hace falta fundido ahí -- pero CapaVoz ya aplica uno mínimo a
  // TODOS los tramos, así que no hay que distinguir el caso.
  const puntos = new Set<number>([0]);
  for (const r of remociones) {
    puntos.add(r.inicioOriginal);
    puntos.add(r.finOriginal);
  }
  for (let i = 0; i < palabras.length - 1; i++) {
    if (escenaIndicePorPalabra[i] !== escenaIndicePorPalabra[i + 1]) {
      const yaCubierto = remociones.some((r) => r.inicioOriginal >= palabras[i].fin_s - TOLERANCIA_EMPAREJAMIENTO_S && r.finOriginal <= palabras[i + 1].inicio_s + TOLERANCIA_EMPAREJAMIENTO_S);
      if (!yaCubierto) puntos.add((palabras[i].fin_s + palabras[i + 1].inicio_s) / 2);
    }
  }
  const finalDeAudio = Math.max(ultimaPalabra.fin_s, ...silencios.map((s) => s.fin_s));
  puntos.add(finalDeAudio);

  const ordenados = [...puntos].sort((a, b) => a - b);
  const esRemocion = (desde: number, hasta: number) => remociones.some((r) => Math.abs(r.inicioOriginal - desde) < 1e-6 && Math.abs(r.finOriginal - hasta) < 1e-6);

  const tramosGlobales: TramoAudio[] = [];
  for (let k = 0; k < ordenados.length - 1; k++) {
    const desde = ordenados[k];
    const hasta = ordenados[k + 1];
    if (hasta - desde < 1e-9) continue;
    if (esRemocion(desde, hasta)) continue;
    tramosGlobales.push({
      original: { inicio_s: desde, fin_s: hasta },
      compactado: { inicio_s: desde - corrimientoEn(desde), fin_s: hasta - corrimientoEn(hasta) },
    });
  }

  // Cada tramo global pertenece exactamente a UNA escena: la de la
  // última palabra cuyo inicio (original) no pasa de su propio punto
  // medio (por construcción, ningún tramo cruza un límite de escena --
  // siempre se forzó un punto de corte ahí arriba).
  const tramosPorEscena: TramoAudio[][] = Array.from({ length: Math.max(...escenaIndicePorPalabra) + 1 }, () => []);
  for (const tramo of tramosGlobales) {
    const medio = (tramo.original.inicio_s + tramo.original.fin_s) / 2;
    let indiceEscena = escenaIndicePorPalabra[0];
    for (let i = 0; i < palabras.length; i++) {
      if (palabras[i].inicio_s <= medio) indiceEscena = escenaIndicePorPalabra[i];
      else break;
    }
    tramosPorEscena[indiceEscena].push(tramo);
  }

  return { palabras: palabrasCompactadas, tramosPorEscena };
}

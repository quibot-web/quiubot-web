import type { PalabraConTiempo } from "./generarVoz";

// Fase B v2.0, ronda H (revisión de staging, 16 nov 2026). Bug real
// confirmado leyendo un guion real generado de punta a punta: las
// palabras que Whisper alinea pueden tener un hueco interno más largo
// que el que un reel debería mostrar -- ej. "mensajes" (termina en
// 1.06s) -> "aunque" (empieza en 1.62s), 0.56s de silencio real DENTRO
// de una sola escena (ReelAutomatico.tsx reproduce cada escena como
// un solo tramo continuo de audio, así que ese hueco SÍ se escucha).
// El hueco ENTRE escenas distintas (ej. fin_s de e1=3.38, inicio_s de
// e2=4.24) no tiene el mismo problema -- cada escena ya reproduce
// SOLO su propio tramo de palabras, así que ese hueco nunca se oye
// (duracionReelAutomaticoEnCuadros() suma (fin_s-inicio_s) por
// escena, nunca el tiempo total de la toma cruda). Esta función de
// todos modos no distingue "mismo hueco" de "hueco entre escenas" --
// no necesita saberlo, cualquier hueco (de la toma cruda) por encima
// de maxPausa_s se recorta igual, esté donde esté.
//
// Enfoque: NUNCA se edita el archivo de audio. Se recalculan los
// tiempos de cada palabra a una línea de tiempo "compactada" (más
// corta) donde ningún hueco entre palabras consecutivas supera
// maxPausa_s -- el contenido real de cada palabra (su propia
// duración) nunca cambia, solo se la corre hacia atrás lo que haga
// falta. Quien reproduce el audio (ReelAutomatico.tsx) sigue
// extrayendo del archivo ORIGINAL (campo "original"), solo que ahora
// puede necesitar varios tramos por escena en vez de uno solo --ver
// construirSegmentosAudio() más abajo-- cada uno colocado en su
// posición COMPACTADA (campo "compactado").
export type PalabraCompactada = {
  texto: string;
  original: { inicio_s: number; fin_s: number };
  compactado: { inicio_s: number; fin_s: number };
};

export const MAX_PAUSA_S = 0.25;

export function compactarPausas(palabras: PalabraConTiempo[], maxPausa_s: number = MAX_PAUSA_S): PalabraCompactada[] {
  let corrimiento = 0;
  let finOriginalAnterior: number | null = null;

  return palabras.map((p) => {
    if (finOriginalAnterior !== null) {
      const gap = p.inicio_s - finOriginalAnterior;
      if (gap > maxPausa_s) corrimiento += gap - maxPausa_s;
    }
    finOriginalAnterior = p.fin_s;
    return {
      texto: p.texto,
      original: { inicio_s: p.inicio_s, fin_s: p.fin_s },
      compactado: { inicio_s: p.inicio_s - corrimiento, fin_s: p.fin_s - corrimiento },
    };
  });
}

// Margen de seguridad en cada punto de CORTE (60-80ms, mitad del
// rango pedido) -- Whisper no mide con precisión perfecta (hay
// palabras reales con inicio_s===fin_s en guiones reales: "botón",
// "anuncio", "atención", "mejorar"). Cortar justo en el límite medido
// de una palabra arriesga morder su cola/cabeza real. Como cada corte
// solo ocurre donde el hueco ORIGINAL ya superó maxPausa_s (0.25s) --
// y 2×margenCorte_s <= maxPausa_s --, extender el tramo guardado hacia
// AFUERA (hacia el silencio real que ya existe a los dos lados del
// corte) nunca muerde habla real y nunca se come el silencio objetivo
// entre tramos: solo cambia CUÁNTO de ese silencio real se conserva
// como audio (en vez de puro corte en cero) vs. cuánto queda como
// silencio digital puro entre los dos <CapaVoz> consecutivos.
export const MARGEN_CORTE_S = 0.07;

// Por escena: agrupa sus propias palabras (ya compactadas) en
// "tramos" -- cada vez que el hueco ORIGINAL entre dos palabras
// consecutivas de esa escena superó maxPausa_s, ahí hay que cortar
// (ese tramo de la toma cruda ya no es contiguo con el siguiente en
// el tiempo compactado, hace falta un <CapaVoz> aparte para saltar el
// sobrante). Si una escena no tiene ningún hueco así, da exactamente
// 1 tramo -- mismo comportamiento de hoy (una sola extracción
// continua por escena).
//
// margenAlInicio/margenAlFinal: si el primer/último tramo de ESTA
// escena también es un "corte" real desde el punto de vista del
// REEL completo -- ej. el primer tramo de e2 linda con el fin de e1,
// que en la práctica siempre es un hueco grande (cada escena es su
// propia oración) aunque, visto solo con las palabras de e2, no haya
// ningún hueco ahí adentro. El caller (quien ya sabe si esta escena es
// la primera/última del reel) decide esto -- por defecto true (más
// seguro: aplicar el margen) salvo en los 2 bordes reales del reel
// completo, donde no hay silencio fuente de dónde sacar margen antes
// de la primera palabra o después de la última.
export type TramoAudio = { original: { inicio_s: number; fin_s: number }; compactado: { inicio_s: number; fin_s: number } };

export function construirTramosAudio(
  palabrasDeEscena: PalabraCompactada[],
  opciones: { maxPausa_s?: number; margenCorte_s?: number; margenAlInicio?: boolean; margenAlFinal?: boolean } = {}
): TramoAudio[] {
  const { maxPausa_s = MAX_PAUSA_S, margenCorte_s = MARGEN_CORTE_S, margenAlInicio = true, margenAlFinal = true } = opciones;
  if (palabrasDeEscena.length === 0) return [];

  const crudos: TramoAudio[] = [];
  let inicioTramo = palabrasDeEscena[0];
  let finTramo = palabrasDeEscena[0];

  for (let i = 1; i < palabrasDeEscena.length; i++) {
    const anterior = palabrasDeEscena[i - 1];
    const actual = palabrasDeEscena[i];
    const gapOriginal = actual.original.inicio_s - anterior.original.fin_s;
    if (gapOriginal > maxPausa_s) {
      crudos.push({
        original: { inicio_s: inicioTramo.original.inicio_s, fin_s: finTramo.original.fin_s },
        compactado: { inicio_s: inicioTramo.compactado.inicio_s, fin_s: finTramo.compactado.fin_s },
      });
      inicioTramo = actual;
    }
    finTramo = actual;
  }
  crudos.push({
    original: { inicio_s: inicioTramo.original.inicio_s, fin_s: finTramo.original.fin_s },
    compactado: { inicio_s: inicioTramo.compactado.inicio_s, fin_s: finTramo.compactado.fin_s },
  });

  return crudos.map((tramo, i) => {
    const esPrimero = i === 0;
    const esUltimo = i === crudos.length - 1;
    // Un corte INTERNO (no es ni el primer ni el último tramo de esta
    // escena) siempre lleva margen -- es, sin excepción, un punto
    // donde se saltó un hueco real. En los bordes, el margen depende
    // de si ese borde también linda con un corte visto desde el reel
    // completo (lo decide el caller).
    const margenAntes = esPrimero ? (margenAlInicio ? margenCorte_s : 0) : margenCorte_s;
    const margenDespues = esUltimo ? (margenAlFinal ? margenCorte_s : 0) : margenCorte_s;
    return {
      original: { inicio_s: tramo.original.inicio_s - margenAntes, fin_s: tramo.original.fin_s + margenDespues },
      compactado: { inicio_s: tramo.compactado.inicio_s - margenAntes, fin_s: tramo.compactado.fin_s + margenDespues },
    };
  });
}

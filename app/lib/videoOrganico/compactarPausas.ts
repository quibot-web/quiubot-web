import type { PalabraConTiempo } from "./generarVoz";
import type { SilencioReal } from "./detectarSilenciosReales";
import type { Guion } from "@/video/guion.schema";

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

// Ronda J: techo duro pedido explícito ("nunca más de 0.5s") -- red de
// seguridad final, independiente de que la clasificación de arriba
// (límite de frase vs dentro de frase) se calcule bien. Con los
// objetivos de arriba (0.25/0.4) nunca se activa en el caso normal;
// protege si algún día opciones.pausaEntreFrases_s se configura más
// alto, o aparece un caso borde no previsto.
const PAUSA_MAXIMA_ABSOLUTA_S = 0.5;

// Tolerancia de desacuerdo entre lo que ffmpeg mide como silencio y lo
// que Whisper cree que dura una palabra -- las dos mediciones nunca
// coinciden al milisegundo (confirmado real: ffmpeg detectó el mismo
// hueco entre escenas que Whisper, pero con bordes ~20-80ms distintos
// a cada lado). Un silencio real que no calza con NINGÚN hueco de
// palabras (más allá de esta tolerancia) nunca se recorta -- más
// seguro dejarlo intacto que arriesgar con un emparejamiento dudoso.
const TOLERANCIA_EMPAREJAMIENTO_S = 0.05;

type Remocion = { inicioOriginal: number; finOriginal: number; magnitud: number };

// Zona que es silencio real y hueco entre palabras a la vez: por debajo de
// esto el emparejamiento se considera ambiguo y no se toca.
const ZONA_SEGURA_MINIMA_S = 0.15;

// Corrección de alineación (prototipo ilustrado, 18 nov 2026): Whisper a
// veces estira una palabra sobre un silencio real ("y" reportada en
// 1.04-1.84 con silencio real 0.97-1.63 -- una palabra no dura 0.6s en
// silencio). Si un silencio real de 0.25s o más tapa más de la mitad de
// la palabra por UNO de sus extremos, ese borde se mueve al borde del
// silencio. Si el silencio la tapa entera o es corto, no se toca.
const SILENCIO_MINIMO_CORRECCION_S = 0.25;
export function corregirPalabrasConSilencios(palabras: PalabraConTiempo[], silencios: SilencioReal[]): PalabraConTiempo[] {
  return palabras.map((p) => {
    let { inicio_s, fin_s } = p;
    for (const s of silencios) {
      if (s.fin_s - s.inicio_s < SILENCIO_MINIMO_CORRECCION_S) continue;
      const superposicion = Math.min(fin_s, s.fin_s) - Math.max(inicio_s, s.inicio_s);
      if (superposicion < SILENCIO_MINIMO_CORRECCION_S || superposicion < 0.5 * (fin_s - inicio_s)) continue;
      const tapaInicio = s.inicio_s <= inicio_s + TOLERANCIA_EMPAREJAMIENTO_S && s.fin_s < fin_s - TOLERANCIA_EMPAREJAMIENTO_S;
      const tapaFin = s.fin_s >= fin_s - TOLERANCIA_EMPAREJAMIENTO_S && s.inicio_s > inicio_s + TOLERANCIA_EMPAREJAMIENTO_S;
      if (tapaInicio) inicio_s = s.fin_s;
      else if (tapaFin) fin_s = s.inicio_s;
    }
    return inicio_s === p.inicio_s && fin_s === p.fin_s ? p : { ...p, inicio_s, fin_s };
  });
}

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

    // Encuentra la última palabra que ya había empezado para cuando
    // arranca este silencio real. Esto es SOLO para clasificar el tipo
    // de pausa (límite de frase vs dentro de frase) -- el corte en sí
    // siempre usa s.inicio_s/s.fin_s (el silencio real medido), nunca
    // estos límites de palabra, así que ensanchar esta búsqueda no
    // puede volver a morder una palabra.
    let i = -1;
    for (let k = 0; k < palabras.length; k++) {
      if (palabras[k].inicio_s <= s.inicio_s + TOLERANCIA_EMPAREJAMIENTO_S) i = k;
      else break;
    }
    // Caso real (prototipo ilustrado, 18 nov 2026): Whisper dejó
    // "volver." con duración cero justo en el borde del silencio real
    // (33.10-33.10 con el silencio desde 33.05), y la regla de arriba
    // emparejó el silencio con el hueco "a -> volver" (casi cero) en vez
    // de "volver -> Sigue" -- quedaron 0.81s de silencio real sin
    // recortar. Se prefiere el hueco entre palabras con el que el
    // silencio real MÁS se superpone; si no se superpone con ninguno, se
    // queda la regla de siempre.
    let mejorSuperposicion = 0;
    for (let k = 0; k < palabras.length - 1; k++) {
      const superposicion = Math.min(palabras[k + 1].inicio_s, s.fin_s) - Math.max(palabras[k].fin_s, s.inicio_s);
      if (superposicion > mejorSuperposicion + 1e-9) {
        mejorSuperposicion = superposicion;
        i = k;
      }
    }
    if (i === -1 || i >= palabras.length - 1) continue; // no debería pasar (ya cubierto por los 2 casos de arriba) -- no se toca

    const siguiente = i + 1;
    // Caso real que antes se dejaba sin tocar (mordió "conecta"/
    // "responde"/"Quiubot" en la ronda H, y de nuevo dejó un hueco de
    // 0.73s sin comprimir en la ronda I): Whisper reporta que una
    // palabra se extiende varios cientos de ms DESPUÉS de donde ffmpeg
    // ya mide silencio real (ej. real: "anuncio" fin_s=7.98 pero el
    // silencio real ya empezaba en 7.48). Eso es la imprecisión normal
    // de Whisper en el BORDE de una sola palabra, no un caso ambiguo --
    // sigue siendo seguro clasificar y comprimir. Solo es GENUINAMENTE
    // ambiguo (y por eso nunca se toca) cuando el hueco medido se mete
    // adentro de las DOS palabras vecinas a la vez -- ahí sí no separa
    // nada real y cualquier emparejamiento sería una apuesta.
    const anteriorSeMeteAdentro = palabras[i].fin_s > s.inicio_s + TOLERANCIA_EMPAREJAMIENTO_S;
    const siguienteSeMeteAdentro = palabras[siguiente].inicio_s < s.fin_s - TOLERANCIA_EMPAREJAMIENTO_S;
    // Prototipo ilustrado (18 nov 2026): los dos bordes de Whisper se
    // metían ~90ms en un silencio real de 0.76s y se dejaba sin tocar.
    // Solo es ambiguo de verdad si la zona que es silencio real Y hueco
    // entre palabras a la vez es mínima; si es grande, el recorte (que
    // cae dentro del hueco de Whisper, centrado) no puede morder voz.
    const zonaSegura = Math.min(palabras[siguiente].inicio_s, s.fin_s) - Math.max(palabras[i].fin_s, s.inicio_s);
    if (anteriorSeMeteAdentro && siguienteSeMeteAdentro && zonaSegura < ZONA_SEGURA_MINIMA_S) continue; // ambiguo real, no tocar

    const distintaEscena = escenaIndicePorPalabra[i] !== escenaIndicePorPalabra[siguiente];
    const terminaEnPuntuacionFuerte = /[.?!;]$/.test(palabras[i].texto.trim());
    const esLimiteDeFrase = distintaEscena || terminaEnPuntuacionFuerte;

    // El silencio que detectó ffmpeg solo CONFIRMA que este hueco entre
    // palabras tiene silencio real adentro (ya se descartó arriba el
    // caso ambiguo) -- una vez confirmado, se compacta el hueco ENTERO
    // entre las dos palabras (de fin_s de la anterior a inicio_s de la
    // siguiente), no solo el sub-tramo que ffmpeg marcó. Caso real que
    // esto corrige: ffmpeg a veces deja de marcar silencio un poco
    // ANTES de que Whisper diga que la siguiente palabra ya empezó
    // (ej. real: el silencio mide hasta 12.902 pero "Tercero" recién
    // se reporta en 13.100) -- esos ~200ms de holgura sin clasificar no
    // son otra palabra (no hay ninguna palabra ahí, por construcción:
    // "palabras" es la lista completa y ordenada, sin huecos), así que
    // es seguro tratarlos igual que el silencio ya confirmado. Sin
    // este ajuste, esa holgura se sumaba AFUERA de cualquier objetivo y
    // el techo de 0.5s pedido explícito se rompía en la práctica
    // (medido real: hasta 0.63s).
    const inicioHueco = palabras[i].fin_s;
    const finHueco = palabras[siguiente].inicio_s;
    const duracion = finHueco - inicioHueco;
    const objetivo = Math.min(esLimiteDeFrase ? pausaEntreFrases : Math.min(duracion, pausaFrase), PAUSA_MAXIMA_ABSOLUTA_S);
    if (duracion <= objetivo) continue;

    const recorte = duracion - objetivo;
    remociones.push({ inicioOriginal: inicioHueco + objetivo / 2, finOriginal: finHueco - objetivo / 2, magnitud: recorte });
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

// Ronda J, punto B (revisión de escucha en staging): el control de
// calidad del arnés (render + visión + audio, ver
// AdminReelAutomaticoPruebaClient.tsx) antes llamaba a /guion desde
// cero en CADA reintento -- nuevo guion de la IA, nueva voz de TTS --
// aunque el ÚNICO hallazgo fuera un silencio largo. Carísimo e
// inútil: un reintento completo ni siquiera garantiza que el nuevo
// guion/toma tenga el mismo problema resuelto, cuando lo único que
// hacía falta era recompactar la MISMA voz ya generada con límites
// más estrictos. Esta función extrae exactamente la construcción de
// tiemposRender/palabrasPorEscena/segmentosAudio que antes vivía
// inline en route.ts, para que /guion y el nuevo endpoint de
// recompactación (que SOLO corre esto, nunca la IA ni generarVoz())
// compartan la misma lógica, una sola vez.
export function construirCamposDeTiempo(
  palabrasPorEscenaCrudo: { escena_id: string; palabras: PalabraConTiempo[] }[],
  silencios: SilencioReal[],
  opciones: { pausaDentroDeFrase_s?: number; pausaEntreFrases_s?: number } = {}
): {
  tiemposRender: NonNullable<Guion["tiemposRender"]>;
  palabrasPorEscena: NonNullable<Guion["palabrasPorEscena"]>;
  segmentosAudio: NonNullable<Guion["segmentosAudio"]>;
  palabrasFlat: PalabraConTiempo[];
  tramosPorEscena: TramoAudio[][];
} {
  const cantidadesPorEscena = palabrasPorEscenaCrudo.map((p) => p.palabras.length);
  // Bordes de Whisper corregidos con los silencios reales (ver
  // corregirPalabrasConSilencios); lo que se devuelve como palabrasFlat
  // (y lo que revisa verificarPalabrasCompletas) son las corregidas.
  const palabrasFlat = corregirPalabrasConSilencios(
    palabrasPorEscenaCrudo.flatMap((p) => p.palabras),
    silencios
  );
  const escenaIndicePorPalabra = palabrasPorEscenaCrudo.flatMap((p, i) => p.palabras.map(() => i));
  const { palabras: palabrasCompactadas, tramosPorEscena } = compactarConSilenciosReales(palabrasFlat, silencios, escenaIndicePorPalabra, opciones);

  const tiemposRender: NonNullable<Guion["tiemposRender"]> = [];
  const palabrasPorEscena: NonNullable<Guion["palabrasPorEscena"]> = [];
  const segmentosAudio: NonNullable<Guion["segmentosAudio"]> = [];
  let cursor = 0;
  for (let i = 0; i < palabrasPorEscenaCrudo.length; i++) {
    const escenaId = palabrasPorEscenaCrudo[i].escena_id;
    const cantidad = cantidadesPorEscena[i];
    const deEscena = palabrasCompactadas.slice(cursor, cursor + cantidad);
    cursor += cantidad;

    palabrasPorEscena.push({ escena_id: escenaId, palabras: deEscena.map((p) => ({ texto: p.texto, inicio_s: p.compactado.inicio_s, fin_s: p.compactado.fin_s })) });

    const tramos = tramosPorEscena[i] ?? [];
    if (tramos.length === 0) {
      tiemposRender.push({ escena_id: escenaId, inicio_s: 0, fin_s: 0 });
      segmentosAudio.push({ escena_id: escenaId, tramos: [] });
      continue;
    }

    tiemposRender.push({ escena_id: escenaId, inicio_s: tramos[0].compactado.inicio_s, fin_s: tramos[tramos.length - 1].compactado.fin_s });
    segmentosAudio.push({ escena_id: escenaId, tramos });
  }

  return { tiemposRender, palabrasPorEscena, segmentosAudio, palabrasFlat, tramosPorEscena };
}

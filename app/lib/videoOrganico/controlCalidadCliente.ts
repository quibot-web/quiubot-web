import { silenciosLargosDesdeNivelesDb, type SilencioLargo } from "./encontrarSilenciosLargos";
import { controlarArranquesDeVoz, type AudioMono, type TramoVoz } from "./controlArranquesVoz";

// Extraído de app/admin/reel-automatico-prueba/AdminReelAutomaticoPruebaClient.tsx
// (paso 3 de la integración a /contenido, plan en memoria
// plan_integracion_contenido_organico_fase_b_v2) -- esta cadena de
// control de calidad (extracción de cuadros con tiempos límite reales,
// silencio del audio ya mezclado, clasificación pausas-vs-contenido)
// ya se probó en staging durante varias rondas reales. Esta es esa
// MISMA implementación, sin cambios de comportamiento, para que tanto
// el arnés admin como ColaDeRender.tsx (/contenido real) la llamen una
// sola vez.

export type HallazgoVision = { cuadro: string; pantalla_vacia: boolean; texto_superpuesto: boolean; contraste_bajo: boolean; nota: string };
export type HallazgoConImagen = HallazgoVision & { dataUrl?: string };

const TIMEOUT_METADATA_MS = 10_000;
const TIMEOUT_SEEK_MS = 5_000;
const TIMEOUT_RVFC_MS = 1_500;
const TIMEOUT_CUADRO_TOTAL_MS = 8_000;
const TIMEOUT_AUDIO_MS = 10_000;

export function conTimeout<T>(promesa: Promise<T>, ms: number, mensajeTimeout: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(mensajeTimeout)), ms);
  });
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

function esperarEventoVideo(video: HTMLVideoElement, evento: "loadedmetadata" | "seeked", ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    let resuelto = false;
    function limpiar() {
      video.removeEventListener(evento, onEvento);
      clearTimeout(timer);
    }
    function onEvento() {
      if (resuelto) return;
      resuelto = true;
      limpiar();
      resolve(true);
    }
    const timer = setTimeout(() => {
      if (resuelto) return;
      resuelto = true;
      limpiar();
      resolve(false);
    }, ms);
    video.addEventListener(evento, onEvento);
  });
}

function esperarCuadroPresentado(video: HTMLVideoElement, ms: number): Promise<boolean> {
  if (typeof video.requestVideoFrameCallback !== "function") {
    return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(() => resolve(true), 50))));
  }
  return new Promise((resolve) => {
    let resuelto = false;
    const timer = setTimeout(() => {
      if (resuelto) return;
      resuelto = true;
      resolve(false);
    }, ms);
    video.requestVideoFrameCallback(() => {
      if (resuelto) return;
      resuelto = true;
      clearTimeout(timer);
      resolve(true);
    });
  });
}

async function extraerUnCuadro(video: HTMLVideoElement, canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, segundo: number, duracionS: number): Promise<string | null> {
  const objetivo = Math.min(Math.max(segundo, 0), Math.max(duracionS - 0.05, 0));
  video.currentTime = objetivo;
  const buscoATiempo = await esperarEventoVideo(video, "seeked", TIMEOUT_SEEK_MS);
  if (!buscoATiempo) return null;
  await esperarCuadroPresentado(video, TIMEOUT_RVFC_MS);
  try {
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.85);
  } catch {
    return null;
  }
}

export async function extraerCuadrosClave(
  blob: Blob,
  duracionS: number,
  etiquetasYSegundos: { etiqueta: string; segundo: number }[],
  onProgreso: (actual: number, total: number) => void
): Promise<{ etiqueta: string; dataUrl: string | null }[]> {
  const url = URL.createObjectURL(blob);
  try {
    const video = document.createElement("video");
    video.src = url;
    video.muted = true;
    video.preload = "auto";

    const cargoMetadata = await esperarEventoVideo(video, "loadedmetadata", TIMEOUT_METADATA_MS);
    if (!cargoMetadata) throw new Error("El video renderizado no cargó a tiempo para extraer cuadros.");

    await video.play().then(() => video.pause()).catch(() => {});

    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1080;
    canvas.height = video.videoHeight || 1920;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("No se pudo preparar el lienzo para extraer cuadros.");

    const resultados: { etiqueta: string; dataUrl: string | null }[] = [];
    for (let i = 0; i < etiquetasYSegundos.length; i++) {
      const { etiqueta, segundo } = etiquetasYSegundos[i];
      onProgreso(i + 1, etiquetasYSegundos.length);
      let dataUrl: string | null;
      try {
        dataUrl = await conTimeout(extraerUnCuadro(video, canvas, ctx, segundo, duracionS), TIMEOUT_CUADRO_TOTAL_MS, "timeout");
      } catch {
        dataUrl = null;
      }
      resultados.push({ etiqueta, dataUrl });
    }
    return resultados;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type ResultadoSilencio = "silencioso" | "con_audio" | "no_verificado";

async function audioEstaEnSilencioInterno(blob: Blob): Promise<ResultadoSilencio> {
  const buffer = await blob.arrayBuffer();
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const contexto = new AudioContextCtor();
  try {
    const decodificado = await contexto.decodeAudioData(buffer.slice(0));
    let sumaCuadrados = 0;
    let total = 0;
    for (let canal = 0; canal < decodificado.numberOfChannels; canal++) {
      const datos = decodificado.getChannelData(canal);
      for (let i = 0; i < datos.length; i += 50) {
        sumaCuadrados += datos[i] * datos[i];
        total += 1;
      }
    }
    if (total === 0) return "silencioso";
    const rms = Math.sqrt(sumaCuadrados / total);
    const db = 20 * Math.log10(rms || 1e-10);
    return db < -45 ? "silencioso" : "con_audio";
  } finally {
    await contexto.close().catch(() => {});
  }
}

export async function audioEstaEnSilencio(blob: Blob): Promise<ResultadoSilencio> {
  try {
    return await conTimeout(audioEstaEnSilencioInterno(blob), TIMEOUT_AUDIO_MS, "timeout");
  } catch {
    return "no_verificado";
  }
}

const UMBRAL_SILENCIO_DB = -45;
export const DURACION_MINIMA_SILENCIO_S = 0.6;
const VENTANA_ESCANEO_S = 0.05;

async function encontrarSilenciosLargosInterno(blob: Blob, duracionMinima_s: number = DURACION_MINIMA_SILENCIO_S): Promise<SilencioLargo[]> {
  const buffer = await blob.arrayBuffer();
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const contexto = new AudioContextCtor();
  try {
    const decodificado = await contexto.decodeAudioData(buffer.slice(0));
    const sampleRate = decodificado.sampleRate;
    const tamanoVentana = Math.max(1, Math.round(VENTANA_ESCANEO_S * sampleRate));
    const canales = Array.from({ length: decodificado.numberOfChannels }, (_, c) => decodificado.getChannelData(c));
    const totalMuestras = decodificado.length;

    const nivelesDb: number[] = [];
    for (let i = 0; i < totalMuestras; i += tamanoVentana) {
      const fin = Math.min(i + tamanoVentana, totalMuestras);
      let sumaCuadrados = 0;
      let total = 0;
      for (const datos of canales) {
        for (let j = i; j < fin; j++) {
          sumaCuadrados += datos[j] * datos[j];
          total += 1;
        }
      }
      const rms = Math.sqrt(sumaCuadrados / Math.max(total, 1));
      nivelesDb.push(20 * Math.log10(rms || 1e-10));
    }

    return silenciosLargosDesdeNivelesDb(nivelesDb, VENTANA_ESCANEO_S, UMBRAL_SILENCIO_DB, duracionMinima_s);
  } finally {
    await contexto.close().catch(() => {});
  }
}

export async function encontrarSilenciosLargos(blob: Blob): Promise<SilencioLargo[] | "no_verificado"> {
  try {
    return await conTimeout(encontrarSilenciosLargosInterno(blob), TIMEOUT_AUDIO_MS, "timeout");
  } catch {
    return "no_verificado";
  }
}

export function combinarHallazgosConImagenes(hallazgos: HallazgoVision[], cuadros: { etiqueta: string; dataUrl: string }[]): HallazgoConImagen[] {
  if (hallazgos.length === cuadros.length) {
    return hallazgos.map((h, i) => ({ ...h, dataUrl: cuadros[i].dataUrl }));
  }
  const porEtiqueta = new Map(cuadros.map((c) => [c.etiqueta, c.dataUrl]));
  return hallazgos.map((h) => ({ ...h, dataUrl: porEtiqueta.get(h.cuadro) }));
}

export function erroresDesdeQC(hallazgos: HallazgoVision[], silencio: ResultadoSilencio, silenciosLargos: SilencioLargo[] | "no_verificado"): string[] {
  const errores = hallazgos
    .filter((h) => h.pantalla_vacia || h.texto_superpuesto || h.contraste_bajo)
    .map((h) => `El control de calidad (visión) encontró un problema real en el cuadro "${h.cuadro}": ${h.nota}`);
  if (silencio === "silencioso") errores.push("El audio final mezclado salió en silencio -- revisa que ninguna narracion haya quedado vacía o con un texto raro para la voz.");
  if (Array.isArray(silenciosLargos)) {
    for (const s of silenciosLargos) {
      errores.push(`El audio final mezclado tiene ${(s.fin_s - s.inicio_s).toFixed(2)}s de silencio real entre el segundo ${s.inicio_s.toFixed(2)} y ${s.fin_s.toFixed(2)} -- revisa compactarPausas()/las pausas de la narración ahí.`);
    }
  }
  return errores;
}

export function esSoloProblemaDePausas(hallazgos: HallazgoVision[], silencio: ResultadoSilencio, silenciosLargos: SilencioLargo[] | "no_verificado"): boolean {
  const hayProblemaVision = hallazgos.some((h) => h.pantalla_vacia || h.texto_superpuesto || h.contraste_bajo);
  const haySilencioLargo = Array.isArray(silenciosLargos) && silenciosLargos.length > 0;
  return !hayProblemaVision && silencio !== "silencioso" && haySilencioLargo;
}

// Compartida entre el arnés admin y ColaDeRender.tsx (/contenido real)
// -- hasta 3 intentos totales de control de calidad (el primer render
// + hasta 2 reintentos), igual en los 2 lugares. Un valor compartido
// evita que un lugar quede en 3 intentos y el otro en 1 por error de
// copiar-pegar (justo el bug real de la ronda M: /contenido
// recompactaba UNA vez y subía sin volver a verificar el resultado).
export const MAX_REINTENTOS_QC = 2;

// ---------- Control de la voz después del render (23 nov 2026) ----------
// Principal: energía de cada arranque de palabra del video contra la voz
// TTS original (controlArranquesVoz.ts). Segundo: Whisper sobre el audio
// final, solo para palabras que faltan del todo (ruta control-voz).

async function decodificarMono(buffer: ArrayBuffer): Promise<AudioMono> {
  const AudioContextCtor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const contexto = new AudioContextCtor();
  try {
    const d = await contexto.decodeAudioData(buffer.slice(0));
    const muestras = new Float32Array(d.length);
    for (let c = 0; c < d.numberOfChannels; c++) {
      const datos = d.getChannelData(c);
      for (let i = 0; i < d.length; i++) muestras[i] += datos[i] / d.numberOfChannels;
    }
    return { muestras, sampleRate: d.sampleRate };
  } finally {
    await contexto.close().catch(() => {});
  }
}

// WAV mono de 16 kHz (lo que necesita Whisper; ~32 KB por segundo).
export function aWav16k(audio: AudioMono): ArrayBuffer {
  const sr = 16000;
  const paso = audio.sampleRate / sr;
  const n = Math.floor(audio.muestras.length / paso);
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);
  const txt = (o: number, t: string) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  txt(0, "RIFF");
  v.setUint32(4, 36 + n * 2, true);
  txt(8, "WAVE");
  txt(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, sr, true);
  v.setUint32(28, sr * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  txt(36, "data");
  v.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) {
    const a = Math.floor(i * paso);
    const b = Math.max(a + 1, Math.floor((i + 1) * paso));
    let suma = 0;
    for (let j = a; j < b; j++) suma += audio.muestras[j] ?? 0;
    const x = Math.max(-1, Math.min(1, suma / (b - a)));
    v.setInt16(44 + i * 2, Math.round(x * 32767), true);
  }
  return buf;
}

export type GuionParaControlDeVoz = {
  vozUrl?: string;
  segmentosAudio?: { escena_id: string; tramos: TramoVoz[] }[];
  palabrasPorEscena?: { escena_id: string; palabras: { texto: string; inicio_s: number }[] }[];
};

export async function controlarVozDelVideo(params: { blob: Blob; guion: GuionParaControlDeVoz; piezaId: string }): Promise<string[]> {
  const { guion } = params;
  if (!guion.vozUrl || !guion.segmentosAudio?.length) return [];
  let final: AudioMono;
  let original: AudioMono;
  try {
    const resVoz = await fetch(guion.vozUrl, { mode: "cors" });
    if (!resVoz.ok) throw new Error(`la voz original respondió ${resVoz.status}`);
    [final, original] = await Promise.all([params.blob.arrayBuffer().then(decodificarMono), resVoz.arrayBuffer().then(decodificarMono)]);
  } catch (err) {
    // Nunca se aprueba sin medir: si no se pudo, no pasa.
    return [`No se pudo verificar la voz del video (${err instanceof Error ? err.message : "error al leer el audio"}).`];
  }
  const energia = controlarArranquesDeVoz({
    original,
    final,
    tramos: guion.segmentosAudio.flatMap((s) => s.tramos),
    palabras: guion.palabrasPorEscena?.flatMap((e) => e.palabras),
  });
  if (energia.hallazgos.length > 0) return energia.hallazgos;

  // Segundo control (Whisper). Si la transcripción no está disponible (red,
  // créditos de OpenAI), no bloquea: el control principal ya pasó.
  try {
    const form = new FormData();
    form.set("audio", new Blob([aWav16k(final)], { type: "audio/wav" }), "final.wav");
    const res = await fetch(`/api/contenido/${params.piezaId}/control-voz`, { method: "POST", body: form });
    if (!res.ok) return [];
    const data = (await res.json()) as { hallazgos?: string[] };
    return data.hallazgos ?? [];
  } catch {
    return [];
  }
}

export function limitesDeRecompactacion(intentosRecompactacion: number): { pausaEntreFrases_s: number; pausaDentroDeFrase_s: number } {
  return {
    pausaEntreFrases_s: Math.max(0.3, 0.4 - 0.05 * intentosRecompactacion),
    pausaDentroDeFrase_s: Math.max(0.15, 0.25 - 0.05 * intentosRecompactacion),
  };
}

// "voz": el control de la voz encontró un arranque cortado/corrido o una
// palabra faltante -> se vuelve a renderizar UNA vez; si falla de nuevo, error.
export type ClasificacionQC = { tipo: "aprobado" } | { tipo: "pausas" } | { tipo: "voz"; hallazgos: string[] } | { tipo: "rechazado"; hallazgos: string[] };

export type ResultadoLoopQC<TGuion, TBlob> = {
  aprobado: boolean;
  guion: TGuion;
  blob: TBlob;
  hallazgos: string[];
  intentosRecompactacion: number;
};

// Orquesta el MISMO loop que el arnés admin ya probó en staging: correr
// el control de calidad, y si lo único que falló fue un silencio largo,
// recompactar + volver a renderizar + VOLVER A CORRER el control de
// calidad sobre ese nuevo blob -- nunca subir/entregar un resultado
// recompactado sin reverificarlo. Extraído a función pura (en vez de
// vivir inline dentro de ColaDeRender.tsx) específicamente para poder
// probar con callbacks simulados que el loop SÍ vuelve a llamar a
// `correrQC` después de recompactar -- bug real de la ronda M: antes
// ColaDeRender.tsx recompactaba una vez y subía sin volver a este
// punto.
export async function ejecutarControlDeCalidadConReintentos<TGuion, TBlob>(params: {
  blobInicial: TBlob;
  guionInicial: TGuion;
  crudo: unknown;
  maxIntentos?: number;
  correrQC: (blob: TBlob, guion: TGuion) => Promise<ClasificacionQC>;
  recompactar: (guion: TGuion, crudo: unknown, limites: { pausaEntreFrases_s: number; pausaDentroDeFrase_s: number }) => Promise<TGuion | null>;
  rerenderizar: (guion: TGuion) => Promise<TBlob>;
}): Promise<ResultadoLoopQC<TGuion, TBlob>> {
  const maxIntentos = params.maxIntentos ?? MAX_REINTENTOS_QC + 1;
  let guion = params.guionInicial;
  let blob = params.blobInicial;
  let intentosRecompactacion = 0;
  let rerendersPorVoz = 0;
  let hallazgosFinal: string[] = [];

  for (let intento = 1; intento <= maxIntentos + rerendersPorVoz; intento++) {
    const resultadoQC = await params.correrQC(blob, guion);

    if (resultadoQC.tipo === "aprobado") {
      return { aprobado: true, guion, blob, hallazgos: [], intentosRecompactacion };
    }

    if (resultadoQC.tipo === "voz") {
      if (rerendersPorVoz === 0) {
        rerendersPorVoz += 1;
        blob = await params.rerenderizar(guion);
        continue;
      }
      hallazgosFinal = [`La voz del video no pasó el control dos veces: ${resultadoQC.hallazgos[0] ?? "sin detalle"}`, ...resultadoQC.hallazgos.slice(1)];
      break;
    }

    if (resultadoQC.tipo === "pausas" && params.crudo && intento < maxIntentos) {
      intentosRecompactacion += 1;
      const limites = limitesDeRecompactacion(intentosRecompactacion);
      const guionRecompactado = await params.recompactar(guion, params.crudo, limites);
      if (!guionRecompactado) {
        hallazgosFinal = ["No se pudo recompactar las pausas -- revisa este reel a mano."];
        break;
      }
      guion = guionRecompactado;
      blob = await params.rerenderizar(guion);
      continue;
    }

    hallazgosFinal =
      resultadoQC.tipo === "rechazado" ? resultadoQC.hallazgos : ["El audio siguió con pausas largas después de recompactar -- revisa este reel a mano."];
    break;
  }

  return { aprobado: false, guion, blob, hallazgos: hallazgosFinal, intentosRecompactacion };
}

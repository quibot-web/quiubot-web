"use client";
import { useRef, useState } from "react";
import type { Guion } from "@/video/guion.schema";
import { silenciosLargosDesdeNivelesDb, type SilencioLargo } from "@/app/lib/videoOrganico/encontrarSilenciosLargos";

// Fase B v2.0, paso 8 del plan -- arnés de prueba del único reel
// automático. Flujo real (nada mockeado): genera el guion con voz vía
// IA (narración + visual + eventos, voz real de generarVoz()) -> lo
// renderiza en el navegador (@remotion/web-renderer, mismo mecanismo
// real que ColaDeRender.tsx) -> extrae cuadros clave del mp4 ya
// renderizado -> control de calidad (silencio real de audio, medido
// acá; visión, en el servidor) -> si pasa, da el mp4 para descargar.
// Si no pasa, nunca entrega el mp4 -- muestra por qué.

type FaseArnes = "inactivo" | "generando_guion" | "renderizando" | "extrayendo_cuadros" | "control_calidad" | "listo" | "rechazado" | "error";

type HallazgoVision = { cuadro: string; pantalla_vacia: boolean; texto_superpuesto: boolean; contraste_bajo: boolean; nota: string };
// El cuadro real que vio el modelo, para poder confirmar a simple
// vista si un hallazgo es real o un falso positivo -- pedido explícito
// de Juan José tras el caso de "texto_superpuesto" en escena_3_mitad
// que no se pudo reproducir con un spike: antes de aflojar la
// definición otra vez hace falta ver el cuadro exacto que la disparó,
// no solo confiar en la nota en texto del modelo.
type HallazgoConImagen = HallazgoVision & { dataUrl?: string };

// "crudo" (ronda J): palabras de Whisper + silencios reales de ffmpeg
// ANTES de compactar -- se guarda tal cual (nunca se interpreta acá)
// para poder pedir una recompactación sola sobre la MISMA voz ya
// generada, sin volver a llamar a la IA ni a generarVoz().
type CrudoVoz = { palabrasPorEscenaCrudo: unknown; silencios: unknown };
type ResultadoGuion = { guion: Guion; pistaMusicaUrl: string | null; voz: string; puntajeAlineacion: number; intentosGuion: number; seRegeneroPorQC: boolean; crudo?: CrudoVoz };

const LICENCIA_REMOTION = "free-license";
// Plan punto 8: "si algo falla, se reintenta... hasta 2 veces". Son
// intentos de CONTROL DE CALIDAD (render + visión + audio), aparte de
// los intentos de validación estructural que ya corren dentro de cada
// llamada a /guion (MAX_REINTENTOS en esa ruta) -- 3 corridas
// completas en total como máximo (1 + 2 reintentos).
const MAX_REINTENTOS_QC = 2;

// Bug real reportado (staging, 16 nov 2026): el arnés se quedaba
// colgado para siempre en "extrayendo cuadros/revisando audio", tanto
// en Safari como en Chrome (con pestaña oculta o al frente). Causa
// real: "onseeked"/requestVideoFrameCallback pueden simplemente NUNCA
// disparar -- los navegadores frenan el decodificador de video y los
// callbacks de compositor cuando la pestaña pasa a segundo plano, y
// algunos (Safari) tienen fallas conocidas buscando sobre un <video>
// de blob que nunca reprodujo nada. Por eso TODA esta sección tiene
// un tiempo límite explícito en cada paso, con una salida de
// emergencia que SIEMPRE resuelve (nunca deja la promesa colgada) --
// ningún paso puede quedarse esperando para siempre.
const TIMEOUT_METADATA_MS = 10_000;
const TIMEOUT_SEEK_MS = 5_000;
const TIMEOUT_RVFC_MS = 1_500;
const TIMEOUT_CUADRO_TOTAL_MS = 8_000;
const TIMEOUT_AUDIO_MS = 10_000;
const TIMEOUT_FASE_CONTROL_CALIDAD_MS = 120_000;

function conTimeout<T>(promesa: Promise<T>, ms: number, mensajeTimeout: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(mensajeTimeout)), ms);
  });
  return Promise.race([promesa, timeout]).finally(() => clearTimeout(timer)) as Promise<T>;
}

// Espera un evento del <video> con tiempo límite -- a diferencia de
// conTimeout(), esto NUNCA rechaza: devuelve false si se agotó el
// tiempo, para que quien llama decida qué hacer (nunca un throw que
// tumbe todo el proceso por un solo cuadro).
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

// Confirmación real de que el navegador ya PINTÓ el cuadro nuevo
// (evita el bug del cuadro negro: "seeked" dispara en cuanto el
// navegador ACEPTA el seek, no cuando el cuadro ya está decodificado
// en el buffer que lee drawImage()) -- pero con un tiempo límite
// corto: en una pestaña oculta, requestVideoFrameCallback puede no
// responder nunca, y para entonces "seeked" ya disparó -- mejor
// dibujar un cuadro "probablemente ya listo" que colgarse esperando
// la confirmación perfecta.
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

// dataUrl: null = "no se pudo extraer este cuadro a tiempo" -- NO es
// un error que tumbe el proceso (pedido explícito): se marca así y
// se sigue con el resto. onProgreso informa "cuadro N de M" para que
// la pantalla nunca se vea colgada sin explicación.
async function extraerCuadrosClave(
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

    // "Calienta" el decodificador -- mitigación real para navegadores
    // (Safari en particular) que no resuelven nunca un seek sobre un
    // <video> de blob que no llegó a reproducir ni un cuadro.
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

// "no_verificado" (nunca "silencioso" por defecto) si decodeAudioData
// se cuelga o falla -- no hay forma de distinguir "sí tiene audio"
// de "no se pudo revisar" sin el dato real, así que nunca se asume
// lo peor ni lo mejor, se lo dice claro al admin.
type ResultadoSilencio = "silencioso" | "con_audio" | "no_verificado";

// Silencio real del audio YA MEZCLADO (voz + música + efectos) -- el
// único de los 2 casos documentados en el plan que se puede medir acá
// mismo, sin mandar nada a un modelo: Web Audio API decodifica el
// archivo final tal cual va a quedar. Umbral generoso (-45dB de RMS)
// -- lo que importa es detectar "no hay NADA de audio", no afinar el
// nivel ideal de mezcla.
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

async function audioEstaEnSilencio(blob: Blob): Promise<ResultadoSilencio> {
  try {
    return await conTimeout(audioEstaEnSilencioInterno(blob), TIMEOUT_AUDIO_MS, "timeout");
  } catch {
    return "no_verificado";
  }
}

// Ronda H (revisión de staging, 16 nov 2026): "¿está todo en silencio?"
// no atrapa un hueco puntual DENTRO de un reel que por lo demás suena
// bien (el caso real que motivó esto: 0.56s de silencio real a mitad
// de una sola escena, por un hueco de Whisper que
// app/lib/videoOrganico/compactarPausas.ts ahora recorta en el
// guion -- esto mide el audio YA MEZCLADO Y RENDERIZADO de verdad,
// nunca los números crudos de tiemposRender/palabrasPorEscena, para
// atrapar tanto un hueco que se escapó de esa compactación como
// cualquier otra causa de silencio real (música/efectos no cubren un
// hueco de voz, por ejemplo). Mismo umbral de -45dB que ya usa
// audioEstaEnSilencioInterno -- lo que importa es "no hay nada
// sonando", no afinar el nivel ideal de mezcla.
//
// Ronda J: el umbral subió de 0.4 a 0.6 -- 0.4 quedó obsoleto en
// cuanto compactarPausas.ts empezó a apuntar a pausas de 0.35-0.45s
// ENTRE frases/escenas a propósito (antes sonaba "mordido"; ver su
// propio comentario). Caso real que lo disparó en staging: un intento
// 3/3 falló por un silencio de 0.50s que era exactamente el respiro
// nuevo pedido, no un defecto. compactarPausas.ts ya garantiza un
// techo duro de 0.5s (PAUSA_MAXIMA_ABSOLUTA_S) -- este umbral solo
// necesita quedar POR ENCIMA de ese techo para no marcar como falla
// lo que la compactación hace a propósito, con margen para que un
// silencio real de verdad (una pausa que se escapó, o música/efectos
// que no taparon un hueco de voz) siga marcándose.
const UMBRAL_SILENCIO_DB = -45;
const DURACION_MINIMA_SILENCIO_S = 0.6;
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

    // Un nivel de dB por ventana -- la detección de "cuánto dura un
    // tramo por debajo del umbral" es lógica pura aparte, probada con
    // niveles sintéticos (silenciosLargosDesdeNivelesDb, ver
    // app/lib/videoOrganico/encontrarSilenciosLargos.ts); acá solo se
    // arma el arreglo real a partir del audio de verdad decodificado.
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

async function encontrarSilenciosLargos(blob: Blob): Promise<SilencioLargo[] | "no_verificado"> {
  try {
    return await conTimeout(encontrarSilenciosLargosInterno(blob), TIMEOUT_AUDIO_MS, "timeout");
  } catch {
    return "no_verificado";
  }
}

// Empareja cada hallazgo con el cuadro (dataUrl) que lo originó.
// control-calidad/route.ts le pide al modelo responder "en el mismo
// orden" que los cuadros que recibió -- se empareja por posición
// primero (el caso normal); si por algún motivo la cantidad no
// coincide, se cae a emparejar por el texto exacto de la etiqueta en
// vez de asumir una posición que puede estar desalineada.
function combinarHallazgosConImagenes(hallazgos: HallazgoVision[], cuadros: { etiqueta: string; dataUrl: string }[]): HallazgoConImagen[] {
  if (hallazgos.length === cuadros.length) {
    return hallazgos.map((h, i) => ({ ...h, dataUrl: cuadros[i].dataUrl }));
  }
  const porEtiqueta = new Map(cuadros.map((c) => [c.etiqueta, c.dataUrl]));
  return hallazgos.map((h) => ({ ...h, dataUrl: porEtiqueta.get(h.cuadro) }));
}

// Construye los mensajes de corrección que se le mandan de vuelta a
// POST /guion (erroresPrevios) cuando el control de calidad rechaza un
// intento -- mismo texto que ve la IA al reintentar por un fallo de
// validación estructural (ver el comentario en esa ruta). "no_verificado"
// NUNCA se trata como un fallo real (no hay evidencia de que algo esté
// mal, solo que no se pudo confirmar) -- no dispara un reintento por
// sí solo.
function erroresDesdeQC(hallazgos: HallazgoVision[], silencio: ResultadoSilencio, silenciosLargos: SilencioLargo[] | "no_verificado"): string[] {
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

// Ronda J, punto B: clasifica el hallazgo del intento anterior -- si
// lo ÚNICO que falló fue un silencio largo (audio ya renderizado y
// visión limpios), el problema es de PAUSAS, no de contenido. Nunca
// hace falta un guion ni una voz nuevos para arreglar eso -- solo
// recompactar la misma voz con límites más estrictos (POST
// /recompactar). Cualquier otra causa (visión, o el audio completo en
// silencio -- señal de algo roto de verdad, no solo una pausa larga)
// sigue regenerando todo desde cero, igual que antes.
function esSoloProblemaDePausas(hallazgos: HallazgoVision[], silencio: ResultadoSilencio, silenciosLargos: SilencioLargo[] | "no_verificado"): boolean {
  const hayProblemaVision = hallazgos.some((h) => h.pantalla_vacia || h.texto_superpuesto || h.contraste_bajo);
  const haySilencioLargo = Array.isArray(silenciosLargos) && silenciosLargos.length > 0;
  return !hayProblemaVision && silencio !== "silencioso" && haySilencioLargo;
}

// Cada recompactación es más estricta que la anterior -- un paso de
// 0.05s por intento, nunca por debajo de un piso razonable (0.3s entre
// frases/escenas sigue siendo un respiro real; 0.15s dentro de una
// frase sigue sin sonar mordido). Si tras MAX_REINTENTOS_QC intentos
// de recompactación el silencio sigue sin resolverse, el problema ya
// no es de límites -- el loop principal lo trata como cualquier otro
// fallo agotado.
function limitesDeRecompactacion(intentosRecompactacion: number): { pausaEntreFrases_s: number; pausaDentroDeFrase_s: number } {
  return {
    pausaEntreFrases_s: Math.max(0.3, 0.4 - 0.05 * intentosRecompactacion),
    pausaDentroDeFrase_s: Math.max(0.15, 0.25 - 0.05 * intentosRecompactacion),
  };
}

export default function AdminReelAutomaticoPruebaClient() {
  const [fase, setFase] = useState<FaseArnes>("inactivo");
  const [error, setError] = useState<string | null>(null);
  const [resumenGuion, setResumenGuion] = useState<ResultadoGuion | null>(null);
  const [progresoRender, setProgresoRender] = useState(0);
  const [hallazgosVision, setHallazgosVision] = useState<HallazgoConImagen[] | null>(null);
  const [audioSilencioso, setAudioSilencioso] = useState<ResultadoSilencio | null>(null);
  const [silenciosLargos, setSilenciosLargos] = useState<SilencioLargo[] | "no_verificado" | null>(null);
  const [intentoQC, setIntentoQC] = useState(0);
  // Texto de progreso DENTRO de "extrayendo_cuadros"/"control_calidad"
  // -- pedido explícito, para que la pantalla nunca se vea colgada sin
  // explicación ("Extrayendo cuadro 3 de 8...", "Revisando audio...",
  // "Consultando al modelo de visión...").
  const [detalleProgreso, setDetalleProgreso] = useState<string | null>(null);
  const urlDescargaRef = useRef<string | null>(null);
  const [urlDescarga, setUrlDescarga] = useState<string | null>(null);
  // Descarga forzada del ÚLTIMO blob renderizado aunque no haya
  // pasado el control de calidad -- pedido explícito: el admin (nunca
  // el cliente) tiene que poder bajarlo igual para ver qué salió mal.
  const urlDescargaForzadaRef = useRef<string | null>(null);
  const [urlDescargaForzada, setUrlDescargaForzada] = useState<string | null>(null);

  function limpiarUrls() {
    if (urlDescargaRef.current) {
      URL.revokeObjectURL(urlDescargaRef.current);
      urlDescargaRef.current = null;
    }
    if (urlDescargaForzadaRef.current) {
      URL.revokeObjectURL(urlDescargaForzadaRef.current);
      urlDescargaForzadaRef.current = null;
    }
    setUrlDescarga(null);
    setUrlDescargaForzada(null);
  }

  async function correr() {
    setError(null);
    setResumenGuion(null);
    setHallazgosVision(null);
    setAudioSilencioso(null);
    setSilenciosLargos(null);
    setIntentoQC(0);
    limpiarUrls();

    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
      const { ReelAutomatico, duracionReelAutomaticoEnCuadros } = await import("@/video/visuales/ReelAutomatico");

      const check = await canRenderMediaOnWeb({ width: 1080, height: 1920, container: "mp4", videoCodec: "h264", audioCodec: "aac" });
      if (!check.canRender) {
        setError("Este navegador no puede preparar videos acá. Abre Quiubot desde un computador con Chrome.");
        setFase("error");
        return;
      }

      let erroresPrevios: string[] | undefined = undefined;
      // Ronda J, punto B: si el intento anterior falló SOLO por pausas,
      // el siguiente intento recompacta la MISMA voz (resultadoAnterior)
      // en vez de pedir un guion y una voz nuevos -- ver
      // esSoloProblemaDePausas()/limitesDeRecompactacion() más arriba.
      let resultadoAnterior: ResultadoGuion | null = null;
      let soloFuePausaElUltimoIntento = false;
      let intentosRecompactacion = 0;

      for (let intento = 1; intento <= MAX_REINTENTOS_QC + 1; intento++) {
        setIntentoQC(intento);

        let resultado: ResultadoGuion;
        if (soloFuePausaElUltimoIntento && resultadoAnterior?.crudo) {
          intentosRecompactacion += 1;
          setFase("generando_guion");
          const resRecompactar = await fetch("/api/admin/reel-automatico-prueba/recompactar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ guion: resultadoAnterior.guion, crudo: resultadoAnterior.crudo, ...limitesDeRecompactacion(intentosRecompactacion) }),
          });
          const dataRecompactar = await resRecompactar.json();
          if (!resRecompactar.ok) {
            setError(dataRecompactar.resumenErrores ? `${dataRecompactar.error}\n- ${dataRecompactar.resumenErrores.join("\n- ")}` : dataRecompactar.error || "No se pudo recompactar las pausas.");
            setFase("error");
            return;
          }
          resultado = { ...resultadoAnterior, guion: dataRecompactar.guion, crudo: dataRecompactar.crudo, seRegeneroPorQC: true };
        } else {
          intentosRecompactacion = 0; // voz nueva -- las pausas vuelven a sus límites por defecto
          setFase("generando_guion");
          const resGuion = await fetch("/api/admin/reel-automatico-prueba/guion", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ erroresPrevios }),
          });
          const dataGuion = await resGuion.json();
          if (!resGuion.ok) {
            setError(dataGuion.resumenErrores ? `${dataGuion.error}\n- ${dataGuion.resumenErrores.join("\n- ")}` : dataGuion.error || "No se pudo generar el guion.");
            setFase("error");
            return;
          }
          resultado = dataGuion as ResultadoGuion;
        }
        resultadoAnterior = resultado;
        setResumenGuion(resultado);

        setFase("renderizando");
        setProgresoRender(0);
        const guion = resultado.guion;
        const duracionInFrames = duracionReelAutomaticoEnCuadros(guion);
        const duracionS = duracionInFrames / guion.fps;
        const props = { guion, pistaMusicaUrl: resultado.pistaMusicaUrl, efectos: [], mostrarZonaSegura: false };

        const renderizado = await renderMediaOnWeb({
          composition: { id: "reel-automatico-prueba", component: ReelAutomatico, durationInFrames: duracionInFrames, fps: guion.fps, width: 1080, height: 1920, defaultProps: props },
          inputProps: props,
          container: "mp4",
          videoCodec: "h264",
          audioCodec: "aac",
          licenseKey: LICENCIA_REMOTION,
          onProgress: (p: { progress: number }) => setProgresoRender(Math.round((p.progress ?? 0) * 100)),
        });
        const blob = await renderizado.getBlob();

        setFase("extrayendo_cuadros");
        // Un par de cuadros por escena (inicio + mitad), identificados
        // por el id REAL de la escena (no por posición) -- así un
        // hallazgo del control de calidad se puede leer de vuelta sin
        // ambigüedad ("escena_e3_mitad" es la escena "e3", siempre,
        // nunca "la 3ra en el array de este intento en particular").
        const tiempos = guion.tiemposRender ?? [];
        const etiquetasYSegundos = tiempos.flatMap((t) => [
          { etiqueta: `escena_${t.escena_id}_inicio`, segundo: t.inicio_s + 0.15 },
          { etiqueta: `escena_${t.escena_id}_mitad`, segundo: (t.inicio_s + t.fin_s) / 2 },
        ]);

        // Bug real (staging, 16 nov 2026): esta fase entera se quedaba
        // colgada para siempre. Ahora, aparte de los tiempos límite de
        // cada paso individual (ver las funciones de arriba), TODA la
        // fase (extracción + audio + llamada a visión) tiene un tope
        // final -- si algo imprevisto la cuelga igual, esto la corta
        // con un mensaje claro en vez de dejar la pantalla sin avisar.
        // Se devuelve el resultado en vez de mutar variables de afuera
        // desde el closure -- TypeScript no sigue ese tipo de mutación
        // para angostar el tipo en el código que viene después.
        const { hallazgos, silencio, silenciosLargosDetectados } = await conTimeout(
          (async (): Promise<{ hallazgos: HallazgoVision[]; silencio: ResultadoSilencio; silenciosLargosDetectados: SilencioLargo[] | "no_verificado" }> => {
            const [cuadrosConFallidos, silencioDetectado, silenciosLargosRes] = await Promise.all([
              extraerCuadrosClave(blob, duracionS, etiquetasYSegundos, (actual, total) => setDetalleProgreso(`Extrayendo cuadro ${actual} de ${total}...`)),
              (async () => {
                setDetalleProgreso("Revisando audio...");
                return audioEstaEnSilencio(blob);
              })(),
              encontrarSilenciosLargos(blob),
            ]);
            setAudioSilencioso(silencioDetectado);
            setSilenciosLargos(silenciosLargosRes);

            const cuadrosValidos = cuadrosConFallidos.filter((c): c is { etiqueta: string; dataUrl: string } => c.dataUrl !== null);
            const etiquetasFallidas = cuadrosConFallidos.filter((c) => c.dataUrl === null).map((c) => c.etiqueta);

            setFase("control_calidad");
            let hallazgosDetectados: HallazgoVision[] = [];
            if (cuadrosValidos.length > 0) {
              setDetalleProgreso("Consultando al modelo de visión...");
              const resCalidad = await fetch("/api/admin/reel-automatico-prueba/control-calidad", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cuadros: cuadrosValidos }),
              });
              const dataCalidad = await resCalidad.json();
              if (!resCalidad.ok) throw new Error(dataCalidad.error || "No se pudo correr el control de calidad.");
              hallazgosDetectados = dataCalidad.hallazgos as HallazgoVision[];
            }

            const hallazgosFallidos: HallazgoConImagen[] = etiquetasFallidas.map((etiqueta) => ({
              cuadro: etiqueta,
              pantalla_vacia: false,
              texto_superpuesto: false,
              contraste_bajo: false,
              nota: "No se pudo extraer este cuadro a tiempo (no cuenta como error -- no se pudo confirmar si está bien o mal).",
            }));
            setHallazgosVision([...combinarHallazgosConImagenes(hallazgosDetectados, cuadrosValidos), ...hallazgosFallidos]);

            return { hallazgos: hallazgosDetectados, silencio: silencioDetectado, silenciosLargosDetectados: silenciosLargosRes };
          })(),
          TIMEOUT_FASE_CONTROL_CALIDAD_MS,
          "El control de calidad tardó demasiado (más de 2 minutos) -- revisa la consola del navegador o inténtalo de nuevo."
        );

        const hayProblemaVision = hallazgos.some((h) => h.pantalla_vacia || h.texto_superpuesto || h.contraste_bajo);
        const haySilencioLargo = Array.isArray(silenciosLargosDetectados) && silenciosLargosDetectados.length > 0;
        if (!hayProblemaVision && silencio !== "silencioso" && !haySilencioLargo) {
          const url = URL.createObjectURL(blob);
          urlDescargaRef.current = url;
          setUrlDescarga(url);
          setFase("listo");
          return;
        }

        if (intento >= MAX_REINTENTOS_QC + 1) {
          // Se agotaron los reintentos -- nunca se entrega como
          // aprobado, pero el admin sí puede bajarlo para depurar.
          const urlForzada = URL.createObjectURL(blob);
          urlDescargaForzadaRef.current = urlForzada;
          setUrlDescargaForzada(urlForzada);
          setFase("rechazado");
          return;
        }

        soloFuePausaElUltimoIntento = esSoloProblemaDePausas(hallazgos, silencio, silenciosLargosDetectados);
        if (!soloFuePausaElUltimoIntento) {
          erroresPrevios = erroresDesdeQC(hallazgos, silencio, silenciosLargosDetectados);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo falló generando el reel.");
      setFase("error");
    } finally {
      setDetalleProgreso(null);
    }
  }

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "3rem 1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#17152B", marginBottom: 4 }}>Reel automático de prueba (solo admin)</h1>
      <p style={{ fontSize: 13, color: "#999", marginBottom: 28 }}>
        Genera de punta a punta UN reel (consejos_numerados, tu marca): guion con voz vía IA, narración y voz reales, visuales con eventos, control de calidad, y el mp4 para descargar. Fase B v2.0 -- no se guarda ni se publica nada.
      </p>

      <button
        onClick={correr}
        disabled={fase !== "inactivo" && fase !== "listo" && fase !== "error" && fase !== "rechazado"}
        style={{ padding: "12px 20px", borderRadius: 10, border: "none", background: "#534AB7", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
      >
        Generar reel automático (consejos_numerados, marca)
      </button>

      <div style={{ marginTop: 24, fontSize: 13, color: "#444", lineHeight: 1.6 }}>
        {fase !== "inactivo" && fase !== "error" && (
          <p style={{ color: "#777", marginBottom: 4 }}>
            Intento de control de calidad {intentoQC} de {MAX_REINTENTOS_QC + 1}
          </p>
        )}
        {fase === "generando_guion" && <p>Generando guion con narración y visuales (IA) + voz real (TTS/transcripción)...</p>}
        {fase === "renderizando" && <p>Renderizando en el navegador... {progresoRender}%</p>}
        {(fase === "extrayendo_cuadros" || fase === "control_calidad") && <p>{detalleProgreso ?? "Preparando el control de calidad..."}</p>}
      </div>

      {resumenGuion && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: "#F7F6FB", fontSize: 13, color: "#333" }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Guion generado</p>
          <p>
            Voz usada: <strong>{resumenGuion.voz}</strong> -- puntaje de alineación: {resumenGuion.puntajeAlineacion.toFixed(2)} -- intentos de guion (validación estructural): {resumenGuion.intentosGuion}
            {resumenGuion.seRegeneroPorQC && " (regenerado por un control de calidad anterior)"}
          </p>
          <ul style={{ marginTop: 8, paddingLeft: 18 }}>
            {resumenGuion.guion.escenas.map((e) => (
              <li key={e.id}>
                <strong>{e.bloque}</strong> ({e.visual?.tipo ?? "sin visual"}): {e.narracion}
              </li>
            ))}
          </ul>
        </div>
      )}

      {audioSilencioso === "silencioso" && (
        <p style={{ marginTop: 16, color: "#B42318", fontWeight: 700 }}>⚠️ El audio mezclado salió en silencio -- el reel no se entrega.</p>
      )}
      {audioSilencioso === "no_verificado" && (
        <p style={{ marginTop: 16, color: "#966F00", fontWeight: 700 }}>⚠️ No se pudo revisar el audio a tiempo (no es necesariamente un error -- revisa el mp4 a oído si sigues dudando).</p>
      )}
      {Array.isArray(silenciosLargos) && silenciosLargos.length > 0 && (
        <div style={{ marginTop: 16, color: "#B42318", fontWeight: 700 }}>
          ⚠️ El audio mezclado tiene {silenciosLargos.length} silencio{silenciosLargos.length === 1 ? "" : "s"} real{silenciosLargos.length === 1 ? "" : "es"} de más de 0.4s -- el reel no se entrega.
          <ul style={{ fontWeight: 400, fontSize: 13, marginTop: 4 }}>
            {silenciosLargos.map((s, i) => (
              <li key={i}>
                {s.inicio_s.toFixed(2)}s a {s.fin_s.toFixed(2)}s ({(s.fin_s - s.inicio_s).toFixed(2)}s)
              </li>
            ))}
          </ul>
        </div>
      )}
      {silenciosLargos === "no_verificado" && (
        <p style={{ marginTop: 16, color: "#966F00", fontWeight: 700 }}>⚠️ No se pudo revisar si hay silencios largos a tiempo (no es necesariamente un error).</p>
      )}

      {hallazgosVision && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: fase === "rechazado" ? "#FEF3F2" : "#F0FDF4", fontSize: 13, color: "#333" }}>
          <p style={{ fontWeight: 700, marginBottom: 4 }}>Control de calidad por visión</p>
          <p style={{ fontSize: 12, color: "#777", marginBottom: 12 }}>
            El cuadro exacto que vio el modelo va al lado de cada nota -- antes de aflojar la regla por un hallazgo repetido, confirma acá si de verdad se ve el problema o si es un falso positivo.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {hallazgosVision.map((h, i) => {
              const esProblema = h.pantalla_vacia || h.texto_superpuesto || h.contraste_bajo;
              return (
                <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                  {h.dataUrl && (
                    <img
                      src={h.dataUrl}
                      alt={h.cuadro}
                      style={{ width: 72, height: 128, objectFit: "cover", borderRadius: 6, border: esProblema ? "2px solid #B42318" : "1px solid #ddd", flexShrink: 0 }}
                    />
                  )}
                  <div>
                    <strong>{h.cuadro}</strong>: {esProblema ? "⚠️ " : "✓ "}
                    {h.nota}
                    {esProblema && (
                      <p style={{ fontSize: 11, color: "#777", marginTop: 2 }}>
                        {h.pantalla_vacia && "pantalla_vacia "}
                        {h.texto_superpuesto && "texto_superpuesto "}
                        {h.contraste_bajo && "contraste_bajo"}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fase === "rechazado" && (
        <div style={{ marginTop: 16 }}>
          <p style={{ color: "#B42318", fontWeight: 700, marginBottom: 8 }}>
            El reel no pasó el control de calidad después de {MAX_REINTENTOS_QC + 1} intentos -- al cliente NUNCA se le entrega así. Revisa los hallazgos de arriba.
          </p>
          {urlDescargaForzada && (
            <>
              <a
                href={urlDescargaForzada}
                download="reel-automatico-prueba-NO-APROBADO.mp4"
                style={{ display: "inline-block", padding: "8px 14px", borderRadius: 8, border: "1px solid #B42318", color: "#B42318", fontWeight: 700, textDecoration: "none" }}
              >
                Descargar de todos modos (no aprobado)
              </a>
              <p style={{ fontSize: 12, color: "#999", marginTop: 6 }}>Solo para depurar como admin -- el último intento renderizado, con los problemas que ya viste arriba.</p>
            </>
          )}
        </div>
      )}

      {error && <p style={{ marginTop: 16, color: "#B42318", whiteSpace: "pre-line" }}>{error}</p>}

      {fase === "listo" && urlDescarga && (
        <div style={{ marginTop: 20 }}>
          <p style={{ color: "#0F7B3F", fontWeight: 700, marginBottom: 8 }}>✓ Reel listo y aprobado por el control de calidad.</p>
          <a href={urlDescarga} download="reel-automatico-prueba.mp4" style={{ color: "#534AB7", fontWeight: 700 }}>
            Descargar reel-automatico-prueba.mp4
          </a>
        </div>
      )}
    </div>
  );
}

"use client";
import { useRef, useState } from "react";
import type { Guion } from "@/video/guion.schema";

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

type ResultadoGuion = { guion: Guion; pistaMusicaUrl: string | null; voz: string; puntajeAlineacion: number; intentosGuion: number; seRegeneroPorQC: boolean };

const LICENCIA_REMOTION = "free-license";
// Plan punto 8: "si algo falla, se reintenta... hasta 2 veces". Son
// intentos de CONTROL DE CALIDAD (render + visión + audio), aparte de
// los intentos de validación estructural que ya corren dentro de cada
// llamada a /guion (MAX_REINTENTOS en esa ruta) -- 3 corridas
// completas en total como máximo (1 + 2 reintentos).
const MAX_REINTENTOS_QC = 2;

// Bug real reportado (staging, 16 nov 2026): el primer cuadro salía
// negro en el control de calidad. Ningún componente del molde funde
// desde negro (FondoMarca pinta su degradado desde el cuadro 0, sin
// fade -- confirmado leyendo el código) -- era la extracción: "onseeked"
// dispara en cuanto el navegador ACEPTÓ el seek, no cuando el cuadro
// ya está decodificado y pintado en el buffer que lee drawImage(). Acá
// se espera además a que el navegador confirme que presentó un cuadro
// nuevo (requestVideoFrameCallback) antes de capturar.
function esperarCuadroPresentado(video: HTMLVideoElement): Promise<void> {
  if (typeof video.requestVideoFrameCallback === "function") {
    return new Promise((resolve) => video.requestVideoFrameCallback(() => resolve()));
  }
  // Navegadores sin esa API (no debería pasar en Chrome, que es el
  // único soportado hoy para renderMediaOnWeb) -- 2 rAF + un margen
  // chico es el mejor sustituto sin esa confirmación real.
  return new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 50))));
}

async function extraerCuadrosClave(blob: Blob, duracionS: number, etiquetasYSegundos: { etiqueta: string; segundo: number }[]): Promise<{ etiqueta: string; dataUrl: string }[]> {
  const url = URL.createObjectURL(blob);
  const video = document.createElement("video");
  video.src = url;
  video.muted = true;
  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error("No se pudo leer el video renderizado para extraer cuadros."));
  });

  const canvas = document.createElement("canvas");
  canvas.width = video.videoWidth || 1080;
  canvas.height = video.videoHeight || 1920;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No se pudo preparar el lienzo para extraer cuadros.");

  const resultados: { etiqueta: string; dataUrl: string }[] = [];
  for (const { etiqueta, segundo } of etiquetasYSegundos) {
    const objetivo = Math.min(Math.max(segundo, 0), Math.max(duracionS - 0.05, 0));
    await new Promise<void>((resolve, reject) => {
      video.onseeked = () => resolve();
      video.onerror = () => reject(new Error(`No se pudo buscar el cuadro de "${etiqueta}".`));
      video.currentTime = objetivo;
    });
    await esperarCuadroPresentado(video);
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    resultados.push({ etiqueta, dataUrl: canvas.toDataURL("image/jpeg", 0.85) });
  }

  URL.revokeObjectURL(url);
  return resultados;
}

// Silencio real del audio YA MEZCLADO (voz + música + efectos) -- el
// único de los 2 casos documentados en el plan que se puede medir acá
// mismo, sin mandar nada a un modelo: Web Audio API decodifica el
// archivo final tal cual va a quedar. Umbral generoso (-45dB de RMS)
// -- lo que importa es detectar "no hay NADA de audio", no afinar el
// nivel ideal de mezcla.
async function audioEstaEnSilencio(blob: Blob): Promise<boolean> {
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
    if (total === 0) return true;
    const rms = Math.sqrt(sumaCuadrados / total);
    const db = 20 * Math.log10(rms || 1e-10);
    return db < -45;
  } finally {
    await contexto.close().catch(() => {});
  }
}

// Construye los mensajes de corrección que se le mandan de vuelta a
// POST /guion (erroresPrevios) cuando el control de calidad rechaza un
// intento -- mismo texto que ve la IA al reintentar por un fallo de
// validación estructural (ver el comentario en esa ruta).
function erroresDesdeQC(hallazgos: HallazgoVision[], silencio: boolean): string[] {
  const errores = hallazgos
    .filter((h) => h.pantalla_vacia || h.texto_superpuesto || h.contraste_bajo)
    .map((h) => `El control de calidad (visión) encontró un problema real en el cuadro "${h.cuadro}": ${h.nota}`);
  if (silencio) errores.push("El audio final mezclado salió en silencio -- revisa que ninguna narracion haya quedado vacía o con un texto raro para la voz.");
  return errores;
}

export default function AdminReelAutomaticoPruebaClient() {
  const [fase, setFase] = useState<FaseArnes>("inactivo");
  const [error, setError] = useState<string | null>(null);
  const [resumenGuion, setResumenGuion] = useState<ResultadoGuion | null>(null);
  const [progresoRender, setProgresoRender] = useState(0);
  const [hallazgosVision, setHallazgosVision] = useState<HallazgoVision[] | null>(null);
  const [audioSilencioso, setAudioSilencioso] = useState<boolean | null>(null);
  const [intentoQC, setIntentoQC] = useState(0);
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

      for (let intento = 1; intento <= MAX_REINTENTOS_QC + 1; intento++) {
        setIntentoQC(intento);

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
        const resultado = dataGuion as ResultadoGuion;
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
        const [cuadros, silencio] = await Promise.all([extraerCuadrosClave(blob, duracionS, etiquetasYSegundos), audioEstaEnSilencio(blob)]);
        setAudioSilencioso(silencio);

        setFase("control_calidad");
        const resCalidad = await fetch("/api/admin/reel-automatico-prueba/control-calidad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cuadros }),
        });
        const dataCalidad = await resCalidad.json();
        if (!resCalidad.ok) {
          setError(dataCalidad.error || "No se pudo correr el control de calidad.");
          setFase("error");
          return;
        }
        const hallazgos = dataCalidad.hallazgos as HallazgoVision[];
        setHallazgosVision(hallazgos);

        const hayProblemaVision = hallazgos.some((h) => h.pantalla_vacia || h.texto_superpuesto || h.contraste_bajo);
        if (!hayProblemaVision && !silencio) {
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

        erroresPrevios = erroresDesdeQC(hallazgos, silencio);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Algo falló generando el reel.");
      setFase("error");
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
        {fase === "extrayendo_cuadros" && <p>Extrayendo cuadros clave y revisando el audio mezclado...</p>}
        {fase === "control_calidad" && <p>Control de calidad por visión (gpt-4o)...</p>}
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

      {audioSilencioso === true && (
        <p style={{ marginTop: 16, color: "#B42318", fontWeight: 700 }}>⚠️ El audio mezclado salió en silencio -- el reel no se entrega.</p>
      )}

      {hallazgosVision && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: fase === "rechazado" ? "#FEF3F2" : "#F0FDF4", fontSize: 13, color: "#333" }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Control de calidad por visión</p>
          <ul style={{ paddingLeft: 18 }}>
            {hallazgosVision.map((h, i) => (
              <li key={i} style={{ marginBottom: 4 }}>
                <strong>{h.cuadro}</strong>: {h.pantalla_vacia || h.texto_superpuesto || h.contraste_bajo ? "⚠️ " : "✓ "}
                {h.nota}
              </li>
            ))}
          </ul>
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

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

type ResultadoGuion = { guion: Guion; pistaMusicaUrl: string | null; voz: string; puntajeAlineacion: number; intentos: number };

const LICENCIA_REMOTION = "free-license";

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

export default function AdminReelAutomaticoPruebaClient() {
  const [fase, setFase] = useState<FaseArnes>("inactivo");
  const [error, setError] = useState<string | null>(null);
  const [resumenGuion, setResumenGuion] = useState<ResultadoGuion | null>(null);
  const [progresoRender, setProgresoRender] = useState(0);
  const [hallazgosVision, setHallazgosVision] = useState<HallazgoVision[] | null>(null);
  const [audioSilencioso, setAudioSilencioso] = useState<boolean | null>(null);
  const urlDescargaRef = useRef<string | null>(null);
  const [urlDescarga, setUrlDescarga] = useState<string | null>(null);

  async function correr() {
    setError(null);
    setResumenGuion(null);
    setHallazgosVision(null);
    setAudioSilencioso(null);
    if (urlDescargaRef.current) {
      URL.revokeObjectURL(urlDescargaRef.current);
      urlDescargaRef.current = null;
      setUrlDescarga(null);
    }

    try {
      setFase("generando_guion");
      const resGuion = await fetch("/api/admin/reel-automatico-prueba/guion", { method: "POST" });
      const dataGuion = await resGuion.json();
      if (!resGuion.ok) {
        setError(dataGuion.resumenErrores ? `${dataGuion.error}\n- ${dataGuion.resumenErrores.join("\n- ")}` : dataGuion.error || "No se pudo generar el guion.");
        setFase("error");
        return;
      }
      const resultado = dataGuion as ResultadoGuion;
      setResumenGuion(resultado);

      setFase("renderizando");
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
      const { ReelAutomatico, duracionReelAutomaticoEnCuadros } = await import("@/video/visuales/ReelAutomatico");

      const check = await canRenderMediaOnWeb({ width: 1080, height: 1920, container: "mp4", videoCodec: "h264", audioCodec: "aac" });
      if (!check.canRender) {
        setError("Este navegador no puede preparar videos acá. Abre Quiubot desde un computador con Chrome.");
        setFase("error");
        return;
      }

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
      // Un par de cuadros por escena (inicio + mitad) -- suficiente para
      // que el modelo de visión vea cada visual en marcha, sin mandar
      // decenas de imágenes por una sola petición.
      const tiempos = guion.tiemposRender ?? [];
      const etiquetasYSegundos = tiempos.flatMap((t, i) => [
        { etiqueta: `escena_${i + 1}_inicio`, segundo: t.inicio_s + 0.15 },
        { etiqueta: `escena_${i + 1}_mitad`, segundo: (t.inicio_s + t.fin_s) / 2 },
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
      if (hayProblemaVision || silencio) {
        setFase("rechazado");
        return;
      }

      const url = URL.createObjectURL(blob);
      urlDescargaRef.current = url;
      setUrlDescarga(url);
      setFase("listo");
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
        {fase === "generando_guion" && <p>Generando guion con narración y visuales (IA) + voz real (TTS/transcripción)...</p>}
        {fase === "renderizando" && <p>Renderizando en el navegador... {progresoRender}%</p>}
        {fase === "extrayendo_cuadros" && <p>Extrayendo cuadros clave y revisando el audio mezclado...</p>}
        {fase === "control_calidad" && <p>Control de calidad por visión (gpt-4o)...</p>}
      </div>

      {resumenGuion && (
        <div style={{ marginTop: 20, padding: 16, borderRadius: 10, background: "#F7F6FB", fontSize: 13, color: "#333" }}>
          <p style={{ fontWeight: 700, marginBottom: 8 }}>Guion generado</p>
          <p>Voz usada: <strong>{resumenGuion.voz}</strong> -- puntaje de alineación: {resumenGuion.puntajeAlineacion.toFixed(2)} -- intentos: {resumenGuion.intentos}</p>
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
        <p style={{ marginTop: 16, color: "#B42318", fontWeight: 700 }}>El reel no pasó el control de calidad -- no se entrega el mp4. Revisa los hallazgos de arriba.</p>
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

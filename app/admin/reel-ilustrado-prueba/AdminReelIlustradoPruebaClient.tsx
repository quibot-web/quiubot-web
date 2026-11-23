"use client";
import { useRef, useState } from "react";
import type { TiemposIlustrado } from "@/video/ilustrado/tiempoIlustrado";
import { nombreNavegador } from "@/app/lib/navegador";
import { useDescripcionEquipo, useNombreNavegador } from "@/app/lib/useNavegador";

// Reel ilustrado, fase 1: renderiza el reel del prototipo con el motor
// genérico EN ESTE NAVEGADOR (mismo @remotion/web-renderer que la cola de
// /contenido) y mide cuánto tarda. Dos modos: con la voz real (genera
// TTS + tiempos con tu llave, ~unos centavos) o sin voz con tiempos
// sintéticos (gratis, solo para medir el render).

const LICENCIA_REMOTION = "free-license";
const META_SEGUNDOS_POR_SEGUNDO = 5;
const TEMA = { color_primario: "#534AB7", color_secundario: "#B9B2FF", fuente: "moderna" as const, logo_url: null, nombre_marca: "Quiubot", instagramUsuario: "quiubot" };

type Fase = "inactivo" | "generando_voz" | "renderizando" | "listo" | "error";
type Resultado = { duracionVideo: number; segundosRender: number; conVoz: boolean; voz: string | null; navegador: string };


export default function AdminReelIlustradoPruebaClient() {
  const [fase, setFase] = useState<Fase>("inactivo");
  const [error, setError] = useState<string | null>(null);
  const [progreso, setProgreso] = useState(0);
  const [transcurrido, setTranscurrido] = useState(0);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [urlVideo, setUrlVideo] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const entorno = { navegador: useNombreNavegador() ?? "", equipo: useDescripcionEquipo() ?? "" };

  async function correr(conVoz: boolean) {
    setError(null);
    setResultado(null);
    setProgreso(0);
    setTranscurrido(0);
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
    setUrlVideo(null);
    try {
      const { canRenderMediaOnWeb, renderMediaOnWeb } = await import("@remotion/web-renderer");
      const check = await canRenderMediaOnWeb({ width: 1080, height: 1920, container: "mp4", videoCodec: "h264", audioCodec: "aac" });
      if (!check.canRender) throw new Error("Este navegador no puede preparar videos acá. Usa Chrome en un computador.");

      let tiempos: TiemposIlustrado;
      let vozUrl: string | null = null;
      let voz: string | null = null;
      if (conVoz) {
        setFase("generando_voz");
        const res = await fetch("/api/admin/reel-ilustrado-prueba/voz", { method: "POST" });
        const datos = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error([datos.error ?? "No se pudo generar la voz.", ...(datos.resumenErrores ?? [])].join(" "));
        tiempos = datos.tiempos;
        vozUrl = datos.vozUrl;
        voz = datos.voz;
      } else {
        const { tiemposSinteticos } = await import("@/video/ilustrado/guionPrototipo");
        tiempos = tiemposSinteticos();
      }

      setFase("renderizando");
      const { ReelIlustrado, duracionReelIlustrado } = await import("@/video/ilustrado/ReelIlustrado");
      const { PLAN_PROTOTIPO, MARCA_PROTOTIPO } = await import("@/video/ilustrado/planPrototipo");
      const props = { tiempos, plan: PLAN_PROTOTIPO, vozUrl, tema: TEMA, marca: MARCA_PROTOTIPO };
      const durationInFrames = duracionReelIlustrado(props);
      const inicio = performance.now();
      const reloj = setInterval(() => setTranscurrido((performance.now() - inicio) / 1000), 500);
      try {
        const render = await renderMediaOnWeb({
          composition: { id: "reel-ilustrado-prueba", component: ReelIlustrado as unknown as React.ComponentType<Record<string, unknown>>, durationInFrames, fps: 30, width: 1080, height: 1920, defaultProps: props },
          inputProps: props,
          container: "mp4",
          videoCodec: "h264",
          audioCodec: "aac",
          licenseKey: LICENCIA_REMOTION,
          onProgress: (p: { progress: number }) => setProgreso(Math.round((p.progress ?? 0) * 100)),
        });
        const blob = await render.getBlob();
        const segundosRender = (performance.now() - inicio) / 1000;
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setUrlVideo(url);
        setResultado({ duracionVideo: durationInFrames / 30, segundosRender, conVoz, voz, navegador: nombreNavegador(navigator.userAgent) });
        setFase("listo");
      } finally {
        clearInterval(reloj);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setFase("error");
    }
  }

  const ocupado = fase === "generando_voz" || fase === "renderizando";
  const porSegundo = resultado ? resultado.segundosRender / resultado.duracionVideo : null;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 16px", fontFamily: "system-ui, sans-serif", color: "#1c1c22" }}>
      <h1 style={{ fontSize: 24, fontWeight: 800, marginBottom: 6 }}>Reel ilustrado (prueba del motor)</h1>
      <p style={{ color: "#555", marginBottom: 20, lineHeight: 1.5 }}>
        Renderiza en este navegador el reel &ldquo;Por qué tus anuncios no venden&rdquo; con el motor genérico (escenas, acciones y cámara automática) y mide el tiempo. Meta de la fase 1: como máximo {META_SEGUNDOS_POR_SEGUNDO} s de render por cada segundo de video. Deja esta pestaña al frente mientras renderiza.
      </p>

      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <button
          onClick={() => correr(true)}
          disabled={ocupado}
          style={{ padding: "10px 16px", borderRadius: 8, border: "none", background: ocupado ? "#bbb" : "#534AB7", color: "#fff", fontWeight: 700, cursor: ocupado ? "default" : "pointer" }}
        >
          Con voz real (usa tu llave de OpenAI)
        </button>
        <button
          onClick={() => correr(false)}
          disabled={ocupado}
          style={{ padding: "10px 16px", borderRadius: 8, border: "1px solid #534AB7", background: "#fff", color: "#534AB7", fontWeight: 700, cursor: ocupado ? "default" : "pointer" }}
        >
          Sin voz (gratis, solo medir)
        </button>
      </div>
      <p style={{ fontSize: 13, color: "#555", marginBottom: 20 }}>
        Navegador: <strong>{entorno.navegador}</strong> · Equipo: {entorno.equipo}
      </p>
      {entorno.navegador.startsWith("Safari") && (
        <p style={{ fontSize: 13, color: "#7A4D00", background: "#FFF4D1", borderRadius: 8, padding: "8px 12px", marginBottom: 20 }}>En Chrome tu video se arma más rápido.</p>
      )}

      {fase === "generando_voz" && <p>Generando la voz y los tiempos por palabra…</p>}
      {fase === "renderizando" && (
        <p>
          Renderizando: {progreso}% · {transcurrido.toFixed(0)} s
        </p>
      )}
      {fase === "error" && error && <p style={{ color: "#B42318", fontWeight: 600 }}>{error}</p>}

      {resultado && porSegundo !== null && (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, marginBottom: 16 }}>
          <p style={{ fontSize: 18, fontWeight: 800, color: porSegundo <= META_SEGUNDOS_POR_SEGUNDO ? "#0F7A3C" : "#B42318", marginBottom: 6 }}>
            {porSegundo.toFixed(2)} s de render por segundo de video {porSegundo <= META_SEGUNDOS_POR_SEGUNDO ? "· cumple la meta" : `· NO cumple la meta (≤ ${META_SEGUNDOS_POR_SEGUNDO})`}
          </p>
          <p style={{ color: "#555" }}>
            Video de {resultado.duracionVideo.toFixed(1)} s renderizado en {resultado.segundosRender.toFixed(0)} s en <strong>{resultado.navegador}</strong> · {resultado.conVoz ? `con voz real (${resultado.voz})` : "sin voz, tiempos sintéticos (solo diagnóstico: los reels reales siempre llevan voz)"}
          </p>
        </div>
      )}

      {urlVideo && (
        <div>
          <video src={urlVideo} controls style={{ width: 270, height: 480, background: "#000", borderRadius: 12, display: "block", marginBottom: 10 }} />
          <a href={urlVideo} download="reel-ilustrado-prueba.mp4" style={{ display: "inline-block", padding: "8px 14px", borderRadius: 8, border: "1px solid #534AB7", color: "#534AB7", fontWeight: 700, textDecoration: "none" }}>
            Descargar mp4
          </a>
        </div>
      )}
    </div>
  );
}

"use client";
import { useRef, useState } from "react";
import type { Guion } from "@/video/guion.schema";
import type { SilencioLargo } from "@/app/lib/videoOrganico/encontrarSilenciosLargos";
import {
  conTimeout,
  extraerCuadrosClave,
  audioEstaEnSilencio,
  encontrarSilenciosLargos,
  combinarHallazgosConImagenes,
  erroresDesdeQC,
  esSoloProblemaDePausas,
  limitesDeRecompactacion,
  DURACION_MINIMA_SILENCIO_S,
  MAX_REINTENTOS_QC,
  type HallazgoVision,
  type HallazgoConImagen,
  type ResultadoSilencio,
} from "@/app/lib/videoOrganico/controlCalidadCliente";

// Fase B v2.0, paso 8 del plan -- arnés de prueba del único reel
// automático. Flujo real (nada mockeado): genera el guion con voz vía
// IA (narración + visual + eventos, voz real de generarVoz()) -> lo
// renderiza en el navegador (@remotion/web-renderer, mismo mecanismo
// real que ColaDeRender.tsx) -> extrae cuadros clave del mp4 ya
// renderizado -> control de calidad (silencio real de audio, medido
// acá; visión, en el servidor) -> si pasa, da el mp4 para descargar.
// Si no pasa, nunca entrega el mp4 -- muestra por qué.

type FaseArnes = "inactivo" | "generando_guion" | "renderizando" | "extrayendo_cuadros" | "control_calidad" | "listo" | "rechazado" | "error";

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
const TIMEOUT_FASE_CONTROL_CALIDAD_MS = 120_000;

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
          ⚠️ El audio mezclado tiene {silenciosLargos.length} silencio{silenciosLargos.length === 1 ? "" : "s"} real{silenciosLargos.length === 1 ? "" : "es"} de más de {DURACION_MINIMA_SILENCIO_S}s -- el reel no se entrega.
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

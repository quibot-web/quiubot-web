"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import CargandoQuiubot from "@/app/components/CargandoQuiubot";

const MIN_IMAGENES = 1;
const MAX_IMAGENES = 3;
const LIMITE_REGENERACIONES = 2;

// Convierte un data URI ("data:image/jpeg;base64,...") a Blob decodificando
// el base64 a mano (Uint8Array), sin pasar por fetch(dataUri) -- eso
// generaba un aviso de CSP (Report-Only por ahora, pero frágil si algún
// día deja de serlo).
function base64ToBlob(dataUri: string): Blob {
  const [meta, contenidoBase64] = dataUri.split(",");
  const mimeMatch = meta.match(/data:(.*);base64/);
  const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
  const binario = atob(contenidoBase64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) {
    bytes[i] = binario.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

type Segmento = {
  orden: number;
  job_id: string;
  duracion: number;
  public_id: string;
  url_video: string;
  plantilla_id: string;
  tipo_segmento: string;
  imagen_url?: string;
};

type EstadoVideoJob = {
  ok: boolean;
  estado: string;
  segmentos: Segmento[];
  total_segmentos: number | null;
  video_final_url: string | null;
  texto_cta: string | null;
  regeneraciones_usadas: number;
  error_mensaje: string | null;
  error?: string;
};

const ESTADOS_TERMINALES_GENERACION = ["revision_pendiente", "error"];
const ESTADOS_TERMINALES_UNION = ["listo", "error"];

// Consulta /api/video-jobs/[id] cada 5s hasta que el estado llegue a
// alguno de los "estadosFinales" pedidos. Se usa tanto para esperar los
// 4 fragmentos, como para esperar una regeneracion puntual, como para
// esperar la union final -- mismo patron que pollJobHasta en estrategia,
// adaptado a los varios estados intermedios de video_jobs.
async function pollVideoJobHasta(
  jobId: string,
  estadosFinales: string[],
  onProgress?: (data: EstadoVideoJob) => void,
  maxMs = 25 * 60 * 1000
): Promise<EstadoVideoJob> {
  const inicio = Date.now();
  while (Date.now() - inicio < maxMs) {
    const res = await fetch(`/api/video-jobs/${jobId}`);
    const data = await res.json().catch(() => ({ ok: false }));
    if (!data.ok) throw new Error(data.error || "No se pudo consultar el estado del video.");
    onProgress?.(data);
    if (estadosFinales.includes(data.estado)) return data;
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  throw new Error("Está tardando más de lo esperado. Intenta de nuevo en unos minutos.");
}

const TIPO_LABEL: Record<string, string> = {
  hook: "Hook (0-5s)",
  contenido: "Contenido",
  cierre: "Cierre / CTA",
};

// Player grande compartido entre la pantalla de revisión (muestra el
// fragmento seleccionado en el filmstrip) y la de resultado final
// (muestra el video ya unido) -- mismo componente, dos usos.
function VideoPlayerGrande({
  src,
  videoRef,
  onTimeUpdate,
}: {
  src: string;
  videoRef?: React.RefObject<HTMLVideoElement | null>;
  onTimeUpdate?: () => void;
}) {
  return (
    <video
      key={src}
      ref={videoRef}
      src={src}
      controls
      onTimeUpdate={onTimeUpdate}
      style={{ width: "100%", maxHeight: 480, borderRadius: 10, background: "#000", display: "block" }}
    />
  );
}

function VideoContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [paso, setPaso] = useState<"form" | "generando" | "revision" | "uniendo" | "listo" | "error">("form");
  const [imagenesUrls, setImagenesUrls] = useState<string[]>([]);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [argumentacion, setArgumentacion] = useState("");
  const [textoCta, setTextoCta] = useState("");
  const [jobId, setJobId] = useState<string | null>(null);
  // true si se llegó con ?returnTo=estrategia -- controla el formulario
  // (fotos read-only, sin campo de CTA). La decisión de a dónde volver al
  // terminar la unión NO depende de este estado sino de una clave en
  // localStorage (ver el efecto de precarga abajo), para que sobreviva
  // aunque el usuario cierre la pestaña y retome por notificación (?job=),
  // que no trae el ?returnTo= en la URL.
  const [modoWizard, setModoWizard] = useState(false);
  const [precargandoFotos, setPrecargandoFotos] = useState(false);
  const [segmentos, setSegmentos] = useState<Segmento[]>([]);
  const [regeneracionesUsadas, setRegeneracionesUsadas] = useState(0);
  const [videoFinalUrl, setVideoFinalUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [regenerandoOrden, setRegenerandoOrden] = useState<number | null>(null);
  const [segmentoSeleccionado, setSegmentoSeleccionado] = useState(0);
  const [progreso, setProgreso] = useState(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Si el usuario llega desde una notificación (?job=<id>), retoma el
  // estado real del job en vez de arrancar el formulario desde cero.
  useEffect(() => {
    const jid = searchParams.get("job");
    if (!jid) return;
    setJobId(jid);

    (async () => {
      try {
        const res = await fetch(`/api/video-jobs/${jid}`);
        const data: EstadoVideoJob = await res.json();
        if (!data.ok) {
          setErrorMsg(data.error || "No se pudo recuperar este video.");
          setPaso("error");
          return;
        }
        if (data.estado === "generando_fragmentos") {
          setPaso("generando");
          const listo = await pollVideoJobHasta(jid, ESTADOS_TERMINALES_GENERACION);
          if (listo.estado === "error") {
            setErrorMsg(listo.error_mensaje || "No se pudo generar el video.");
            setPaso("error");
          } else {
            setSegmentos(listo.segmentos.sort((a, b) => a.orden - b.orden));
            setRegeneracionesUsadas(listo.regeneraciones_usadas);
            setTextoCta(listo.texto_cta || "");
            setPaso("revision");
          }
        } else if (data.estado === "revision_pendiente" || data.estado === "regenerando_fragmento") {
          setSegmentos(data.segmentos.sort((a, b) => a.orden - b.orden));
          setRegeneracionesUsadas(data.regeneraciones_usadas);
          setTextoCta(data.texto_cta || "");
          setPaso("revision");
        } else if (data.estado === "uniendo") {
          setPaso("uniendo");
          const listo = await pollVideoJobHasta(jid, ESTADOS_TERMINALES_UNION);
          if (listo.estado === "error") {
            setErrorMsg(listo.error_mensaje || "No se pudo unir el video.");
            setPaso("error");
          } else {
            setVideoFinalUrl(listo.video_final_url);
            setPaso("listo");
          }
        } else if (data.estado === "listo") {
          setVideoFinalUrl(data.video_final_url);
          setPaso("listo");
        } else if (data.estado === "error") {
          setErrorMsg(data.error_mensaje || "No se pudo generar el video.");
          setPaso("error");
        }
      } catch (e: any) {
        setErrorMsg(e?.message || "No se pudo recuperar este video.");
        setPaso("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Si se llega desde el wizard de estrategia (?returnTo=estrategia), no
  // se repiten las fotos ni la descripción (paso 2 del wizard) ni se pide
  // el CTA a mano -- se leen 3 claves de localStorage que el wizard ya
  // mantiene al día por su cuenta (nada de esto duplica estado nuevo):
  // quiubot_imagenes_producto_base64, quiubot_descripcion_visual_producto,
  // quiubot_estrategia_seleccionada (de ahí sale el CTA del primer anuncio
  // recomendado, mismo campo que ya reusa el flujo de álbum). El CTA sigue
  // editable más adelante en la pantalla de revisión, solo se oculta el
  // campo inicial del formulario.
  useEffect(() => {
    if (searchParams.get("job")) return; // ese flujo (arriba) tiene prioridad
    if (searchParams.get("returnTo") !== "estrategia") return;

    setModoWizard(true);
    try {
      localStorage.setItem("quiubot_video_return_to", "estrategia");
    } catch {}

    const descGuardada = localStorage.getItem("quiubot_descripcion_visual_producto");
    if (descGuardada) setArgumentacion(descGuardada);

    const estrategiaGuardada = localStorage.getItem("quiubot_estrategia_seleccionada");
    if (estrategiaGuardada) {
      try {
        const estrategia = JSON.parse(estrategiaGuardada);
        const ctaResuelto = estrategia?.conjuntos?.[0]?.anuncios?.[0]?.copy?.cta || "Comprar ahora";
        setTextoCta(ctaResuelto);
      } catch {}
    }

    const imgsGuardadas = localStorage.getItem("quiubot_imagenes_producto_base64");
    if (!imgsGuardadas) return;

    (async () => {
      setPrecargandoFotos(true);
      try {
        const base64s: string[] = JSON.parse(imgsGuardadas);
        const urls: string[] = [];
        const errores: string[] = [];
        for (const b64 of base64s.slice(0, MAX_IMAGENES)) {
          const blob = base64ToBlob(b64);
          const formData = new FormData();
          formData.append("archivo", blob, "foto.jpg");
          const res = await fetch("/api/album/subir", { method: "POST", body: formData });
          const data = await res.json().catch(() => ({}));
          if (res.ok && data.url) {
            urls.push(data.url);
          } else {
            errores.push(data.error || `Error ${res.status}`);
          }
        }
        setImagenesUrls(urls);
        if (urls.length === 0) {
          setErrorMsg(`No se pudieron preparar las fotos que subiste en el wizard: ${errores[0] || "error desconocido"}`);
        }
      } catch (e: any) {
        setErrorMsg(`No se pudieron preparar las fotos que subiste en el wizard: ${e?.message || "error desconocido"}`);
      } finally {
        setPrecargandoFotos(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubirImagenes = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const disponibles = MAX_IMAGENES - imagenesUrls.length;
    if (disponibles <= 0) return;

    setSubiendoImagen(true);
    setErrorMsg(null);
    try {
      const nuevas: string[] = [];
      for (const archivo of Array.from(files).slice(0, disponibles)) {
        const formData = new FormData();
        formData.append("archivo", archivo);
        const res = await fetch("/api/album/subir", { method: "POST", body: formData });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.url) {
          setErrorMsg(data.error || "No se pudo subir una de las imágenes.");
          continue;
        }
        nuevas.push(data.url);
      }
      setImagenesUrls((prev) => [...prev, ...nuevas]);
    } finally {
      setSubiendoImagen(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleQuitarImagen = (idx: number) => {
    setImagenesUrls((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleGenerar = async () => {
    if (imagenesUrls.length < MIN_IMAGENES) return;
    setErrorMsg(null);
    setPaso("generando");
    try {
      const res = await fetch("/api/generar-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagenes_producto_urls: imagenesUrls,
          argumentacion,
          texto_cta: textoCta,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.job_id) {
        setErrorMsg(data.error || "No se pudo iniciar la generación del video.");
        setPaso("form");
        return;
      }
      setJobId(data.job_id);
      const listo = await pollVideoJobHasta(data.job_id, ESTADOS_TERMINALES_GENERACION);
      if (listo.estado === "error") {
        setErrorMsg(listo.error_mensaje || "No se pudo generar el video.");
        setPaso("error");
        return;
      }
      setSegmentos(listo.segmentos.sort((a, b) => a.orden - b.orden));
      setRegeneracionesUsadas(listo.regeneraciones_usadas);
      setTextoCta(listo.texto_cta || textoCta);
      setPaso("revision");
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo conectar con el servidor.");
      setPaso("form");
    }
  };

  const handleRegenerarFragmento = async (orden: number) => {
    if (!jobId || regeneracionesUsadas >= LIMITE_REGENERACIONES) return;
    setRegenerandoOrden(orden);
    setErrorMsg(null);
    try {
      const res = await fetch("/api/regenerar-fragmento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, orden }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setErrorMsg(data.error || "No se pudo regenerar este fragmento.");
        return;
      }
      const listo = await pollVideoJobHasta(jobId, ["revision_pendiente", "error"]);
      if (listo.estado === "error") {
        setErrorMsg(listo.error_mensaje || "No se pudo regenerar este fragmento.");
        return;
      }
      setSegmentos(listo.segmentos.sort((a, b) => a.orden - b.orden));
      setRegeneracionesUsadas(listo.regeneraciones_usadas);
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo conectar con el servidor.");
    } finally {
      setRegenerandoOrden(null);
    }
  };

  const handleSeleccionarFragmento = (orden: number) => {
    setSegmentoSeleccionado(orden);
    setProgreso(0);
  };

  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v || !v.duration) return;
    setProgreso((v.currentTime / v.duration) * 100);
  };

  const handleConfirmarUnion = async () => {
    if (!jobId) return;
    setErrorMsg(null);
    setPaso("uniendo");
    try {
      const res = await fetch("/api/confirmar-union-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, texto_cta: textoCta }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.ok === false) {
        setErrorMsg(data.error || "No se pudo confirmar la unión del video.");
        setPaso("revision");
        return;
      }
      const listo = await pollVideoJobHasta(jobId, ESTADOS_TERMINALES_UNION);
      if (listo.estado === "error") {
        setErrorMsg(listo.error_mensaje || "No se pudo unir el video.");
        setPaso("error");
        return;
      }
      setVideoFinalUrl(listo.video_final_url);

      // Si se vino del wizard de estrategia (aunque haya sido por
      // notificación, sin ?returnTo= en esta URL puntual), se vuelve
      // directo al paso 6 con el video ya armado, en vez de mostrar la
      // pantalla de resultado standalone.
      let vuelveAEstrategia = false;
      try {
        vuelveAEstrategia = localStorage.getItem("quiubot_video_return_to") === "estrategia";
      } catch {}
      if (vuelveAEstrategia) {
        try {
          localStorage.removeItem("quiubot_video_return_to");
        } catch {}
        router.push(`/estrategia?step=6&videoJobId=${jobId}`);
        return;
      }

      setPaso("listo");
    } catch (e: any) {
      setErrorMsg(e?.message || "No se pudo conectar con el servidor.");
      setPaso("revision");
    }
  };

  const handleEmpezarDeNuevo = () => {
    setPaso("form");
    // En modo wizard las fotos/descripción/CTA vienen precargadas y no hay
    // forma de volver a cargarlas desde este botón (no hay uploader) -- se
    // conservan tal cual para poder reintentar sin perderlas.
    if (!modoWizard) {
      setImagenesUrls([]);
      setArgumentacion("");
      setTextoCta("");
    }
    setJobId(null);
    setSegmentos([]);
    setRegeneracionesUsadas(0);
    setVideoFinalUrl(null);
    setErrorMsg(null);
    setSegmentoSeleccionado(0);
    setProgreso(0);
  };

  const pageStyle: React.CSSProperties = {
    minHeight: "100vh",
    background: "#f9f9f8",
    fontFamily: "system-ui, sans-serif",
    padding: "2rem",
  };
  const containerStyle: React.CSSProperties = { maxWidth: 860, margin: "0 auto" };
  const cardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #e8e8e6",
    borderRadius: 16,
    padding: "1.75rem",
  };

  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={{ marginBottom: "1.5rem" }}>
          <a href="/" style={{ color: "#7F77DD", textDecoration: "none", fontSize: 14 }}>← Volver</a>
        </div>

        <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#1a1a1a" }}>Video con IA</h1>
        <p style={{ fontSize: 13, color: "#999", marginBottom: "1.5rem" }}>
          Sube las fotos de tu producto y genera un video de 4 fragmentos (hook, contenido, cierre) listo para Meta Ads.
        </p>

        {errorMsg && (
          <div style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#b91c1c", borderRadius: 10, padding: "10px 14px", fontSize: 13, marginBottom: 16 }}>
            {errorMsg}
          </div>
        )}

        {paso === "form" && (
          <div style={cardStyle}>
            {modoWizard ? (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#1a1a1a" }}>Fotos de tu producto</p>
                <p style={{ fontSize: 11.5, color: "#999", marginTop: -6, marginBottom: 10 }}>
                  Las mismas que subiste en el paso 2 del wizard.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 20 }}>
                  {precargandoFotos && <p style={{ fontSize: 12.5, color: "#999" }}>Preparando tus fotos...</p>}
                  {!precargandoFotos &&
                    imagenesUrls.map((url) => (
                      <img key={url} src={url} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, border: "1px solid #e0e0e0" }} />
                    ))}
                </div>
              </>
            ) : (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 10, color: "#1a1a1a" }}>1. Fotos de tu producto (1 a 3)</p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 12 }}>
                  {imagenesUrls.map((url, idx) => (
                    <div key={url} style={{ position: "relative", width: 96, height: 96 }}>
                      <img src={url} alt="" style={{ width: 96, height: 96, objectFit: "cover", borderRadius: 10, border: "1px solid #e0e0e0" }} />
                      <button
                        onClick={() => handleQuitarImagen(idx)}
                        style={{ position: "absolute", top: -6, right: -6, width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 12, cursor: "pointer" }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {imagenesUrls.length < MAX_IMAGENES && (
                    <label
                      style={{
                        width: 96, height: 96, borderRadius: 10, border: "1.5px dashed #d0d0d0",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 12, color: "#999", cursor: subiendoImagen ? "not-allowed" : "pointer", textAlign: "center",
                      }}
                    >
                      {subiendoImagen ? "Subiendo..." : "+ Subir foto"}
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        disabled={subiendoImagen}
                        onChange={(e) => handleSubirImagenes(e.target.files)}
                        style={{ display: "none" }}
                      />
                    </label>
                  )}
                </div>
              </>
            )}

            <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#1a1a1a" }}>
              {modoWizard ? "Cuéntanos de tu producto (opcional)" : "2. Cuéntanos de tu producto (opcional)"}
            </p>
            <textarea
              value={argumentacion}
              onChange={(e) => setArgumentacion(e.target.value)}
              placeholder="Ej: Crema hidratante facial, ideal para piel seca, hecha en Colombia..."
              style={{ width: "100%", minHeight: 70, padding: 10, borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, resize: "vertical", boxSizing: "border-box", marginBottom: modoWizard ? 20 : 16, fontFamily: "inherit" }}
            />

            {!modoWizard && (
              <>
                <p style={{ fontSize: 14, fontWeight: 600, marginBottom: 8, color: "#1a1a1a" }}>3. Texto del llamado a la acción (opcional)</p>
                <input
                  value={textoCta}
                  onChange={(e) => setTextoCta(e.target.value)}
                  placeholder="Ej: Compra ahora"
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box", marginBottom: 20 }}
                />
                <p style={{ fontSize: 11.5, color: "#999", marginTop: -14, marginBottom: 20 }}>
                  Se puede editar de nuevo más adelante, antes de unir el video final.
                </p>
              </>
            )}

            <button
              onClick={handleGenerar}
              disabled={imagenesUrls.length < MIN_IMAGENES || subiendoImagen || precargandoFotos}
              style={{
                width: "100%", background: imagenesUrls.length < MIN_IMAGENES || precargandoFotos ? "#ccc" : "#534AB7", color: "#fff",
                border: "none", padding: 14, borderRadius: 10, fontSize: 15, fontWeight: 600,
                cursor: imagenesUrls.length < MIN_IMAGENES || precargandoFotos ? "not-allowed" : "pointer",
              }}
            >
              Generar video →
            </button>
          </div>
        )}

        {paso === "generando" && (
          <div style={cardStyle}>
            <CargandoQuiubot mensaje="Generando los 4 fragmentos de tu video (puede tardar hasta 20 minutos)" />
          </div>
        )}

        {paso === "uniendo" && (
          <div style={cardStyle}>
            <CargandoQuiubot mensaje="Uniendo tu video final" />
          </div>
        )}

        {paso === "revision" && (() => {
          const activo = segmentos.find((s) => s.orden === segmentoSeleccionado) || segmentos[0];
          const regenerandoActivo = regenerandoOrden === segmentoSeleccionado;
          return (
            <div>
              <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 4 }}>Revisa tus fragmentos</p>
              <p style={{ fontSize: 12.5, color: "#999", marginBottom: 16 }}>
                Regeneraciones usadas: {regeneracionesUsadas}/{LIMITE_REGENERACIONES}
              </p>

              <div style={cardStyle}>
                {/* Player grande -- mismo componente que la pantalla de resultado final */}
                <div style={{ position: "relative", marginBottom: 10 }}>
                  {activo && <VideoPlayerGrande src={activo.url_video} videoRef={videoRef} onTimeUpdate={handleTimeUpdate} />}
                  {regenerandoActivo && (
                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.35)", borderRadius: 10 }}>
                      <div style={{ width: 32, height: 32, border: "3px solid rgba(255,255,255,0.35)", borderTopColor: "#fff", borderRadius: "50%", animation: "girarVideo 0.9s linear infinite" }} />
                    </div>
                  )}
                </div>

                {/* Barra delgada de progreso, tipo "stories" -- una franja por fragmento */}
                <div style={{ display: "flex", gap: 4, marginBottom: 14 }}>
                  {segmentos.map((s) => {
                    const pct = s.orden < segmentoSeleccionado ? 100 : s.orden === segmentoSeleccionado ? progreso : 0;
                    return (
                      <div key={s.orden} style={{ flex: 1, height: 3, borderRadius: 2, background: "#ECE9F7", overflow: "hidden" }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: "#7F77DD", transition: "width 0.1s linear" }} />
                      </div>
                    );
                  })}
                </div>

                {/* Filmstrip de miniaturas -- click para seleccionar, icono de regenerar superpuesto */}
                <div style={{ display: "flex", gap: 10 }}>
                  {segmentos.map((s) => {
                    const regenerando = regenerandoOrden === s.orden;
                    const seleccionado = s.orden === segmentoSeleccionado;
                    return (
                      <div
                        key={s.orden}
                        onClick={() => handleSeleccionarFragmento(s.orden)}
                        style={{
                          position: "relative", flex: 1, cursor: "pointer", borderRadius: 8, overflow: "hidden",
                          border: seleccionado ? "2px solid #534AB7" : "2px solid transparent",
                        }}
                      >
                        <video src={s.url_video} muted style={{ width: "100%", height: 64, objectFit: "cover", display: "block", opacity: regenerando ? 0.4 : 1, background: "#f3f2fe" }} />
                        <div style={{ position: "absolute", bottom: 3, left: 5, fontSize: 9.5, fontWeight: 700, color: "#fff", textShadow: "0 1px 2px rgba(0,0,0,0.7)" }}>
                          {TIPO_LABEL[s.tipo_segmento] || s.tipo_segmento}
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRegenerarFragmento(s.orden);
                          }}
                          disabled={regenerando || regeneracionesUsadas >= LIMITE_REGENERACIONES}
                          title={regeneracionesUsadas >= LIMITE_REGENERACIONES ? "Ya usaste tus 2 regeneraciones gratis" : "Regenerar este fragmento"}
                          style={{
                            position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: "50%",
                            border: "none", background: "rgba(0,0,0,0.55)", color: "#fff", fontSize: 11,
                            display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
                            cursor: regenerando || regeneracionesUsadas >= LIMITE_REGENERACIONES ? "not-allowed" : "pointer",
                            opacity: regeneracionesUsadas >= LIMITE_REGENERACIONES ? 0.5 : 1,
                          }}
                        >
                          {regenerando ? (
                            <span style={{ width: 10, height: 10, border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "#fff", borderRadius: "50%", display: "block", animation: "girarVideo 0.8s linear infinite" }} />
                          ) : (
                            "🔄"
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ ...cardStyle, marginTop: 16 }}>
                <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 8, color: "#1a1a1a" }}>Texto del llamado a la acción</p>
                <input
                  value={textoCta}
                  onChange={(e) => setTextoCta(e.target.value)}
                  placeholder="Ej: Compra ahora"
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box", marginBottom: 16 }}
                />
                <button
                  onClick={handleConfirmarUnion}
                  style={{ width: "100%", background: "#534AB7", color: "#fff", border: "none", padding: 14, borderRadius: 10, fontSize: 15, fontWeight: 600, cursor: "pointer" }}
                >
                  Confirmar y unir video final →
                </button>
              </div>
            </div>
          );
        })()}

        {paso === "listo" && videoFinalUrl && (
          <div style={cardStyle}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 12 }}>🎬 Tu video está listo</p>
            <div style={{ marginBottom: 16 }}>
              <VideoPlayerGrande src={videoFinalUrl} />
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <a
                href={videoFinalUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ flex: 1, textAlign: "center", background: "#534AB7", color: "#fff", padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600, textDecoration: "none" }}
              >
                Descargar / abrir
              </a>
              <button
                onClick={handleEmpezarDeNuevo}
                style={{ flex: 1, background: "#fff", border: "1px solid #e0e0e0", color: "#534AB7", padding: 12, borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
              >
                Generar otro video
              </button>
            </div>
          </div>
        )}

        {paso === "error" && (
          <div style={{ ...cardStyle, textAlign: "center" }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", marginBottom: 8 }}>No se pudo generar el video</p>
            <p style={{ fontSize: 13, color: "#666", marginBottom: 16 }}>{errorMsg || "Ocurrió un error inesperado."}</p>
            <button
              onClick={handleEmpezarDeNuevo}
              style={{ background: "#534AB7", color: "#fff", border: "none", padding: "10px 20px", borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}
            >
              Intentar de nuevo
            </button>
          </div>
        )}
      </div>
      <style>{`@keyframes girarVideo { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function VideoPage() {
  return (
    <Suspense fallback={<CargandoQuiubot mensaje="Cargando" />}>
      <VideoContent />
    </Suspense>
  );
}

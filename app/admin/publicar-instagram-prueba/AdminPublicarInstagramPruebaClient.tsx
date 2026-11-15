"use client";
import { useEffect, useState } from "react";

type VideoAlbum = {
  id: string;
  url_imagen: string;
  public_id: string;
  creado_en: string;
};

type EstadoPublicacion = "inactivo" | "creando" | "procesando" | "publicando" | "listo" | "error";

const INTERVALO_VERIFICACION_MS = 4000;
const MAX_INTENTOS_VERIFICACION = 30; // ~2 minutos

export default function AdminPublicarInstagramPruebaClient() {
  const [videos, setVideos] = useState<VideoAlbum[]>([]);
  const [cargandoVideos, setCargandoVideos] = useState(true);
  const [errorVideos, setErrorVideos] = useState<string | null>(null);

  const [videoSeleccionado, setVideoSeleccionado] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [estado, setEstado] = useState<EstadoPublicacion>("inactivo");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [permalink, setPermalink] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/album?tipo=video&limit=20");
        const data = await res.json();
        if (!res.ok) {
          setErrorVideos(data.error || "No se pudieron cargar los videos del álbum.");
          return;
        }
        setVideos(data.imagenes || []);
      } catch {
        setErrorVideos("No se pudo conectar con el servidor.");
      } finally {
        setCargandoVideos(false);
      }
    })();
  }, []);

  async function publicar() {
    if (!videoSeleccionado) return;
    setEstado("creando");
    setMensaje(null);
    setPermalink(null);

    try {
      const crearRes = await fetch("/api/admin/publicar-instagram-prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "crear_contenedor", album_id: videoSeleccionado, caption }),
      });
      const crearData = await crearRes.json();
      if (!crearRes.ok) {
        setEstado("error");
        setMensaje(crearData.error || "No se pudo crear el contenedor en Instagram.");
        return;
      }

      const { container_id, ig_user_id } = crearData as { container_id: string; ig_user_id: string };

      setEstado("procesando");
      let listo = false;
      for (let intento = 0; intento < MAX_INTENTOS_VERIFICACION; intento++) {
        await new Promise((r) => setTimeout(r, INTERVALO_VERIFICACION_MS));
        const verificarRes = await fetch("/api/admin/publicar-instagram-prueba", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "verificar_estado", container_id }),
        });
        const verificarData = await verificarRes.json();
        if (!verificarRes.ok) {
          setEstado("error");
          setMensaje(verificarData.error || "No se pudo verificar el video en Instagram.");
          return;
        }
        if (verificarData.status_code === "FINISHED") {
          listo = true;
          break;
        }
        if (verificarData.status_code === "ERROR" || verificarData.status_code === "EXPIRED") {
          setEstado("error");
          setMensaje(`Instagram no pudo procesar el video (${verificarData.status_code}).`);
          return;
        }
      }

      if (!listo) {
        setEstado("error");
        setMensaje("Instagram está tardando más de lo esperado en procesar el video. Intenta de nuevo en unos minutos.");
        return;
      }

      setEstado("publicando");
      const publicarRes = await fetch("/api/admin/publicar-instagram-prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "publicar", container_id, ig_user_id }),
      });
      const publicarData = await publicarRes.json();
      if (!publicarRes.ok) {
        setEstado("error");
        setMensaje(publicarData.error || "No se pudo publicar el video en Instagram.");
        return;
      }

      setPermalink(publicarData.permalink || null);
      setEstado("listo");
    } catch {
      setEstado("error");
      setMensaje("No se pudo conectar con el servidor.");
    }
  }

  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: "3rem 1.5rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#17152B", marginBottom: 4 }}>
        Publicar en Instagram (prueba, solo admin)
      </h1>
      <p style={{ fontSize: 13, color: "#999", marginBottom: 28 }}>
        Flujo mínimo para probar instagram_content_publish de punta a punta con un video real
        del álbum. No es el publicador de contenido orgánico (eso sigue en pausa) — publica un
        video a la vez, a mano.
      </p>

      {cargandoVideos && <p style={{ fontSize: 13, color: "#666" }}>Cargando videos del álbum...</p>}
      {errorVideos && <p style={{ fontSize: 13, color: "#b91c1c" }}>{errorVideos}</p>}

      {!cargandoVideos && !errorVideos && videos.length === 0 && (
        <p style={{ fontSize: 13, color: "#666" }}>No tienes videos en tu álbum todavía.</p>
      )}

      {!cargandoVideos && videos.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
          {videos.map((video) => (
            <label
              key={video.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: 10,
                border: `1px solid ${videoSeleccionado === video.id ? "#534AB7" : "#e8e8e6"}`,
                borderRadius: 10,
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name="video"
                checked={videoSeleccionado === video.id}
                onChange={() => setVideoSeleccionado(video.id)}
              />
              <video src={video.url_imagen} muted style={{ width: 60, height: 60, objectFit: "cover", borderRadius: 6, background: "#000" }} />
              <span style={{ fontSize: 12, color: "#333" }}>{video.public_id}</span>
            </label>
          ))}
        </div>
      )}

      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        placeholder="Caption del reel (opcional)"
        rows={3}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #e8e8e6", fontSize: 13, marginBottom: 16, boxSizing: "border-box" }}
      />

      <button
        type="button"
        onClick={publicar}
        disabled={!videoSeleccionado || estado === "creando" || estado === "procesando" || estado === "publicando"}
        style={{
          padding: "10px 18px",
          borderRadius: 8,
          border: "1px solid #534AB7",
          background: "#534AB7",
          color: "#fff",
          fontSize: 13,
          fontWeight: 600,
          cursor: !videoSeleccionado ? "not-allowed" : "pointer",
          opacity: !videoSeleccionado ? 0.5 : 1,
        }}
      >
        {estado === "creando" && "Creando contenedor en Instagram..."}
        {estado === "procesando" && "Instagram está procesando el video..."}
        {estado === "publicando" && "Publicando..."}
        {(estado === "inactivo" || estado === "listo" || estado === "error") && "Publicar en Instagram"}
      </button>

      {estado === "error" && mensaje && (
        <p style={{ fontSize: 13, color: "#b91c1c", marginTop: 14 }}>{mensaje}</p>
      )}

      {estado === "listo" && (
        <p style={{ fontSize: 13, color: "#0F7A3C", marginTop: 14 }}>
          Publicado.{" "}
          {permalink && (
            <a href={permalink} target="_blank" rel="noreferrer" style={{ color: "#534AB7", fontWeight: 600 }}>
              Ver en Instagram →
            </a>
          )}
        </p>
      )}
    </div>
  );
}

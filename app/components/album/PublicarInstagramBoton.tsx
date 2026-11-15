"use client";
import { useState } from "react";

// Botón real de "Publicar en Instagram" para cualquier video del
// álbum -- vive en el panel de detalle de /album (ver app/album/
// page.tsx). Reusa la ruta app/api/album/[id]/publicar-instagram/
// route.ts (misma lógica que antes vivía solo en la pantalla de
// prueba de admin). Nada automático: publicar exige que el usuario
// escriba el caption (opcional) y haga clic en "Publicar" a propósito.
type Estado = "inactivo" | "abierto" | "creando" | "procesando" | "publicando" | "listo" | "error";

const INTERVALO_VERIFICACION_MS = 4000;
const MAX_INTENTOS_VERIFICACION = 30; // ~2 minutos

export default function PublicarInstagramBoton({ albumId }: { albumId: string }) {
  const [estado, setEstado] = useState<Estado>("inactivo");
  const [caption, setCaption] = useState("");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [accionError, setAccionError] = useState<{ texto: string; url: string } | null>(null);
  const [permalink, setPermalink] = useState<string | null>(null);

  async function publicar() {
    setEstado("creando");
    setMensaje(null);
    setAccionError(null);
    setPermalink(null);

    try {
      const crearRes = await fetch(`/api/album/${albumId}/publicar-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "crear_contenedor", caption }),
      });
      const crearData = await crearRes.json();
      if (!crearRes.ok) {
        setEstado("error");
        setMensaje(crearData.error || "No se pudo crear el contenedor en Instagram.");
        setAccionError(crearData.accion || null);
        return;
      }

      const { container_id, ig_user_id } = crearData as { container_id: string; ig_user_id: string };

      setEstado("procesando");
      let listo = false;
      for (let intento = 0; intento < MAX_INTENTOS_VERIFICACION; intento++) {
        await new Promise((r) => setTimeout(r, INTERVALO_VERIFICACION_MS));
        const verificarRes = await fetch(`/api/album/${albumId}/publicar-instagram`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accion: "verificar_estado", container_id }),
        });
        const verificarData = await verificarRes.json();
        if (!verificarRes.ok) {
          setEstado("error");
          setMensaje(verificarData.error || "No se pudo verificar el video en Instagram.");
          setAccionError(verificarData.accion || null);
          return;
        }
        if (verificarData.status_code === "FINISHED") {
          listo = true;
          break;
        }
        if (verificarData.status_code === "ERROR" || verificarData.status_code === "EXPIRED") {
          setEstado("error");
          setMensaje("Instagram no pudo procesar el video.");
          return;
        }
      }

      if (!listo) {
        setEstado("error");
        setMensaje("Instagram está tardando más de lo esperado en procesar el video. Intenta de nuevo en unos minutos.");
        return;
      }

      setEstado("publicando");
      const publicarRes = await fetch(`/api/album/${albumId}/publicar-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "publicar", container_id, ig_user_id }),
      });
      const publicarData = await publicarRes.json();
      if (!publicarRes.ok) {
        setEstado("error");
        setMensaje(publicarData.error || "No se pudo publicar el video en Instagram.");
        setAccionError(publicarData.accion || null);
        return;
      }

      setPermalink(publicarData.permalink || null);
      setEstado("listo");
    } catch {
      setEstado("error");
      setMensaje("No se pudo conectar con el servidor.");
    }
  }

  if (estado === "inactivo") {
    return (
      <button
        type="button"
        onClick={() => setEstado("abierto")}
        style={{ width: "100%", border: "1.5px solid #534AB7", background: "#fff", color: "#534AB7", borderRadius: 12, padding: "10px", font: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
      >
        Publicar en Instagram
      </button>
    );
  }

  const publicando = estado === "creando" || estado === "procesando" || estado === "publicando";

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: 8 }}>
      {estado === "abierto" && (
        <>
          <label htmlFor={`caption-${albumId}`} style={{ fontSize: 12, fontWeight: 600, color: "#1B1A22" }}>
            Caption del reel (opcional)
          </label>
          <textarea
            id={`caption-${albumId}`}
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={2}
            style={{ width: "100%", padding: 8, borderRadius: 8, border: "1px solid #E9E7EE", fontSize: 13, boxSizing: "border-box" }}
          />
          <div style={{ display: "flex", gap: 8 }}>
            <button
              type="button"
              onClick={() => setEstado("inactivo")}
              style={{ flex: 1, border: "1.5px solid #E9E7EE", background: "#fff", color: "#1B1A22", borderRadius: 12, padding: "10px", font: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={publicar}
              style={{ flex: 1, border: "none", background: "#534AB7", color: "#fff", borderRadius: 12, padding: "10px", font: "inherit", fontWeight: 700, fontSize: 14, cursor: "pointer" }}
            >
              Publicar
            </button>
          </div>
        </>
      )}

      {publicando && (
        <p style={{ fontSize: 13, color: "#6B6880", margin: 0 }}>
          {estado === "creando" && "Creando el reel en Instagram..."}
          {estado === "procesando" && "Instagram está procesando el video..."}
          {estado === "publicando" && "Publicando..."}
        </p>
      )}

      {estado === "error" && mensaje && (
        <p style={{ fontSize: 13, color: "#DC2626", margin: 0 }}>
          {mensaje}{" "}
          {accionError && (
            <a href={accionError.url} style={{ color: "#534AB7", fontWeight: 600 }}>
              {accionError.texto}
            </a>
          )}
        </p>
      )}
      {estado === "error" && (
        <button
          type="button"
          onClick={() => setEstado("inactivo")}
          style={{ alignSelf: "flex-start", border: "none", background: "none", color: "#534AB7", fontSize: 13, fontWeight: 600, cursor: "pointer", padding: 0 }}
        >
          Intentar de nuevo
        </button>
      )}

      {estado === "listo" && (
        <p style={{ fontSize: 14, color: "#0F7A3C", margin: 0, fontWeight: 600 }}>
          Publicado.{" "}
          {permalink ? (
            <a href={permalink} target="_blank" rel="noreferrer" style={{ color: "#534AB7" }}>
              Ver el reel en Instagram →
            </a>
          ) : (
            "(Meta no devolvió el enlace público todavía.)"
          )}
        </p>
      )}
    </div>
  );
}

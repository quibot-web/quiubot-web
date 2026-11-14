"use client";

import { useEffect, useState, useCallback, use } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import EditorEscena from "@/app/video/EditorEscena";
import { labelReceta, type PublicacionOrganica } from "@/app/lib/contenido";
import type { Guion, Escena } from "@/video/guion.schema";
import type { MediosResueltos } from "@/video/escenas/tipos";
import { duracionEnCuadros } from "@/video/Composicion";

const VistaPrevia = dynamic(() => import("@/app/video/VistaPrevia"), { ssr: false });

type Paso = "cargando" | "sin-acceso" | "no-encontrada" | "revision";

export default function RevisionPiezaPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>("cargando");
  const [pieza, setPieza] = useState<PublicacionOrganica | null>(null);
  const [medios, setMedios] = useState<MediosResueltos>({});
  const [guion, setGuion] = useState<Guion | null>(null);
  const [caption, setCaption] = useState("");
  const [hashtagsTexto, setHashtagsTexto] = useState("");
  const [generando, setGenerando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [aprobando, setAprobando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    const res = await fetch(`/api/contenido/${id}`);
    if (!res.ok) {
      setPaso("no-encontrada");
      return;
    }
    const data = await res.json();
    const p = data.pieza as PublicacionOrganica;
    setPieza(p);
    setMedios((data.medios as MediosResueltos) ?? {});
    setGuion((p.guion as Guion | null) ?? null);
    setCaption(p.caption || "");
    setHashtagsTexto((p.hashtags || []).join(" "));
    setPaso("revision");
  }, [id]);

  useEffect(() => {
    (async () => {
      try {
        const rolRes = await fetch("/api/usuario/rol");
        const rolData = await rolRes.json();
        if (rolData.rol !== "admin") {
          setPaso("sin-acceso");
          return;
        }
        await cargar();
      } catch {
        setPaso("sin-acceso");
      }
    })();
  }, [cargar]);

  async function generarGuion() {
    setGenerando(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/contenido/${id}/guion`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudo generar el guion.");
        return;
      }
      setGuion(data.guion as Guion);
      setCaption(data.guion.publicacion?.caption || "");
      setHashtagsTexto((data.guion.publicacion?.hashtags || []).join(" "));
    } catch {
      setErrorMsg("No se pudo generar el guion.");
    } finally {
      setGenerando(false);
    }
  }

  function cambiarEscena(indice: number, nueva: Escena) {
    if (!guion) return;
    const escenas = [...guion.escenas];
    escenas[indice] = nueva;
    setGuion({ ...guion, escenas });
  }

  async function guardarCambios() {
    if (!guion) return;
    setGuardando(true);
    setErrorMsg(null);
    try {
      const hashtags = hashtagsTexto.split(/\s+/).filter(Boolean);
      const guionConPublicacion: Guion = { ...guion, publicacion: { caption, hashtags } };
      const res = await fetch(`/api/contenido/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "editar", guion: guionConPublicacion, caption, hashtags }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudo guardar.");
        return;
      }
      setGuion(guionConPublicacion);
    } catch {
      setErrorMsg("No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function aprobar() {
    setAprobando(true);
    setErrorMsg(null);
    try {
      await guardarCambios();
      const res = await fetch(`/api/contenido/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "aprobar" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudo aprobar.");
        return;
      }
      router.push("/contenido");
    } catch {
      setErrorMsg("No se pudo aprobar.");
    } finally {
      setAprobando(false);
    }
  }

  if (paso === "cargando") return <PantallaCentro texto="Cargando…" />;
  if (paso === "sin-acceso") return <PantallaCentro texto="No tienes acceso a esta sección." />;
  if (paso === "no-encontrada") return <PantallaCentro texto="Esta pieza no existe." />;
  if (!pieza) return null;

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "24px 20px" }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <button type="button" onClick={() => router.push("/contenido")} style={{ ...botonSecundario, marginBottom: 16 }}>
          ← Volver al calendario
        </button>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a", margin: "0 0 4px" }}>{labelReceta(pieza.receta_organica)}</h1>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 20px" }}>
          Programada para {new Date(pieza.programada_para).toLocaleString("es-CO", { timeZone: "America/Bogota" })}
        </p>

        {errorMsg && <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 16 }}>{errorMsg}</p>}

        {!guion && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e5e5", padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 16 }}>Esta pieza todavía no tiene guion.</p>
            <button type="button" onClick={generarGuion} disabled={generando} style={botonPrimario}>
              {generando ? "Generando…" : "Generar guion"}
            </button>
          </div>
        )}

        {guion && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 24, alignItems: "start" }}>
            <div>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                <button type="button" onClick={generarGuion} disabled={generando} style={botonSecundario}>
                  {generando ? "Regenerando…" : "Regenerar guion"}
                </button>
              </div>
              {guion.escenas.map((escena, i) => (
                <EditorEscena
                  key={escena.id}
                  escena={escena}
                  piezas={Object.entries(medios).map(([mid, m]) => ({ id: mid, url_imagen: m.url, tipo: m.tipo }))}
                  onCambiar={(nueva) => cambiarEscena(i, nueva)}
                  onElegirPieza={() => {}}
                />
              ))}

              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e5e5", padding: 16, marginTop: 10 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 6 }}>Caption</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  maxLength={2200}
                  rows={4}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }}
                />
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 6 }}>Hashtags (separados por espacio)</label>
                <input
                  value={hashtagsTexto}
                  onChange={(e) => setHashtagsTexto(e.target.value)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit" }}
                />
              </div>

              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                <button type="button" onClick={guardarCambios} disabled={guardando} style={botonSecundario}>
                  {guardando ? "Guardando…" : "Guardar cambios"}
                </button>
                <button type="button" onClick={aprobar} disabled={aprobando} style={botonPrimario}>
                  {aprobando ? "Aprobando…" : "Aprobar"}
                </button>
              </div>
            </div>

            <div style={{ position: "sticky", top: 24 }}>
              <VistaPrevia guion={guion} medios={medios} pistaUrl={null} mostrarZonaSegura={false} />
              <p style={{ fontSize: 11, color: "#888", marginTop: 8 }}>{(duracionEnCuadros(guion) / guion.fps).toFixed(1)}s</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function PantallaCentro({ texto }: { texto: string }) {
  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui, sans-serif", color: "#666" }}>
      {texto}
    </div>
  );
}

const botonPrimario: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "none",
  background: "#534AB7",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const botonSecundario: React.CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid #534AB7",
  background: "#fff",
  color: "#534AB7",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

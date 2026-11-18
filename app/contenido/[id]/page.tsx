"use client";

import { useEffect, useState, useCallback, use } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import EditorEscena from "@/app/video/EditorEscena";
import { rotuloEscena } from "@/app/lib/videoOrganico/rotuloEscena";
import { labelReceta, formatoFechaLarga, evaluarEliminacion, puedePublicarAhora, type PublicacionOrganica } from "@/app/lib/contenido";
import ConfirmarEliminarReel from "../ConfirmarEliminarReel";
import SelectorFechaHora from "../SelectorFechaHora";
import { urlDescargaCloudinary } from "@/app/lib/cloudinaryUrl";
import type { Guion, Escena } from "@/video/guion.schema";
import type { MediosResueltos } from "@/video/escenas/tipos";
import { duracionEnCuadros } from "@/video/Composicion";
import { duracionReelAutomaticoEnCuadros } from "@/video/visuales/ReelAutomatico";

const VistaPrevia = dynamic(() => import("@/app/video/VistaPrevia"), { ssr: false });
const VistaPreviaConVoz = dynamic(() => import("@/app/video/VistaPreviaConVoz"), { ssr: false });

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
  const [tema, setTema] = useState("");
  const [guardandoTema, setGuardandoTema] = useState(false);
  const [avisoInfoIncompleta, setAvisoInfoIncompleta] = useState(false);
  const [textoCopiado, setTextoCopiado] = useState(false);
  const [pistaUrl, setPistaUrl] = useState<string | null>(null);
  const [pistaSinLicencia, setPistaSinLicencia] = useState(false);
  const [avisoSinMusica, setAvisoSinMusica] = useState(false);
  const [pistasDisponibles, setPistasDisponibles] = useState<{ id: string; nombre: string | null; mood: string; licencia_url: string | null }[]>([]);
  const [guardandoMusica, setGuardandoMusica] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [esPiezaConVoz, setEsPiezaConVoz] = useState(false);
  const [vozDesactualizada, setVozDesactualizada] = useState(false);
  const [regenerandoVoz, setRegenerandoVoz] = useState(false);
  const [confirmandoEliminar, setConfirmandoEliminar] = useState(false);
  const [publicandoAhora, setPublicandoAhora] = useState(false);
  // Guardado explícito (no solo "ya pasó el gate de arriba") para que,
  // el día que esta pantalla se abra a clientes, la distinción
  // admin/cliente de generarGuion() siga siendo correcta sin tener que
  // recordar tocarla -- hoy esto es admin-only, así que rol siempre es
  // "admin" acá, pero la rama "else" ya queda lista.
  const [rol, setRol] = useState<string | null>(null);

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
    setTema(p.tema || "");
    setAvisoInfoIncompleta(!!data.avisoInfoIncompleta);
    setPistaUrl((data.pistaUrl as string | null) ?? null);
    setPistaSinLicencia(!!data.pistaSinLicencia);
    setAvisoSinMusica(!!data.avisoSinMusica);
    setEsPiezaConVoz(!!data.esPiezaConVoz);
    setVozDesactualizada(!!data.vozDesactualizada);
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
        setRol(rolData.rol);
        // Lista de pistas para el selector "elegir música a mano" --
        // mismo endpoint que ya usa /video, cualquier admin puede verlas
        // todas (ver lib/accesoMusica.ts).
        fetch("/api/admin/musica")
          .then((r) => r.json())
          .then((d) => setPistasDisponibles(d.pistas ?? []))
          .catch(() => {});
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
        // resumenErrores: motivos reales del último intento (pedido
        // explícito) -- solo para admin. El cliente (cuando exista acá)
        // sigue viendo nada más que data.error, ya genérico.
        if (rol === "admin" && Array.isArray(data.resumenErrores) && data.resumenErrores.length > 0) {
          setErrorMsg(`${data.error || "No se pudo generar un guion válido."}\n${data.resumenErrores.map((e: string) => `• ${e}`).join("\n")}`);
        } else {
          setErrorMsg(data.error || "No se pudo generar el guion.");
        }
        return;
      }
      setGuion(data.guion as Guion);
      setCaption(data.guion.publicacion?.caption || "");
      setHashtagsTexto((data.guion.publicacion?.hashtags || []).join(" "));
      // Caso real (staging, 18 nov 2026): el reproductor seguía con el
      // diseño viejo (texto sobre fondo) hasta salir y volver a entrar --
      // esPiezaConVoz, la pista y vozDesactualizada los calcula el
      // servidor en GET y no se pedían de nuevo tras generar. Se recarga
      // la pieza completa (el guion ya quedó guardado por la ruta).
      await cargar();
    } catch {
      setErrorMsg("No se pudo generar el guion.");
    } finally {
      setGenerando(false);
    }
  }

  async function guardarTema() {
    setGuardandoTema(true);
    try {
      await fetch(`/api/contenido/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "tema", tema }),
      });
    } finally {
      setGuardandoTema(false);
    }
  }

  async function guardarMusica(nuevoPistaId: string | null) {
    setGuardandoMusica(true);
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/contenido/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "musica", pista_id: nuevoPistaId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || "No se pudo guardar la música.");
        return;
      }
      await cargar();
    } catch {
      setErrorMsg("No se pudo guardar la música.");
    } finally {
      setGuardandoMusica(false);
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
      // Recarga (en vez de solo setGuion local) para que
      // vozDesactualizada venga recalculada de verdad contra la
      // narración recién guardada -- ese cálculo es server-only
      // (hashNarracion.ts), no se puede repetir en el cliente.
      await cargar();
    } catch {
      setErrorMsg("No se pudo guardar.");
    } finally {
      setGuardando(false);
    }
  }

  async function regenerarVoz() {
    setRegenerandoVoz(true);
    setErrorMsg(null);
    try {
      await guardarCambios();
      const res = await fetch(`/api/contenido/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accion: "regenerar_voz" }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (rol === "admin" && Array.isArray(data.resumenErrores) && data.resumenErrores.length > 0) {
          setErrorMsg(`${data.error || "No se pudo regenerar la voz."}\n${data.resumenErrores.map((e: string) => `• ${e}`).join("\n")}`);
        } else {
          setErrorMsg(data.error || "No se pudo regenerar la voz.");
        }
        return;
      }
      await cargar();
    } catch {
      setErrorMsg("No se pudo regenerar la voz.");
    } finally {
      setRegenerandoVoz(false);
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
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "space-between", marginBottom: 16 }}>
          <button type="button" onClick={() => router.push("/contenido")} style={botonSecundario}>
            ← Volver al calendario
          </button>
          {pieza.estado !== "cancelada" && (
            <button
              type="button"
              onClick={() => setConfirmandoEliminar(true)}
              disabled={evaluarEliminacion(pieza.estado).permitido === false}
              title={evaluarEliminacion(pieza.estado).permitido ? undefined : "Se está publicando en este momento."}
              style={{ ...botonSecundario, borderColor: "#E8A0A0", color: "#B91C1C", opacity: evaluarEliminacion(pieza.estado).permitido ? 1 : 0.5 }}
            >
              {pieza.estado === "publicada" ? "Quitar del calendario" : "Eliminar reel"}
            </button>
          )}
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#1a1a1a", margin: "0 0 4px" }}>{labelReceta(pieza.receta_organica)}</h1>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 20px" }}>
          {pieza.estado === "cancelada" ? "Eliminado -- ya no aparece en el calendario ni se publicará." : `Programada para ${formatoFechaLarga(pieza.programada_para)}`}
        </p>

        {puedePublicarAhora(pieza) && (
          <div style={{ background: "#FEF6E7", border: "1px solid #F0C36D", borderRadius: 14, padding: 16, marginBottom: 12, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#8A6416", fontWeight: 700, flex: 1 }}>
              {pieza.estado === "error"
                ? pieza.tipo_error === "revisar_publicacion"
                  ? "Antes de reintentar, revisa tu Instagram: si el reel ya salió, no lo vuelvas a publicar. Si no salió, reinténtalo ahora (sale en los próximos minutos) o elige una nueva fecha abajo."
                  : "Cuando hayas resuelto el problema de arriba, reintenta la publicación (sale en los próximos minutos) o elige una nueva fecha abajo."
                : "Este reel ya tiene su video pero se pasó su hora. Publícalo ahora (sale en los próximos minutos) o elige una nueva fecha abajo."}
            </span>
            <button
              type="button"
              style={botonPrimario}
              disabled={publicandoAhora}
              onClick={async () => {
                setPublicandoAhora(true);
                setErrorMsg(null);
                try {
                  const res = await fetch(`/api/contenido/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "publicar_ahora" }) });
                  const data = await res.json();
                  if (!res.ok) setErrorMsg(data.error || "No se pudo programar la publicación.");
                  await cargar();
                } catch {
                  setErrorMsg("No se pudo programar la publicación.");
                } finally {
                  setPublicandoAhora(false);
                }
              }}
            >
              {publicandoAhora ? "Programando…" : pieza.estado === "error" ? "Reintentar publicación" : "Publicar ahora"}
            </button>
          </div>
        )}

        <SelectorFechaHora key={`${pieza.programada_para}-${pieza.estado}`} pieza={pieza} onGuardado={cargar} />

        {confirmandoEliminar && (
          <ConfirmarEliminarReel piezaId={pieza.id} onCerrar={() => setConfirmandoEliminar(false)} onEliminado={() => router.push("/contenido")} />
        )}

        {errorMsg && <p style={{ color: "#b91c1c", fontSize: 13, marginBottom: 16, whiteSpace: "pre-line" }}>{errorMsg}</p>}

        {guion && avisoInfoIncompleta && (
          <p style={{ background: "#FEF6E7", border: "1px solid #F0C36D", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#8A6416", marginBottom: 16 }}>
            Tus reels serán más útiles si completas &ldquo;Lo que deben saber&rdquo; en Mi marca.
          </p>
        )}

        {guion && avisoSinMusica && (
          <p style={{ background: "#FEF6E7", border: "1px solid #F0C36D", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#8A6416", marginBottom: 16 }}>
            Sin música: no hay pistas con licencia.
          </p>
        )}

        {guion && esPiezaConVoz && vozDesactualizada && (
          <p style={{ background: "#FDECEC", border: "1px solid #E8A0A0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#8A1F1F", fontWeight: 700, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ flex: 1 }}>La narración se editó después de generar la voz -- regenérala antes de aprobar.</span>
            <button type="button" onClick={regenerarVoz} disabled={regenerandoVoz} style={{ ...botonPrimario, padding: "6px 12px", fontSize: 12 }}>
              {regenerandoVoz ? "Regenerando voz…" : "Regenerar voz"}
            </button>
          </p>
        )}

        {guion && pistaSinLicencia && (
          <p style={{ background: "#FDECEC", border: "1px solid #E8A0A0", borderRadius: 10, padding: "10px 14px", fontSize: 13, color: "#8A1F1F", fontWeight: 700, marginBottom: 16 }}>
            ⚠ Solo pruebas, no publicar -- la pista elegida no tiene licencia.
          </p>
        )}

        {pieza.estado === "error" && pieza.tipo_error === "calidad" && (
          <div style={{ background: "#FDECEC", border: "1px solid #E8A0A0", borderRadius: 14, padding: 16, marginBottom: 16 }}>
            <p style={{ fontSize: 13, color: "#8A1F1F", fontWeight: 700, margin: "0 0 8px" }}>El control de calidad rechazó este reel.</p>
            {Array.isArray(pieza.control_calidad?.hallazgos) && (
              <ul style={{ fontSize: 12, color: "#8A1F1F", margin: "0 0 10px", paddingLeft: 18 }}>
                {(pieza.control_calidad!.hallazgos as string[]).map((h, i) => (
                  <li key={i}>{h}</li>
                ))}
              </ul>
            )}
            <button
              type="button"
              style={{ ...botonSecundario, borderColor: "#8A1F1F", color: "#8A1F1F" }}
              onClick={async () => {
                await fetch(`/api/contenido/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "forzar_sin_calidad" }) });
                await cargar();
              }}
            >
              Forzar de todos modos
            </button>
          </div>
        )}

        {pieza.estado === "publicada" && (
          <div style={{ background: "#EAF7F0", border: "1px solid #9FD8BA", borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#1E6B47", fontWeight: 700, flex: 1 }}>Publicado en Instagram por el Publicador.</span>
            {pieza.permalink && (
              <a href={pieza.permalink} target="_blank" rel="noopener noreferrer" style={{ ...botonSecundario, textDecoration: "none", display: "inline-block" }}>
                Ver en Instagram
              </a>
            )}
          </div>
        )}

        {pieza.estado === "error" && pieza.tipo_error !== "calidad" && pieza.error && (
          <div style={{ background: "#FDECEC", border: "1px solid #E8A0A0", borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#8A1F1F", fontWeight: 700, flex: 1 }}>{pieza.error}</span>
            {(pieza.tipo_error === "reconexion" || pieza.tipo_error === "sin_instagram") && (
              <a href="/api/meta/conectar" style={{ ...botonSecundario, borderColor: "#8A1F1F", color: "#8A1F1F", textDecoration: "none", display: "inline-block" }}>
                Reconectar Meta
              </a>
            )}
          </div>
        )}

        {pieza.estado === "lista" && pieza.control_calidad?.aprobado === false && !pieza.control_calidad?.publicarIgual && (
          <div style={{ background: "#FEF6E7", border: "1px solid #F0C36D", borderRadius: 14, padding: 16, marginBottom: 16, display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#8A6416", fontWeight: 700, flex: 1 }}>Lista, no aprobada: requiere confirmación -- el control de calidad no pasó y esta pieza se forzó.</span>
            <button
              type="button"
              style={botonPrimario}
              onClick={async () => {
                await fetch(`/api/contenido/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accion: "publicar_igual" }) });
                await cargar();
              }}
            >
              Publicar de todos modos
            </button>
          </div>
        )}

        {pieza.estado === "lista" && pieza.url_video && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e5e5", padding: 16, marginBottom: 16, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 700, marginRight: "auto" }}>Video listo -- descárgalo para subirlo a TikTok</span>
            <a href={urlDescargaCloudinary(pieza.url_video)} download style={{ ...botonSecundario, textDecoration: "none", display: "inline-block" }}>
              Descargar video
            </a>
            <button
              type="button"
              style={botonSecundario}
              onClick={async () => {
                const texto = `${caption}\n\n${hashtagsTexto}`;
                try {
                  await navigator.clipboard.writeText(texto);
                  setTextoCopiado(true);
                  setTimeout(() => setTextoCopiado(false), 2000);
                } catch {
                  // Sin permiso de portapapeles -- no es crítico, la marca
                  // puede seleccionar y copiar el caption a mano.
                }
              }}
            >
              {textoCopiado ? "¡Copiado!" : "Copiar texto para TikTok"}
            </button>
          </div>
        )}

        {!guion && (
          <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e5e5", padding: 24, textAlign: "center" }}>
            <p style={{ fontSize: 14, color: "#666", marginBottom: 12 }}>Esta pieza todavía no tiene guion.</p>
            <div style={{ textAlign: "left", maxWidth: 420, margin: "0 auto 16px" }}>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 6 }}>Tema (opcional)</label>
              <input
                value={tema}
                onChange={(e) => setTema(e.target.value)}
                onBlur={guardarTema}
                maxLength={200}
                placeholder='Ej. "por qué tus anuncios no traen mensajes"'
                disabled={guardandoTema}
                style={{ width: "100%", padding: 10, borderRadius: 8, border: "1px solid #ddd", fontSize: 13, fontFamily: "inherit" }}
              />
            </div>
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
                  rotulo={rotuloEscena(guion.escenas, i)}
                  piezas={Object.entries(medios).map(([mid, m]) => ({ id: mid, url_imagen: m.url, tipo: m.tipo }))}
                  onCambiar={(nueva) => cambiarEscena(i, nueva)}
                  onElegirPieza={() => {}}
                />
              ))}

              <div style={{ background: "#fff", borderRadius: 14, border: "1px solid #e5e5e5", padding: 16, marginTop: 10 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#444", marginBottom: 6 }}>
                  Música{pistaSinLicencia ? " -- SOLO PRUEBAS, NO PUBLICAR" : ""}
                </label>
                <select
                  value={guion.musica.pista_id ?? ""}
                  disabled={guardandoMusica}
                  onChange={(e) => guardarMusica(e.target.value || null)}
                  style={{ width: "100%", padding: 10, borderRadius: 8, border: pistaSinLicencia ? "1px solid #E8A0A0" : "1px solid #ddd", fontSize: 13, fontFamily: "inherit", marginBottom: 12 }}
                >
                  <option value="">Sin música</option>
                  {pistasDisponibles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre || p.id.slice(0, 8)} ({p.mood}){!p.licencia_url ? " -- solo pruebas" : ""}
                    </option>
                  ))}
                </select>

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
                <button type="button" onClick={aprobar} disabled={aprobando || (esPiezaConVoz && vozDesactualizada)} style={botonPrimario}>
                  {aprobando ? "Aprobando…" : "Aprobar"}
                </button>
              </div>
            </div>

            <div style={{ position: "sticky", top: 24 }}>
              {esPiezaConVoz || !!guion.vozUrl ? (
                <VistaPreviaConVoz guion={guion} pistaMusicaUrl={pistaUrl} medios={medios} />
              ) : (
                <VistaPrevia guion={guion} medios={medios} pistaUrl={pistaUrl} mostrarZonaSegura={false} />
              )}
              <p style={{ fontSize: 11, color: "#888", marginTop: 8 }}>
                {((esPiezaConVoz || !!guion.vozUrl ? duracionReelAutomaticoEnCuadros(guion) : duracionEnCuadros(guion)) / guion.fps).toFixed(1)}s
              </p>
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

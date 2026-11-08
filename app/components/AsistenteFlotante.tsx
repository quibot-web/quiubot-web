"use client"
import { useEffect, useRef, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente"
import type { AsistenteId, EstadoEsfera } from "@/app/components/esferas/esferasShared"
import type { ContextoCuentaDirector } from "@/app/lib/director/contextoCuenta"
import { NOMBRE_CHAT, ESFERA_POR_CHAT, type ChatEquipoId } from "@/app/lib/director/chatsEquipo"
import type { ContenidoMeta } from "@/app/lib/director/flujoCrearMeta"
import PanelDirectorGeneral from "@/app/components/burbuja/PanelDirectorGeneral"
import PanelSoporte from "@/app/components/burbuja/PanelSoporte"
import PanelAsistenteIndividual from "@/app/components/burbuja/PanelAsistenteIndividual"
import ListaChats from "@/app/components/burbuja/ListaChats"

type MensajeSoporte = { rol: "user" | "assistant"; mensaje: string; creadoEn: string }
type AccionDirector = { label: string; tipo: "link" | "crear_meta" | "ir_a_soporte"; href?: string }
type MensajeDirector = { rol: "user" | "assistant"; mensaje: string; acciones?: AccionDirector[]; contenido?: ContenidoMeta | null; creado_en?: string }

const RUTAS_PUBLICAS = ["/bienvenida", "/login", "/terminos", "/pricing"]

type Vista = "lista" | ChatEquipoId

// Fase 2, Commit 5/5 -- la burbuja ahora abre en una LISTA de chats
// (docs/diseno/director_lista_chats.html), no en una pestaña fija:
// Equipo (lleva a /equipo, página completa), Director, cada asistente
// con chat propio, Soporte. Reemplaza las pestañas Director/Soporte
// del Paso 6 de la Fase 1 -- esos dos paneles siguen siendo los mismos
// componentes, solo cambia cómo se llega a ellos.
export default function AsistenteFlotante() {
  const pathname = usePathname()
  const router = useRouter()
  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) => pathname?.startsWith(ruta))

  const [mostrar, setMostrar] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [vista, setVista] = useState<Vista>("lista")
  const [estadoDirector, setEstadoDirector] = useState<"listo" | "pensando">("listo")

  const [soporteActivo, setSoporteActivo] = useState(false)
  const [soporteHistorial, setSoporteHistorial] = useState<MensajeSoporte[]>([])
  const [autoenviarSoporte, setAutoenviarSoporte] = useState<string | null>(null)

  const [directorActivo, setDirectorActivo] = useState(false)
  const [directorHistorial, setDirectorHistorial] = useState<MensajeDirector[]>([])
  const [autoenviarDirector, setAutoenviarDirector] = useState<string | null>(null)
  const [metaActivaId, setMetaActivaId] = useState<string | null>(null)
  const [contexto, setContexto] = useState<ContextoCuentaDirector | null>(null)

  const cargado = useRef(false)

  useEffect(() => {
    if (esRutaPublica || cargado.current) return
    cargado.current = true

    fetch("/api/asistente")
      .then((res) => res.json())
      .then((data) => {
        setMostrar(!!data.mostrar)
        if (!data.mostrar) return

        setSoporteActivo(!!data.activo)
        if (Array.isArray(data.historial)) {
          setSoporteHistorial(data.historial.map((h: { rol: "user" | "assistant"; mensaje: string; creado_en: string }) => ({ rol: h.rol, mensaje: h.mensaje, creadoEn: h.creado_en })))
        }

        fetch("/api/director/conversacion")
          .then((r) => r.json())
          .then((d) => {
            setDirectorActivo(!!d.activo)
            if (Array.isArray(d.mensajes)) setDirectorHistorial(d.mensajes)
            setMetaActivaId(d.metaActiva?.conversacionId ?? null)
          })
          .catch(() => {})

        fetch("/api/director/contexto")
          .then((r) => (r.ok ? r.json() : null))
          .then((c) => setContexto(c))
          .catch(() => {})
      })
      .catch(() => setMostrar(false))
  }, [esRutaPublica])

  function abrirChat(chat: ChatEquipoId) {
    setVista(chat)
    setAbierto(true)
    fetch("/api/equipo/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat }) }).catch(() => {})
  }

  // Otras partes de la app (ej. la tarjeta "¿No sabes cuál elegir?" del
  // carrusel de objetivos en /estrategia) abren este chat sin acceso
  // directo a su estado -- siempre abrían Soporte directo, eso no
  // cambia con la lista nueva.
  useEffect(() => {
    const abrir = () => abrirChat("soporte")
    window.addEventListener("quiubot:abrir-asistente", abrir)
    return () => window.removeEventListener("quiubot:abrir-asistente", abrir)
  }, [])

  // Tocar la mascota de un mensaje de evento en /equipo abre su chat
  // individual acá, con el detalle {chat} (ver app/equipo/page.tsx).
  useEffect(() => {
    const abrir = (e: Event) => {
      const chat = (e as CustomEvent<{ chat: ChatEquipoId }>).detail?.chat
      if (chat) abrirChat(chat)
    }
    window.addEventListener("quiubot:abrir-chat-equipo", abrir)
    return () => window.removeEventListener("quiubot:abrir-chat-equipo", abrir)
  }, [])

  if (esRutaPublica || !mostrar) return null

  const irASoporte = (pregunta: string) => {
    abrirChat("soporte")
    if (pregunta) setAutoenviarSoporte(pregunta)
  }
  const irADirector = (pregunta: string) => {
    abrirChat("director")
    if (pregunta) setAutoenviarDirector(pregunta)
  }

  const estadoEsferaDirector: EstadoEsfera = estadoDirector === "pensando" ? "trabajando" : "normal"
  const mostrarAvisoProactivo = !abierto && !!contexto && contexto.propuestasPendientes > 0

  const tituloVista = vista === "lista" ? "Quiubot" : NOMBRE_CHAT[vista]
  const esferaVista: AsistenteId | null = vista === "lista" ? null : vista === "director" ? "director" : vista === "soporte" ? "soporte" : (ESFERA_POR_CHAT[vista] ?? null)

  return (
    <div data-tour="asistente-flotante" style={{ position: "fixed", bottom: 24, right: 24, zIndex: 1000, fontFamily: "system-ui, sans-serif" }}>
      <style>{`
        @keyframes qbSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes qbPulse {
          0% { box-shadow: 0 0 0 0 rgba(127,119,221,0.45); }
          70% { box-shadow: 0 0 0 14px rgba(127,119,221,0); }
          100% { box-shadow: 0 0 0 0 rgba(127,119,221,0); }
        }
        .qb-boton-flotante:hover .qb-anillo {
          animation-duration: 1.4s;
        }
      `}</style>

      {mostrarAvisoProactivo && (
        <button
          onClick={() => abrirChat("director")}
          style={{
            display: "block",
            marginBottom: 10,
            marginLeft: "auto",
            maxWidth: 220,
            background: "#fff",
            border: "1px solid #e8e8e6",
            borderRadius: "14px 14px 4px 14px",
            padding: "10px 14px",
            fontSize: 12.5,
            color: "#1a1a1a",
            textAlign: "left",
            cursor: "pointer",
            boxShadow: "0 6px 20px rgba(0,0,0,0.1)",
          }}
        >
          Tienes {contexto!.propuestasPendientes} propuesta{contexto!.propuestasPendientes === 1 ? "" : "s"} pendiente{contexto!.propuestasPendientes === 1 ? "" : "s"} →
        </button>
      )}

      {abierto && (
        <div
          style={
            pantallaCompleta
              ? { position: "fixed", inset: 20, background: "#fff", borderRadius: 18, boxShadow: "0 8px 32px rgba(0,0,0,0.25)", display: "flex", flexDirection: "column", overflow: "hidden", border: "1px solid #e8e8e6", zIndex: 1001 }
              : { width: 360, height: 500, background: "#fff", borderRadius: 18, boxShadow: "0 8px 32px rgba(0,0,0,0.16)", display: "flex", flexDirection: "column", marginBottom: 12, overflow: "hidden", border: "1px solid #e8e8e6" }
          }
        >
          <div style={{ background: "#534AB7", color: "#fff", padding: "12px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {vista !== "lista" && (
                <button onClick={() => setVista("lista")} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: 0 }} aria-label="Volver a la lista">
                  ←
                </button>
              )}
              {esferaVista && <EsferaAsistente asistente={esferaVista} estado={vista === "director" ? estadoEsferaDirector : "normal"} tamano={30} />}
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, display: "block" }}>{tituloVista}</span>
                {vista === "director" && <span style={{ fontSize: 11, opacity: 0.85 }}>{estadoDirector === "pensando" ? "Pensando..." : "Listo"}</span>}
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                onClick={() => setPantallaCompleta((v) => !v)}
                aria-label={pantallaCompleta ? "Salir de pantalla completa" : "Pantalla completa"}
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 16, lineHeight: 1, opacity: 0.9 }}
              >
                {pantallaCompleta ? "⤡" : "⤢"}
              </button>
              <button onClick={() => setAbierto(false)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1 }}>
                ×
              </button>
            </div>
          </div>

          {vista === "lista" && <ListaChats onAbrirChat={abrirChat} onAbrirEquipo={() => { setAbierto(false); router.push("/equipo") }} />}
          {vista === "director" && (
            <PanelDirectorGeneral
              activo={directorActivo}
              historialInicial={directorHistorial}
              metaActivaId={metaActivaId}
              contexto={contexto}
              autoenviar={autoenviarDirector}
              onConsumidoAutoenviar={() => setAutoenviarDirector(null)}
              onIrASoporte={irASoporte}
              onCambiarEstado={setEstadoDirector}
            />
          )}
          {vista === "soporte" && (
            <PanelSoporte activo={soporteActivo} historialInicial={soporteHistorial} autoenviar={autoenviarSoporte} onConsumidoAutoenviar={() => setAutoenviarSoporte(null)} onIrADirector={irADirector} />
          )}
          {(vista === "marca" || vista === "estratega" || vista === "creativo" || vista === "publicador" || vista === "analista" || vista === "optimizador") && (
            <PanelAsistenteIndividual asistente={vista} onPreguntarAlDirector={irADirector} />
          )}
        </div>
      )}

      <div className="qb-boton-flotante" style={{ position: "relative", width: 60, height: 60, animation: "qbPulse 2.8s infinite", borderRadius: "50%" }}>
        <div
          className="qb-anillo"
          style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 0deg, #7F77DD, #534AB7, #C4BFF0, #7F77DD)", animation: "qbSpin 3.2s linear infinite" }}
        />
        <button
          onClick={() => setAbierto((v) => !v)}
          style={{ position: "absolute", inset: 3, borderRadius: "50%", background: "#fff", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          {abierto ? <span style={{ color: "#534AB7", fontSize: 22, fontWeight: 300 }}>×</span> : <EsferaAsistente asistente="director" estado="normal" tamano={38} />}
        </button>
      </div>
    </div>
  )
}

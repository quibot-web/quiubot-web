"use client"
import { useEffect, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente"
import type { EstadoEsfera } from "@/app/components/esferas/esferasShared"
import type { ContextoCuentaDirector } from "@/app/lib/director/contextoCuenta"
import PanelDirectorGeneral from "@/app/components/burbuja/PanelDirectorGeneral"
import PanelSoporte from "@/app/components/burbuja/PanelSoporte"

type MensajeSoporte = { rol: "user" | "assistant"; mensaje: string }
type AccionDirector = { label: string; tipo: "link" | "crear_meta" | "ir_a_soporte"; href?: string }
type MensajeDirector = { rol: "user" | "assistant"; mensaje: string; acciones?: AccionDirector[] }

const RUTAS_PUBLICAS = ["/bienvenida", "/login", "/terminos", "/pricing"]

// Paso 6/6 de la burbuja del Director -- dos pestañas visibles (la
// burbuja siempre fue "Asistente Quiubot"/Soporte; ahora el Director
// de Quiubot es el modo principal y Soporte queda aparte). La pestaña
// "Equipo" (Fase 2, grupo de mascotas) se agrega después -- este
// switcher ya está armado para sumarla sin rehacer nada de acá.
export default function AsistenteFlotante() {
  const pathname = usePathname()
  const esRutaPublica = RUTAS_PUBLICAS.some((ruta) => pathname?.startsWith(ruta))

  const [mostrar, setMostrar] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [pantallaCompleta, setPantallaCompleta] = useState(false)
  const [pestana, setPestana] = useState<"director" | "soporte">("director")
  const [estadoDirector, setEstadoDirector] = useState<"listo" | "pensando">("listo")

  const [soporteActivo, setSoporteActivo] = useState(false)
  const [soporteHistorial, setSoporteHistorial] = useState<MensajeSoporte[]>([])
  const [autoenviarSoporte, setAutoenviarSoporte] = useState<string | null>(null)

  const [directorActivo, setDirectorActivo] = useState(false)
  const [directorHistorial, setDirectorHistorial] = useState<MensajeDirector[]>([])
  const [autoenviarDirector, setAutoenviarDirector] = useState<string | null>(null)
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
          setSoporteHistorial(data.historial.map((h: { rol: "user" | "assistant"; mensaje: string }) => ({ rol: h.rol, mensaje: h.mensaje })))
        }

        fetch("/api/director/conversacion")
          .then((r) => r.json())
          .then((d) => {
            setDirectorActivo(!!d.activo)
            if (Array.isArray(d.mensajes)) setDirectorHistorial(d.mensajes)
          })
          .catch(() => {})

        fetch("/api/director/contexto")
          .then((r) => (r.ok ? r.json() : null))
          .then((c) => setContexto(c))
          .catch(() => {})
      })
      .catch(() => setMostrar(false))
  }, [esRutaPublica])

  // Otras partes de la app (ej. la tarjeta "¿No sabes cuál elegir?" del
  // carrusel de objetivos en /estrategia) abren este chat sin acceso
  // directo a su estado -- siempre abrían el chat de soporte, eso no
  // cambia con las pestañas nuevas.
  useEffect(() => {
    const abrir = () => {
      setPestana("soporte")
      setAbierto(true)
    }
    window.addEventListener("quiubot:abrir-asistente", abrir)
    return () => window.removeEventListener("quiubot:abrir-asistente", abrir)
  }, [])

  if (esRutaPublica || !mostrar) return null

  const irASoporte = (pregunta: string) => {
    setPestana("soporte")
    if (pregunta) setAutoenviarSoporte(pregunta)
  }
  const irADirector = (pregunta: string) => {
    setPestana("director")
    if (pregunta) setAutoenviarDirector(pregunta)
  }

  const estadoEsferaDirector: EstadoEsfera = estadoDirector === "pensando" ? "trabajando" : "normal"
  const mostrarAvisoProactivo = !abierto && !!contexto && contexto.propuestasPendientes > 0

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
          onClick={() => {
            setPestana("director")
            setAbierto(true)
          }}
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
              <EsferaAsistente asistente={pestana === "director" ? "director" : "soporte"} estado={pestana === "director" ? estadoEsferaDirector : "normal"} tamano={30} />
              <div>
                <span style={{ fontWeight: 700, fontSize: 14, display: "block" }}>{pestana === "director" ? "Director de Quiubot" : "Soporte Quiubot"}</span>
                {pestana === "director" && (
                  <span style={{ fontSize: 11, opacity: 0.85 }}>{estadoDirector === "pensando" ? "Pensando..." : "Listo"}</span>
                )}
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
              <button
                onClick={() => setAbierto(false)}
                style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
              >
                ×
              </button>
            </div>
          </div>

          <div style={{ display: "flex", background: "#F3F2FE", padding: 4, gap: 4, margin: "10px 10px 0" }}>
            {(["director", "soporte"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setPestana(t)}
                style={{
                  flex: 1,
                  textAlign: "center",
                  padding: "7px 0",
                  borderRadius: 9,
                  fontSize: 12.5,
                  fontWeight: 700,
                  color: "#534AB7",
                  border: "none",
                  cursor: "pointer",
                  background: pestana === t ? "#fff" : "transparent",
                  boxShadow: pestana === t ? "0 2px 6px rgba(0,0,0,.08)" : "none",
                }}
              >
                {t === "director" ? "💬 Director" : "🎧 Soporte"}
              </button>
            ))}
          </div>

          {pestana === "director" ? (
            <PanelDirectorGeneral
              activo={directorActivo}
              historialInicial={directorHistorial}
              contexto={contexto}
              autoenviar={autoenviarDirector}
              onConsumidoAutoenviar={() => setAutoenviarDirector(null)}
              onIrASoporte={irASoporte}
              onCambiarEstado={setEstadoDirector}
            />
          ) : (
            <PanelSoporte
              activo={soporteActivo}
              historialInicial={soporteHistorial}
              autoenviar={autoenviarSoporte}
              onConsumidoAutoenviar={() => setAutoenviarSoporte(null)}
              onIrADirector={irADirector}
            />
          )}
        </div>
      )}

      <div
        className="qb-boton-flotante"
        style={{
          position: "relative",
          width: 60,
          height: 60,
          animation: "qbPulse 2.8s infinite",
          borderRadius: "50%",
        }}
      >
        <div
          className="qb-anillo"
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "50%",
            background: "conic-gradient(from 0deg, #7F77DD, #534AB7, #C4BFF0, #7F77DD)",
            animation: "qbSpin 3.2s linear infinite",
          }}
        />
        <button
          onClick={() => setAbierto((v) => !v)}
          style={{
            position: "absolute",
            inset: 3,
            borderRadius: "50%",
            background: "#fff",
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {abierto ? <span style={{ color: "#534AB7", fontSize: 22, fontWeight: 300 }}>×</span> : <EsferaAsistente asistente="director" estado="normal" tamano={38} />}
        </button>
      </div>
    </div>
  )
}

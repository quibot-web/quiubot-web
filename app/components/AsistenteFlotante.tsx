"use client"
import { useEffect, useRef, useState } from "react"

type Mensaje = {
  rol: "user" | "assistant"
  mensaje: string
}

export default function AsistenteFlotante() {
  const [mostrar, setMostrar] = useState(false)
  const [activo, setActivo] = useState(false)
  const [abierto, setAbierto] = useState(false)
  const [mensajes, setMensajes] = useState<Mensaje[]>([])
  const [texto, setTexto] = useState("")
  const [enviando, setEnviando] = useState(false)
  const [escalar, setEscalar] = useState(false)
  const finRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetch("/api/asistente")
      .then((res) => res.json())
      .then((data) => {
        setMostrar(!!data.mostrar)
        setActivo(!!data.activo)
        if (data.historial) {
          setMensajes(
            data.historial.map((h: any) => ({ rol: h.rol, mensaje: h.mensaje }))
          )
        }
      })
      .catch(() => setMostrar(false))
  }, [])

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [mensajes, abierto])

  async function enviar() {
    const contenido = texto.trim()
    if (!contenido || enviando) return

    setMensajes((prev) => [...prev, { rol: "user", mensaje: contenido }])
    setTexto("")
    setEnviando(true)

    try {
      const res = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: contenido }),
      })
      const data = await res.json()

      if (!res.ok) {
        setMensajes((prev) => [
          ...prev,
          { rol: "assistant", mensaje: data.error || "Algo salió mal, intenta de nuevo." },
        ])
      } else {
        setMensajes((prev) => [...prev, { rol: "assistant", mensaje: data.respuesta }])
        if (data.escalar) setEscalar(true)
      }
    } catch {
      setMensajes((prev) => [
        ...prev,
        { rol: "assistant", mensaje: "No se pudo conectar. Intenta de nuevo en un momento." },
      ])
    } finally {
      setEnviando(false)
    }
  }

  if (!mostrar) return null

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

      {abierto && (
        <div
          style={{
            width: 340,
            height: 460,
            background: "#fff",
            borderRadius: 18,
            boxShadow: "0 8px 32px rgba(0,0,0,0.16)",
            display: "flex",
            flexDirection: "column",
            marginBottom: 12,
            overflow: "hidden",
            border: "1px solid #e8e8e6",
          }}
        >
          <div
            style={{
              background: "#7F77DD",
              color: "#fff",
              padding: "14px 16px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <span style={{ fontWeight: 600, fontSize: 14 }}>Asistente Quiubot</span>
            <button
              onClick={() => setAbierto(false)}
              style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", fontSize: 18, lineHeight: 1 }}
            >
              ×
            </button>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {!activo ? (
              <div
                style={{
                  background: "#f5f4fb",
                  border: "1px solid #e3e1f7",
                  borderRadius: 12,
                  padding: "14px 16px",
                  fontSize: 13,
                  color: "#444",
                  textAlign: "center",
                }}
              >
                Para activar el asistente, conecta tu cuenta de OpenAI en{" "}
                <a href="/integraciones" style={{ color: "#7F77DD", fontWeight: 600 }}>
                  Integraciones
                </a>
                .
              </div>
            ) : mensajes.length === 0 ? (
              <div style={{ color: "#999", fontSize: 13, textAlign: "center", marginTop: 20 }}>
                Pregúntame lo que necesites sobre Quiubot.
              </div>
            ) : (
              mensajes.map((m, i) => (
                <div
                  key={i}
                  style={{
                    alignSelf: m.rol === "user" ? "flex-end" : "flex-start",
                    background: m.rol === "user" ? "#7F77DD" : "#f2f2f0",
                    color: m.rol === "user" ? "#fff" : "#1a1a1a",
                    padding: "8px 12px",
                    borderRadius: 12,
                    fontSize: 13,
                    maxWidth: "80%",
                    lineHeight: 1.4,
                  }}
                >
                  {m.mensaje}
                </div>
              ))
            )}

            {escalar && (
              <div
                style={{
                  background: "#fff7e6",
                  border: "1px solid #ffe1a8",
                  borderRadius: 12,
                  padding: "10px 12px",
                  fontSize: 12,
                  color: "#7a5c00",
                  textAlign: "center",
                }}
              >
                Esto es mejor resolverlo con el equipo directamente.{" "}
                <a
                  href="https://wa.me/00000000000"
                  target="_blank"
                  rel="noreferrer"
                  style={{ color: "#7a5c00", fontWeight: 700, textDecoration: "underline" }}
                >
                  Escríbenos por WhatsApp
                </a>
              </div>
            )}

            <div ref={finRef} />
          </div>

          {activo && (
            <div style={{ display: "flex", borderTop: "1px solid #eee", padding: 10, gap: 8 }}>
              <input
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && enviar()}
                placeholder="Escribe tu pregunta..."
                disabled={enviando}
                style={{
                  flex: 1,
                  border: "1px solid #e0e0e0",
                  borderRadius: 10,
                  padding: "8px 12px",
                  fontSize: 13,
                  outline: "none",
                }}
              />
              <button
                onClick={enviar}
                disabled={enviando || !texto.trim()}
                style={{
                  background: "#7F77DD",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 14px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: enviando ? "default" : "pointer",
                  opacity: enviando || !texto.trim() ? 0.6 : 1,
                }}
              >
                {enviando ? "..." : "Enviar"}
              </button>
            </div>
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
          {abierto ? (
            <span style={{ color: "#534AB7", fontSize: 22, fontWeight: 300 }}>×</span>
          ) : (
            <img src="/marca/icono-quiubot.svg" alt="Asistente Quiubot" width={30} height={30} />
          )}
        </button>
      </div>
    </div>
  )
}
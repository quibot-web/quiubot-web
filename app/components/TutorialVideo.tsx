"use client"
import { useEffect, useState } from "react"
import { Play, X } from "lucide-react"

type InfoVideo = {
  configurado: boolean
  titulo?: string
  url_video?: string
  descripcion?: string
  visto?: boolean
}

function obtenerEmbedUrl(url: string): string | null {
  if (url.includes("youtube.com/watch")) {
    try {
      const id = new URL(url).searchParams.get("v")
      return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null
    } catch {
      return null
    }
  }
  if (url.includes("youtu.be/")) {
    const id = url.split("youtu.be/")[1]?.split(/[?&]/)[0]
    return id ? `https://www.youtube.com/embed/${id}?autoplay=1` : null
  }
  if (url.includes("vimeo.com/")) {
    const id = url.split("vimeo.com/")[1]?.split(/[?&]/)[0]
    return id ? `https://player.vimeo.com/video/${id}?autoplay=1` : null
  }
  return null
}

type Props = {
  seccion: string
  /**
   * Se dispara una sola vez cuando este componente ya "terminó su turno":
   * o porque no había video que mostrar automáticamente, o porque el usuario
   * ya cerró el video que se abrió solo la primera vez. Úsalo para no arrancar
   * el TourGuiado al mismo tiempo que el video (evita el estrés de ver los dos
   * a la vez) — pásalo como parte del prop `listo` de TourGuiado.
   */
  onListo?: () => void
}

export default function TutorialVideo({ seccion, onListo }: Props) {
  const [info, setInfo] = useState<InfoVideo | null>(null)
  const [abierto, setAbierto] = useState(false)
  const [marcando, setMarcando] = useState(false)

  useEffect(() => {
    fetch(`/api/tutoriales/${seccion}`)
      .then((r) => r.json())
      .then((data: InfoVideo) => {
        setInfo(data)
        if (data.configurado && !data.visto) {
          setAbierto(true)
        } else {
          // No hay video que mostrar automáticamente — el tour puede arrancar ya.
          onListo?.()
        }
      })
      .catch(() => {
        setInfo({ configurado: false })
        onListo?.()
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seccion])

  async function cerrarYMarcarVisto() {
    setAbierto(false)
    // El video (auto-abierto o abierto a mano) ya se cerró — el tour puede arrancar.
    onListo?.()
    if (info?.visto || marcando) return
    setMarcando(true)
    try {
      await fetch(`/api/tutoriales/${seccion}`, { method: "POST" })
      setInfo((prev) => (prev ? { ...prev, visto: true } : prev))
    } finally {
      setMarcando(false)
    }
  }

  if (!info?.configurado) return null

  const embedUrl = info.url_video ? obtenerEmbedUrl(info.url_video) : null

  return (
    <>
      <button
        onClick={() => setAbierto(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#F1EFFB",
          color: "#4A3FAE",
          border: "none",
          borderRadius: 20,
          padding: "6px 14px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        <Play size={12} fill="currentColor" strokeWidth={0} aria-hidden="true" />
        Ver tutorial
      </button>

      {abierto && (
        <div
          onClick={cerrarYMarcarVisto}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(23,21,43,0.6)",
            zIndex: 2000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 18,
              width: "100%",
              maxWidth: 720,
              overflow: "hidden",
              boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "14px 18px",
                borderBottom: "1px solid #eee",
              }}
            >
              <div style={{ fontWeight: 600, fontSize: 14, color: "#17152B" }}>{info.titulo}</div>
              <button
                onClick={cerrarYMarcarVisto}
                style={{
                  background: "none",
                  border: "none",
                  display: "flex",
                  color: "#999",
                  cursor: "pointer",
                  lineHeight: 1,
                  padding: 0,
                }}
                aria-label="Cerrar"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <div style={{ position: "relative", paddingTop: "56.25%", background: "#000" }}>
              {embedUrl ? (
                <iframe
                  src={embedUrl}
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }}
                />
              ) : (
                <video
                  src={info.url_video}
                  controls
                  autoPlay
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
                />
              )}
            </div>

            {info.descripcion && (
              <div style={{ padding: "14px 18px", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                {info.descripcion}
              </div>
            )}

            <div style={{ padding: "12px 18px 18px", display: "flex", justifyContent: "flex-end" }}>
              <button
                onClick={cerrarYMarcarVisto}
                style={{
                  background: "#7F77DD",
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "8px 18px",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {info.visto ? "Cerrar" : "Saltar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
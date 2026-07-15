"use client"
import { useEffect, useRef, useState } from "react"

type PasoTour = {
  selector: string
  titulo: string
  texto: string
}

type Props = {
  seccion: string
  pasos: PasoTour[]
  /** Si la sección carga datos async, pasa un booleano que se vuelva true cuando ya esté lista */
  listo?: boolean
}

type Rect = { top: number; left: number; width: number; height: number }

function buscarPrimerPasoDisponible(pasos: PasoTour[], desde: number): { indice: number; el: Element } | null {
  for (let i = desde; i < pasos.length; i++) {
    const el = document.querySelector(pasos[i].selector)
    if (el) return { indice: i, el }
  }
  return null
}

export default function TourGuiado({ seccion, pasos, listo = true }: Props) {
  const [pasoActivo, setPasoActivo] = useState<number | null>(null)
  const [rect, setRect] = useState<Rect | null>(null)
  const [yaVisto, setYaVisto] = useState<boolean | null>(null)
  const intentosRef = useRef(0)

  // Consulta si el usuario ya vio este tour
  useEffect(() => {
    fetch(`/api/tour/${seccion}`)
      .then((r) => r.json())
      .then((data) => setYaVisto(!!data.visto))
      .catch(() => setYaVisto(true))
  }, [seccion])

  // Intenta arrancar el tour cuando la sección esté lista y no se haya visto
  useEffect(() => {
    if (!listo || yaVisto !== false || pasoActivo !== null) return

    intentosRef.current = 0
    const intervalo = setInterval(() => {
      intentosRef.current += 1
      const encontrado = buscarPrimerPasoDisponible(pasos, 0)
      if (encontrado) {
        clearInterval(intervalo)
        irAPaso(encontrado.indice)
      } else if (intentosRef.current > 15) {
        // No se encontró ningún elemento del tour en 4.5s — no hay nada que mostrar
        clearInterval(intervalo)
        marcarVisto()
      }
    }, 300)

    return () => clearInterval(intervalo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listo, yaVisto])

  function medirYPosicionar(el: Element) {
    const r = el.getBoundingClientRect()
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height })
  }

  function irAPaso(indice: number) {
    const el = document.querySelector(pasos[indice].selector)
    if (!el) {
      // Este paso puntual no está en el DOM ahora mismo — busca el siguiente disponible
      const siguiente = buscarPrimerPasoDisponible(pasos, indice + 1)
      if (siguiente) {
        setPasoActivo(siguiente.indice)
        medirYPosicionar(siguiente.el)
      } else {
        finalizar()
      }
      return
    }
    setPasoActivo(indice)
    medirYPosicionar(el)
    el.scrollIntoView({ behavior: "smooth", block: "center" })
  }

  useEffect(() => {
    if (pasoActivo === null) return
    const onResize = () => {
      const el = document.querySelector(pasos[pasoActivo].selector)
      if (el) medirYPosicionar(el)
    }
    window.addEventListener("resize", onResize)
    window.addEventListener("scroll", onResize, true)
    return () => {
      window.removeEventListener("resize", onResize)
      window.removeEventListener("scroll", onResize, true)
    }
  }, [pasoActivo])

  async function marcarVisto() {
    setYaVisto(true)
    try {
      await fetch(`/api/tour/${seccion}`, { method: "POST" })
    } catch {}
  }

  function finalizar() {
    setPasoActivo(null)
    setRect(null)
    marcarVisto()
  }

  function siguiente() {
    if (pasoActivo === null) return
    const esUltimo = pasoActivo >= pasos.length - 1
    if (esUltimo) {
      finalizar()
    } else {
      irAPaso(pasoActivo + 1)
    }
  }

  function anterior() {
    if (pasoActivo === null || pasoActivo === 0) return
    irAPaso(pasoActivo - 1)
  }

  function reiniciar() {
    setYaVisto(false)
    intentosRef.current = 0
    const encontrado = buscarPrimerPasoDisponible(pasos, 0)
    if (encontrado) irAPaso(encontrado.indice)
  }

  if (pasoActivo === null || !rect) {
    return (
      <button
        onClick={reiniciar}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          background: "#fff",
          color: "#4A3FAE",
          border: "1px solid #E5E1F5",
          borderRadius: 20,
          padding: "6px 14px",
          fontSize: 12,
          fontWeight: 600,
          cursor: "pointer",
        }}
      >
        🧭 Ver guía
      </button>
    )
  }

  const paso = pasos[pasoActivo]
  const espacioAbajo = window.innerHeight - (rect.top + rect.height)
  const tooltipArriba = espacioAbajo < 180

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 3000 }}>
      {/* Overlay con "hueco" alrededor del elemento señalado */}
      <div
        style={{
          position: "fixed",
          top: rect.top - 6,
          left: rect.left - 6,
          width: rect.width + 12,
          height: rect.height + 12,
          borderRadius: 12,
          boxShadow: "0 0 0 9999px rgba(23,21,43,0.65)",
          border: "2px solid #7F77DD",
          pointerEvents: "none",
          transition: "top 0.25s ease, left 0.25s ease, width 0.25s ease, height 0.25s ease",
        }}
      />

      <div
        style={{
          position: "fixed",
          top: tooltipArriba ? Math.max(16, rect.top - 12) : rect.top + rect.height + 12,
          left: Math.min(Math.max(16, rect.left), window.innerWidth - 300),
          transform: tooltipArriba ? "translateY(-100%)" : "none",
          width: 280,
          background: "#fff",
          borderRadius: 14,
          padding: 18,
          boxShadow: "0 12px 32px rgba(0,0,0,0.22)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 600, color: "#999", marginBottom: 6 }}>
          Paso {pasoActivo + 1} de {pasos.length}
        </div>
        <div style={{ fontSize: 14, fontWeight: 700, color: "#17152B", marginBottom: 6 }}>{paso.titulo}</div>
        <div style={{ fontSize: 13, color: "#666", lineHeight: 1.5, marginBottom: 14 }}>{paso.texto}</div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <button
            onClick={finalizar}
            style={{ background: "none", border: "none", color: "#999", fontSize: 12, cursor: "pointer", padding: 0 }}
          >
            Saltar
          </button>
          <div style={{ display: "flex", gap: 8 }}>
            {pasoActivo > 0 && (
              <button
                onClick={anterior}
                style={{
                  background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8,
                  padding: "6px 12px", fontSize: 12, fontWeight: 600, color: "#444", cursor: "pointer",
                }}
              >
                Atrás
              </button>
            )}
            <button
              onClick={siguiente}
              style={{
                background: "#7F77DD", border: "none", borderRadius: 8, color: "#fff",
                padding: "6px 14px", fontSize: 12, fontWeight: 600, cursor: "pointer",
              }}
            >
              {pasoActivo >= pasos.length - 1 ? "Listo ✓" : "Siguiente"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
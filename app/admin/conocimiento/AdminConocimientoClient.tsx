"use client"
import { useEffect, useState } from "react"

type Seccion = {
  id: string
  seccion: string
  contenido: string
  actualizado_en: string
}

export default function AdminConocimientoClient() {
  const [secciones, setSecciones] = useState<Seccion[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [tituloForm, setTituloForm] = useState("")
  const [contenidoForm, setContenidoForm] = useState("")
  const [creandoNueva, setCreandoNueva] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)

  async function cargarSecciones() {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/conocimiento")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al cargar")
      setSecciones(data.conocimiento || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarSecciones()
  }, [])

  function iniciarEdicion(s: Seccion) {
    setEditandoId(s.id)
    setTituloForm(s.seccion)
    setContenidoForm(s.contenido)
    setCreandoNueva(false)
  }

  function iniciarCreacion() {
    setCreandoNueva(true)
    setEditandoId(null)
    setTituloForm("")
    setContenidoForm("")
  }

  function cancelar() {
    setEditandoId(null)
    setCreandoNueva(false)
    setTituloForm("")
    setContenidoForm("")
  }

  async function guardar() {
    if (!tituloForm.trim() || !contenidoForm.trim()) {
      setError("El título y el contenido son obligatorios")
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const esEdicion = !!editandoId
      const url = esEdicion
        ? `/api/admin/conocimiento/${editandoId}`
        : "/api/admin/conocimiento"
      const res = await fetch(url, {
        method: esEdicion ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seccion: tituloForm, contenido: contenidoForm }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al guardar")
      cancelar()
      await cargarSecciones()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(id: string) {
    if (!confirm("¿Borrar esta sección del conocimiento del asistente? Esta acción no se puede deshacer.")) {
      return
    }
    setBorrandoId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/conocimiento/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al borrar")
      await cargarSecciones()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBorrandoId(null)
    }
  }

  const mostrandoFormulario = creandoNueva || !!editandoId

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2.5rem" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>
              Base de conocimiento del asistente
            </h1>
            <p style={{ color: "#666", fontSize: 14, margin: "4px 0 0" }}>
              Cada sección que edites o crees aquí actualiza automáticamente lo que el asistente de IA sabe.
            </p>
          </div>
          {!mostrandoFormulario && (
            <button
              onClick={iniciarCreacion}
              style={{
                background: "#7F77DD",
                color: "#fff",
                border: "none",
                borderRadius: 10,
                padding: "10px 18px",
                fontWeight: 600,
                fontSize: 14,
                cursor: "pointer",
              }}
            >
              + Nueva sección
            </button>
          )}
        </div>

        {error && (
          <div style={{
            background: "#fdecea", color: "#b3261e", border: "1px solid #f5c2bf",
            borderRadius: 10, padding: "10px 14px", fontSize: 14, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {mostrandoFormulario && (
          <div style={{
            background: "#fff", border: "1px solid #e8e8e6", borderRadius: 16,
            padding: 24, marginBottom: 24, boxShadow: "0 4px 20px rgba(0,0,0,0.04)",
          }}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: "#1a1a1a", margin: "0 0 16px" }}>
              {editandoId ? "Editar sección" : "Nueva sección"}
            </h2>

            <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
              Título de la sección
            </label>
            <input
              value={tituloForm}
              onChange={(e) => setTituloForm(e.target.value)}
              placeholder='Ej: "Cómo funciona la generación de estrategia"'
              style={{
                width: "100%", border: "1px solid #e0e0e0", borderRadius: 10,
                padding: "10px 12px", fontSize: 14, marginBottom: 16, boxSizing: "border-box",
              }}
            />

            <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
              Contenido
            </label>
            <textarea
              value={contenidoForm}
              onChange={(e) => setContenidoForm(e.target.value)}
              placeholder="Escribe aquí toda la información que el asistente debe saber sobre este tema..."
              rows={10}
              style={{
                width: "100%", border: "1px solid #e0e0e0", borderRadius: 10,
                padding: "10px 12px", fontSize: 14, marginBottom: 16, boxSizing: "border-box",
                fontFamily: "inherit", resize: "vertical",
              }}
            />

            <div style={{ display: "flex", gap: 10 }}>
              <button
                onClick={guardar}
                disabled={guardando}
                style={{
                  background: "#7F77DD", color: "#fff", border: "none", borderRadius: 10,
                  padding: "10px 18px", fontWeight: 600, fontSize: 14,
                  cursor: guardando ? "default" : "pointer", opacity: guardando ? 0.7 : 1,
                }}
              >
                {guardando ? "Guardando..." : "Guardar"}
              </button>
              <button
                onClick={cancelar}
                disabled={guardando}
                style={{
                  background: "#fff", color: "#444", border: "1px solid #e0e0e0", borderRadius: 10,
                  padding: "10px 18px", fontWeight: 600, fontSize: 14, cursor: "pointer",
                }}
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {cargando ? (
          <p style={{ color: "#666", fontSize: 14 }}>Cargando...</p>
        ) : secciones.length === 0 ? (
          <p style={{ color: "#666", fontSize: 14 }}>
            Todavía no hay ninguna sección. Crea la primera con el botón de arriba.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {secciones.map((s) => (
              <div
                key={s.id}
                style={{
                  background: "#fff", border: "1px solid #e8e8e6", borderRadius: 14,
                  padding: "16px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: "0 0 6px" }}>
                      {s.seccion}
                    </h3>
                    <p style={{
                      fontSize: 13, color: "#666", margin: 0,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                    }}>
                      {s.contenido}
                    </p>
                    <p style={{ fontSize: 11, color: "#aaa", margin: "8px 0 0" }}>
                      Actualizado: {new Date(s.actualizado_en).toLocaleString("es-CO")}
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                    <button
                      onClick={() => iniciarEdicion(s)}
                      style={{
                        background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8,
                        padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#444", cursor: "pointer",
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => borrar(s.id)}
                      disabled={borrandoId === s.id}
                      style={{
                        background: "#fff", border: "1px solid #f5c2bf", borderRadius: 8,
                        padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#b3261e",
                        cursor: borrandoId === s.id ? "default" : "pointer",
                        opacity: borrandoId === s.id ? 0.6 : 1,
                      }}
                    >
                      {borrandoId === s.id ? "Borrando..." : "Borrar"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
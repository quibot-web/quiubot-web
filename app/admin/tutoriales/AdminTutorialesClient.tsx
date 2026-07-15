"use client"
import { useEffect, useState } from "react"
import { SECCIONES_TUTORIALES } from "@/app/lib/seccionesTutoriales"

type VideoGuardado = {
  id: string
  seccion: string
  titulo: string
  url_video: string
  descripcion: string | null
  actualizado_en: string
}

export default function AdminTutorialesClient() {
  const [videos, setVideos] = useState<VideoGuardado[]>([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [editandoSeccion, setEditandoSeccion] = useState<string | null>(null)
  const [tituloForm, setTituloForm] = useState("")
  const [urlForm, setUrlForm] = useState("")
  const [descForm, setDescForm] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [borrandoId, setBorrandoId] = useState<string | null>(null)

  async function cargar() {
    setCargando(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/tutoriales")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al cargar")
      setVideos(data.videos || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
  }, [])

  function videoDeSeccion(key: string) {
    return videos.find((v) => v.seccion === key) || null
  }

  function iniciarEdicion(key: string) {
    const existente = videoDeSeccion(key)
    setEditandoSeccion(key)
    setTituloForm(existente?.titulo || "")
    setUrlForm(existente?.url_video || "")
    setDescForm(existente?.descripcion || "")
  }

  function cancelar() {
    setEditandoSeccion(null)
    setTituloForm("")
    setUrlForm("")
    setDescForm("")
  }

  async function guardar() {
    if (!editandoSeccion || !tituloForm.trim() || !urlForm.trim()) {
      setError("Título y URL del video son obligatorios")
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const res = await fetch("/api/admin/tutoriales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          seccion: editandoSeccion,
          titulo: tituloForm,
          url_video: urlForm,
          descripcion: descForm,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al guardar")
      cancelar()
      await cargar()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setGuardando(false)
    }
  }

  async function quitarVideo(id: string) {
    if (!confirm("¿Quitar este video? La sección quedará sin tutorial hasta que subas uno nuevo.")) return
    setBorrandoId(id)
    setError(null)
    try {
      const res = await fetch(`/api/admin/tutoriales/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al borrar")
      await cargar()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setBorrandoId(null)
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2.5rem" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" }}>
          Videos tutoriales por sección
        </h1>
        <p style={{ color: "#666", fontSize: 14, margin: "0 0 24px" }}>
          Pega la URL del video (YouTube, Vimeo, o un link directo a un archivo .mp4). Se actualiza al instante en toda la app.
        </p>

        {error && (
          <div style={{
            background: "#fdecea", color: "#b3261e", border: "1px solid #f5c2bf",
            borderRadius: 10, padding: "10px 14px", fontSize: 14, marginBottom: 16,
          }}>
            {error}
          </div>
        )}

        {cargando ? (
          <p style={{ color: "#666", fontSize: 14 }}>Cargando...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {SECCIONES_TUTORIALES.map((s) => {
              const existente = videoDeSeccion(s.key)
              const enEdicion = editandoSeccion === s.key

              return (
                <div
                  key={s.key}
                  style={{
                    background: "#fff", border: "1px solid #e8e8e6", borderRadius: 14,
                    padding: "16px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{s.label}</div>
                      {existente ? (
                        <div style={{ fontSize: 12, color: "#1FA97C", marginTop: 2 }}>
                          ✓ Configurado — {existente.titulo}
                        </div>
                      ) : (
                        <div style={{ fontSize: 12, color: "#999", marginTop: 2 }}>Sin video todavía</div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <button
                        onClick={() => iniciarEdicion(s.key)}
                        style={{
                          background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8,
                          padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#444", cursor: "pointer",
                        }}
                      >
                        {existente ? "Editar" : "Agregar video"}
                      </button>
                      {existente && (
                        <button
                          onClick={() => quitarVideo(existente.id)}
                          disabled={borrandoId === existente.id}
                          style={{
                            background: "#fff", border: "1px solid #f5c2bf", borderRadius: 8,
                            padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#b3261e",
                            cursor: borrandoId === existente.id ? "default" : "pointer",
                            opacity: borrandoId === existente.id ? 0.6 : 1,
                          }}
                        >
                          {borrandoId === existente.id ? "Quitando..." : "Quitar"}
                        </button>
                      )}
                    </div>
                  </div>

                  {enEdicion && (
                    <div style={{ marginTop: 16, borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
                        Título del video
                      </label>
                      <input
                        value={tituloForm}
                        onChange={(e) => setTituloForm(e.target.value)}
                        placeholder='Ej: "Cómo generar tu primera estrategia"'
                        style={{
                          width: "100%", border: "1px solid #e0e0e0", borderRadius: 10,
                          padding: "10px 12px", fontSize: 14, marginBottom: 12, boxSizing: "border-box",
                        }}
                      />

                      <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
                        URL del video
                      </label>
                      <input
                        value={urlForm}
                        onChange={(e) => setUrlForm(e.target.value)}
                        placeholder="https://youtube.com/watch?v=... o link directo a .mp4"
                        style={{
                          width: "100%", border: "1px solid #e0e0e0", borderRadius: 10,
                          padding: "10px 12px", fontSize: 14, marginBottom: 12, boxSizing: "border-box",
                        }}
                      />

                      <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
                        Descripción (opcional)
                      </label>
                      <textarea
                        value={descForm}
                        onChange={(e) => setDescForm(e.target.value)}
                        rows={2}
                        style={{
                          width: "100%", border: "1px solid #e0e0e0", borderRadius: 10,
                          padding: "10px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box",
                          fontFamily: "inherit", resize: "vertical",
                        }}
                      />

                      <div style={{ display: "flex", gap: 10 }}>
                        <button
                          onClick={guardar}
                          disabled={guardando}
                          style={{
                            background: "#7F77DD", color: "#fff", border: "none", borderRadius: 10,
                            padding: "9px 16px", fontWeight: 600, fontSize: 14,
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
                            padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer",
                          }}
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
"use client"
import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight } from "lucide-react"
import { SECCIONES_TUTORIALES } from "@/app/lib/seccionesTutoriales"

type VideoGuardado = {
  id: string
  seccion: string
  titulo: string
  url_video: string
  descripcion: string | null
  actualizado_en: string
}

type SeccionTutorial = { key: string; label: string; grupo?: string }

type TestimonioGuardado = {
  id: string
  nombre_empresa: string
  imagen_url: string
  url_video: string
  cita: string | null
  orden: number
  activo: boolean
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

  // Qué grupos (ej. "Motor de Estrategia") están desplegados.
  const [gruposAbiertos, setGruposAbiertos] = useState<Record<string, boolean>>({})

  // ---- Testimonios de clientes (tarjetas con video, para /bienvenida) ----
  const [testimonios, setTestimonios] = useState<TestimonioGuardado[]>([])
  const [cargandoTestimonios, setCargandoTestimonios] = useState(true)
  const [errorTestimonios, setErrorTestimonios] = useState<string | null>(null)
  const [editandoTestimonioId, setEditandoTestimonioId] = useState<string | null>(null)
  const [nombreEmpresaForm, setNombreEmpresaForm] = useState("")
  const [imagenUrlForm, setImagenUrlForm] = useState("")
  const [urlVideoTestimonioForm, setUrlVideoTestimonioForm] = useState("")
  const [citaForm, setCitaForm] = useState("")
  const [guardandoTestimonio, setGuardandoTestimonio] = useState(false)
  const [borrandoTestimonioId, setBorrandoTestimonioId] = useState<string | null>(null)

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

  async function cargarTestimonios() {
    setCargandoTestimonios(true)
    setErrorTestimonios(null)
    try {
      const res = await fetch("/api/admin/testimonios")
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al cargar")
      setTestimonios(data.testimonios || [])
    } catch (err: any) {
      setErrorTestimonios(err.message)
    } finally {
      setCargandoTestimonios(false)
    }
  }

  useEffect(() => {
    cargar()
    cargarTestimonios()
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

  function alternarGrupo(nombre: string) {
    setGruposAbiertos((prev) => ({ ...prev, [nombre]: !prev[nombre] }))
  }

  // ---- Acciones de testimonios ----

  function iniciarNuevoTestimonio() {
    setEditandoTestimonioId("nuevo")
    setNombreEmpresaForm("")
    setImagenUrlForm("")
    setUrlVideoTestimonioForm("")
    setCitaForm("")
  }

  function iniciarEdicionTestimonio(t: TestimonioGuardado) {
    setEditandoTestimonioId(t.id)
    setNombreEmpresaForm(t.nombre_empresa)
    setImagenUrlForm(t.imagen_url)
    setUrlVideoTestimonioForm(t.url_video)
    setCitaForm(t.cita || "")
  }

  function cancelarTestimonio() {
    setEditandoTestimonioId(null)
    setNombreEmpresaForm("")
    setImagenUrlForm("")
    setUrlVideoTestimonioForm("")
    setCitaForm("")
  }

  async function guardarTestimonio() {
    if (!nombreEmpresaForm.trim() || !imagenUrlForm.trim() || !urlVideoTestimonioForm.trim()) {
      setErrorTestimonios("Nombre de la empresa, imagen y URL del video son obligatorios")
      return
    }
    setGuardandoTestimonio(true)
    setErrorTestimonios(null)
    try {
      const esNuevo = editandoTestimonioId === "nuevo"
      const url = esNuevo ? "/api/admin/testimonios" : `/api/admin/testimonios/${editandoTestimonioId}`
      const res = await fetch(url, {
        method: esNuevo ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_empresa: nombreEmpresaForm,
          imagen_url: imagenUrlForm,
          url_video: urlVideoTestimonioForm,
          cita: citaForm,
          ...(esNuevo ? { orden: testimonios.length } : {}),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al guardar")
      cancelarTestimonio()
      await cargarTestimonios()
    } catch (err: any) {
      setErrorTestimonios(err.message)
    } finally {
      setGuardandoTestimonio(false)
    }
  }

  async function alternarActivoTestimonio(t: TestimonioGuardado) {
    try {
      await fetch(`/api/admin/testimonios/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activo: !t.activo }),
      })
      await cargarTestimonios()
    } catch {
      setErrorTestimonios("No se pudo actualizar el testimonio")
    }
  }

  async function quitarTestimonio(id: string) {
    if (!confirm("¿Borrar este testimonio? Esta acción no se puede deshacer.")) return
    setBorrandoTestimonioId(id)
    setErrorTestimonios(null)
    try {
      const res = await fetch(`/api/admin/testimonios/${id}`, { method: "DELETE" })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Error al borrar")
      await cargarTestimonios()
    } catch (err: any) {
      setErrorTestimonios(err.message)
    } finally {
      setBorrandoTestimonioId(null)
    }
  }

  // Fila individual de una sección — se usa tanto para secciones sueltas
  // como para cada paso dentro de una tarjeta de grupo. `indentada` le
  // baja el peso visual cuando vive dentro de un grupo, para que se note
  // la jerarquía.
  function FilaSeccion({ s, indentada }: { s: SeccionTutorial; indentada?: boolean }) {
    const existente = videoDeSeccion(s.key)
    const enEdicion = editandoSeccion === s.key

    return (
      <div
        style={{
          background: indentada ? "#fafafa" : "#fff",
          border: "1px solid #e8e8e6",
          borderRadius: 14,
          padding: "16px 20px",
          boxShadow: indentada ? "none" : "0 2px 10px rgba(0,0,0,0.03)",
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
  }

  // Tarjeta desplegable que envuelve todas las secciones de un mismo grupo
  // (ej. los 6 pasos de "Motor de Estrategia"). Muestra cuántas de esas
  // secciones ya tienen video configurado, de un vistazo, sin desplegar.
  function TarjetaGrupo({ nombre, items }: { nombre: string; items: SeccionTutorial[] }) {
    const abierto = !!gruposAbiertos[nombre]
    const configuradas = items.filter((s) => !!videoDeSeccion(s.key)).length

    return (
      <div
        style={{
          background: "#fff", border: "1px solid #e8e8e6", borderRadius: 14,
          boxShadow: "0 2px 10px rgba(0,0,0,0.03)", overflow: "hidden",
        }}
      >
        <button
          onClick={() => alternarGrupo(nombre)}
          style={{
            width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
            gap: 12, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {abierto ? <ChevronDown size={16} color="#666" /> : <ChevronRight size={16} color="#666" />}
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{nombre}</div>
              <div style={{ fontSize: 12, color: configuradas === items.length ? "#1FA97C" : "#999", marginTop: 2 }}>
                {configuradas} de {items.length} pasos configurados
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: 11, fontWeight: 700, color: "#4A3FAE", background: "#F1EFFB",
              borderRadius: 20, padding: "3px 10px", flexShrink: 0,
            }}
          >
            {items.length} pasos
          </span>
        </button>

        {abierto && (
          <div style={{ padding: "0 20px 20px", display: "flex", flexDirection: "column", gap: 10 }}>
            {items.map((s) => (
              <FilaSeccion key={s.key} s={s} indentada />
            ))}
          </div>
        )}
      </div>
    )
  }

  // Tarjeta de un testimonio existente, con miniatura de la empresa.
  // El formulario de edicion se despliega debajo, igual que en FilaSeccion,
  // para que se sienta como la misma pieza de UI, no algo aparte.
  function FilaTestimonio({ t }: { t: TestimonioGuardado }) {
    const enEdicion = editandoTestimonioId === t.id

    return (
      <div
        style={{
          background: "#fff", border: "1px solid #e8e8e6", borderRadius: 14,
          padding: "16px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
          opacity: t.activo ? 1 : 0.55,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
            <img
              src={t.imagen_url}
              alt=""
              style={{ width: 40, height: 40, borderRadius: 10, objectFit: "cover", flexShrink: 0, background: "#f0f0f0" }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>{t.nombre_empresa}</div>
              <div style={{ fontSize: 12, color: t.activo ? "#1FA97C" : "#999", marginTop: 2 }}>
                {t.activo ? "✓ Visible en bienvenida" : "Oculto"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
            <button
              onClick={() => alternarActivoTestimonio(t)}
              style={{
                background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8,
                padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#444", cursor: "pointer",
              }}
            >
              {t.activo ? "Ocultar" : "Mostrar"}
            </button>
            <button
              onClick={() => iniciarEdicionTestimonio(t)}
              style={{
                background: "#fff", border: "1px solid #e0e0e0", borderRadius: 8,
                padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#444", cursor: "pointer",
              }}
            >
              Editar
            </button>
            <button
              onClick={() => quitarTestimonio(t.id)}
              disabled={borrandoTestimonioId === t.id}
              style={{
                background: "#fff", border: "1px solid #f5c2bf", borderRadius: 8,
                padding: "6px 12px", fontSize: 13, fontWeight: 600, color: "#b3261e",
                cursor: borrandoTestimonioId === t.id ? "default" : "pointer",
                opacity: borrandoTestimonioId === t.id ? 0.6 : 1,
              }}
            >
              {borrandoTestimonioId === t.id ? "Borrando..." : "Borrar"}
            </button>
          </div>
        </div>

        {enEdicion && <FormularioTestimonio />}
      </div>
    )
  }

  // Formulario compartido entre "editar" y "agregar nuevo" testimonio.
  function FormularioTestimonio() {
    return (
      <div style={{ marginTop: 16, borderTop: "1px solid #f0f0f0", paddingTop: 16 }}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
          Nombre de la empresa
        </label>
        <input
          value={nombreEmpresaForm}
          onChange={(e) => setNombreEmpresaForm(e.target.value)}
          placeholder="Ej: Tabu"
          style={{
            width: "100%", border: "1px solid #e0e0e0", borderRadius: 10,
            padding: "10px 12px", fontSize: 14, marginBottom: 12, boxSizing: "border-box",
          }}
        />

        <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
          URL de la imagen o logo de la empresa
        </label>
        <input
          value={imagenUrlForm}
          onChange={(e) => setImagenUrlForm(e.target.value)}
          placeholder="https://..."
          style={{
            width: "100%", border: "1px solid #e0e0e0", borderRadius: 10,
            padding: "10px 12px", fontSize: 14, marginBottom: 12, boxSizing: "border-box",
          }}
        />

        <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
          URL del video testimonial
        </label>
        <input
          value={urlVideoTestimonioForm}
          onChange={(e) => setUrlVideoTestimonioForm(e.target.value)}
          placeholder="https://youtube.com/watch?v=... o link directo a .mp4"
          style={{
            width: "100%", border: "1px solid #e0e0e0", borderRadius: 10,
            padding: "10px 12px", fontSize: 14, marginBottom: 12, boxSizing: "border-box",
          }}
        />

        <label style={{ fontSize: 13, fontWeight: 600, color: "#444", display: "block", marginBottom: 6 }}>
          Cita corta (opcional, se muestra en la tarjeta)
        </label>
        <input
          value={citaForm}
          onChange={(e) => setCitaForm(e.target.value)}
          placeholder='Ej: "Publiqué mi primera campaña en 10 minutos"'
          style={{
            width: "100%", border: "1px solid #e0e0e0", borderRadius: 10,
            padding: "10px 12px", fontSize: 14, marginBottom: 14, boxSizing: "border-box",
          }}
        />

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={guardarTestimonio}
            disabled={guardandoTestimonio}
            style={{
              background: "#7F77DD", color: "#fff", border: "none", borderRadius: 10,
              padding: "9px 16px", fontWeight: 600, fontSize: 14,
              cursor: guardandoTestimonio ? "default" : "pointer", opacity: guardandoTestimonio ? 0.7 : 1,
            }}
          >
            {guardandoTestimonio ? "Guardando..." : "Guardar"}
          </button>
          <button
            onClick={cancelarTestimonio}
            disabled={guardandoTestimonio}
            style={{
              background: "#fff", color: "#444", border: "1px solid #e0e0e0", borderRadius: 10,
              padding: "9px 16px", fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      </div>
    )
  }

  const gruposYaRenderizados = new Set<string>()

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2.5rem" }}>
      <div style={{ maxWidth: 820, margin: "0 auto" }}>

        {/* ---- TESTIMONIOS DE CLIENTES (tarjetas con video, para /bienvenida) ---- */}
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#1a1a1a", margin: "0 0 4px" }}>
          Testimonios de clientes
        </h1>
        <p style={{ color: "#666", fontSize: 14, margin: "0 0 16px" }}>
          Tarjetas con imagen de la empresa que se muestran en la landing de bienvenida — al hacer clic, se abre el video.
        </p>

        {errorTestimonios && (
          <div style={{
            background: "#fdecea", color: "#b3261e", border: "1px solid #f5c2bf",
            borderRadius: 10, padding: "10px 14px", fontSize: 14, marginBottom: 16,
          }}>
            {errorTestimonios}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 20 }}>
          {cargandoTestimonios ? (
            <p style={{ color: "#666", fontSize: 14 }}>Cargando...</p>
          ) : (
            <>
              {testimonios.map((t) => (
                <FilaTestimonio key={t.id} t={t} />
              ))}

              {editandoTestimonioId === "nuevo" ? (
                <div style={{
                  background: "#fff", border: "1px solid #e8e8e6", borderRadius: 14,
                  padding: "16px 20px", boxShadow: "0 2px 10px rgba(0,0,0,0.03)",
                }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a" }}>Nuevo testimonio</div>
                  <FormularioTestimonio />
                </div>
              ) : (
                <button
                  onClick={iniciarNuevoTestimonio}
                  style={{
                    background: "#fff", border: "1px dashed #cfcbe8", borderRadius: 14,
                    padding: "14px 20px", fontSize: 14, fontWeight: 600, color: "#4A3FAE",
                    cursor: "pointer", textAlign: "center",
                  }}
                >
                  + Agregar testimonio
                </button>
              )}
            </>
          )}
        </div>

        {/* ---- VIDEOS TUTORIALES POR SECCION (ya existente) ---- */}
        <h1 style={{ fontSize: 24, fontWeight: 600, color: "#1a1a1a", margin: "32px 0 4px" }}>
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
              const grupo = (s as SeccionTutorial).grupo
              if (grupo) {
                if (gruposYaRenderizados.has(grupo)) return null
                gruposYaRenderizados.add(grupo)
                const items = (SECCIONES_TUTORIALES as readonly SeccionTutorial[]).filter((x) => x.grupo === grupo)
                return <TarjetaGrupo key={grupo} nombre={grupo} items={items} />
              }
              return <FilaSeccion key={s.key} s={s} />
            })}
          </div>
        )}
      </div>
    </div>
  )
}
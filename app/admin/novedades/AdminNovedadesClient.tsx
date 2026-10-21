"use client";

import { useState, useEffect, useCallback } from "react";
import { CargandoQuiubotInline } from "@/app/components/CargandoQuiubot";

type Novedad = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  imagen_url: string | null;
  categoria: string;
  enlace: string | null;
  activo: boolean;
  orden: number;
  creado_en: string;
};

const TIPOS = [
  { id: "proximamente", label: "Próximamente", color: "#534AB7", fondo: "#f3f2fe" },
  { id: "nuevo", label: "Nuevo", color: "#166534", fondo: "#f0fdf4" },
  { id: "actualizacion", label: "Actualización", color: "#1d4ed8", fondo: "#dbeafe" },
];

const CATEGORIAS = [
  { id: "novedad", label: "Novedad (tarjeta Actualizaciones)" },
  { id: "capacitacion", label: "Capacitación (tarjeta Capacitaciones)" },
];

function badgeTipo(tipo: string) {
  return TIPOS.find((t) => t.id === tipo) || TIPOS[1];
}

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminNovedadesClient() {
  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [cargando, setCargando] = useState(true);

  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("proximamente");
  const [categoria, setCategoria] = useState("novedad");
  const [enlace, setEnlace] = useState("");
  const [imagenUrl, setImagenUrl] = useState("");
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [formAbierto, setFormAbierto] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/admin/novedades");
      const data = await res.json();
      if (res.ok) setNovedades(data.novedades || []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const subirImagen = async (file: File) => {
    setSubiendoImagen(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("archivo", file);
      const res = await fetch("/api/admin/subir-imagen-home", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setImagenUrl(data.url);
      else setError(data.error || "No se pudo subir la imagen.");
    } finally {
      setSubiendoImagen(false);
    }
  };

  const limpiarForm = () => {
    setEditandoId(null);
    setTitulo("");
    setDescripcion("");
    setTipo("proximamente");
    setCategoria("novedad");
    setEnlace("");
    setImagenUrl("");
    setFormAbierto(false);
    setError(null);
  };

  const editar = (n: Novedad) => {
    setEditandoId(n.id);
    setTitulo(n.titulo);
    setDescripcion(n.descripcion || "");
    setTipo(n.tipo);
    setCategoria(n.categoria);
    setEnlace(n.enlace || "");
    setImagenUrl(n.imagen_url || "");
    setFormAbierto(true);
    setError(null);
  };

  const guardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const payload = { titulo, descripcion, tipo, categoria, enlace: enlace.trim() || null, imagen_url: imagenUrl };
      const res = editandoId
        ? await fetch(`/api/admin/novedades/${editandoId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/novedades", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (res.ok) {
        limpiarForm();
        cargar();
      } else {
        setError(data.error || "No se pudo publicar.");
      }
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta novedad?")) return;
    await fetch(`/api/admin/novedades/${id}`, { method: "DELETE" });
    cargar();
  };

  const toggleActivo = async (n: Novedad) => {
    setNovedades((prev) => prev.map((x) => (x.id === n.id ? { ...x, activo: !x.activo } : x)));
    await fetch(`/api/admin/novedades/${n.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !n.activo }),
    });
  };

  // El orden (y las flechas ↑↓) se maneja por categoría -- novedades y
  // capacitaciones son listas separadas en el Inicio.
  const mover = async (categoriaLista: string, idxEnLista: number, direccion: -1 | 1) => {
    const lista = novedades.filter((n) => n.categoria === categoriaLista);
    const destino = idxEnLista + direccion;
    if (destino < 0 || destino >= lista.length) return;
    const a = lista[idxEnLista];
    const b = lista[destino];
    setNovedades((prev) =>
      prev.map((x) => (x.id === a.id ? { ...x, orden: b.orden } : x.id === b.id ? { ...x, orden: a.orden } : x))
    );
    await Promise.all([
      fetch(`/api/admin/novedades/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orden: b.orden }) }),
      fetch(`/api/admin/novedades/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orden: a.orden }) }),
    ]);
  };

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#17152B" }}>Novedades y capacitaciones</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
        Lo que publiques aquí aparece en las tarjetas "Actualizaciones" o "Capacitaciones" (según la
        categoría) del panel de Inicio de todos los usuarios — úsalo para anunciar próximos lanzamientos,
        funciones nuevas, o enlazar a material de capacitación.
      </p>

      {!formAbierto ? (
        <button
          type="button"
          onClick={() => setFormAbierto(true)}
          style={{ marginBottom: 20, padding: "10px 20px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          + Nueva
        </button>
      ) : (
        <form onSubmit={guardar} style={{ background: "#f9fafb", borderRadius: 14, padding: 20, marginBottom: 28, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Categoría</label>
            <div style={{ display: "flex", gap: 8 }}>
              {CATEGORIAS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategoria(c.id)}
                  style={{
                    padding: "6px 14px", borderRadius: 20,
                    border: categoria === c.id ? "2px solid #534AB7" : "1px solid #e0e0e0",
                    background: categoria === c.id ? "#f3f2fe" : "#fff",
                    color: categoria === c.id ? "#534AB7" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Tipo</label>
            <div style={{ display: "flex", gap: 8 }}>
              {TIPOS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTipo(t.id)}
                  style={{
                    padding: "6px 14px",
                    borderRadius: 20,
                    border: tipo === t.id ? `2px solid ${t.color}` : "1px solid #e0e0e0",
                    background: tipo === t.id ? t.fondo : "#fff",
                    color: tipo === t.id ? t.color : "#666",
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Generación de imágenes con video llega pronto"
              required
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Descripción (opcional)</label>
            <textarea
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              placeholder="Un par de líneas que generen curiosidad..."
              rows={3}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Enlace (opcional)</label>
            <input
              type="text"
              value={enlace}
              onChange={(e) => setEnlace(e.target.value)}
              placeholder="/estrategia o https://..."
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Miniatura (opcional)</label>
            <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && subirImagen(e.target.files[0])} style={{ fontSize: 12 }} />
            {subiendoImagen && <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>Subiendo...</p>}
            {imagenUrl && <img src={imagenUrl} alt="Vista previa" style={{ marginTop: 8, maxHeight: 90, borderRadius: 8, display: "block" }} />}
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={guardando || subiendoImagen}
              style={{ padding: "10px 20px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Publicar"}
            </button>
            <button
              type="button"
              onClick={limpiarForm}
              style={{ padding: "10px 20px", borderRadius: 8, background: "#fff", color: "#666", border: "1px solid #e0e0e0", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              Cancelar
            </button>
          </div>
          {error && <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>{error}</p>}
        </form>
      )}

      {cargando ? (
        <CargandoQuiubotInline />
      ) : novedades.length === 0 ? (
        <p style={{ fontSize: 13, color: "#888" }}>Aún no has publicado ninguna.</p>
      ) : (
        CATEGORIAS.map((c) => {
          const lista = novedades.filter((n) => n.categoria === c.id);
          if (lista.length === 0) return null;
          return (
            <div key={c.id} style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" }}>{c.label}</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {lista.map((n, idx) => {
                  const badge = badgeTipo(n.tipo);
                  return (
                    <div key={n.id} style={{ display: "flex", gap: 12, border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fff", opacity: n.activo ? 1 : 0.55 }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <button type="button" onClick={() => mover(c.id, idx, -1)} disabled={idx === 0} style={{ background: "none", border: "none", cursor: idx === 0 ? "not-allowed" : "pointer", color: idx === 0 ? "#ccc" : "#534AB7", fontSize: 12, padding: 0 }}>▲</button>
                        <button type="button" onClick={() => mover(c.id, idx, 1)} disabled={idx === lista.length - 1} style={{ background: "none", border: "none", cursor: idx === lista.length - 1 ? "not-allowed" : "pointer", color: idx === lista.length - 1 ? "#ccc" : "#534AB7", fontSize: 12, padding: 0 }}>▼</button>
                      </div>
                      {n.imagen_url && (
                        <img src={n.imagen_url} alt="" style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 10.5, fontWeight: 700, color: badge.color, background: badge.fondo, padding: "2px 8px", borderRadius: 8 }}>
                            {badge.label}
                          </span>
                          <span style={{ fontSize: 11, color: "#999" }}>{formatearFecha(n.creado_en)}</span>
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>{n.titulo}</p>
                        {n.descripcion && <p style={{ fontSize: 12.5, color: "#666", margin: "3px 0 0" }}>{n.descripcion}</p>}
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                        <button type="button" onClick={() => toggleActivo(n)} style={{ fontSize: 11, color: n.activo ? "#166534" : "#999", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                          {n.activo ? "Activo" : "Inactivo"}
                        </button>
                        <button type="button" onClick={() => editar(n)} style={{ fontSize: 11, color: "#534AB7", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => eliminar(n.id)}
                          style={{ fontSize: 11, color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                        >
                          Eliminar
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

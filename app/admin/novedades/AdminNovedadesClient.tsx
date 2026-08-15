"use client";

import { useState, useEffect, useCallback } from "react";
import { CargandoQuiubotInline } from "@/app/components/CargandoQuiubot";

type Novedad = {
  id: string;
  titulo: string;
  descripcion: string | null;
  tipo: string;
  imagen_url: string | null;
  creado_en: string;
};

const TIPOS = [
  { id: "proximamente", label: "Próximamente", color: "#534AB7", fondo: "#f3f2fe" },
  { id: "nuevo", label: "Nuevo", color: "#166534", fondo: "#f0fdf4" },
  { id: "actualizacion", label: "Actualización", color: "#1d4ed8", fondo: "#dbeafe" },
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

  const [titulo, setTitulo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("proximamente");
  const [imagenUrl, setImagenUrl] = useState("");
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

  const publicar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/novedades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ titulo, descripcion, tipo, imagen_url: imagenUrl }),
      });
      const data = await res.json();
      if (res.ok) {
        setTitulo("");
        setDescripcion("");
        setImagenUrl("");
        setTipo("proximamente");
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

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#17152B" }}>Novedades de Quiubot</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 24 }}>
        Lo que publiques aquí aparece en la tarjeta "Novedades de Quiubot" del panel de Inicio de todos
        los usuarios — úsalo para anunciar próximos lanzamientos, funciones nuevas, o generar intriga
        sobre lo que viene.
      </p>

      {/* Formulario de nueva novedad */}
      <form onSubmit={publicar} style={{ background: "#f9fafb", borderRadius: 14, padding: 20, marginBottom: 28, display: "flex", flexDirection: "column", gap: 12 }}>
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
          <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>URL de imagen (opcional)</label>
          <input
            type="url"
            value={imagenUrl}
            onChange={(e) => setImagenUrl(e.target.value)}
            placeholder="https://..."
            style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
          />
          <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>
            Sube la imagen a donde prefieras (Cloudinary, Imgur, etc.) y pega aquí el link directo a la imagen.
          </p>
          {imagenUrl && (
            <img src={imagenUrl} alt="Vista previa" style={{ marginTop: 8, maxHeight: 120, borderRadius: 8, display: "block" }} onError={(e) => (e.currentTarget.style.display = "none")} />
          )}
        </div>

        <button
          type="submit"
          disabled={guardando}
          style={{ alignSelf: "flex-start", padding: "10px 20px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          {guardando ? "Publicando..." : "Publicar novedad"}
        </button>
        {error && <p style={{ fontSize: 12, color: "#DC2626", margin: 0 }}>{error}</p>}
      </form>

      {/* Lista de novedades existentes */}
      {cargando ? (
        <CargandoQuiubotInline />
      ) : novedades.length === 0 ? (
        <p style={{ fontSize: 13, color: "#888" }}>Aún no has publicado ninguna novedad.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {novedades.map((n) => {
            const badge = badgeTipo(n.tipo);
            return (
              <div key={n.id} style={{ display: "flex", gap: 12, border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fff" }}>
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
                <button
                  onClick={() => eliminar(n.id)}
                  style={{ fontSize: 11, color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600, alignSelf: "flex-start" }}
                >
                  Eliminar
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
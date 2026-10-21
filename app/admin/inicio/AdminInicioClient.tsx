"use client";

import { useState, useEffect, useCallback } from "react";
import { CargandoQuiubotInline } from "@/app/components/CargandoQuiubot";
import { BLOQUES_INICIO } from "@/app/lib/configHome";

const PLANES_DISPONIBLES = [
  { id: "arranque", label: "Arranque" },
  { id: "crecimiento", label: "Crecimiento" },
  { id: "escala", label: "Escala" },
];

type Banner = {
  id: string;
  titulo: string;
  texto: string | null;
  boton_texto: string | null;
  boton_url: string | null;
  imagen_desktop_url: string;
  imagen_mobile_url: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  planes: string[] | null;
  incluye_prueba: boolean;
  activo: boolean;
  orden: number;
};

type BloqueConfig = { id: string; visible: boolean };

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });
}

function SeccionBloques() {
  const [bloques, setBloques] = useState<BloqueConfig[]>([]);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/admin/config-home");
      const data = await res.json();
      if (res.ok) setBloques(data.bloques || []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const nombreBloque = (id: string) => BLOQUES_INICIO.find((b) => b.id === id)?.nombre || id;
  const esSiempreVisible = (id: string) => BLOQUES_INICIO.find((b) => b.id === id)?.siempreVisible ?? false;

  const guardar = async (nuevos: BloqueConfig[]) => {
    setBloques(nuevos);
    setGuardando(true);
    try {
      await fetch("/api/admin/config-home", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bloques: nuevos }),
      });
    } finally {
      setGuardando(false);
    }
  };

  const mover = (idx: number, direccion: -1 | 1) => {
    const destino = idx + direccion;
    if (destino < 0 || destino >= bloques.length) return;
    const nuevos = [...bloques];
    [nuevos[idx], nuevos[destino]] = [nuevos[destino], nuevos[idx]];
    guardar(nuevos);
  };

  const toggleVisible = (idx: number) => {
    if (esSiempreVisible(bloques[idx].id)) return;
    const nuevos = bloques.map((b, i) => (i === idx ? { ...b, visible: !b.visible } : b));
    guardar(nuevos);
  };

  if (cargando) return <CargandoQuiubotInline />;

  return (
    <div>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 1.5 }}>
        Orden y visibilidad de los bloques del Inicio. En computador, "Métricas", "Actualizaciones" y
        "Capacitaciones" siempre van en la columna derecha — el resto, a la izquierda. El orden de aquí
        se respeta dentro de cada columna (y es el orden completo en celular). "Métricas" y "Decisiones
        pendientes" no se pueden ocultar, solo mover.
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {bloques.map((b, idx) => {
          const siempreVisible = esSiempreVisible(b.id);
          return (
            <div
              key={b.id}
              style={{ display: "flex", alignItems: "center", gap: 10, background: "#f9fafb", borderRadius: 10, padding: "10px 14px" }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button
                  type="button"
                  onClick={() => mover(idx, -1)}
                  disabled={idx === 0 || guardando}
                  style={{ background: "none", border: "none", cursor: idx === 0 ? "not-allowed" : "pointer", color: idx === 0 ? "#ccc" : "#534AB7", fontSize: 12, padding: 0, lineHeight: 1 }}
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => mover(idx, 1)}
                  disabled={idx === bloques.length - 1 || guardando}
                  style={{ background: "none", border: "none", cursor: idx === bloques.length - 1 ? "not-allowed" : "pointer", color: idx === bloques.length - 1 ? "#ccc" : "#534AB7", fontSize: 12, padding: 0, lineHeight: 1 }}
                >
                  ▼
                </button>
              </div>
              <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600, color: "#1a1a1a" }}>{nombreBloque(b.id)}</span>
              {siempreVisible && <span style={{ fontSize: 11, color: "#999" }}>Siempre visible</span>}
              <button
                type="button"
                onClick={() => toggleVisible(idx)}
                disabled={siempreVisible || guardando}
                title={siempreVisible ? "Este bloque no se puede ocultar" : b.visible ? "Ocultar" : "Mostrar"}
                style={{
                  width: 40, height: 22, borderRadius: 12, border: "none", position: "relative",
                  background: siempreVisible ? "#e5e7eb" : b.visible ? "#534AB7" : "#e5e7eb",
                  cursor: siempreVisible ? "not-allowed" : "pointer", flexShrink: 0,
                }}
              >
                <span
                  style={{
                    position: "absolute", top: 2, left: (siempreVisible ? true : b.visible) ? 20 : 2,
                    width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left .15s ease",
                  }}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SeccionBanners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [cargando, setCargando] = useState(true);
  const [formAbierto, setFormAbierto] = useState(false);
  const [editandoId, setEditandoId] = useState<string | null>(null);

  const [titulo, setTitulo] = useState("");
  const [texto, setTexto] = useState("");
  const [botonTexto, setBotonTexto] = useState("");
  const [botonUrl, setBotonUrl] = useState("");
  const [imagenDesktopUrl, setImagenDesktopUrl] = useState("");
  const [imagenMobileUrl, setImagenMobileUrl] = useState("");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [planesSel, setPlanesSel] = useState<string[]>([]);
  const [incluyePrueba, setIncluyePrueba] = useState(false);
  const [subiendoDesktop, setSubiendoDesktop] = useState(false);
  const [subiendoMobile, setSubiendoMobile] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/admin/banners");
      const data = await res.json();
      if (res.ok) setBanners(data.banners || []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const subirImagen = async (file: File, cual: "desktop" | "mobile") => {
    const setSubiendo = cual === "desktop" ? setSubiendoDesktop : setSubiendoMobile;
    const setUrl = cual === "desktop" ? setImagenDesktopUrl : setImagenMobileUrl;
    setSubiendo(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("archivo", file);
      const res = await fetch("/api/admin/subir-imagen-home", { method: "POST", body: formData });
      const data = await res.json();
      if (res.ok) setUrl(data.url);
      else setError(data.error || "No se pudo subir la imagen.");
    } finally {
      setSubiendo(false);
    }
  };

  const limpiarForm = () => {
    setEditandoId(null);
    setTitulo("");
    setTexto("");
    setBotonTexto("");
    setBotonUrl("");
    setImagenDesktopUrl("");
    setImagenMobileUrl("");
    setFechaInicio("");
    setFechaFin("");
    setPlanesSel([]);
    setIncluyePrueba(false);
    setFormAbierto(false);
    setError(null);
  };

  const editar = (b: Banner) => {
    setEditandoId(b.id);
    setTitulo(b.titulo);
    setTexto(b.texto || "");
    setBotonTexto(b.boton_texto || "");
    setBotonUrl(b.boton_url || "");
    setImagenDesktopUrl(b.imagen_desktop_url);
    setImagenMobileUrl(b.imagen_mobile_url || "");
    setFechaInicio(b.fecha_inicio || "");
    setFechaFin(b.fecha_fin || "");
    setPlanesSel(b.planes || []);
    setIncluyePrueba(b.incluye_prueba);
    setFormAbierto(true);
    setError(null);
  };

  const guardarBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!titulo.trim() || !imagenDesktopUrl.trim()) {
      setError("Falta el título o la imagen para computador.");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        titulo: titulo.trim(),
        texto: texto.trim() || null,
        boton_texto: botonTexto.trim() || null,
        boton_url: botonUrl.trim() || null,
        imagen_desktop_url: imagenDesktopUrl.trim(),
        imagen_mobile_url: imagenMobileUrl.trim() || null,
        fecha_inicio: fechaInicio || null,
        fecha_fin: fechaFin || null,
        planes: planesSel.length > 0 ? planesSel : null,
        incluye_prueba: incluyePrueba,
      };
      const res = editandoId
        ? await fetch(`/api/admin/banners/${editandoId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch("/api/admin/banners", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      const data = await res.json();
      if (res.ok) {
        limpiarForm();
        cargar();
      } else {
        setError(data.error || "No se pudo guardar el banner.");
      }
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar este banner?")) return;
    await fetch(`/api/admin/banners/${id}`, { method: "DELETE" });
    cargar();
  };

  const toggleActivo = async (b: Banner) => {
    setBanners((prev) => prev.map((x) => (x.id === b.id ? { ...x, activo: !x.activo } : x)));
    await fetch(`/api/admin/banners/${b.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activo: !b.activo }),
    });
  };

  const mover = async (idx: number, direccion: -1 | 1) => {
    const destino = idx + direccion;
    if (destino < 0 || destino >= banners.length) return;
    const a = banners[idx];
    const b = banners[destino];
    const nuevos = [...banners];
    [nuevos[idx], nuevos[destino]] = [nuevos[destino], nuevos[idx]];
    setBanners(nuevos);
    await Promise.all([
      fetch(`/api/admin/banners/${a.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orden: b.orden }) }),
      fetch(`/api/admin/banners/${b.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ orden: a.orden }) }),
    ]);
  };

  const togglePlan = (id: string) => {
    setPlanesSel((prev) => (prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]));
  };

  return (
    <div>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 16, lineHeight: 1.5 }}>
        Banners grandes del Inicio — si hay más de uno vigente (activo, dentro de sus fechas, y que
        aplique al usuario), se muestran en carrusel; si hay solo uno, queda fijo.
      </p>

      {!formAbierto ? (
        <button
          type="button"
          onClick={() => setFormAbierto(true)}
          style={{ marginBottom: 20, padding: "10px 18px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
        >
          + Nuevo banner
        </button>
      ) : (
        <form onSubmit={guardarBanner} style={{ background: "#f9fafb", borderRadius: 14, padding: 20, marginBottom: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Título</label>
            <input
              type="text"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ej: Nuevo objetivo: Generación de Leads"
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Texto corto (opcional)</label>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={2}
              style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Texto del botón (opcional)</label>
              <input
                type="text"
                value={botonTexto}
                onChange={(e) => setBotonTexto(e.target.value)}
                placeholder="Ej: Probar ahora"
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Enlace del botón</label>
              <input
                type="text"
                value={botonUrl}
                onChange={(e) => setBotonUrl(e.target.value)}
                placeholder="/estrategia o https://..."
                style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 200px" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Imagen para computador (1600×600 recomendado)</label>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && subirImagen(e.target.files[0], "desktop")} style={{ fontSize: 12 }} />
              {subiendoDesktop && <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>Subiendo...</p>}
              {imagenDesktopUrl && <img src={imagenDesktopUrl} alt="" style={{ marginTop: 8, maxHeight: 90, borderRadius: 8, display: "block" }} />}
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Imagen para celular (800×1000, opcional)</label>
              <input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && subirImagen(e.target.files[0], "mobile")} style={{ fontSize: 12 }} />
              {subiendoMobile && <p style={{ fontSize: 11, color: "#999", margin: "4px 0 0" }}>Subiendo...</p>}
              {imagenMobileUrl && <img src={imagenMobileUrl} alt="" style={{ marginTop: 8, maxHeight: 90, borderRadius: 8, display: "block" }} />}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Desde (opcional)</label>
              <input type="date" value={fechaInicio} onChange={(e) => setFechaInicio(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }} />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Hasta (opcional)</label>
              <input type="date" value={fechaFin} onChange={(e) => setFechaFin(e.target.value)} style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }} />
            </div>
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: "#666", display: "block", marginBottom: 6 }}>
              A quién se muestra <span style={{ fontWeight: 400, color: "#999" }}>(nada marcado = todos)</span>
            </label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PLANES_DISPONIBLES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => togglePlan(p.id)}
                  style={{
                    padding: "6px 14px", borderRadius: 20,
                    border: planesSel.includes(p.id) ? "2px solid #534AB7" : "1px solid #e0e0e0",
                    background: planesSel.includes(p.id) ? "#f3f2fe" : "#fff",
                    color: planesSel.includes(p.id) ? "#534AB7" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setIncluyePrueba((v) => !v)}
                style={{
                  padding: "6px 14px", borderRadius: 20,
                  border: incluyePrueba ? "2px solid #534AB7" : "1px solid #e0e0e0",
                  background: incluyePrueba ? "#f3f2fe" : "#fff",
                  color: incluyePrueba ? "#534AB7" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer",
                }}
              >
                En prueba gratuita
              </button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="submit"
              disabled={guardando || subiendoDesktop || subiendoMobile}
              style={{ padding: "10px 20px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
            >
              {guardando ? "Guardando..." : editandoId ? "Guardar cambios" : "Crear banner"}
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
      ) : banners.length === 0 ? (
        <p style={{ fontSize: 13, color: "#888" }}>Aún no has creado ningún banner.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {banners.map((b, idx) => (
            <div key={b.id} style={{ display: "flex", gap: 12, border: "1px solid #eee", borderRadius: 12, padding: 14, background: "#fff", opacity: b.activo ? 1 : 0.55 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <button type="button" onClick={() => mover(idx, -1)} disabled={idx === 0} style={{ background: "none", border: "none", cursor: idx === 0 ? "not-allowed" : "pointer", color: idx === 0 ? "#ccc" : "#534AB7", fontSize: 12, padding: 0 }}>▲</button>
                <button type="button" onClick={() => mover(idx, 1)} disabled={idx === banners.length - 1} style={{ background: "none", border: "none", cursor: idx === banners.length - 1 ? "not-allowed" : "pointer", color: idx === banners.length - 1 ? "#ccc" : "#534AB7", fontSize: 12, padding: 0 }}>▼</button>
              </div>
              <img src={b.imagen_desktop_url} alt="" style={{ width: 90, height: 60, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 14, fontWeight: 600, margin: 0, color: "#1a1a1a" }}>{b.titulo}</p>
                <p style={{ fontSize: 11.5, color: "#999", margin: "3px 0 0" }}>
                  {b.fecha_inicio || b.fecha_fin
                    ? `${b.fecha_inicio ? formatearFecha(b.fecha_inicio) : "sin inicio"} — ${b.fecha_fin ? formatearFecha(b.fecha_fin) : "sin fin"}`
                    : "Sin fechas (siempre vigente)"}
                  {" · "}
                  {b.planes && b.planes.length > 0 ? b.planes.join(", ") : "todos los planes"}
                  {b.incluye_prueba ? " + prueba" : ""}
                </p>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end", flexShrink: 0 }}>
                <button type="button" onClick={() => toggleActivo(b)} style={{ fontSize: 11, color: b.activo ? "#166534" : "#999", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  {b.activo ? "Activo" : "Inactivo"}
                </button>
                <button type="button" onClick={() => editar(b)} style={{ fontSize: 11, color: "#534AB7", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Editar
                </button>
                <button type="button" onClick={() => eliminar(b.id)} style={{ fontSize: 11, color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminInicioClient() {
  const [tab, setTab] = useState<"banners" | "bloques">("banners");

  return (
    <div style={{ maxWidth: 800, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#17152B" }}>Inicio</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
        Arma el tablero de Inicio de todos los usuarios: banners grandes y el orden/visibilidad de sus bloques.
      </p>
      <div style={{ display: "flex", gap: 8, marginBottom: 24, borderBottom: "1px solid #eee" }}>
        {(["banners", "bloques"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: "10px 16px", background: "none", border: "none", cursor: "pointer",
              fontSize: 13, fontWeight: 600, color: tab === t ? "#534AB7" : "#999",
              borderBottom: tab === t ? "2px solid #534AB7" : "2px solid transparent",
            }}
          >
            {t === "banners" ? "Banners" : "Orden de bloques"}
          </button>
        ))}
      </div>
      {tab === "banners" ? <SeccionBanners /> : <SeccionBloques />}
    </div>
  );
}

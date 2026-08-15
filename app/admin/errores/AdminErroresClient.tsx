"use client";

import { useState, useEffect, useCallback } from "react";
import { CargandoQuiubotInline } from "@/app/components/CargandoQuiubot";

type ErrorPublicacion = {
  id: string;
  origen: string | null;
  user_id: string | null;
  email: string;
  paso: string | null;
  error_subcode: number | null;
  error_titulo: string | null;
  error_mensaje: string;
  detalle_tecnico: string | null;
  campana_nombre: string | null;
  objetivo_id: string | null;
  creado_en: string;
};

type Contacto = {
  id: string;
  nombre: string | null;
  email: string;
  activo: boolean;
  creado_en: string;
};

const NOMBRES_ORIGEN: Record<string, string> = {
  publicar_estrategia: "Publicar estrategia",
  generar_estrategia: "Generar estrategia",
  crear_creativos: "Crear creativos",
  conectar_meta: "Conectar Meta",
  billing_bold: "Pago con Bold",
};

const NOMBRES_OBJETIVO: Record<string, string> = {
  venta_directa_web: "Venta Directa",
  venta_directa_whatsapp: "Venta Directa (WhatsApp)",
  reconocimiento: "Reconocimiento",
  retargeting: "Retargeting",
  leads: "Generación de Leads",
  trafico_mensajes: "Tráfico",
};

const NOMBRES_PASO: Record<string, string> = {
  crear_campana: "Crear campaña",
  crear_conjunto_de_anuncios: "Crear conjunto de anuncios",
  crear_formulario_de_leads: "Crear formulario de leads",
  crear_ad_creative: "Crear creativo",
  crear_anuncio: "Crear anuncio",
  conexion_con_n8n: "Conexión con n8n",
};

function formatearFecha(iso: string) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function SeccionContactos() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      const res = await fetch("/api/admin/contactos");
      const data = await res.json();
      if (res.ok) setContactos(data.contactos || []);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (abierto) cargar();
  }, [abierto, cargar]);

  const agregar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/contactos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre, email }),
      });
      const data = await res.json();
      if (res.ok) {
        setNombre("");
        setEmail("");
        cargar();
      } else {
        setError(data.error || "No se pudo agregar.");
      }
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async (id: string) => {
    await fetch(`/api/admin/contactos/${id}`, { method: "DELETE" });
    cargar();
  };

  return (
    <div style={{ background: "#f3f2fe", borderRadius: 12, padding: 16, marginBottom: 20 }}>
      <div
        onClick={() => setAbierto(!abierto)}
        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }}
      >
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#534AB7" }}>📧 Contactos que reciben notificación de errores</span>
          <p style={{ fontSize: 11.5, color: "#666", margin: "4px 0 0" }}>
            Cada vez que ocurre un error, cada uno de estos correos recibe un aviso. Si no agregas ninguno, se usa ADMIN_EMAIL por defecto.
          </p>
        </div>
        <span style={{ fontSize: 12, color: "#534AB7", fontWeight: 600 }}>{abierto ? "Ocultar ▲" : "Administrar ▼"}</span>
      </div>

      {abierto && (
        <div style={{ marginTop: 14 }}>
          {cargando ? (
            <CargandoQuiubotInline />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 12 }}>
              {contactos.length === 0 && <p style={{ fontSize: 12, color: "#888" }}>Sin contactos registrados — usando ADMIN_EMAIL.</p>}
              {contactos.map((c) => (
                <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fff", padding: "8px 12px", borderRadius: 8 }}>
                  <span style={{ fontSize: 12.5, color: "#333" }}>
                    {c.nombre ? `${c.nombre} — ` : ""}{c.email}
                  </span>
                  <button
                    onClick={() => eliminar(c.id)}
                    style={{ fontSize: 11, color: "#DC2626", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={agregar} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Nombre (opcional)"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              style={{ flex: "1 1 140px", padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 12.5 }}
            />
            <input
              type="email"
              placeholder="correo@ejemplo.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{ flex: "1 1 200px", padding: "8px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 12.5 }}
            />
            <button
              type="submit"
              disabled={guardando}
              style={{ padding: "8px 16px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontWeight: 600, fontSize: 12.5, cursor: "pointer" }}
            >
              {guardando ? "Agregando..." : "Agregar"}
            </button>
          </form>
          {error && <p style={{ fontSize: 11.5, color: "#DC2626", marginTop: 6 }}>{error}</p>}
        </div>
      )}
    </div>
  );
}

export default function AdminErroresClient() {
  const [errores, setErrores] = useState<ErrorPublicacion[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [origen, setOrigen] = useState("");
  const [paso, setPaso] = useState("");
  const [objetivoId, setObjetivoId] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");

  const [expandido, setExpandido] = useState<string | null>(null);

  const porPagina = 30;
  const totalPaginas = Math.max(1, Math.ceil(total / porPagina));

  const cargarErrores = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (origen) params.set("origen", origen);
      if (paso) params.set("paso", paso);
      if (objetivoId) params.set("objetivo_id", objetivoId);
      if (desde) params.set("desde", desde);
      if (hasta) params.set("hasta", hasta);
      params.set("pagina", String(pagina));

      const res = await fetch(`/api/admin/errores?${params.toString()}`);
      const data = await res.json();
      if (res.ok) {
        setErrores(data.errores || []);
        setTotal(data.total || 0);
      } else {
        setErrorCarga(data.error || "No se pudieron cargar los errores.");
      }
    } catch {
      setErrorCarga("No se pudo conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }, [q, origen, paso, objetivoId, desde, hasta, pagina]);

  useEffect(() => {
    cargarErrores();
  }, [cargarErrores]);

  const handleBuscar = (e: React.FormEvent) => {
    e.preventDefault();
    setPagina(1);
    cargarErrores();
  };

  const limpiarFiltros = () => {
    setQ("");
    setOrigen("");
    setPaso("");
    setObjetivoId("");
    setDesde("");
    setHasta("");
    setPagina(1);
  };

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 24px" }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4, color: "#17152B" }}>Errores del sistema</h1>
      <p style={{ fontSize: 13, color: "#666", marginBottom: 20 }}>
        Cualquier error significativo de Quiubot (publicar campañas, generar estrategias, crear
        creativos, pagos, conexión con Meta) queda registrado aquí — con el detalle técnico completo,
        para poder contactar al usuario de forma proactiva.
      </p>

      <SeccionContactos />

      <form onSubmit={handleBuscar} style={{ background: "#f9fafb", borderRadius: 12, padding: 16, marginBottom: 20, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
        <div style={{ flex: "1 1 220px" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Buscar (correo o campaña)</label>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="cliente@correo.com o nombre de campaña"
            style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ flex: "1 1 160px" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Parte de Quiubot</label>
          <select
            value={origen}
            onChange={(e) => setOrigen(e.target.value)}
            style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
          >
            <option value="">Todas</option>
            {Object.entries(NOMBRES_ORIGEN).map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 160px" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Paso donde falló</label>
          <select
            value={paso}
            onChange={(e) => setPaso(e.target.value)}
            style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
          >
            <option value="">Todos</option>
            {Object.entries(NOMBRES_PASO).map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 160px" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Objetivo</label>
          <select
            value={objetivoId}
            onChange={(e) => setObjetivoId(e.target.value)}
            style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
          >
            <option value="">Todos</option>
            {Object.entries(NOMBRES_OBJETIVO).map(([id, nombre]) => (
              <option key={id} value={id}>{nombre}</option>
            ))}
          </select>
        </div>

        <div style={{ flex: "1 1 140px" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Desde</label>
          <input
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ flex: "1 1 140px" }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: "#666", display: "block", marginBottom: 4 }}>Hasta</label>
          <input
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #e0e0e0", fontSize: 13, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="submit"
            style={{ padding: "9px 18px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Buscar
          </button>
          <button
            type="button"
            onClick={limpiarFiltros}
            style={{ padding: "9px 14px", borderRadius: 8, background: "#fff", color: "#666", border: "1px solid #e0e0e0", fontWeight: 600, fontSize: 13, cursor: "pointer" }}
          >
            Limpiar
          </button>
        </div>
      </form>

      {cargando ? (
        <CargandoQuiubotInline />
      ) : errorCarga ? (
        <p style={{ fontSize: 13, color: "#DC2626" }}>{errorCarga}</p>
      ) : errores.length === 0 ? (
        <p style={{ fontSize: 13, color: "#888" }}>No hay errores registrados con estos filtros.</p>
      ) : (
        <>
          <p style={{ fontSize: 12, color: "#999", marginBottom: 10 }}>{total} resultado{total !== 1 ? "s" : ""}</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {errores.map((err) => {
              const abierto = expandido === err.id;
              return (
                <div key={err.id} style={{ border: "1px solid #eee", borderRadius: 12, overflow: "hidden", background: "#fff" }}>
                  <div
                    onClick={() => setExpandido(abierto ? null : err.id)}
                    style={{ padding: 16, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#17152B" }}>{err.email}</span>
                        {err.origen && (
                          <span style={{ fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "2px 8px", borderRadius: 8, fontWeight: 600 }}>
                            {NOMBRES_ORIGEN[err.origen] || err.origen}
                          </span>
                        )}
                        {err.paso && (
                          <span style={{ fontSize: 11, background: "#f3f2fe", color: "#534AB7", padding: "2px 8px", borderRadius: 8, fontWeight: 600 }}>
                            {NOMBRES_PASO[err.paso] || err.paso}
                          </span>
                        )}
                        {err.objetivo_id && (
                          <span style={{ fontSize: 11, background: "#f5f5f5", color: "#666", padding: "2px 8px", borderRadius: 8, fontWeight: 600 }}>
                            {NOMBRES_OBJETIVO[err.objetivo_id] || err.objetivo_id}
                          </span>
                        )}
                        {err.error_subcode && (
                          <span style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", padding: "2px 8px", borderRadius: 8, fontWeight: 600 }}>
                            subcode {err.error_subcode}
                          </span>
                        )}
                      </div>
                      {err.campana_nombre && (
                        <div style={{ fontSize: 12, color: "#999", marginBottom: 4 }}>Campaña: {err.campana_nombre}</div>
                      )}
                      {err.error_titulo && (
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#991b1b", marginBottom: 2 }}>{err.error_titulo}</div>
                      )}
                      <div style={{ fontSize: 13, color: "#333" }}>{err.error_mensaje}</div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{ fontSize: 11, color: "#999", whiteSpace: "nowrap" }}>{formatearFecha(err.creado_en)}</div>
                      <div style={{ fontSize: 11, color: "#534AB7", marginTop: 6 }}>{abierto ? "Ocultar detalle ▲" : "Ver detalle técnico ▼"}</div>
                    </div>
                  </div>
                  {abierto && err.detalle_tecnico && (
                    <div style={{ background: "#17152B", padding: 16, borderTop: "1px solid #333" }}>
                      <pre style={{ margin: 0, fontSize: 11.5, color: "#e5e7eb", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "monospace" }}>
                        {err.detalle_tecnico}
                      </pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {totalPaginas > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 24 }}>
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", cursor: pagina === 1 ? "not-allowed" : "pointer", fontSize: 13, opacity: pagina === 1 ? 0.5 : 1 }}
              >
                ← Anterior
              </button>
              <span style={{ fontSize: 13, color: "#666", display: "flex", alignItems: "center" }}>
                Página {pagina} de {totalPaginas}
              </span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                style={{ padding: "8px 14px", borderRadius: 8, border: "1px solid #e0e0e0", background: "#fff", cursor: pagina === totalPaginas ? "not-allowed" : "pointer", fontSize: 13, opacity: pagina === totalPaginas ? 0.5 : 1 }}
              >
                Siguiente →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
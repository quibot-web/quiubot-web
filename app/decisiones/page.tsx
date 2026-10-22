"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import CargandoQuiubot, { CargandoQuiubotInline } from "@/app/components/CargandoQuiubot";
import { ProveedorEsferas } from "@/app/components/esferas/ProveedorEsferas";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { Asistente, AccionPropuesta } from "@/app/lib/metas";

type PropuestaUnificada = {
  id: string;
  origen: "propuesta" | "notificacion";
  asistente: Asistente;
  accion: AccionPropuesta | null;
  titulo: string;
  justificacion: string;
  impactoEsperado: string | null;
  costoEstimadoCop: number | null;
  venceEn: string | null;
  creadoEn: string;
};

const NOMBRE_ASISTENTE: Record<Asistente, string> = {
  director: "Director",
  marca: "Analista de marca",
  estratega: "Estratega",
  creativo: "Creativo",
  publicador: "Publicador",
  analista: "Analista de campañas",
  optimizador: "Optimizador",
};

const CATALOGO_LABEL: Record<AccionPropuesta, string> = {
  generar_estrategia: "Generar estrategia",
  crear_creativos: "Crear creativos",
  publicar_campana: "Publicar campaña",
  pausar: "Pausar campaña",
  ajustar_presupuesto: "Ajustar presupuesto",
  agregar_anuncios: "Agregar anuncios",
};

function formatoCop(valor: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(valor);
}

function tiempoRestante(venceEn: string | null): string | null {
  if (!venceEn) return null;
  const msRestantes = new Date(venceEn).getTime() - Date.now();
  if (msRestantes <= 0) return "vencida";
  const horas = Math.floor(msRestantes / (60 * 60 * 1000));
  if (horas < 1) return "vence en menos de 1h";
  if (horas < 24) return `vence en ${horas}h`;
  return `vence en ${Math.floor(horas / 24)}d`;
}

function idReal(id: string): string {
  return id.startsWith("notif-") ? id.slice(6) : id;
}

export default function DecisionesPage() {
  const router = useRouter();
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [propuestas, setPropuestas] = useState<PropuestaUnificada[]>([]);
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [ajustandoId, setAjustandoId] = useState<string | null>(null);
  const [porcentajeAjuste, setPorcentajeAjuste] = useState("20");
  const [error, setError] = useState<string | null>(null);

  const [mostrarHerramientas, setMostrarHerramientas] = useState(false);
  const [mostrarHistorial, setMostrarHistorial] = useState(false);
  const [historial, setHistorial] = useState<{ propuestas: any[]; bitacora: any[] } | null>(null);

  useEffect(() => {
    fetch("/api/usuario/rol")
      .then((r) => r.json())
      .then((data) => setEsAdmin(data.rol === "admin"))
      .catch(() => setEsAdmin(false));
  }, []);

  const cargarPropuestas = () => {
    setCargando(true);
    fetch("/api/propuestas")
      .then((r) => r.json())
      .then((data) => setPropuestas(data.propuestas ?? []))
      .catch(() => setPropuestas([]))
      .finally(() => setCargando(false));
  };

  useEffect(() => {
    if (esAdmin) cargarPropuestas();
  }, [esAdmin]);

  const cargarHistorial = () => {
    fetch("/api/propuestas/historial")
      .then((r) => r.json())
      .then((data) => setHistorial(data))
      .catch(() => setHistorial({ propuestas: [], bitacora: [] }));
  };

  const aprobar = async (p: PropuestaUnificada) => {
    setProcesandoId(p.id);
    setError(null);
    try {
      const url = p.origen === "notificacion" ? `/api/notificaciones/${idReal(p.id)}/aceptar` : `/api/propuestas/${p.id}/aprobar`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo aprobar.");
      cargarPropuestas();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const rechazar = async (p: PropuestaUnificada) => {
    setProcesandoId(p.id);
    setError(null);
    try {
      const url = p.origen === "notificacion" ? `/api/notificaciones/${idReal(p.id)}/descartar` : `/api/propuestas/${p.id}/rechazar`;
      const res = await fetch(url, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo rechazar.");
      cargarPropuestas();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  const confirmarAjuste = async (p: PropuestaUnificada) => {
    setProcesandoId(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/propuestas/${p.id}/ajustar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parametros: { ajuste_porcentaje: Number(porcentajeAjuste) } }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo ajustar.");
      setAjustandoId(null);
      cargarPropuestas();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setProcesandoId(null);
    }
  };

  if (esAdmin === null) return <CargandoQuiubot mensaje="Verificando tu acceso" />;

  if (esAdmin === false) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 20, border: "1px solid #e8e8e6", padding: "2.5rem 2rem", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "#F3F2FE", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1.25rem" }}>
            <Clock size={28} color="#534AB7" strokeWidth={2} aria-hidden="true" />
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" }}>Autopiloto — Próximamente</h1>
          <p style={{ fontSize: 14, color: "#666", lineHeight: 1.6, margin: "0 0 24px" }}>
            Todavía estamos puliendo Autopiloto. Muy pronto lo abrimos para todos.
          </p>
          <button onClick={() => router.push("/")} style={{ display: "block", width: "100%", padding: "13px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>
            Volver al panel principal
          </button>
        </div>
      </div>
    );
  }

  return (
    <ProveedorEsferas>
      <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#7F77DD", fontSize: 14, cursor: "pointer", marginBottom: 20, padding: 0 }}>
            ← Volver al panel principal
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>Bandeja de decisiones</h1>
          <p style={{ fontSize: 13.5, color: "#666", margin: "0 0 24px" }}>
            Nada de esto cambia tus campañas en Meta hasta que apruebes.
          </p>

          {error && (
            <div style={{ background: "#FEF0EF", color: "#B3261E", padding: "10px 14px", borderRadius: 10, fontSize: 13.5, marginBottom: 16 }}>
              {error}
            </div>
          )}

          {cargando && <CargandoQuiubotInline mensaje="Cargando propuestas" />}

          {!cargando && propuestas.length === 0 && (
            <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "2rem", textAlign: "center", color: "#666", fontSize: 14 }}>
              No tienes propuestas esperando tu decisión.
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {propuestas.map((p) => {
              const procesando = procesandoId === p.id;
              const puedeAjustar = p.origen === "propuesta" && p.accion === "ajustar_presupuesto";
              const restante = tiempoRestante(p.venceEn);
              return (
                <div key={p.id} style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.25rem 1.5rem" }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <EsferaAsistente asistente={p.asistente} estado="esperando" tamano={48} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
                        <p style={{ fontSize: 11.5, fontWeight: 700, color: "#534AB7", margin: 0, textTransform: "uppercase", letterSpacing: "0.02em" }}>
                          {NOMBRE_ASISTENTE[p.asistente]}{p.accion ? ` · ${CATALOGO_LABEL[p.accion]}` : ""}
                        </p>
                        {restante && (
                          <span style={{ fontSize: 11.5, color: restante === "vencida" ? "#B3261E" : "#999" }}>{restante}</span>
                        )}
                      </div>
                      <p style={{ fontSize: 15, fontWeight: 600, color: "#1a1a1a", margin: "4px 0 4px" }}>{p.titulo}</p>
                      <p style={{ fontSize: 13, color: "#666", margin: "0 0 6px", lineHeight: 1.5 }}>{p.justificacion}</p>
                      {p.impactoEsperado && (
                        <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 4px" }}>Impacto esperado: {p.impactoEsperado}</p>
                      )}
                      {p.costoEstimadoCop != null && (
                        <p style={{ fontSize: 12.5, color: "#888", margin: "0 0 10px" }}>Costo estimado: {formatoCop(p.costoEstimadoCop)}</p>
                      )}

                      {ajustandoId === p.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                          <input
                            type="number"
                            value={porcentajeAjuste}
                            onChange={(e) => setPorcentajeAjuste(e.target.value)}
                            style={{ width: 70, padding: "7px 8px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
                          />
                          <span style={{ fontSize: 13, color: "#666" }}>% de ajuste</span>
                          <button
                            onClick={() => confirmarAjuste(p)}
                            disabled={procesando}
                            style={{ padding: "7px 14px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                          >
                            {procesando ? "..." : "Aplicar ajuste"}
                          </button>
                          <button onClick={() => setAjustandoId(null)} style={{ padding: "7px 10px", borderRadius: 8, background: "none", border: "none", color: "#888", fontSize: 12.5, cursor: "pointer" }}>
                            Cancelar
                          </button>
                        </div>
                      ) : (
                        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                          <button
                            onClick={() => aprobar(p)}
                            disabled={procesando}
                            style={{ padding: "8px 16px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: procesando ? "not-allowed" : "pointer" }}
                          >
                            {procesando ? "..." : "Aprobar"}
                          </button>
                          {puedeAjustar && (
                            <button
                              onClick={() => { setAjustandoId(p.id); setPorcentajeAjuste("20"); }}
                              disabled={procesando}
                              style={{ padding: "8px 16px", borderRadius: 8, background: "#fff", color: "#534AB7", border: "1px solid #534AB7", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                            >
                              Ajustar
                            </button>
                          )}
                          <button
                            onClick={() => rechazar(p)}
                            disabled={procesando}
                            style={{ padding: "8px 16px", borderRadius: 8, background: "#fff", color: "#888", border: "1px solid #ddd", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                          >
                            Rechazar
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ marginTop: 28 }}>
            <button
              onClick={() => setMostrarHistorial((v) => { if (!v) cargarHistorial(); return !v; })}
              style={{ background: "none", border: "none", color: "#534AB7", fontSize: 13.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              {mostrarHistorial ? "Ocultar historial" : "Ver historial"}
            </button>
            {mostrarHistorial && historial && (
              <div style={{ marginTop: 14, background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.25rem 1.5rem" }}>
                {historial.propuestas.length === 0 && historial.bitacora.length === 0 && (
                  <p style={{ fontSize: 13, color: "#999", margin: 0 }}>Todavía no hay historial.</p>
                )}
                {historial.propuestas.map((p: any) => (
                  <div key={p.id} style={{ padding: "8px 0", borderBottom: "1px solid #f3f2fe" }}>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", margin: 0 }}>{p.titulo} — {p.estado}</p>
                    <p style={{ fontSize: 11.5, color: "#999", margin: "2px 0 0" }}>{new Date(p.decidido_en || p.creado_en).toLocaleString("es-CO")}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginTop: 28, borderTop: "1px solid #e8e8e6", paddingTop: 20 }}>
            <button
              onClick={() => setMostrarHerramientas((v) => !v)}
              style={{ background: "none", border: "none", color: "#888", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: 0 }}
            >
              {mostrarHerramientas ? "Ocultar herramientas de prueba" : "Herramientas de prueba (admin)"}
            </button>
            {mostrarHerramientas && (
              <HerramientaPruebaPropuesta onCreada={cargarPropuestas} />
            )}
          </div>
        </div>
      </div>
    </ProveedorEsferas>
  );
}

const ASISTENTES: Asistente[] = ["director", "marca", "estratega", "creativo", "publicador", "analista", "optimizador"];
const ACCIONES: AccionPropuesta[] = ["generar_estrategia", "crear_creativos", "publicar_campana", "pausar", "ajustar_presupuesto", "agregar_anuncios"];
const ACCIONES_CON_CAMPANA = new Set<AccionPropuesta>(["pausar", "ajustar_presupuesto"]);

function HerramientaPruebaPropuesta({ onCreada }: { onCreada: () => void }) {
  const [asistente, setAsistente] = useState<Asistente>("optimizador");
  const [accion, setAccion] = useState<AccionPropuesta>("pausar");
  const [campanas, setCampanas] = useState<any[]>([]);
  const [campanaId, setCampanaId] = useState("");
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (ACCIONES_CON_CAMPANA.has(accion) && campanas.length === 0) {
      fetch("/api/campanas").then((r) => r.json()).then((d) => setCampanas(d.campanas ?? [])).catch(() => setCampanas([]));
    }
  }, [accion, campanas.length]);

  const crear = async () => {
    setCreando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/propuestas/prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asistente, accion, campana_id: ACCIONES_CON_CAMPANA.has(accion) ? campanaId : undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo crear.");
      setMensaje("Propuesta de prueba creada.");
      onCreada();
    } catch (err: any) {
      setMensaje(err.message);
    } finally {
      setCreando(false);
    }
  };

  return (
    <div style={{ marginTop: 14, background: "#fff", border: "1px dashed #ddd", borderRadius: 12, padding: "1rem 1.25rem" }}>
      <p style={{ fontSize: 12.5, color: "#999", margin: "0 0 10px" }}>
        Crea una propuesta pendiente de prueba para tu propia cuenta, como la crearía el Director.
      </p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={asistente} onChange={(e) => setAsistente(e.target.value as Asistente)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5 }}>
          {ASISTENTES.map((a) => <option key={a} value={a}>{NOMBRE_ASISTENTE[a]}</option>)}
        </select>
        <select value={accion} onChange={(e) => setAccion(e.target.value as AccionPropuesta)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5 }}>
          {ACCIONES.map((a) => <option key={a} value={a}>{CATALOGO_LABEL[a]}</option>)}
        </select>
        {ACCIONES_CON_CAMPANA.has(accion) && (
          <select value={campanaId} onChange={(e) => setCampanaId(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5, minWidth: 160 }}>
            <option value="">Elige una campaña</option>
            {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
        <button
          onClick={crear}
          disabled={creando || (ACCIONES_CON_CAMPANA.has(accion) && !campanaId)}
          style={{ padding: "7px 14px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
        >
          {creando ? "Creando..." : "Crear propuesta de prueba"}
        </button>
      </div>
      {mensaje && <p style={{ fontSize: 12.5, color: mensaje.includes("creada") ? "#15803d" : "#B3261E", margin: "8px 0 0" }}>{mensaje}</p>}
    </div>
  );
}

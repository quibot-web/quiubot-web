"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock } from "lucide-react";
import CargandoQuiubot, { CargandoQuiubotInline } from "@/app/components/CargandoQuiubot";
import { ProveedorEsferas } from "@/app/components/esferas/ProveedorEsferas";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import { comprimirSiHaceFalta, esArchivoDeImagen } from "@/app/lib/imagenes";
import type { Asistente, AccionPropuesta } from "@/app/lib/metas";

type CreativoPropuesto = {
  titulo?: string;
  texto?: string;
  descripcion?: string;
  url_imagen?: string;
  cta?: string;
  concepto?: { angulo?: string; hook?: string };
};

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
  metaId: string | null;
  resultado: { etapa?: "esperando_fotos" | "generando" | "completado" | "fallida"; job_id?: string; error?: string } | null;
  parametros: { creativos?: CreativoPropuesto[]; campana_id?: string; ajuste_porcentaje?: number } | null;
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

const MOTIVO_LABEL: Record<string, string> = {
  token_meta: "tu conexión con Meta",
  meta: "la campaña en Meta",
  accion: "la acción solicitada",
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
  const [error, setError] = useState<{ mensaje: string; motivo?: string } | null>(null);

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
      if (!res.ok) {
        setError({ mensaje: data.error || "No se pudo aprobar.", motivo: data.motivo });
        return;
      }
      // El Estratega todavía no publica nada solo -- aprobar esto solo
      // lleva al cliente a /estrategia con el objetivo ya precargado.
      if (p.accion === "generar_estrategia" && p.metaId) {
        router.push(`/estrategia?meta_id=${p.metaId}`);
        return;
      }
      cargarPropuestas();
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
      if (!res.ok) {
        setError({ mensaje: data.error || "No se pudo rechazar." });
        return;
      }
      cargarPropuestas();
    } finally {
      setProcesandoId(null);
    }
  };

  const confirmarAjuste = async (p: PropuestaUnificada, parametros: Record<string, unknown>) => {
    setProcesandoId(p.id);
    setError(null);
    try {
      const res = await fetch(`/api/propuestas/${p.id}/ajustar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ parametros }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError({ mensaje: data.error || "No se pudo ajustar.", motivo: data.motivo });
        return;
      }
      setAjustandoId(null);
      cargarPropuestas();
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
              {error.mensaje}
              {error.motivo && (
                <span style={{ display: "block", fontSize: 12, opacity: 0.8, marginTop: 2 }}>
                  Motivo: {MOTIVO_LABEL[error.motivo] || error.motivo}
                </span>
              )}
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
              const puedeAjustar = p.origen === "propuesta" && (p.accion === "ajustar_presupuesto" || p.accion === "agregar_anuncios");
              const restante = tiempoRestante(p.venceEn);
              const creativos = p.accion === "agregar_anuncios" ? p.parametros?.creativos ?? [] : [];
              return (
                <div key={p.id} style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.25rem 1.5rem" }}>
                  <div style={{ display: "flex", gap: 14 }}>
                    <EsferaAsistente asistente={p.asistente} estado={procesando ? "trabajando" : "esperando"} tamano={48} />
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

                      {creativos.length > 0 && ajustandoId !== p.id && (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
                          {creativos.map((c, i) => (
                            <div key={i} style={{ width: 92, border: "1px solid #ece9f9", borderRadius: 8, overflow: "hidden" }}>
                              {c.url_imagen && <img src={c.url_imagen} alt="" style={{ width: "100%", height: 70, objectFit: "cover", display: "block" }} />}
                              <p style={{ fontSize: 10.5, color: "#666", margin: "4px 6px", lineHeight: 1.3 }}>{c.titulo || c.texto || ""}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {p.accion === "crear_creativos" && p.resultado?.etapa === "esperando_fotos" ? (
                        <PasoSubirFotos propuestaId={p.id} onListo={cargarPropuestas} />
                      ) : p.accion === "crear_creativos" && p.resultado?.etapa === "generando" ? (
                        <EstadoGenerandoCreativos propuestaId={p.id} onListo={cargarPropuestas} />
                      ) : ajustandoId === p.id && p.accion === "agregar_anuncios" ? (
                        <AjusteCreativos
                          creativos={creativos}
                          procesando={procesando}
                          onConfirmar={(editados) => confirmarAjuste(p, { creativos: editados })}
                          onCancelar={() => setAjustandoId(null)}
                        />
                      ) : ajustandoId === p.id ? (
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
                          <input
                            type="number"
                            value={porcentajeAjuste}
                            onChange={(e) => setPorcentajeAjuste(e.target.value)}
                            style={{ width: 70, padding: "7px 8px", borderRadius: 8, border: "1px solid #ddd", fontSize: 13 }}
                          />
                          <span style={{ fontSize: 13, color: "#666" }}>% de ajuste</span>
                          <button
                            onClick={() => confirmarAjuste(p, { ajuste_porcentaje: Number(porcentajeAjuste) })}
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
const ACCIONES_CON_CAMPANA = new Set<AccionPropuesta>(["pausar", "ajustar_presupuesto", "crear_creativos", "agregar_anuncios"]);

type JobListo = { id: string; creado_en: string; total_creativos: number; preview_url: string | null };

function HerramientaPruebaPropuesta({ onCreada }: { onCreada: () => void }) {
  const [asistente, setAsistente] = useState<Asistente>("optimizador");
  const [accion, setAccion] = useState<AccionPropuesta>("pausar");
  const [campanas, setCampanas] = useState<any[]>([]);
  const [campanaId, setCampanaId] = useState("");
  const [jobsListos, setJobsListos] = useState<JobListo[]>([]);
  const [jobId, setJobId] = useState("");
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    if (ACCIONES_CON_CAMPANA.has(accion) && campanas.length === 0) {
      fetch("/api/campanas").then((r) => r.json()).then((d) => setCampanas(d.campanas ?? [])).catch(() => setCampanas([]));
    }
  }, [accion, campanas.length]);

  useEffect(() => {
    if (accion === "agregar_anuncios" && jobsListos.length === 0) {
      fetch("/api/admin/propuestas/prueba").then((r) => r.json()).then((d) => setJobsListos(d.jobs ?? [])).catch(() => setJobsListos([]));
    }
  }, [accion, jobsListos.length]);

  const necesitaJob = accion === "agregar_anuncios";

  const crear = async () => {
    setCreando(true);
    setMensaje(null);
    try {
      const res = await fetch("/api/admin/propuestas/prueba", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          asistente,
          accion,
          campana_id: ACCIONES_CON_CAMPANA.has(accion) ? campanaId : undefined,
          creativos_job_id: necesitaJob ? jobId : undefined,
        }),
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
        <select value={accion} onChange={(e) => { setAccion(e.target.value as AccionPropuesta); setJobId(""); }} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5 }}>
          {ACCIONES.map((a) => <option key={a} value={a}>{CATALOGO_LABEL[a]}</option>)}
        </select>
        {ACCIONES_CON_CAMPANA.has(accion) && (
          <select value={campanaId} onChange={(e) => setCampanaId(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5, minWidth: 160 }}>
            <option value="">Elige una campaña</option>
            {campanas.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
          </select>
        )}
        {necesitaJob && (
          <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5, minWidth: 200 }}>
            <option value="">Elige un lote de creativos listo</option>
            {jobsListos.map((j) => (
              <option key={j.id} value={j.id}>
                {j.total_creativos} creativo(s) · {new Date(j.creado_en).toLocaleDateString("es-CO")}
              </option>
            ))}
          </select>
        )}
        {necesitaJob && jobsListos.length === 0 && (
          <span style={{ fontSize: 11.5, color: "#999" }}>No tienes ningún creativos_jobs "listo" todavía.</span>
        )}
        <button
          onClick={crear}
          disabled={creando || (ACCIONES_CON_CAMPANA.has(accion) && !campanaId) || (necesitaJob && !jobId)}
          style={{ padding: "7px 14px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
        >
          {creando ? "Creando..." : "Crear propuesta de prueba"}
        </button>
      </div>
      {mensaje && <p style={{ fontSize: 12.5, color: mensaje.includes("creada") ? "#15803d" : "#B3261E", margin: "8px 0 0" }}>{mensaje}</p>}
    </div>
  );
}

const MAX_FOTOS = 3;

type FotoElegida = { tipo: "base64" | "url"; valor: string; preview: string };

// Paso intermedio de crear_creativos, una vez aprobada: no hay fotos de
// producto guardadas por campaña (ver investigación de fase 2), así que
// esto es lo que de verdad dispara la generación. Ofrece primero las
// imágenes que ya existen en el Álbum de creativos del cliente (lo más
// cercano a "fotos del ADN o de la estrategia" que hay guardado hoy) y
// también deja subir otras nuevas.
function PasoSubirFotos({ propuestaId, onListo }: { propuestaId: string; onListo: () => void }) {
  const [album, setAlbum] = useState<{ id: string; url_imagen: string }[]>([]);
  const [elegidas, setElegidas] = useState<FotoElegida[]>([]);
  const [descripcion, setDescripcion] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/album")
      .then((r) => r.json())
      .then((d) => setAlbum((d.imagenes ?? d ?? []).slice(0, 8)))
      .catch(() => setAlbum([]));
  }, []);

  const alternarDelAlbum = (url: string) => {
    setElegidas((prev) => {
      const yaEsta = prev.some((f) => f.tipo === "url" && f.valor === url);
      if (yaEsta) return prev.filter((f) => !(f.tipo === "url" && f.valor === url));
      if (prev.length >= MAX_FOTOS) return prev;
      return [...prev, { tipo: "url", valor: url, preview: url }];
    });
  };

  const agregarArchivos = async (files: FileList | null) => {
    if (!files) return;
    setErrorLocal(null);
    const disponibles = MAX_FOTOS - elegidas.length;
    for (const file of Array.from(files).slice(0, disponibles)) {
      if (!esArchivoDeImagen(file)) continue;
      try {
        const base64 = await comprimirSiHaceFalta(file);
        setElegidas((prev) => [...prev, { tipo: "base64", valor: base64, preview: base64 }]);
      } catch {
        setErrorLocal("No se pudo leer una de las fotos.");
      }
    }
  };

  const quitar = (preview: string) => setElegidas((prev) => prev.filter((f) => f.preview !== preview));

  const generar = async () => {
    if (elegidas.length === 0 || !descripcion.trim()) {
      setErrorLocal("Elige al menos 1 foto y describe lo que se ve en ellas.");
      return;
    }
    setSubiendo(true);
    setErrorLocal(null);
    try {
      const res = await fetch(`/api/propuestas/${propuestaId}/subir-fotos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imagenes: elegidas.map(({ tipo, valor }) => ({ tipo, valor })),
          descripcion_visual_producto: descripcion.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "No se pudo iniciar la generación.");
      onListo();
    } catch (err: any) {
      setErrorLocal(err.message || "Algo salió mal.");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <div style={{ marginTop: 10, background: "#F9F8FD", borderRadius: 10, padding: "12px 14px" }}>
      <p style={{ fontSize: 12.5, fontWeight: 600, color: "#1a1a1a", margin: "0 0 8px" }}>Elige hasta {MAX_FOTOS} fotos</p>

      {album.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {album.map((a) => {
            const seleccionada = elegidas.some((f) => f.tipo === "url" && f.valor === a.url_imagen);
            return (
              <img
                key={a.id}
                src={a.url_imagen}
                onClick={() => alternarDelAlbum(a.url_imagen)}
                style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, cursor: "pointer", border: seleccionada ? "2.5px solid #534AB7" : "2.5px solid transparent", opacity: seleccionada ? 1 : 0.75 }}
                alt=""
              />
            );
          })}
        </div>
      )}

      <input type="file" accept="image/*" multiple onChange={(e) => agregarArchivos(e.target.files)} style={{ fontSize: 12, marginBottom: 8 }} />

      {elegidas.length > 0 && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 8 }}>
          {elegidas.map((f) => (
            <div key={f.preview} style={{ position: "relative" }}>
              <img src={f.preview} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8 }} alt="" />
              <button onClick={() => quitar(f.preview)} style={{ position: "absolute", top: -6, right: -6, width: 18, height: 18, borderRadius: "50%", background: "#B3261E", color: "#fff", border: "none", fontSize: 11, cursor: "pointer" }}>×</button>
            </div>
          ))}
        </div>
      )}

      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder="¿Qué se ve en estas fotos?"
        rows={2}
        style={{ width: "100%", padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5, resize: "vertical", marginBottom: 8, boxSizing: "border-box" }}
      />

      {errorLocal && <p style={{ fontSize: 12, color: "#B3261E", margin: "0 0 8px" }}>{errorLocal}</p>}

      <button
        onClick={generar}
        disabled={subiendo}
        style={{ padding: "8px 16px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: subiendo ? "not-allowed" : "pointer" }}
      >
        {subiendo ? "Enviando..." : "Generar creativos"}
      </button>
    </div>
  );
}

// Mientras está "generando", hace polling (como ya hace /estrategia)
// para que, si el cliente sigue en /decisiones, la propuesta
// agregar_anuncios aparezca apenas el job termine -- sin esperar la
// corrida horaria del cron, que queda solo de respaldo.
function EstadoGenerandoCreativos({ propuestaId, onListo }: { propuestaId: string; onListo: () => void }) {
  useEffect(() => {
    let cancelado = false;
    const revisar = async () => {
      try {
        const res = await fetch(`/api/propuestas/${propuestaId}/revisar-generacion`, { method: "POST" });
        const data = await res.json();
        if (cancelado) return;
        if (data.estado === "ejecutada" || data.estado === "fallida") {
          onListo();
          return;
        }
      } catch {
        // red caída puntual -- el siguiente tick reintenta, y el cron queda de respaldo
      }
      if (!cancelado) setTimeout(revisar, 5000);
    };
    const primerIntento = setTimeout(revisar, 5000);
    return () => {
      cancelado = true;
      clearTimeout(primerIntento);
    };
  }, [propuestaId, onListo]);

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <CargandoQuiubotInline mensaje="Generando creativos" />
    </div>
  );
}

// "Ajustar" de agregar_anuncios: quitar creativos o editar su texto
// antes de aprobar. Confirmar manda el array editado a
// /api/propuestas/[id]/ajustar, que actualiza parametros.creativos y
// aprueba en el mismo paso (ver app/lib/propuestas.ts).
function AjusteCreativos({
  creativos,
  procesando,
  onConfirmar,
  onCancelar,
}: {
  creativos: CreativoPropuesto[];
  procesando: boolean;
  onConfirmar: (editados: CreativoPropuesto[]) => void;
  onCancelar: () => void;
}) {
  const [items, setItems] = useState<CreativoPropuesto[]>(creativos);

  const quitar = (i: number) => setItems((prev) => prev.filter((_, idx) => idx !== i));
  const editarTexto = (i: number, campo: "titulo" | "texto", valor: string) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, [campo]: valor } : it)));

  return (
    <div style={{ marginTop: 10, background: "#F9F8FD", borderRadius: 10, padding: "12px 14px" }}>
      {items.length === 0 && (
        <p style={{ fontSize: 12.5, color: "#B3261E", margin: "0 0 8px" }}>Quitaste todos los creativos -- deja al menos uno.</p>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 10 }}>
        {items.map((c, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            {c.url_imagen && (
              <img src={c.url_imagen} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 8, flexShrink: 0 }} alt="" />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                value={c.titulo || ""}
                onChange={(e) => editarTexto(i, "titulo", e.target.value)}
                placeholder="Título"
                style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, marginBottom: 4, boxSizing: "border-box" }}
              />
              <input
                value={c.texto || ""}
                onChange={(e) => editarTexto(i, "texto", e.target.value)}
                placeholder="Texto"
                style={{ width: "100%", padding: "5px 8px", borderRadius: 6, border: "1px solid #ddd", fontSize: 12, boxSizing: "border-box" }}
              />
            </div>
            <button onClick={() => quitar(i)} style={{ background: "none", border: "none", color: "#B3261E", fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
              Quitar
            </button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <button
          onClick={() => onConfirmar(items)}
          disabled={procesando || items.length === 0}
          style={{ padding: "7px 14px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: procesando || items.length === 0 ? "not-allowed" : "pointer" }}
        >
          {procesando ? "..." : "Aprobar con estos cambios"}
        </button>
        <button onClick={onCancelar} style={{ padding: "7px 10px", borderRadius: 8, background: "none", border: "none", color: "#888", fontSize: 12.5, cursor: "pointer" }}>
          Cancelar
        </button>
      </div>
    </div>
  );
}

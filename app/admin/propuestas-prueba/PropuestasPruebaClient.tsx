"use client";
// Porteado tal cual de app/decisiones/page.tsx (HerramientaPruebaPropuesta
// + la simulación de recordatorio de renovación) -- mismas rutas de
// siempre, solo relocado. Antes vivía detrás de un toggle visible para
// cualquier usuario (ver fix de visibilidad en el commit de seguridad);
// acá ya está detrás del gate server-side de /admin, así que no hace
// falta ningún toggle.
import { useEffect, useState } from "react";
import { NOMBRE_ASISTENTE, ASISTENTE_POR_ACCION, textoRecordatorio3Dias, TEXTO_HOY_VENCE, TEXTO_VENCIDO, textoRecienPagado } from "@/app/lib/directorChat";
import type { Asistente, AccionPropuesta } from "@/app/lib/metas";

const ASISTENTES: Asistente[] = ["director", "marca", "estratega", "creativo", "publicador", "analista", "optimizador"];
const ACCIONES: AccionPropuesta[] = ["generar_estrategia", "crear_creativos", "publicar_campana", "pausar", "ajustar_presupuesto", "agregar_anuncios"];
const ACCIONES_CON_CAMPANA = new Set<AccionPropuesta>(["pausar", "ajustar_presupuesto", "crear_creativos", "agregar_anuncios"]);
const CATALOGO_LABEL: Record<AccionPropuesta, string> = {
  generar_estrategia: "Generar estrategia",
  crear_creativos: "Crear creativos",
  publicar_campana: "Publicar campaña",
  pausar: "Pausar campaña",
  ajustar_presupuesto: "Ajustar presupuesto",
  agregar_anuncios: "Agregar anuncios",
};

type JobListo = { id: string; creado_en: string; total_creativos: number; preview_url: string | null };
type Campana = { id: string; nombre: string };

async function leerJsonSeguro(res: Response): Promise<{ [key: string]: unknown }> {
  const texto = await res.text();
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    return { error: `Error del servidor (código ${res.status})` };
  }
}

function HerramientaPruebaPropuesta({ onCreada }: { onCreada: () => void }) {
  const [asistente, setAsistente] = useState<Asistente>("optimizador");
  const [accion, setAccion] = useState<AccionPropuesta>("pausar");
  const [campanas, setCampanas] = useState<Campana[]>([]);
  const [campanaId, setCampanaId] = useState("");
  const [jobsListos, setJobsListos] = useState<JobListo[]>([]);
  const [jobId, setJobId] = useState("");
  const [creando, setCreando] = useState(false);
  const [mensaje, setMensaje] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/campanas")
      .then((r) => (r.ok ? r.json() : { campanas: [] }))
      .then((d) => setCampanas(d.campanas ?? []))
      .catch(() => setCampanas([]));
  }, []);

  useEffect(() => {
    if (accion !== "agregar_anuncios") return;
    fetch("/api/admin/propuestas/prueba")
      .then((r) => (r.ok ? r.json() : { jobs: [] }))
      .then((d) => setJobsListos(d.jobs ?? []))
      .catch(() => setJobsListos([]));
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
      const data = await leerJsonSeguro(res);
      if (!res.ok) throw new Error((data.error as string) || "No se pudo crear.");
      setMensaje("Propuesta de prueba creada.");
      onCreada();
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : "Algo salió mal.");
    } finally {
      setCreando(false);
    }
  };

  return (
    <div style={{ marginTop: 14, background: "#fff", border: "1px dashed #ddd", borderRadius: 12, padding: "1rem 1.25rem" }}>
      <p style={{ fontSize: 12.5, color: "#999", margin: "0 0 10px" }}>Crea una propuesta pendiente de prueba para tu propia cuenta, como la crearía el Director. Se ve en /equipo.</p>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <select value={asistente} onChange={(e) => setAsistente(e.target.value as Asistente)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5 }}>
          {ASISTENTES.map((a) => (
            <option key={a} value={a}>
              {NOMBRE_ASISTENTE[a]}
            </option>
          ))}
        </select>
        <select
          value={accion}
          onChange={(e) => {
            const nuevaAccion = e.target.value as AccionPropuesta;
            setAccion(nuevaAccion);
            setAsistente(ASISTENTE_POR_ACCION[nuevaAccion]);
            setJobId("");
          }}
          style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5 }}
        >
          {ACCIONES.map((a) => (
            <option key={a} value={a}>
              {CATALOGO_LABEL[a]}
            </option>
          ))}
        </select>
        {ACCIONES_CON_CAMPANA.has(accion) && (
          <select value={campanaId} onChange={(e) => setCampanaId(e.target.value)} style={{ padding: "7px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 12.5, minWidth: 160 }}>
            <option value="">Elige una campaña</option>
            {campanas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nombre}
              </option>
            ))}
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
        {necesitaJob && jobsListos.length === 0 && <span style={{ fontSize: 11.5, color: "#999" }}>No tienes ningún creativos_jobs &quot;listo&quot; todavía.</span>}
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

type EtapaRecordatorio = "3_dias_antes" | "hoy_vence" | "vencido" | "recien_pagado";
const ETAPAS: EtapaRecordatorio[] = ["3_dias_antes", "hoy_vence", "vencido", "recien_pagado"];

function SimulacionRecordatorio() {
  const [etapa, setEtapa] = useState<EtapaRecordatorio>("3_dias_antes");

  const fecha = new Date();
  if (etapa === "3_dias_antes") fecha.setDate(fecha.getDate() + 2);
  else if (etapa === "vencido") fecha.setDate(fecha.getDate() - 5);
  else if (etapa === "recien_pagado") fecha.setDate(fecha.getDate() + 28);
  const fechaTexto = fecha.toLocaleDateString("es-CO");

  const mensaje =
    etapa === "3_dias_antes"
      ? textoRecordatorio3Dias("Escala", fechaTexto, { cantidad: 42, tipoLabel: "conversaciones de WhatsApp", costoPromedio: 12000 })
      : etapa === "hoy_vence"
      ? TEXTO_HOY_VENCE
      : etapa === "vencido"
      ? TEXTO_VENCIDO
      : textoRecienPagado(fechaTexto);

  return (
    <div style={{ marginTop: 14, background: "#fff", border: "1px dashed #ddd", borderRadius: 12, padding: "1rem 1.25rem" }}>
      <p style={{ fontSize: 12.5, color: "#999", margin: "0 0 10px" }}>Vista previa del recordatorio de renovación -- solo texto, no toca la base ni la pasarela.</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
        {ETAPAS.map((e) => (
          <button
            key={e}
            onClick={() => setEtapa(e)}
            style={{ padding: "6px 12px", borderRadius: 8, border: e === etapa ? "1.5px solid #534AB7" : "1px solid #ddd", background: e === etapa ? "#F3F2FE" : "#fff", color: e === etapa ? "#534AB7" : "#666", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            {e}
          </button>
        ))}
      </div>
      <p style={{ fontSize: 13.5, color: "#1a1a1a", fontWeight: 600, margin: 0, lineHeight: 1.5 }}>{mensaje}</p>
    </div>
  );
}

export default function PropuestasPruebaClient() {
  const [recargar, setRecargar] = useState(0);

  return (
    <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem 1rem" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>Herramientas de prueba</h1>
        <p style={{ fontSize: 13, color: "#666", margin: "0 0 20px" }}>Relocadas desde /decisiones -- solo admin.</p>
        <HerramientaPruebaPropuesta key={recargar} onCreada={() => setRecargar((v) => v + 1)} />
        <SimulacionRecordatorio />
      </div>
    </div>
  );
}

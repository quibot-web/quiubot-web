"use client";
import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Clock } from "lucide-react";
import CargandoQuiubot, { CargandoQuiubotInline } from "@/app/components/CargandoQuiubot";
import { ProveedorEsferas } from "@/app/components/esferas/ProveedorEsferas";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { EstadoEsfera } from "@/app/components/esferas/esferasShared";
import { comprimirSiHaceFalta, esArchivoDeImagen } from "@/app/lib/imagenes";
import type { Asistente, AccionPropuesta } from "@/app/lib/metas";
import type { PropuestaUnificada } from "@/app/lib/propuestas";
import {
  NOMBRE_ASISTENTE,
  ASISTENTE_POR_ACCION,
  asistenteDeMensaje,
  leadInPropuesta,
  cuerpoPropuesta,
  confirmacionExito,
  confirmacionFalla,
  TEXTO_RECHAZO,
  TEXTO_VENCIDA,
  narracionEtapaCreativos,
  narracionMetaCreada,
  TEXTO_AUTOPILOTO_PAUSADO,
  TEXTO_AUTOPILOTO_REANUDADO,
  narracionRevisionSinPropuestas,
  revisionNoPropusoNada,
  textoRecordatorio3Dias,
  TEXTO_HOY_VENCE,
  TEXTO_VENCIDO,
  textoRecienPagado,
} from "@/app/lib/directorChat";

type CreativoPropuesto = {
  titulo?: string;
  texto?: string;
  descripcion?: string;
  url_imagen?: string;
  cta?: string;
  concepto?: { angulo?: string; hook?: string };
};

const ASISTENTES_EQUIPO: Asistente[] = ["marca", "estratega", "creativo", "publicador", "analista", "optimizador"];

const CATALOGO_LABEL: Record<AccionPropuesta, string> = {
  generar_estrategia: "Generar estrategia",
  crear_creativos: "Crear creativos",
  publicar_campana: "Publicar campaña",
  pausar: "Pausar campaña",
  ajustar_presupuesto: "Ajustar presupuesto",
  agregar_anuncios: "Agregar anuncios",
};

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

// Lee la respuesta como texto primero -- si el proxy cortó la conexión
// a mitad de una llamada larga, lo que llega puede ser una página de
// error HTML (o nada), y res.json() directo tira un parse error críptico
// (en Safari: "The string did not match the expected pattern"). Esto
// siempre devuelve algo mostrable.
async function leerJsonSeguro(res: Response): Promise<any> {
  const texto = await res.text();
  try {
    return texto ? JSON.parse(texto) : {};
  } catch {
    return { error: `Error del servidor (código ${res.status})` };
  }
}

function campanaIdDe(p: { parametros: Record<string, unknown> | null }): string | null {
  const id = p.parametros?.campana_id;
  return typeof id === "string" ? id : null;
}

// Estado de cada esfera del equipo para la fila de /decisiones --
// "trabajando" si tiene un crear_creativos pendiente en etapa
// generando_conceptos/generando, "esperando" si tiene cualquier otra
// cosa pendiente. El Director mismo queda "esperando" si cualquiera
// del equipo lo está (algo que contarle al cliente). Ya no existe un
// "pausa" global acá: con varias metas activas a la vez (una por tipo)
// "el Autopiloto está pausado" dejó de ser una sola respuesta -- ese
// estado se ve ahora por meta en "Mis metas", no atenuando todo el
// equipo en esta pantalla.
function construirEstadoPorAsistente(propuestas: PropuestaUnificada[]): Record<Asistente, EstadoEsfera> {
  const estado = {
    director: "normal",
    marca: "normal",
    estratega: "normal",
    creativo: "normal",
    publicador: "normal",
    analista: "normal",
    optimizador: "normal",
  } as Record<Asistente, EstadoEsfera>;

  for (const p of propuestas) {
    const asistente = asistenteDeMensaje(p);
    const etapa = (p.resultado as any)?.etapa;
    if (p.accion === "crear_creativos" && (etapa === "generando_conceptos" || etapa === "generando")) {
      estado[asistente] = "trabajando";
    } else if (estado[asistente] !== "trabajando") {
      estado[asistente] = "esperando";
    }
  }
  if ((Object.keys(estado) as Asistente[]).some((a) => a !== "director" && estado[a] !== "normal")) {
    estado.director = "esperando";
  }
  return estado;
}

// useSearchParams() exige un límite de Suspense -- sin esto, Next
// falla el build entero de la página.
export default function DecisionesPage() {
  return (
    <Suspense fallback={<CargandoQuiubot mensaje="Cargando" />}>
      <DecisionesContenido />
    </Suspense>
  );
}

function DecisionesContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtro = searchParams.get("asistente") as Asistente | null;
  const simularRenovacion = searchParams.get("simular_renovacion") as
    | "3_dias_antes"
    | "hoy_vence"
    | "vencido"
    | "recien_pagado"
    | null;

  // esAdmin es el rol crudo -- solo para las herramientas de prueba y
  // la simulación, que siguen siendo exclusivas de admin. El acceso a
  // la conversación en sí (datos, gate de la página) usa
  // puedeUsarAutopiloto, que también deja pasar a quien tiene beta o
  // (con el interruptor encendido) un plan Autopiloto vigente -- ver
  // tieneAutopiloto en app/lib/planesConfig.ts.
  const [esAdmin, setEsAdmin] = useState<boolean | null>(null);
  const [puedeUsarAutopiloto, setPuedeUsarAutopiloto] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [propuestas, setPropuestas] = useState<PropuestaUnificada[]>([]);
  // Mapa meta_id -> cantidad_objetivo, de todas las metas activas del
  // usuario -- hace falta para narrar "revisión sin propuestas" (cada
  // evento de bitácora trae su propio meta_id) ahora que puede haber
  // varias metas, no "la" meta.
  const [cantidadObjetivoPorMeta, setCantidadObjetivoPorMeta] = useState<Record<string, number>>({});
  const [campanasPorId, setCampanasPorId] = useState<Record<string, string>>({});
  type Recordatorio = {
    etapa: "recien_pagado" | "3_dias_antes" | "hoy_vence" | "vencido";
    // plan/nombrePlan/ciclo salen de la última orden pagada, no de
    // usuarios.plan -- pueden venir null si no hay ninguna orden y el
    // usuario ya está en Arranque (activación manual, sin plan pago
    // que renovar). Ahí no hay botón "Renovar ahora", solo "Ver planes".
    plan: string | null;
    nombrePlan: string | null;
    fechaVencimiento: string;
    ciclo: string | null;
    resultados: { cantidad: number; tipoLabel: string; costoPromedio: number } | null;
  };
  const [recordatorio, setRecordatorio] = useState<Recordatorio | null>(null);
  const [renovando, setRenovando] = useState(false);
  const [mensajeRenovar, setMensajeRenovar] = useState<string | null>(null);

  // Vista previa para probar sin tener una cuenta real vencida --
  // ?simular_renovacion=<etapa> (solo admin) construye un recordatorio
  // de ejemplo EN MEMORIA, nunca toca /api/billing/recordatorio ni la
  // base. Tiene prioridad sobre el recordatorio real mientras el
  // parámetro esté en la URL.
  const esSimulacionRenovacion = !!(simularRenovacion && esAdmin);
  const recordatorioSimulado: Recordatorio | null = esSimulacionRenovacion
    ? (() => {
        const fecha = new Date();
        if (simularRenovacion === "3_dias_antes") fecha.setDate(fecha.getDate() + 2);
        else if (simularRenovacion === "vencido") fecha.setDate(fecha.getDate() - 5);
        else if (simularRenovacion === "recien_pagado") fecha.setDate(fecha.getDate() + 28);
        return {
          etapa: simularRenovacion!,
          plan: "escala",
          nombrePlan: "Escala",
          fechaVencimiento: fecha.toISOString(),
          ciclo: "mensual",
          resultados:
            simularRenovacion === "3_dias_antes"
              ? { cantidad: 42, tipoLabel: "conversaciones de WhatsApp", costoPromedio: 12000 }
              : null,
        };
      })()
    : null;
  const recordatorioMostrado = recordatorioSimulado ?? recordatorio;
  const [procesandoId, setProcesandoId] = useState<string | null>(null);
  const [ajustandoId, setAjustandoId] = useState<string | null>(null);
  const [porcentajeAjuste, setPorcentajeAjuste] = useState("20");
  const [error, setError] = useState<{ mensaje: string; motivo?: string; paso?: string } | null>(null);

  const [mostrarHerramientas, setMostrarHerramientas] = useState(false);
  const [historial, setHistorial] = useState<{ propuestas: any[]; bitacora: any[] } | null>(null);
  const [mostrarTodos, setMostrarTodos] = useState(false);
  const anclaPendientesRef = useRef<HTMLDivElement>(null);
  const anclaFinalRef = useRef<HTMLDivElement>(null);
  const yaBajoSolaRef = useRef(false);

  // Snapshot de la propuesta + la respuesta justo después de decidir,
  // para mostrar la burbuja de "tú" y la confirmación del Director de
  // inmediato -- sin esperar a que /api/propuestas/historial la recoja
  // en la próxima recarga (donde sí va a verse igual, con los mismos
  // datos ya guardados).
  type RespuestaReciente = { propuesta: PropuestaUnificada; etiqueta: string; confirmacion: { texto: string; avisoReconectarMeta?: boolean } };
  const [recienDecididas, setRecienDecididas] = useState<RespuestaReciente[]>([]);

  useEffect(() => {
    fetch("/api/usuario/rol")
      .then((r) => r.json())
      .then((data) => {
        setEsAdmin(data.rol === "admin");
        setPuedeUsarAutopiloto(!!data.tieneAutopiloto);
      })
      .catch(() => {
        setEsAdmin(false);
        setPuedeUsarAutopiloto(false);
      });
  }, []);

  const cargarPropuestas = () => {
    setCargando(true);
    fetch("/api/propuestas")
      .then((r) => r.json())
      .then((data) => setPropuestas(data.propuestas ?? []))
      .catch(() => setPropuestas([]))
      .finally(() => setCargando(false));
  };

  const cargarHistorial = () => {
    fetch("/api/propuestas/historial")
      .then((r) => r.json())
      .then((data) => setHistorial(data))
      .catch(() => setHistorial({ propuestas: [], bitacora: [] }));
  };

  useEffect(() => {
    if (!puedeUsarAutopiloto) return;
    cargarPropuestas();
    cargarHistorial();
    fetch("/api/metas")
      .then((r) => (r.ok ? r.json() : { metas: [] }))
      .then((data) => {
        const mapa: Record<string, number> = {};
        for (const item of data.metas ?? []) mapa[item.meta.id] = item.meta.cantidad_objetivo;
        setCantidadObjetivoPorMeta(mapa);
      })
      .catch(() => {});
    fetch("/api/campanas")
      .then((r) => (r.ok ? r.json() : { campanas: [] }))
      .then((data) => {
        const mapa: Record<string, string> = {};
        for (const c of data.campanas ?? []) mapa[c.id] = c.nombre;
        setCampanasPorId(mapa);
      })
      .catch(() => {});
    fetch("/api/billing/recordatorio")
      .then((r) => (r.ok ? r.json() : { etapa: null }))
      .then((data) => setRecordatorio(data.etapa ? data : null))
      .catch(() => setRecordatorio(null));
  }, [puedeUsarAutopiloto]);

  const renovarAhora = async () => {
    if (!recordatorioMostrado?.plan || !recordatorioMostrado.ciclo) return;
    // En simulación no se genera un link real ni se llama la pasarela --
    // solo se muestra el aviso, nada se escribe en la base.
    if (recordatorioSimulado) {
      setMensajeRenovar("(simulación) Aquí se abriría el link de pago de Bold.");
      return;
    }
    setRenovando(true);
    try {
      const res = await fetch("/api/billing/crear-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: recordatorioMostrado.plan, ciclo: recordatorioMostrado.ciclo }),
      });
      const data = await leerJsonSeguro(res);
      if (!res.ok || !data.url) {
        setError({ mensaje: data.error || "No se pudo generar el link de pago." });
        return;
      }
      window.open(data.url, "_blank");
    } catch {
      setError({ mensaje: "No se pudo conectar con la pasarela de pagos." });
    } finally {
      setRenovando(false);
    }
  };

  // Al abrir, la conversación baja sola al final -- como un chat --
  // una sola vez (no en cada recarga posterior de propuestas/historial,
  // para no saltar la pantalla mientras el cliente está respondiendo
  // algo arriba). anclaFinalRef vive después de los pendientes, así
  // que "el final" es justo donde están.
  useEffect(() => {
    if (cargando || yaBajoSolaRef.current) return;
    yaBajoSolaRef.current = true;
    requestAnimationFrame(() => {
      anclaFinalRef.current?.scrollIntoView({ behavior: "auto", block: "end" });
    });
  }, [cargando]);

  // "Revisar de nuevo" en el historial: para una crear_creativos que
  // quedó fallida por timeout pero sí tiene job_id -- si creativos_jobs
  // ya terminó bien mientras tanto, esto la recupera y crea la
  // propuesta de agregar_anuncios en vez de perder las imágenes.
  const recuperarCreativos = async (id: string) => {
    setProcesandoId(id);
    try {
      const res = await fetch(`/api/propuestas/${id}/recuperar-creativos`, { method: "POST" });
      const data = await leerJsonSeguro(res);
      if (!res.ok || data.ok === false) {
        setError({ mensaje: data.mensaje || data.error || "No se pudo revisar de nuevo." });
      } else {
        setError(null);
        cargarHistorial();
        cargarPropuestas();
      }
    } catch {
      setError({ mensaje: "No se pudo conectar con el servidor." });
    } finally {
      setProcesandoId(null);
    }
  };

  // "Reintentar" en el historial para un agregar_anuncios que quedó
  // "fallida" (timeout de 10 min, o un error real de n8n) -- es seguro
  // porque n8n ya es idempotente por propuesta_id (agregar_anuncios v2),
  // así que un reintento completo nunca duplica lo que ya se haya
  // creado en Meta.
  const reintentarAgregarAnuncios = async (id: string) => {
    setProcesandoId(id);
    try {
      const res = await fetch(`/api/propuestas/${id}/reintentar`, { method: "POST" });
      const data = await leerJsonSeguro(res);
      if (!res.ok || data.ok === false) {
        setError({ mensaje: data.error || "No se pudo reintentar." });
      } else {
        setError(null);
        cargarHistorial();
        cargarPropuestas();
      }
    } catch {
      setError({ mensaje: "No se pudo conectar con el servidor." });
    } finally {
      setProcesandoId(null);
    }
  };

  const nombreCampanaDe = (p: { parametros: Record<string, unknown> | null }): string | null => {
    const id = campanaIdDe(p);
    return id ? campanasPorId[id] ?? null : null;
  };

  const aprobar = async (p: PropuestaUnificada) => {
    setProcesandoId(p.id);
    setError(null);
    try {
      const url = p.origen === "notificacion" ? `/api/notificaciones/${idReal(p.id)}/aceptar` : `/api/propuestas/${p.id}/aprobar`;
      const res = await fetch(url, { method: "POST" });
      const data = await leerJsonSeguro(res);
      if (!res.ok) {
        const { texto, avisoReconectarMeta } = confirmacionFalla(asistenteDeMensaje(p), data.error || "No se pudo aprobar.", data.motivo);
        setRecienDecididas((prev) => [...prev, { propuesta: p, etiqueta: "Sí, adelante", confirmacion: { texto, avisoReconectarMeta } }]);
        setError({ mensaje: data.error || "No se pudo aprobar.", motivo: data.motivo, paso: data.paso });
        return;
      }
      // El Estratega todavía no publica nada solo -- aprobar esto solo
      // lleva al cliente a /estrategia con el objetivo ya precargado.
      // Si viene de "abrir otro frente" (ver app/api/cron/director/
      // route.ts), la propuesta trae también presupuesto sugerido y
      // ángulos a evitar en sus parámetros -- se mandan en la misma URL
      // para que /estrategia los precargue sin otro viaje al servidor.
      if (p.accion === "generar_estrategia" && p.metaId) {
        const params = (data.propuesta?.parametros as Record<string, unknown>) || {};
        const extra = new URLSearchParams();
        if (typeof params.presupuesto_diario_sugerido_cop === "number") {
          extra.set("presupuesto_sugerido_cop", String(params.presupuesto_diario_sugerido_cop));
        }
        if (Array.isArray(params.angulos_a_evitar) && params.angulos_a_evitar.length > 0) {
          extra.set("angulos_a_evitar", JSON.stringify(params.angulos_a_evitar));
        }
        const query = extra.toString();
        router.push(`/estrategia?meta_id=${p.metaId}${query ? `&${query}` : ""}`);
        return;
      }
      // crear_creativos no tiene una "confirmación" propia acá -- solo
      // pasa a etapa esperando_fotos, que ya se narra como mensaje aparte.
      if (p.accion !== "crear_creativos") {
        const texto = confirmacionExito(p.accion as AccionPropuesta, {
          campanaNombre: nombreCampanaDe(p),
          presupuestoAntes: data.resultado?.presupuesto_antes,
          presupuestoDespues: data.resultado?.presupuesto_despues,
          cantidadAnuncios: data.resultado?.anuncios_creados?.length,
        });
        setRecienDecididas((prev) => [...prev, { propuesta: p, etiqueta: "Sí, adelante", confirmacion: { texto } }]);
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
      const data = await leerJsonSeguro(res);
      if (!res.ok) {
        setError({ mensaje: data.error || "No se pudo rechazar." });
        return;
      }
      setRecienDecididas((prev) => [...prev, { propuesta: p, etiqueta: "No por ahora", confirmacion: { texto: TEXTO_RECHAZO } }]);
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
      const data = await leerJsonSeguro(res);
      if (!res.ok) {
        const { texto, avisoReconectarMeta } = confirmacionFalla(asistenteDeMensaje(p), data.error || "No se pudo ajustar.", data.motivo);
        setRecienDecididas((prev) => [...prev, { propuesta: p, etiqueta: "Sí, adelante", confirmacion: { texto, avisoReconectarMeta } }]);
        setError({ mensaje: data.error || "No se pudo ajustar.", motivo: data.motivo, paso: data.paso });
        return;
      }
      const texto = confirmacionExito(p.accion as AccionPropuesta, {
        campanaNombre: nombreCampanaDe(p),
        presupuestoAntes: data.resultado?.presupuesto_antes,
        presupuestoDespues: data.resultado?.presupuesto_despues,
        cantidadAnuncios: data.resultado?.anuncios_creados?.length,
      });
      setRecienDecididas((prev) => [...prev, { propuesta: p, etiqueta: "Sí, adelante", confirmacion: { texto } }]);
      setAjustandoId(null);
      cargarPropuestas();
    } finally {
      setProcesandoId(null);
    }
  };

  if (puedeUsarAutopiloto === null) return <CargandoQuiubot mensaje="Verificando tu acceso" />;

  if (puedeUsarAutopiloto === false) {
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

  const estadoPorAsistente = construirEstadoPorAsistente(propuestas);

  // Las campañas con problema no van en la línea de tiempo (no tienen
  // una fecha real de cuándo empezó el problema, y no son "una
  // conversación" -- son un estado actual) -- se muestran fijas arriba,
  // aparte.
  const sinFiltroOAsistente = (p: PropuestaUnificada) => !filtro || asistenteDeMensaje(p) === filtro;
  const problemasCampana = propuestas.filter((p) => p.origen === "problema_campana").filter(sinFiltroOAsistente);
  const propuestasFiltradas = propuestas.filter((p) => p.origen !== "problema_campana").filter(sinFiltroOAsistente);

  const idsPendientes = new Set(propuestas.map((p) => p.id));
  const historialFiltrado = (historial?.propuestas ?? [])
    .filter((p) => !idsPendientes.has(p.id))
    .filter((p) => !filtro || asistenteDeMensaje(p) === filtro);

  const eventosBitacora = historial?.bitacora ?? [];
  const eventosMeta = !filtro || filtro === "director" ? eventosBitacora.filter((e) => e.tipo_evento === "meta_creada") : [];
  const eventosAutopiloto =
    !filtro || filtro === "director"
      ? eventosBitacora.filter((e) => e.tipo_evento === "autopiloto_pausado" || e.tipo_evento === "autopiloto_reanudado")
      : [];
  const revisionMasReciente =
    !filtro || filtro === "director"
      ? eventosBitacora.find((e) => e.tipo_evento === "director_revision" && revisionNoPropusoNada(e.detalle))
      : undefined;

  // Dos secciones, no una sola línea cronológica: el historial se
  // puede recortar a las últimas 6 ("Ver anteriores" trae el resto),
  // pero los PENDIENTES nunca se recortan ni se mezclan con el
  // historial por fecha -- si uno lleva días sin responder, su
  // creadoEn viejo lo habría enterrado bajo "Ver anteriores" aunque
  // siga necesitando una respuesta. Van siempre al final, todos.
  type Item = { orden: string; key: string; render: () => React.ReactNode };
  const itemsHistorial: Item[] = [
    ...historialFiltrado.map((p) => ({ orden: p.decidido_en || p.creado_en, key: `hist-${p.id}`, render: () => renderDecidida(p) })),
    ...eventosMeta.map((e) => ({ orden: e.creado_en, key: `meta-${e.id}`, render: () => renderDirectorSolo(narracionMetaCreada(e.detalle)) })),
    ...eventosAutopiloto.map((e) => ({
      orden: e.creado_en,
      key: `auto-${e.id}`,
      render: () => renderDirectorSolo(e.tipo_evento === "autopiloto_pausado" ? TEXTO_AUTOPILOTO_PAUSADO : TEXTO_AUTOPILOTO_REANUDADO),
    })),
    ...(revisionMasReciente
      ? [
          {
            orden: revisionMasReciente.creado_en,
            key: `revision-${revisionMasReciente.id}`,
            render: () => renderDirectorSolo(narracionRevisionSinPropuestas(revisionMasReciente.detalle?.avance_resumen ?? null, cantidadObjetivoPorMeta[revisionMasReciente.meta_id] ?? null)),
          },
        ]
      : []),
  ].sort((a, b) => (a.orden < b.orden ? -1 : 1));

  const VISIBLES_POR_DEFECTO = 6;
  const itemsHistorialVisibles = mostrarTodos ? itemsHistorial : itemsHistorial.slice(-VISIBLES_POR_DEFECTO);
  const hayMasAnteriores = !mostrarTodos && itemsHistorial.length > itemsHistorialVisibles.length;

  const itemsPendientes: Item[] = [...propuestasFiltradas]
    .sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : 1))
    .map((p) => ({ orden: p.creadoEn, key: `pend-${p.id}`, render: () => renderPendiente(p) }));

  const recienDecididasFiltradas = recienDecididas.filter((r) => !filtro || asistenteDeMensaje(r.propuesta) === filtro);

  const sinPendientes = propuestas.length === 0;
  const ultimaDecidida = (historial?.propuestas ?? [])[0];

  function renderDirectorSolo(texto: string) {
    return (
      <div style={{ display: "flex", gap: 10 }}>
        <EsferaAsistente asistente="director" estado="normal" tamano={40} />
        <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "calc(100% - 50px)" }}>
          <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{texto}</p>
        </div>
      </div>
    );
  }

  function renderUsuario(texto: string) {
    return (
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <div style={{ background: "#534AB7", color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "8px 14px", fontSize: 13, fontWeight: 600, maxWidth: "80%" }}>
          {texto}
        </div>
      </div>
    );
  }

  function renderPendiente(p: PropuestaUnificada) {
    const procesando = procesandoId === p.id;
    const campanaNombre = nombreCampanaDe(p);
    const campanaId = campanaIdDe(p);

    // Informativa: notificación sin accion_sugerida -- un mensaje del
    // Director, sin botones. (Las campañas con problema, origen
    // "problema_campana", ya no llegan hasta acá -- se muestran en el
    // bloque fijo de arriba, ver problemasCampana.)
    if (p.origen === "notificacion_informativa") {
      return (
        <div style={{ display: "flex", gap: 10 }}>
          <EsferaAsistente asistente="director" estado="normal" tamano={40} />
          <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "calc(100% - 50px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <EsferaAsistente asistente={asistenteDeMensaje(p)} estado="normal" tamano={22} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#534AB7", textTransform: "uppercase", letterSpacing: "0.02em" }}>{NOMBRE_ASISTENTE[asistenteDeMensaje(p)]}</span>
            </div>
            <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{p.justificacion}</p>
            {campanaId && (
              <a href={`/campanas?highlight=${campanaId}`} style={{ display: "inline-block", marginTop: 6, fontSize: 12.5, color: "#534AB7", fontWeight: 600, textDecoration: "underline" }}>
                Ver campaña
              </a>
            )}
          </div>
        </div>
      );
    }

    const puedeAjustar = p.origen === "propuesta" && (p.accion === "ajustar_presupuesto" || p.accion === "agregar_anuncios");
    const restante = tiempoRestante(p.venceEn);
    const creativos = p.accion === "agregar_anuncios" ? ((p.parametros?.creativos as CreativoPropuesto[]) ?? []) : [];
    const etapa = (p.resultado as any)?.etapa as string | undefined;

    const estadoMiniEsfera: EstadoEsfera =
      p.accion === "crear_creativos" && (etapa === "generando_conceptos" || etapa === "generando") ? "trabajando" : "normal";

    return (
      <div style={{ display: "flex", gap: 10 }}>
        <EsferaAsistente asistente="director" estado="normal" tamano={40} />
        <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "12px 16px", maxWidth: "calc(100% - 50px)", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
            <EsferaAsistente asistente={asistenteDeMensaje(p)} estado={estadoMiniEsfera} tamano={22} />
            <span style={{ fontSize: 13, color: "#1a1a1a" }}>{leadInPropuesta(p.accion as AccionPropuesta, campanaNombre, creativos.length)}</span>
          </div>

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

          {p.accion === "crear_creativos" && etapa === "esperando_fotos" ? (
            <>
              <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: "0 0 2px", lineHeight: 1.5 }}>{narracionEtapaCreativos("esperando_fotos")}</p>
              <PasoSubirFotos propuestaId={p.id} campanaId={(p.parametros as any)?.campana_id ?? null} onListo={cargarPropuestas} />
            </>
          ) : p.accion === "crear_creativos" && etapa === "generando_conceptos" ? (
            <>
              <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{narracionEtapaCreativos("generando_conceptos")}</p>
              <EstadoGenerandoConceptos onListo={cargarPropuestas} />
            </>
          ) : p.accion === "crear_creativos" && etapa === "generando" ? (
            <>
              <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{narracionEtapaCreativos("generando")}</p>
              <EstadoGenerandoCreativos propuestaId={p.id} onListo={cargarPropuestas} />
            </>
          ) : p.accion === "agregar_anuncios" && etapa === "procesando" ? (
            <>
              <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>Agregando tus anuncios a la campaña...</p>
              <EstadoAgregandoAnuncios onListo={cargarPropuestas} />
            </>
          ) : (
            <>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#1a1a1a", margin: "0 0 4px" }}>{p.titulo}</p>
              <p style={{ fontSize: 13, color: "#444", margin: "0 0 4px", lineHeight: 1.5 }}>{p.justificacion}</p>
              {p.impactoEsperado && <p style={{ fontSize: 13, color: "#444", margin: "0 0 4px", lineHeight: 1.5 }}>{cuerpoPropuesta(p).impacto}</p>}
              <p style={{ fontSize: 13, color: "#1a1a1a", fontWeight: 600, margin: "4px 0 10px" }}>{cuerpoPropuesta(p).pregunta}</p>

              {ajustandoId === p.id && p.accion === "agregar_anuncios" ? (
                <AjusteCreativos
                  creativos={creativos}
                  procesando={procesando}
                  onConfirmar={(editados) => confirmarAjuste(p, { creativos: editados })}
                  onCancelar={() => setAjustandoId(null)}
                />
              ) : ajustandoId === p.id ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
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
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                  <button
                    onClick={() => aprobar(p)}
                    disabled={procesando}
                    style={{ padding: "8px 16px", borderRadius: 8, background: "#534AB7", color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: procesando ? "not-allowed" : "pointer" }}
                  >
                    {procesando ? "..." : "Sí, adelante"}
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
                    No por ahora
                  </button>
                  {restante && <span style={{ fontSize: 11.5, color: restante === "vencida" ? "#B3261E" : "#999" }}>{restante}</span>}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );
  }

  function renderDecidida(p: any) {
    const campanaNombre = nombreCampanaDe(p);
    let etiquetaUsuario: string | null = null;
    let confirmacion: { texto: string; avisoReconectarMeta?: boolean } | null = null;

    if (p.estado === "rechazada") {
      etiquetaUsuario = "No por ahora";
      confirmacion = { texto: TEXTO_RECHAZO };
    } else if (p.estado === "vencida") {
      confirmacion = { texto: TEXTO_VENCIDA };
    } else if (p.estado === "ejecutada") {
      etiquetaUsuario = "Sí, adelante";
      confirmacion = {
        texto: confirmacionExito(p.accion, {
          campanaNombre,
          presupuestoAntes: p.resultado?.presupuesto_antes,
          presupuestoDespues: p.resultado?.presupuesto_despues,
          cantidadAnuncios: p.resultado?.anuncios_creados?.length,
        }),
      };
    } else if (p.estado === "fallida") {
      etiquetaUsuario = "Sí, adelante";
      confirmacion = confirmacionFalla(asistenteDeMensaje(p), p.resultado?.error || "No se pudo completar.", p.resultado?.motivo);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <EsferaAsistente asistente="director" estado="normal" tamano={40} />
          <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "calc(100% - 50px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <EsferaAsistente asistente={asistenteDeMensaje(p)} estado="normal" tamano={22} />
              <span style={{ fontSize: 13, color: "#1a1a1a" }}>{p.accion ? leadInPropuesta(p.accion, campanaNombre) : p.titulo}</span>
            </div>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: "#1a1a1a", margin: "0 0 2px" }}>{p.titulo}</p>
            <p style={{ fontSize: 13, color: "#555", margin: 0, lineHeight: 1.5 }}>{p.justificacion}</p>
          </div>
        </div>
        {etiquetaUsuario && renderUsuario(etiquetaUsuario)}
        {confirmacion && (
          <div style={{ display: "flex", gap: 10 }}>
            <EsferaAsistente asistente="director" estado="normal" tamano={40} />
            <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "calc(100% - 50px)" }}>
              <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{confirmacion.texto}</p>
              {confirmacion.avisoReconectarMeta && (
                <>
                  <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: "4px 0 0", lineHeight: 1.5 }}>Necesito que reconectes tu cuenta de Meta para seguir trabajando.</p>
                  <a href="/?tab=integraciones" style={{ display: "inline-block", marginTop: 4, color: "#534AB7", fontWeight: 600, fontSize: 12.5, textDecoration: "underline" }}>
                    Reconectar mi cuenta de Meta
                  </a>
                </>
              )}
              {/* Reintentar solo para agregar_anuncios: n8n ya es idempotente
                  por propuesta_id (agregar_anuncios v2), así que un reintento
                  completo nunca duplica anuncios que ya se hayan creado. */}
              {p.estado === "fallida" && p.accion === "agregar_anuncios" && (
                <button
                  onClick={() => reintentarAgregarAnuncios(p.id)}
                  disabled={procesandoId === p.id}
                  style={{ marginTop: 8, background: "none", border: "1px solid #534AB7", color: "#534AB7", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: procesandoId === p.id ? "not-allowed" : "pointer" }}
                >
                  {procesandoId === p.id ? "Reintentando..." : "Reintentar"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <ProveedorEsferas>
      <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", padding: "2rem 1rem" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#7F77DD", fontSize: 14, cursor: "pointer", marginBottom: 20, padding: 0 }}>
            ← Volver al panel principal
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <EsferaAsistente asistente="director" estado={estadoPorAsistente.director} tamano={64} />
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Director</h1>
              <p style={{ fontSize: 13, color: "#666", margin: "2px 0 0" }}>Coordina a tu equipo y cuida tu meta</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 20 }}>
            <button
              onClick={() => router.push("/decisiones")}
              style={{
                flexShrink: 0,
                padding: "6px 14px",
                borderRadius: 20,
                border: filtro ? "1px solid #ddd" : "1px solid #534AB7",
                background: filtro ? "#fff" : "#534AB7",
                color: filtro ? "#666" : "#fff",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Todos
            </button>
            {ASISTENTES_EQUIPO.map((a) => (
              <button
                key={a}
                onClick={() => router.push(`/decisiones?asistente=${a}`)}
                style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", width: 64, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                aria-label={`Filtrar por ${NOMBRE_ASISTENTE[a]}: ${estadoPorAsistente[a] === "pausa" ? "en pausa" : estadoPorAsistente[a] === "esperando" ? "te necesita" : estadoPorAsistente[a] === "trabajando" ? "trabajando" : "activo"}`}
              >
                <EsferaAsistente asistente={a} estado={estadoPorAsistente[a]} tamano={44} />
                <span style={{ fontSize: 10.5, color: filtro === a ? "#534AB7" : "#888", fontWeight: filtro === a ? 700 : 500, marginTop: 2 }}>{NOMBRE_ASISTENTE[a]}</span>
              </button>
            ))}
          </div>

          {recordatorioMostrado && (!filtro || filtro === "director") && (() => {
            const colores =
              recordatorioMostrado.etapa === "vencido"
                ? { fondo: "#FEF2F2", borde: "#FCDADA", texto: "#B3261E" }
                : recordatorioMostrado.etapa === "recien_pagado"
                ? { fondo: "#F0FDF4", borde: "#BBF7D0", texto: "#15803D" }
                : { fondo: "#FFF8E1", borde: "#FCE8A8", texto: "#92600A" };
            const fecha = new Date(recordatorioMostrado.fechaVencimiento).toLocaleDateString("es-CO");
            const mensaje =
              recordatorioMostrado.etapa === "3_dias_antes"
                ? textoRecordatorio3Dias(recordatorioMostrado.nombrePlan, fecha, recordatorioMostrado.resultados)
                : recordatorioMostrado.etapa === "hoy_vence"
                ? TEXTO_HOY_VENCE
                : recordatorioMostrado.etapa === "vencido"
                ? TEXTO_VENCIDO
                : textoRecienPagado(fecha);
            const necesitaBotones = recordatorioMostrado.etapa !== "recien_pagado";
            // Sin plan/ciclo (sin orden pagada y usuarios.plan ya en
            // Arranque) no hay nada que renovar directamente -- solo
            // queda "Ver planes".
            const puedeRenovarDirecto = !!recordatorioMostrado.plan && !!recordatorioMostrado.ciclo;
            return (
              <div style={{ background: colores.fondo, border: `1px solid ${colores.borde}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
                {recordatorioSimulado && (
                  <p style={{ fontSize: 11, color: colores.texto, margin: "0 0 6px", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3 }}>
                    Vista previa (simulación, no escribe en la base)
                  </p>
                )}
                <p style={{ fontSize: 13, color: colores.texto, margin: necesitaBotones ? "0 0 10px" : 0, lineHeight: 1.5, fontWeight: 600 }}>{mensaje}</p>
                {necesitaBotones && (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    {puedeRenovarDirecto && (
                      <button
                        onClick={renovarAhora}
                        disabled={renovando}
                        style={{ padding: "7px 14px", borderRadius: 8, background: colores.texto, color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: renovando ? "not-allowed" : "pointer" }}
                      >
                        {renovando ? "..." : "Renovar ahora"}
                      </button>
                    )}
                    <button
                      onClick={() => router.push("/billing")}
                      style={{ padding: "7px 14px", borderRadius: 8, background: "#fff", color: colores.texto, border: `1px solid ${colores.texto}`, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
                    >
                      Ver planes
                    </button>
                    {recordatorioSimulado && mensajeRenovar && (
                      <span style={{ fontSize: 12, color: colores.texto, fontWeight: 600 }}>{mensajeRenovar}</span>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {itemsPendientes.length > 0 && (
            <button
              onClick={() => anclaPendientesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}
              style={{
                display: "block",
                width: "100%",
                textAlign: "center",
                background: "#F3F2FE",
                border: "none",
                borderRadius: 10,
                padding: "8px 12px",
                color: "#534AB7",
                fontSize: 12.5,
                fontWeight: 700,
                cursor: "pointer",
                marginBottom: 16,
              }}
            >
              Tienes {itemsPendientes.length} pendiente{itemsPendientes.length === 1 ? "" : "s"} ↓
            </button>
          )}

          {problemasCampana.length > 0 && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FCDADA", borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: "#B3261E", margin: "0 0 8px" }}>Esto sigue pendiente en tus campañas:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {problemasCampana.map((p) => {
                  const campanaId = campanaIdDe(p);
                  return (
                    <div key={p.id} style={{ fontSize: 13, color: "#1a1a1a", lineHeight: 1.5 }}>
                      {p.justificacion}
                      {campanaId && (
                        <a href={`/campanas?highlight=${campanaId}`} style={{ marginLeft: 6, color: "#B3261E", fontWeight: 600, textDecoration: "underline" }}>
                          Ver campaña
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div style={{ background: "#FEF0EF", color: "#B3261E", padding: "10px 14px", borderRadius: 10, fontSize: 13.5, marginBottom: 16 }}>
              {error.mensaje}
              {error.paso && <span style={{ display: "block", fontSize: 12, opacity: 0.8, marginTop: 2 }}>Paso: {error.paso}</span>}
            </div>
          )}

          {sinPendientes && !filtro && (
            <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1.25rem 1.5rem", marginBottom: 16 }}>
              <p style={{ fontSize: 14, color: "#1a1a1a", margin: 0, fontWeight: 600 }}>Todo en orden por ahora 👌</p>
              {ultimaDecidida && (
                <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>
                  Lo último que hizo el equipo: {ultimaDecidida.titulo}
                </p>
              )}
            </div>
          )}

          {cargando && <CargandoQuiubotInline mensaje="Cargando la conversación" />}

          {!cargando && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {hayMasAnteriores && (
                <button
                  onClick={() => setMostrarTodos(true)}
                  style={{ alignSelf: "center", background: "none", border: "none", color: "#534AB7", fontSize: 12.5, fontWeight: 600, cursor: "pointer", padding: "6px 0" }}
                >
                  Ver anteriores
                </button>
              )}
              {itemsHistorialVisibles.map((it) => <div key={it.key}>{it.render()}</div>)}

              {/* Los pendientes nunca se recortan -- siempre van todos
                  acá, al final del historial, sin importar su fecha. */}
              <div ref={anclaPendientesRef} />
              {itemsPendientes.map((it) => <div key={it.key}>{it.render()}</div>)}
              {recienDecididasFiltradas.map((r, i) => (
                <div key={`reciente-${i}`} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {renderUsuario(r.etiqueta)}
                  <div style={{ display: "flex", gap: 10 }}>
                    <EsferaAsistente asistente="director" estado="normal" tamano={40} />
                    <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "calc(100% - 50px)" }}>
                      <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{r.confirmacion.texto}</p>
                      {r.confirmacion.avisoReconectarMeta && (
                        <>
                          <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: "4px 0 0", lineHeight: 1.5 }}>Necesito que reconectes tu cuenta de Meta para seguir trabajando.</p>
                          <a href="/?tab=integraciones" style={{ display: "inline-block", marginTop: 4, color: "#534AB7", fontWeight: 600, fontSize: 12.5, textDecoration: "underline" }}>
                            Reconectar mi cuenta de Meta
                          </a>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
              <div ref={anclaFinalRef} />
            </div>
          )}

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
function PasoSubirFotos({ propuestaId, campanaId, onListo }: { propuestaId: string; campanaId: string | null; onListo: () => void }) {
  const [album, setAlbum] = useState<{ id: string; url_imagen: string }[]>([]);
  const [elegidas, setElegidas] = useState<FotoElegida[]>([]);
  const [subiendo, setSubiendo] = useState(false);
  const [errorLocal, setErrorLocal] = useState<{ mensaje: string; paso?: string } | null>(null);

  // tipo_contenido real de la campaña (nunca del formulario) -- "producto"
  // por default si la campaña es vieja y no lo tiene guardado (mismo
  // comportamiento que hoy). Prellena con lo que ya se guardó al
  // publicar; el cliente puede editarlo para este refresco puntual.
  const [tipoContenidoCampana, setTipoContenidoCampana] = useState<"producto" | "servicio">("producto");
  const [textoContexto, setTextoContexto] = useState("");

  useEffect(() => {
    fetch("/api/album")
      .then((r) => r.json())
      .then((d) => setAlbum((d.imagenes ?? d ?? []).slice(0, 8)))
      .catch(() => setAlbum([]));
  }, []);

  useEffect(() => {
    if (!campanaId) return;
    fetch("/api/campanas")
      .then((r) => (r.ok ? r.json() : { campanas: [] }))
      .then((d) => {
        const campana = (d.campanas ?? []).find((c: any) => c.id === campanaId);
        if (!campana) return;
        const tipo = campana.tipo_contenido === "servicio" ? "servicio" : "producto";
        setTipoContenidoCampana(tipo);
        setTextoContexto((tipo === "servicio" ? campana.descripcion_servicio : campana.datos_producto) || "");
      })
      .catch(() => {});
  }, [campanaId]);

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
        setErrorLocal({ mensaje: "No se pudo leer una de las fotos." });
      }
    }
  };

  const quitar = (preview: string) => setElegidas((prev) => prev.filter((f) => f.preview !== preview));

  const generar = async () => {
    if (elegidas.length === 0) {
      setErrorLocal({ mensaje: "Elige al menos 1 foto." });
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
          texto_contexto: textoContexto,
        }),
      });
      const data = await leerJsonSeguro(res);
      if (!res.ok) {
        setErrorLocal({ mensaje: data.error || "No se pudo iniciar la generación.", paso: data.paso });
        return;
      }
      onListo();
    } catch (err: any) {
      setErrorLocal({ mensaje: err.message || "Algo salió mal." });
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

      <label style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", display: "block", marginBottom: 4 }}>
        {tipoContenidoCampana === "servicio" ? "¿Quieres darnos más contexto?" : "¿Qué quieres destacar de este producto?"}{" "}
        <span style={{ fontWeight: 400, color: "#999" }}>(opcional)</span>
      </label>
      <textarea
        value={textoContexto}
        onChange={(e) => setTextoContexto(e.target.value.slice(0, 500))}
        placeholder={
          tipoContenidoCampana === "servicio"
            ? 'Ej: "Paquete todo incluido a Cartagena, 4 noches, incluye vuelos"'
            : "Ej.: precio $1.200.000, combo con 3 herramientas, 10% de descuento esta semana"
        }
        maxLength={500}
        rows={2}
        style={{ width: "100%", padding: 10, borderRadius: 8, border: "1.5px solid #e0e0e0", background: "#fff", fontSize: 12.5, color: "#1a1a1a", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box", outline: "none", marginBottom: 4 }}
      />
      <p style={{ fontSize: 11, color: "#999", margin: "0 0 10px" }}>
        La IA usa esto para escribir tus anuncios. Mientras más concreto, mejor venden.
      </p>

      {errorLocal && (
        <p style={{ fontSize: 12, color: "#B3261E", margin: "0 0 8px" }}>
          {errorLocal.mensaje}
          {errorLocal.paso && <span style={{ display: "block", opacity: 0.8 }}>Paso: {errorLocal.paso}</span>}
        </p>
      )}

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

// Mientras está "generando_conceptos", el trabajo real (generar_estrategia
// + crear_creativos) ya corre solo en el servidor, disparado con after()
// desde /subir-fotos -- este componente no dispara nada, solo refresca
// la lista cada pocos segundos para notar apenas cambie de etapa.
function EstadoGenerandoConceptos({ onListo }: { onListo: () => void }) {
  useEffect(() => {
    const intervalo = setInterval(onListo, 5000);
    return () => clearInterval(intervalo);
  }, [onListo]);

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <CargandoQuiubotInline mensaje="Pensando conceptos nuevos" />
    </div>
  );
}

// Mismo patrón que EstadoGenerandoConceptos -- dispararAgregarAnunciosEnSegundoPlano
// ya dejó el trabajo corriendo solo en el servidor (trabajos_ia, after()),
// esto no dispara nada, solo refresca la lista cada pocos segundos para
// notar apenas termine (ejecutada) o falle (fallida).
function EstadoAgregandoAnuncios({ onListo }: { onListo: () => void }) {
  useEffect(() => {
    const intervalo = setInterval(onListo, 5000);
    return () => clearInterval(intervalo);
  }, [onListo]);

  return (
    <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8 }}>
      <CargandoQuiubotInline mensaje="Agregando anuncios a tu campaña" />
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
        const data = await leerJsonSeguro(res);
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

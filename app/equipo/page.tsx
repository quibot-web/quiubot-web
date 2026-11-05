"use client";
// Fase 2, Commit 4 -- el grupo "Equipo" REEMPLAZA a /decisiones (no la
// complementa, decisión explícita). Mismo contenido que tenía esa
// página (propuestas pendientes con vencimiento, aprobar/ajustar/
// rechazar, historial narrado, "Ver campaña", recordatorio de
// renovación, zero state) portado tal cual, más: eventos reales
// (reporte diario, creativos listos) y conversación libre con
// @mención, ambos de mensajes_equipo. Las herramientas de admin
// (propuesta de prueba, simulación de recordatorio) NO viven acá --
// se movieron a /admin (decisión de la Fase 2), commit aparte.
import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import CargandoQuiubot from "@/app/components/CargandoQuiubot";
import { ProveedorEsferas } from "@/app/components/esferas/ProveedorEsferas";
import EsferaAsistente from "@/app/components/esferas/EsferaAsistente";
import type { AsistenteId, EstadoEsfera } from "@/app/components/esferas/esferasShared";
import ChatShell, { type ItemChat } from "@/app/components/chat/ChatShell";
import IndicadorEscribiendo from "@/app/components/chat/IndicadorEscribiendo";
import type { Asistente, AccionPropuesta } from "@/app/lib/metas";
import type { PropuestaUnificada } from "@/app/lib/propuestas";
import {
  NOMBRE_ASISTENTE,
  asistenteDeMensaje,
  leadInPropuesta,
  confirmacionExito,
  confirmacionFalla,
  TEXTO_RECHAZO,
  TEXTO_VENCIDA,
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
import { usePropuestaAcciones, campanaIdDe } from "@/app/components/burbuja/usePropuestaAcciones";
import TarjetaPropuesta, { TarjetaGrupoPropuestas, agruparPropuestasPorTipo } from "@/app/components/burbuja/TarjetaPropuesta";
import { NOMBRE_CHAT, ASISTENTES_CON_CHAT_PROPIO } from "@/app/lib/director/chatsEquipo";
import type { MensajeEquipo, AsistenteEventoEquipo } from "@/app/lib/director/mensajeEquipo.schema";

const ASISTENTES_EQUIPO: Asistente[] = ["marca", "estratega", "creativo", "publicador", "analista", "optimizador"];

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
    const etapa = (p.resultado as { etapa?: string } | null)?.etapa;
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

// Detecta un "@Nombre " al inicio del mensaje -- quien SIEMPRE responde
// es el Director (ver promptDirectorGeneral.ts); si coincide con uno
// de los 6 asistentes con chat propio, el Director lo cita en su
// respuesta. El parseo vive en el cliente, el servidor solo recibe el
// id ya resuelto (o nada, si no hay mención).
function detectarMencion(texto: string): { asistenteCitado: AsistenteEventoEquipo | undefined; resto: string } {
  const match = texto.match(/^@(\S+)\s+([\s\S]*)$/);
  if (!match) return { asistenteCitado: undefined, resto: texto };
  const nombre = match[1].toLowerCase();
  const encontrado = ASISTENTES_CON_CHAT_PROPIO.find((id) => NOMBRE_CHAT[id].toLowerCase() === nombre);
  return encontrado ? { asistenteCitado: encontrado, resto: match[2] } : { asistenteCitado: undefined, resto: texto };
}

export default function EquipoPage() {
  return (
    <Suspense fallback={<CargandoQuiubot mensaje="Cargando" />}>
      <EquipoContenido />
    </Suspense>
  );
}

function EquipoContenido() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filtro = searchParams.get("asistente") as Asistente | null;

  const [puedeUsarAutopiloto, setPuedeUsarAutopiloto] = useState<boolean | null>(null);
  const [cargando, setCargando] = useState(true);
  const [propuestas, setPropuestas] = useState<PropuestaUnificada[]>([]);
  const [cantidadObjetivoPorMeta, setCantidadObjetivoPorMeta] = useState<Record<string, number>>({});
  const [campanasPorId, setCampanasPorId] = useState<Record<string, string>>({});
  const [mensajesEquipo, setMensajesEquipo] = useState<MensajeEquipo[]>([]);
  const [requiereApiKey, setRequiereApiKey] = useState(false);

  type Recordatorio = {
    etapa: "recien_pagado" | "3_dias_antes" | "hoy_vence" | "vencido";
    plan: string | null;
    nombrePlan: string | null;
    fechaVencimiento: string;
    ciclo: string | null;
    resultados: { cantidad: number; tipoLabel: string; costoPromedio: number } | null;
  };
  const [recordatorio, setRecordatorio] = useState<Recordatorio | null>(null);
  const [renovando, setRenovando] = useState(false);

  const [historial, setHistorial] = useState<{ propuestas: PropuestaConDecision[]; bitacora: EventoBitacora[] }>({ propuestas: [], bitacora: [] });
  const [mostrarGrupo, setMostrarGrupo] = useState<AccionPropuesta | null>(null);
  const [procesandoLote, setProcesandoLote] = useState(false);
  const [soloPendientes, setSoloPendientes] = useState(false);
  const [senalIrAlFondo, setSenalIrAlFondo] = useState(0);

  const [texto, setTexto] = useState("");
  const [enviandoMensaje, setEnviandoMensaje] = useState(false);

  type PropuestaConDecision = PropuestaUnificada & { estado: string; decidido_en: string | null; resultado: Record<string, unknown> | null };
  type EventoBitacora = { id: string; tipo_evento: string; detalle: Record<string, unknown>; meta_id: string | null; creado_en: string };

  // mostrarCargando solo en la primera carga real -- después de
  // aprobar/rechazar, o cuando un PasoSubirFotos/EstadoGenerandoX
  // termina, se actualiza en segundo plano: la tarjeta cambia y el
  // contador baja solos, sin el parpadeo de "Cargando la conversación".
  const cargarTodo = (mostrarCargando = false) => {
    if (mostrarCargando) setCargando(true);
    fetch("/api/equipo/mensajes")
      .then((r) => r.json())
      .then((data) => {
        setPropuestas(data.pendientes ?? []);
        setHistorial({ propuestas: data.historialPropuestas ?? [], bitacora: data.bitacora ?? [] });
        setMensajesEquipo(data.mensajesEquipo ?? []);
        setRequiereApiKey(!!data.requiereApiKey);
      })
      .catch(() => {})
      .finally(() => {
        if (mostrarCargando) setCargando(false);
      });
  };

  const { procesandoId, ajustandoId, setAjustandoId, porcentajeAjuste, setPorcentajeAjuste, error, setError, recienDecididas, aprobar, rechazar, confirmarAjuste, reintentarAgregarAnuncios, aprobarEnLote, nombreCampanaDe } = usePropuestaAcciones(
    campanasPorId,
    () => cargarTodo(false)
  );

  useEffect(() => {
    fetch("/api/usuario/rol")
      .then((r) => r.json())
      .then((data) => setPuedeUsarAutopiloto(!!data.tieneAutopiloto))
      .catch(() => setPuedeUsarAutopiloto(false));
    // Entrar acá cuenta como leer el chat "Equipo" de la lista de la burbuja.
    fetch("/api/equipo/chats", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ chat: "equipo" }) }).catch(() => {});
  }, []);

  useEffect(() => {
    if (!puedeUsarAutopiloto) return;
    // setTimeout(0): cargarTodo() llama setCargando() de entrada, y
    // react-hooks/set-state-in-effect exige que quede en un callback,
    // no directo en el cuerpo síncrono del efecto.
    const id = setTimeout(() => cargarTodo(true), 0);
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
    return () => clearTimeout(id);
  }, [puedeUsarAutopiloto]);

  const renovarAhora = async () => {
    if (!recordatorio?.plan || !recordatorio.ciclo) return;
    setRenovando(true);
    try {
      const res = await fetch("/api/billing/crear-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: recordatorio.plan, ciclo: recordatorio.ciclo }),
      });
      const data = await res.json();
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

  const enviarMensaje = async () => {
    const contenido = texto.trim();
    if (!contenido || enviandoMensaje) return;
    const { asistenteCitado, resto } = detectarMencion(contenido);

    setEnviandoMensaje(true);
    setTexto("");
    // Optimista: la fila real (con id/creado_en reales) llega en la
    // respuesta y reemplaza esto al recargar -- mientras tanto, el
    // propio mensaje del usuario ya se ve en el hilo. asistente queda
    // "director" siempre -- el usuario también le habla al Director.
    setMensajesEquipo((prev) => [
      ...prev,
      { id: `tmp-${Date.now()}`, user_id: "", asistente: "director", tipo_evento: "mensaje_usuario", contenido: { texto: resto, asistenteCitado }, origen_id: null, creado_en: new Date().toISOString() },
    ]);

    try {
      const res = await fetch("/api/equipo/mensajes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensaje: resto, asistente: asistenteCitado }),
      });
      const data = await res.json();
      if (res.ok && data.mensaje) {
        setMensajesEquipo((prev) => [...prev, data.mensaje as MensajeEquipo]);
      } else {
        setError({ mensaje: data.error || "No se pudo enviar el mensaje." });
      }
    } catch {
      setError({ mensaje: "No se pudo conectar con el equipo." });
    } finally {
      setEnviandoMensaje(false);
    }
  };

  if (puedeUsarAutopiloto === null) return <CargandoQuiubot mensaje="Verificando tu acceso" />;

  if (puedeUsarAutopiloto === false) {
    return (
      <div style={{ minHeight: "100vh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "2rem" }}>
        <div style={{ maxWidth: 480, width: "100%", background: "#fff", borderRadius: 20, border: "1px solid #e8e8e6", padding: "2.5rem 2rem", textAlign: "center", boxShadow: "0 8px 30px rgba(0,0,0,0.06)" }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: "#1a1a1a", margin: "0 0 10px" }}>Autopiloto — Próximamente</p>
          <button onClick={() => router.push("/")} style={{ display: "block", width: "100%", padding: "13px", borderRadius: 10, background: "#534AB7", color: "#fff", fontSize: 14, fontWeight: 700, border: "none", cursor: "pointer" }}>
            Volver al panel principal
          </button>
        </div>
      </div>
    );
  }

  const estadoPorAsistente = construirEstadoPorAsistente(propuestas);

  const sinFiltroOAsistente = (p: PropuestaUnificada) => !filtro || asistenteDeMensaje(p) === filtro;
  const problemasCampana = propuestas.filter((p) => p.origen === "problema_campana").filter(sinFiltroOAsistente);
  const propuestasFiltradas = propuestas.filter((p) => p.origen !== "problema_campana").filter(sinFiltroOAsistente);

  const idsPendientes = new Set(propuestas.map((p) => p.id));
  const historialFiltrado = historial.propuestas.filter((p) => !idsPendientes.has(p.id)).filter((p) => !filtro || asistenteDeMensaje(p) === filtro);

  const eventosBitacora = historial.bitacora;
  const eventosMeta = !filtro || filtro === "director" ? eventosBitacora.filter((e) => e.tipo_evento === "meta_creada") : [];
  const eventosAutopiloto = !filtro || filtro === "director" ? eventosBitacora.filter((e) => e.tipo_evento === "autopiloto_pausado" || e.tipo_evento === "autopiloto_reanudado") : [];
  const revisionMasReciente = !filtro || filtro === "director" ? eventosBitacora.find((e) => e.tipo_evento === "director_revision" && revisionNoPropusoNada(e.detalle as { evaluaciones?: { propuso?: boolean }[] })) : undefined;

  // Corrección de voz (Fase 2): los mensajes de mensajes_equipo
  // (eventos automáticos + conversación, siempre en voz del Director)
  // se intercalan por fecha con el resto del historial -- ya no es una
  // sección aparte al final. Filtrado: un evento automático es del
  // asistente que lo generó; una conversación es "del Director" si no
  // citó a nadie, o del asistente citado si lo hizo.
  const mensajesEquipoFiltrados = mensajesEquipo.filter((m) => {
    if (!filtro) return true;
    if (m.tipo_evento === "mensaje_usuario" || m.tipo_evento === "respuesta") {
      return filtro === "director" ? !m.contenido.asistenteCitado : m.contenido.asistenteCitado === filtro;
    }
    return m.asistente === filtro;
  });

  // Orden cronológico real, lo más nuevo abajo -- ya no hay un bloque
  // de "pendientes siempre al final sin importar fecha": todo entra al
  // mismo hilo por fecha real (decisión explícita, reemplaza la regla
  // anterior). ChatShell se encarga del scroll/paginado/separadores.
  const { sueltas, grupos } = agruparPropuestasPorTipo(propuestasFiltradas);

  const itemsPendientesSueltos: ItemChat[] = sueltas.map((p) => ({ id: `pend-${p.id}`, creadoEn: p.creadoEn, render: () => renderPendiente(p) }));
  const itemsGrupos: ItemChat[] = grupos.flatMap((g): ItemChat[] => {
    if (mostrarGrupo === g.accion) {
      return g.propuestas.map((p) => ({ id: `pend-${p.id}`, creadoEn: p.creadoEn, render: () => renderPendiente(p) }));
    }
    const masReciente = g.propuestas.reduce((max, p) => (p.creadoEn > max ? p.creadoEn : max), g.propuestas[0].creadoEn);
    return [
      {
        id: `grupo-${g.accion}`,
        creadoEn: masReciente,
        render: () => (
          <TarjetaGrupoPropuestas
            grupo={g}
            procesandoLote={procesandoLote}
            onRevisarUnaPorUna={() => setMostrarGrupo(g.accion)}
            onAprobarTodas={async () => {
              setProcesandoLote(true);
              await aprobarEnLote(g.propuestas);
              setProcesandoLote(false);
            }}
          />
        ),
      },
    ];
  });

  const itemsHistorial: ItemChat[] = [
    ...historialFiltrado.map((p) => ({ id: `hist-${p.id}`, creadoEn: p.decidido_en || p.creadoEn, render: () => renderDecidida(p) })),
    ...mensajesEquipoFiltrados.map((m) => ({ id: `meq-${m.id}`, creadoEn: m.creado_en, render: () => renderMensajeEquipo(m) })),
    ...eventosMeta.map((e) => ({ id: `meta-${e.id}`, creadoEn: e.creado_en, render: () => renderDirectorSolo(narracionMetaCreada(e.detalle as Parameters<typeof narracionMetaCreada>[0])) })),
    ...eventosAutopiloto.map((e) => ({ id: `auto-${e.id}`, creadoEn: e.creado_en, render: () => renderDirectorSolo(e.tipo_evento === "autopiloto_pausado" ? TEXTO_AUTOPILOTO_PAUSADO : TEXTO_AUTOPILOTO_REANUDADO) })),
    ...(revisionMasReciente
      ? [
          {
            id: `revision-${revisionMasReciente.id}`,
            creadoEn: revisionMasReciente.creado_en,
            render: () =>
              renderDirectorSolo(
                narracionRevisionSinPropuestas(
                  (revisionMasReciente.detalle as { avance_resumen?: { conversiones: number } })?.avance_resumen ?? null,
                  cantidadObjetivoPorMeta[revisionMasReciente.meta_id ?? ""] ?? null
                )
              ),
          },
        ]
      : []),
    ...itemsPendientesSueltos,
    ...itemsGrupos,
  ];

  const recienDecididasFiltradas = recienDecididas.filter((r) => !filtro || asistenteDeMensaje(r.propuesta) === filtro);
  const itemsRecienDecididas: ItemChat[] = recienDecididasFiltradas.map((r, i) => ({
    id: `reciente-${i}`,
    creadoEn: r.creadoEn,
    render: () => (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {renderUsuario(r.etiqueta)}
        <div style={{ display: "flex", gap: 10 }}>
          <EsferaAsistente asistente="director" estado="normal" tamano={40} />
          <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "calc(100% - 50px)" }}>
            <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{r.confirmacion.texto}</p>
            {r.confirmacion.avisoReconectarMeta && (
              <Link href="/?tab=integraciones" style={{ display: "inline-block", marginTop: 4, color: "#534AB7", fontWeight: 600, fontSize: 12.5, textDecoration: "underline" }}>
                Reconectar mi cuenta de Meta
              </Link>
            )}
          </div>
        </div>
      </div>
    ),
  }));

  const todosLosItems = [...itemsHistorial, ...itemsRecienDecididas].sort((a, b) => (a.creadoEn < b.creadoEn ? -1 : 1));
  const idsPendientesEnItems = new Set([...itemsPendientesSueltos, ...itemsGrupos].map((it) => it.id));
  const itemsAMostrar = soloPendientes ? todosLosItems.filter((it) => idsPendientesEnItems.has(it.id)) : todosLosItems;

  const sinPendientes = propuestas.length === 0;
  const ultimaDecidida = historial.propuestas[0];
  const totalPendientesVisibles = itemsPendientesSueltos.length + grupos.length;

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
        <div style={{ background: "#534AB7", color: "#fff", borderRadius: "16px 16px 4px 16px", padding: "8px 14px", fontSize: 13, fontWeight: 600, maxWidth: "80%" }}>{texto}</div>
      </div>
    );
  }

  function renderPendiente(p: PropuestaUnificada) {
    return (
      <TarjetaPropuesta
        propuesta={p}
        procesando={procesandoId === p.id}
        ajustando={ajustandoId === p.id}
        porcentajeAjuste={porcentajeAjuste}
        onCambiarPorcentajeAjuste={setPorcentajeAjuste}
        onAprobar={() => aprobar(p)}
        onIniciarAjuste={() => {
          setAjustandoId(p.id);
          setPorcentajeAjuste("20");
        }}
        onConfirmarAjustePorcentaje={() => confirmarAjuste(p, { ajuste_porcentaje: Number(porcentajeAjuste) })}
        onConfirmarAjusteCreativos={(editados) => confirmarAjuste(p, { creativos: editados })}
        onCancelarAjuste={() => setAjustandoId(null)}
        onRechazar={() => rechazar(p)}
        onListoSubPaso={cargarTodo}
        nombreCampana={nombreCampanaDe(p)}
      />
    );
  }

  function renderDecidida(p: PropuestaConDecision) {
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
      const resultado = p.resultado as { presupuesto_antes?: number; presupuesto_despues?: number; anuncios_creados?: unknown[] } | null;
      confirmacion = {
        texto: confirmacionExito(p.accion as AccionPropuesta, { campanaNombre, presupuestoAntes: resultado?.presupuesto_antes, presupuestoDespues: resultado?.presupuesto_despues, cantidadAnuncios: resultado?.anuncios_creados?.length }),
      };
    } else if (p.estado === "fallida") {
      etiquetaUsuario = "Sí, adelante";
      const resultado = p.resultado as { error?: string; motivo?: string } | null;
      confirmacion = confirmacionFalla(asistenteDeMensaje(p), resultado?.error || "No se pudo completar.", resultado?.motivo);
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ display: "flex", gap: 10 }}>
          <EsferaAsistente asistente="director" estado="normal" tamano={40} />
          <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "calc(100% - 50px)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <EsferaAsistente asistente={asistenteDeMensaje(p)} estado="normal" tamano={22} />
              <span style={{ fontSize: 13, color: "#1a1a1a" }}>{p.accion ? leadInPropuesta(p.accion as AccionPropuesta, campanaNombre) : p.titulo}</span>
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
                  <Link href="/?tab=integraciones" style={{ display: "inline-block", marginTop: 4, color: "#534AB7", fontWeight: 600, fontSize: 12.5, textDecoration: "underline" }}>
                    Reconectar mi cuenta de Meta
                  </Link>
                </>
              )}
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

  function renderMensajeEquipo(m: MensajeEquipo) {
    if (m.tipo_evento === "mensaje_usuario") return renderUsuario(m.contenido.texto);

    // Corrección de voz: el que habla con el usuario es SIEMPRE el
    // Director -- un evento automático cita al asistente que lo generó
    // (m.asistente), una respuesta libre cita a quien el usuario
    // mencionó con @ (contenido.asistenteCitado), si a alguien.
    const esEvento = m.tipo_evento === "reporte_diario" || m.tipo_evento === "creativos_listos";
    const citado = esEvento ? (m.asistente as Asistente) : (m.contenido.asistenteCitado as Asistente | undefined);

    return (
      <div style={{ display: "flex", gap: 10 }}>
        <EsferaAsistente asistente="director" estado="normal" tamano={40} />
        <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: "4px 16px 16px 16px", padding: "10px 14px", maxWidth: "calc(100% - 50px)" }}>
          {citado && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("quiubot:abrir-chat-equipo", { detail: { chat: citado } }))}
              style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, background: "none", border: "none", padding: 0, cursor: "pointer" }}
              aria-label={`Hablar con ${NOMBRE_ASISTENTE[citado]}`}
            >
              <EsferaAsistente asistente={citado as AsistenteId} estado="normal" tamano={22} />
              <span style={{ fontSize: 11, fontWeight: 700, color: "#534AB7", textTransform: "uppercase", letterSpacing: "0.02em" }}>{NOMBRE_ASISTENTE[citado]}</span>
            </button>
          )}
          <p style={{ fontSize: 13.5, color: "#1a1a1a", margin: 0, lineHeight: 1.5 }}>{m.contenido.texto}</p>
          {m.contenido.datos && m.contenido.datos.length > 0 && (
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              {m.contenido.datos.map((d, i) => (
                <div key={i} style={{ flex: 1, background: "#F8F8F6", borderRadius: 10, padding: "7px 8px" }}>
                  <small style={{ display: "block", fontSize: 11, color: "#666" }}>{d.etiqueta}</small>
                  <b style={{ fontSize: 14 }}>{d.valor}</b>
                </div>
              ))}
            </div>
          )}
          {m.contenido.miniaturas && m.contenido.miniaturas.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {m.contenido.miniaturas.map((url, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={url} alt="" style={{ width: 70, height: 70, objectFit: "cover", borderRadius: 8 }} />
              ))}
            </div>
          )}
          {m.contenido.acciones && m.contenido.acciones.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
              {m.contenido.acciones.map((a, i) =>
                a.tipo === "link" && a.href ? (
                  <a key={i} href={a.href} style={{ border: "1.5px solid #534AB7", background: "#EFEDFB", borderRadius: 999, padding: "6px 11px", fontSize: 12, fontWeight: 700, color: "#534AB7", textDecoration: "none" }}>
                    {a.label}
                  </a>
                ) : (
                  <button
                    key={i}
                    onClick={() => router.push(a.tipo === "crear_meta" ? "/metas/crear" : "/")}
                    style={{ border: "1.5px solid #E9E7EE", background: "#fff", borderRadius: 999, padding: "6px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", color: "#1B1A22" }}
                  >
                    {a.label}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  const recordatorioMostrado = recordatorio;

  return (
    <ProveedorEsferas>
      {/* height:100dvh (no 100vh) + flex column fija -- la página ya no
          crece: el encabezado es flexShrink:0, ChatShell toma el resto
          con su propio scroll. dvh además evita que el teclado del
          celular tape el campo de texto (el input es un hijo de flex
          normal, nunca position:fixed). */}
      <div style={{ height: "100dvh", background: "#f9f9f8", fontFamily: "system-ui, sans-serif", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, maxWidth: 720, width: "100%", margin: "0 auto" }}>
        <div style={{ padding: "14px 16px 0", flexShrink: 0 }}>
          <button onClick={() => router.push("/")} style={{ background: "none", border: "none", color: "#7F77DD", fontSize: 14, cursor: "pointer", marginBottom: 14, padding: 0 }}>
            ← Volver al panel principal
          </button>

          <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8 }}>
            <EsferaAsistente asistente="director" estado={estadoPorAsistente.director} tamano={56} />
            <div>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: "#1a1a1a", margin: 0 }}>Equipo</h1>
              <p style={{ fontSize: 13, color: "#666", margin: "2px 0 0" }}>Coordina a tu equipo y cuida tu meta</p>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 6, marginBottom: 10 }}>
            <button
              onClick={() => router.push("/equipo")}
              style={{ flexShrink: 0, padding: "6px 14px", borderRadius: 20, border: filtro ? "1px solid #ddd" : "1px solid #534AB7", background: filtro ? "#fff" : "#534AB7", color: filtro ? "#666" : "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}
            >
              Todos
            </button>
            {ASISTENTES_EQUIPO.map((a) => (
              <button
                key={a}
                onClick={() => router.push(`/equipo?asistente=${a}`)}
                style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", width: 64, background: "none", border: "none", cursor: "pointer", padding: 0 }}
                aria-label={`Filtrar por ${NOMBRE_ASISTENTE[a]}`}
              >
                <EsferaAsistente asistente={a} estado={estadoPorAsistente[a]} tamano={40} />
                <span style={{ fontSize: 10.5, color: filtro === a ? "#534AB7" : "#888", fontWeight: filtro === a ? 700 : 500, marginTop: 2 }}>{NOMBRE_ASISTENTE[a]}</span>
              </button>
            ))}
          </div>

          {recordatorioMostrado &&
            (!filtro || filtro === "director") &&
            (() => {
              const colores =
                recordatorioMostrado.etapa === "vencido" ? { fondo: "#FEF2F2", borde: "#FCDADA", texto: "#B3261E" } : recordatorioMostrado.etapa === "recien_pagado" ? { fondo: "#F0FDF4", borde: "#BBF7D0", texto: "#15803D" } : { fondo: "#FFF8E1", borde: "#FCE8A8", texto: "#92600A" };
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
              const puedeRenovarDirecto = !!recordatorioMostrado.plan && !!recordatorioMostrado.ciclo;
              return (
                <div style={{ background: colores.fondo, border: `1px solid ${colores.borde}`, borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
                  <p style={{ fontSize: 13, color: colores.texto, margin: necesitaBotones ? "0 0 10px" : 0, lineHeight: 1.5, fontWeight: 600 }}>{mensaje}</p>
                  {necesitaBotones && (
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      {puedeRenovarDirecto && (
                        <button onClick={renovarAhora} disabled={renovando} style={{ padding: "7px 14px", borderRadius: 8, background: colores.texto, color: "#fff", border: "none", fontSize: 12.5, fontWeight: 700, cursor: renovando ? "not-allowed" : "pointer" }}>
                          {renovando ? "..." : "Renovar ahora"}
                        </button>
                      )}
                      <button onClick={() => router.push("/billing")} style={{ padding: "7px 14px", borderRadius: 8, background: "#fff", color: colores.texto, border: `1px solid ${colores.texto}`, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
                        Ver planes
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}

          {problemasCampana.length > 0 && (
            <div style={{ background: "#FEF2F2", border: "1px solid #FCDADA", borderRadius: 14, padding: "14px 16px", marginBottom: 10 }}>
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
            <div style={{ background: "#FEF0EF", color: "#B3261E", padding: "10px 14px", borderRadius: 10, fontSize: 13.5, marginBottom: 10 }}>
              {error.mensaje}
              {error.paso && <span style={{ display: "block", fontSize: 12, opacity: 0.8, marginTop: 2 }}>Paso: {error.paso}</span>}
            </div>
          )}

          {sinPendientes && !filtro && (
            <div style={{ background: "#fff", border: "1px solid #ece9f9", borderRadius: 16, padding: "1rem 1.25rem", marginBottom: 10 }}>
              <p style={{ fontSize: 14, color: "#1a1a1a", margin: 0, fontWeight: 600 }}>Todo en orden por ahora 👌</p>
              {ultimaDecidida && <p style={{ fontSize: 13, color: "#666", margin: "4px 0 0" }}>Lo último que hizo el equipo: {ultimaDecidida.titulo}</p>}
            </div>
          )}
        </div>

        <ChatShell
          items={itemsAMostrar}
          cargando={cargando}
          escribiendo={enviandoMensaje}
          indicadorEscribiendo={<IndicadorEscribiendo asistente="director" />}
          textoVacio="Todavía no hay nada en el chat del equipo."
          senalIrAlFondo={senalIrAlFondo}
          pildora={
            soloPendientes
              ? {
                  texto: `Mostrando ${totalPendientesVisibles} pendiente${totalPendientesVisibles === 1 ? "" : "s"} · Ver todo`,
                  onClick: () => {
                    setSoloPendientes(false);
                    setSenalIrAlFondo((v) => v + 1);
                  },
                }
              : totalPendientesVisibles > 0
              ? {
                  texto: `Tienes ${totalPendientesVisibles} pendiente${totalPendientesVisibles === 1 ? "" : "s"}`,
                  onClick: () => setSoloPendientes(true),
                }
              : null
          }
          pie={
            requiereApiKey ? (
              <p style={{ padding: "10px 16px", fontSize: 12.5, color: "#999", textAlign: "center", margin: 0 }}>Conecta tu cuenta de OpenAI en Integraciones para escribirle al equipo.</p>
            ) : (
              <div style={{ display: "flex", gap: 8, padding: "10px 14px", borderTop: "1px solid #eee", paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}>
                <input
                  value={texto}
                  onChange={(e) => setTexto(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && enviarMensaje()}
                  placeholder="Escribe al equipo o menciona con @..."
                  disabled={enviandoMensaje}
                  style={{ flex: 1, background: "#fff", border: "1.5px solid #E9E7EE", borderRadius: 999, padding: "11px 16px", fontSize: 15, outline: "none" }}
                />
                <button
                  onClick={enviarMensaje}
                  disabled={enviandoMensaje || !texto.trim()}
                  style={{ width: 44, height: 44, borderRadius: "50%", background: "#534AB7", color: "#fff", border: "none", fontSize: 18, cursor: enviandoMensaje || !texto.trim() ? "default" : "pointer", opacity: enviandoMensaje || !texto.trim() ? 0.6 : 1, flexShrink: 0 }}
                >
                  ➤
                </button>
              </div>
            )
          }
        />
        </div>
      </div>
    </ProveedorEsferas>
  );
}
